(() => {
  const currentScripts = [...document.scripts].map(script => ({ src: script.getAttribute('src'), text: script.textContent }));
  const signature = scripts => JSON.stringify(scripts.map(script => [script.src, script.text]));
  const initial = signature(currentScripts);
  let checking = false, pending = false, reloadAt = 0, lastPage = '';
  const notice = document.createElement('div');
  notice.setAttribute('role', 'status');
  notice.hidden = true;
  Object.assign(notice.style, { position: 'fixed', left: '12px', bottom: '12px', zIndex: '30', maxWidth: 'min(440px, calc(100vw - 24px))', padding: '12px 16px', background: '#1b1464', color: '#ece9ff', border: '1px solid #ff3fa4', borderRadius: '8px', font: '14px system-ui' });
  document.body.append(notice);
  const busy = () => updateCaptureBusy() || !!document.querySelector('.tile') || !!game || !!invite || !!mode || !!pipWin || !!document.querySelector('#enter input:focus');
  const applyWhenReady = () => {
    if (!pending) return;
    notice.hidden = false;
    if (busy()) { reloadAt = 0; notice.textContent = 'Novidades prontas. Atualização automática quando as transmissões e o jogo terminarem.'; return; }
    if (!reloadAt) reloadAt = Date.now() + 5000;
    const seconds = Math.max(0, Math.ceil((reloadAt - Date.now()) / 1000));
    notice.textContent = `Atualizando o Telão em ${seconds}s. Você volta para a mesma sala.`;
    if (seconds === 0) location.reload();
  };
  const check = async () => {
    if (checking || !navigator.onLine || document.visibilityState === 'hidden') return;
    checking = true;
    try {
      // no-cache revalidates, so an unchanged page costs a 304 instead of the whole file.
      const response = await fetch(location.pathname, { cache: 'no-cache' });
      if (!response.ok) return;
      const page = await response.text();
      if (page === lastPage) return;
      const next = new DOMParser().parseFromString(page, 'text/html');
      const scripts = [...next.scripts].map(script => ({ src: script.getAttribute('src'), text: script.textContent }));
      if (!scripts.some(script => script.src === 'live-updates.js')) return;
      const styles = [...next.head.querySelectorAll('style')];
      const present = [...document.head.querySelectorAll('style')];
      if (styles.length === present.length) styles.forEach((style, i) => {
        if (present[i].textContent !== style.textContent) present[i].textContent = style.textContent;
      });
      pending = signature(scripts) !== initial;
      if (!pending) { notice.hidden = true; reloadAt = 0; }
      applyWhenReady();
      lastPage = page;
    } catch {} finally { checking = false; }
  };
  setInterval(check, 15000);
  setInterval(applyWhenReady, 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  window.addEventListener('online', check);
})();
