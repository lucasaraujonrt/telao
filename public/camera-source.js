(function (root) {
  function createCameraSource({ raw, video, onTrack, createCanvas = () => document.createElement('canvas'), schedule = setInterval, cancel = clearInterval }) {
    let active = raw, processed = null, timer = null, disposed = false, effect = 'normal';
    let queue = Promise.resolve();
    let canvas, context, small, tiny;

    function clearDrawing() {
      if (timer !== null) cancel(timer);
      timer = null;
    }

    function draw() {
      context.save();
      context.filter = effect === 'mono' ? 'grayscale(1) contrast(1.2)' : effect === 'vhs' ? 'sepia(.4) saturate(1.5) contrast(1.1)' : effect === 'neon' ? 'hue-rotate(275deg) saturate(2.8) contrast(1.3)' : 'none';
      if (effect === 'pixel') {
        tiny.drawImage(video, 0, 0, 80, 60);
        context.imageSmoothingEnabled = false;
        context.drawImage(small, 0, 0, 640, 480);
      } else {
        context.imageSmoothingEnabled = true;
        context.drawImage(video, 0, 0, 640, 480);
      }
      context.restore();
      if (effect === 'vhs') {
        context.fillStyle = 'rgba(0,0,0,.18)';
        for (let y = 0; y < 480; y += 4) context.fillRect(0, y, 640, 1);
        context.fillStyle = 'white'; context.font = 'bold 20px monospace';
        context.fillText('REC ● TROPA CAM', 20, 32);
      }
    }

    function setEffect(value) {
      const nextEffect = ['normal', 'mono', 'vhs', 'neon', 'pixel'].includes(value) ? value : 'normal';
      const operation = queue.then(async () => {
        if (disposed || nextEffect === effect) return;
        if (nextEffect !== 'normal' && !canvas) {
          canvas = createCanvas(); canvas.width = 640; canvas.height = 480;
          context = canvas.getContext('2d', { alpha: false });
          small = createCanvas(); small.width = 80; small.height = 60;
          tiny = small.getContext('2d');
        }
        if (nextEffect !== 'normal' && processed) {
          effect = nextEffect;
          return;
        }
        let next = raw;
        const previousEffect = effect;
        try {
          if (nextEffect !== 'normal') {
            effect = nextEffect; draw();
            next = canvas.captureStream(24);
          }
          await onTrack(next.getVideoTracks()[0], next);
        } catch (error) {
          if (next !== raw) next.getTracks().forEach(track => track.stop());
          effect = previousEffect;
          throw error;
        }
        if (disposed) {
          if (next !== raw) next.getTracks().forEach(track => track.stop());
          return;
        }
        clearDrawing();
        processed?.getTracks().forEach(track => track.stop());
        processed = next === raw ? null : next;
        active = next; effect = nextEffect;
        if (processed) timer = schedule(draw, 1000 / 24);
      });
      queue = operation.catch(() => {});
      return operation;
    }

    function stop() {
      disposed = true; clearDrawing();
      processed?.getTracks().forEach(track => track.stop());
      processed = null;
    }

    return { setEffect, stop, getStream: () => active };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { createCameraSource };
  else root.TelaoCamera = { createCameraSource };
})(typeof globalThis !== 'undefined' ? globalThis : this);
