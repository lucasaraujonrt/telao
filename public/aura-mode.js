window.TelaoAura = (() => {
  const titles = ['NPC premium', 'Presença de Wi-Fi fraco', 'Figurante com lore', 'Chegou sem pedir licença', 'Protagonista da fila', 'A entidade do Discord'];
  const roll = (seed, members) => {
    let state = seed >>> 0;
    const random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
    return members.slice(0, 32).map(name => {
      const score = Math.floor(random() * 110001) - 10000;
      const rank = Math.max(0, Math.min(titles.length - 1, Math.floor((score + 10000) / 110001 * titles.length)));
      return { name: String(name).slice(0, 24), score, title: titles[rank] };
    }).sort((a, b) => b.score - a.score);
  };
  const start = (root, result) => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timers = [];
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));
    const scene = document.createElement('section'); scene.className = 'aura-scene';
    scene.innerHTML = `<div class="aura-orbit aura-orbit-one"></div><div class="aura-orbit aura-orbit-two"></div>
      <div class="aura-figure"><svg viewBox="0 0 200 320" aria-hidden="true"><path d="M100 12a27 27 0 1 1 0 54 27 27 0 0 1 0-54ZM75 77Q100 65 125 77L151 93 176 173 159 181 130 122 132 187 145 296 116 300 101 211 86 300 56 296 69 187 70 122 41 181 24 173 49 93Z"/></svg></div>
      <div class="aura-caption"><span class="aura-eyebrow">A presença foi detectada</span><h2>CARREGANDO<br>AURA</h2><div class="aura-meter"><i></i></div><p>A fila sentiu um arrepio.</p></div>
      <div class="aura-result" hidden><span class="aura-eyebrow">O conselho da tropa decidiu</span><h2></h2><strong></strong><p></p><ol></ol><small>Pontos inventados. Ego real.</small></div>`;
    root.append(scene);
    if (reduced) scene.classList.add('aura-reduced');
    const figure = scene.querySelector('.aura-figure');
    if (!reduced) {
      for (let i = 0; i < 26; i++) {
        const particle = document.createElement('i'); particle.className = 'aura-spark';
        particle.style.setProperty('--x', `${(i * 37) % 100}%`);
        particle.style.setProperty('--delay', `${-(i % 9) * .41}s`);
        particle.style.setProperty('--speed', `${2 + (i % 5) * .3}s`);
        scene.append(particle);
      }
    }
    later(() => {
      scene.classList.add('aura-awakened');
      scene.querySelector('.aura-caption h2').textContent = 'EXPANSÃO DE DOMÍNIO';
      scene.querySelector('.aura-caption p').textContent = 'Até o matchmaking ficou em silêncio.';
      if (!reduced) for (let i = 0; i < 3; i++) {
        const ring = document.createElement('div'); ring.className = 'aura-shock'; ring.style.animationDelay = `${i * .35}s`; figure.append(ring);
      }
    }, 3500);
    later(() => {
      const rows = Array.isArray(result) ? result.filter(row => row && typeof row.name === 'string' && typeof row.title === 'string' && Number.isFinite(row.score)).slice(0, 32) : [];
      const winner = rows[0];
      if (!winner) return;
      scene.classList.add('aura-revealed');
      const panel = scene.querySelector('.aura-result'); panel.hidden = false;
      panel.querySelector('h2').textContent = winner.name.slice(0, 24);
      panel.querySelector('strong').textContent = `${winner.score >= 0 ? '+' : ''}${Math.round(winner.score).toLocaleString('pt-BR')} AURA`;
      panel.querySelector('p').textContent = winner.title.slice(0, 60);
      rows.slice(0, 6).forEach((row, i) => {
        const li = document.createElement('li'), name = document.createElement('span'), score = document.createElement('b');
        name.textContent = `${i === 0 ? '♛' : i + 1} ${row.name.slice(0, 24)}`;
        score.textContent = `${row.score >= 0 ? '+' : ''}${Math.round(row.score).toLocaleString('pt-BR')}`;
        li.append(name, score); panel.querySelector('ol').append(li);
      });
    }, 7000);
    return () => { timers.forEach(clearTimeout); scene.remove(); };
  };
  return { roll, start };
})();
