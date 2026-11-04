const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createCameraSource } = require('../public/camera-source.js');

function setup(onTrack = async () => {}) {
  const output = { canvases: 0, drawings: 0, timers: new Set(), tracks: [] };
  const track = () => {
    const result = { stopped: false, stop() { this.stopped = true; } };
    output.tracks.push(result);
    return result;
  };
  const stream = value => ({ getVideoTracks: () => [value], getTracks: () => [value] });
  const raw = stream(track());
  const source = createCameraSource({
    raw, video: {}, onTrack,
    createCanvas() {
      output.canvases++;
      return {
        getContext: () => ({ save() {}, restore() {}, drawImage() { output.drawings++; }, fillRect() {}, fillText() {} }),
        captureStream: () => stream(track()),
      };
    },
    schedule(callback) { output.timers.add(callback); return callback; },
    cancel(callback) { output.timers.delete(callback); },
  });
  return { source, output, raw };
}

test('normal camera uses the original stream without allocating or drawing a canvas', async () => {
  const { source, output, raw } = setup();
  await source.setEffect('normal');
  assert.equal(source.getStream(), raw);
  assert.equal(output.canvases, 0);
  assert.equal(output.drawings, 0);
  assert.equal(output.timers.size, 0);
});

test('returning to normal stops the effect track and drawing without stopping the camera', async () => {
  const sent = [];
  const { source, output, raw } = setup(async (track, stream) => sent.push(stream));
  await source.setEffect('mono');
  const effectTrack = source.getStream().getVideoTracks()[0];
  assert.equal(output.timers.size, 1);
  await source.setEffect('neon');
  assert.equal(output.timers.size, 1);
  await source.setEffect('normal');
  assert.equal(source.getStream(), raw);
  assert.equal(effectTrack.stopped, true);
  assert.equal(raw.getVideoTracks()[0].stopped, false);
  assert.equal(output.timers.size, 0);
  assert.equal(sent.length, 2);
});

test('effect changes wait for track replacement and preserve their order', async () => {
  let release;
  const replaced = [];
  const { source, output, raw } = setup(async (track, stream) => {
    replaced.push(stream);
    if (replaced.length === 1) await new Promise(resolve => { release = resolve; });
  });
  const first = source.setEffect('pixel');
  const second = source.setEffect('normal');
  await Promise.resolve();
  assert.equal(replaced.length, 1);
  release();
  await Promise.all([first, second]);
  assert.equal(replaced[1], raw);
  assert.equal(output.timers.size, 0);
});

test('stopping during replacement disposes the new effect and never starts a drawing loop', async () => {
  let release;
  const { source, output } = setup(() => new Promise(resolve => { release = resolve; }));
  const pending = source.setEffect('mono');
  await Promise.resolve();
  source.stop(); release(); await pending;
  assert.equal(output.tracks[1].stopped, true);
  assert.equal(output.timers.size, 0);
  await source.setEffect('vhs');
  assert.equal(output.tracks.length, 2);
});

test('failed replacement releases the unused effect and allows a later retry', async () => {
  let fail = true;
  const { source, output, raw } = setup(async () => { if (fail) throw Error('replacement failed'); });
  await assert.rejects(source.setEffect('mono'), /replacement failed/);
  assert.equal(output.tracks[1].stopped, true);
  assert.equal(source.getStream(), raw);
  fail = false;
  await source.setEffect('mono');
  assert.notEqual(source.getStream(), raw);
  source.stop();
});

test('failed canvas capture can retry the same effect without leaving a drawing loop', async () => {
  let attempts = 0;
  const context = { save() {}, restore() {}, drawImage() {} };
  const raw = { getVideoTracks: () => [{}] };
  const processed = { getVideoTracks: () => [{}], getTracks: () => [] };
  const source = createCameraSource({
    raw, video: {}, onTrack: async () => {},
    createCanvas: () => ({
      getContext: () => context,
      captureStream() {
        if (++attempts === 1) throw Error('Capture unavailable');
        return processed;
      },
    }),
    schedule: () => 1, cancel: () => {},
  });
  await assert.rejects(source.setEffect('mono'), /Capture unavailable/);
  assert.equal(source.getStream(), raw);
  await source.setEffect('mono');
  assert.equal(attempts, 2);
  assert.equal(source.getStream(), processed);
  source.stop();
});
