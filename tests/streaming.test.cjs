const test = require('node:test');
const assert = require('node:assert/strict');
const { createStreamController, allocateEncodings } = require('../public/streaming.js');
const profile = { fps: 60, bitrate: 4_000_000, motion: true };

function fakeCall() {
  const listeners = new Map();
  let reason = 'none', version = 0;
  const applied = [], transactionErrors = [];
  const sender = {
    track: { kind: 'video' },
    getParameters: () => ({ transactionId: String(++version), encodings: [{}] }),
    async setParameters(parameters) {
      if (parameters.transactionId !== String(version)) transactionErrors.push({ received: parameters.transactionId, expected: String(version) });
      applied.push(structuredClone(parameters));
    },
  };
  const pc = {
    connectionState: 'connected',
    getSenders: () => [sender],
    getStats: async () => new Map([['video', { type: 'outbound-rtp', kind: 'video', qualityLimitationReason: reason }]]),
    addEventListener: (event, listener) => listeners.set(event, listener),
    removeEventListener: (event, listener) => { if (listeners.get(event) === listener) listeners.delete(event); },
  };
  return { peerConnection: pc, sender, applied, listeners, transactionErrors, reason(value) { reason = value; } };
}

test('screen allocations stay within budget and preserve primary quality over thumbnails', () => {
  const streams = Array.from({ length: 8 }, (_, i) => ({ peerId: String(i), preference: i ? 'thumbnail' : 'primary', rung: 0 }));
  const result = allocateEncodings(profile, streams, 8_000_000);
  assert.ok([...result.values()].reduce((sum, value) => sum + value.maxBitrate, 0) <= 8_000_000);
  assert.ok(result.get('0').maxBitrate > result.get('1').maxBitrate);
  assert.equal(result.get('0').maxFramerate, 60);
  assert.equal(result.get('1').maxFramerate, 15);
  assert.ok([...allocateEncodings(profile, streams, 1).values()].reduce((sum, value) => sum + value.maxBitrate, 0) <= 1);
});

test('sustained pressure reduces quality and recovery needs six observed healthy samples', async () => {
  const controller = createStreamController({ sampleInterval: 0 });
  const call = fakeCall();
  await controller.add('a', call);
  call.reason('cpu');
  await controller.sample(); await controller.sample();
  assert.equal(call.applied.at(-1).encodings[0].scaleResolutionDownBy, 1);
  await controller.sample();
  assert.equal(call.applied.at(-1).encodings[0].scaleResolutionDownBy, 1.5);
  call.reason(undefined);
  for (let i = 0; i < 10; i++) await controller.sample();
  assert.equal(call.applied.at(-1).encodings[0].scaleResolutionDownBy, 1.5);
  call.reason('none');
  for (let i = 0; i < 5; i++) await controller.sample();
  assert.equal(call.applied.at(-1).encodings[0].scaleResolutionDownBy, 1.5);
  await controller.sample();
  assert.equal(call.applied.at(-1).encodings[0].scaleResolutionDownBy, 1);
  controller.stop();
});

test('preferences change only video parameters and unchanged refresh does not renegotiate', async () => {
  const controller = createStreamController({ sampleInterval: 0 });
  const call = fakeCall();
  let audioReads = 0, audioWrites = 0;
  const audio = {
    track: { kind: 'audio' },
    getParameters() { audioReads++; return { encodings: [{}] }; },
    async setParameters() { audioWrites++; },
  };
  call.peerConnection.getSenders = () => [call.sender, audio];
  await controller.add('a', call);
  await controller.refresh();
  assert.equal(call.applied.length, 1);
  await controller.setPreference('a', 'hidden');
  assert.equal(call.applied.at(-1).encodings[0].maxFramerate, 2);
  assert.ok(call.applied.at(-1).encodings[0].maxBitrate <= 120_000);
  assert.equal(audioReads, 0);
  assert.equal(audioWrites, 0);
  assert.deepEqual(call.transactionErrors, []);
  controller.stop();
});

test('concurrent preference changes serialize sender transactions and settle at latest target', async () => {
  const controller = createStreamController({ sampleInterval: 0 });
  const call = fakeCall();
  let release, active = 0, concurrentWrites = 0;
  const original = call.sender.setParameters;
  call.sender.setParameters = async parameters => {
    active++;
    if (active > 1) concurrentWrites++;
    if (!release) await new Promise(resolve => { release = resolve; });
    await original(parameters);
    active--;
  };
  const first = controller.add('a', call);
  await Promise.resolve();
  const second = controller.setPreference('a', 'thumbnail');
  const third = controller.setPreference('a', 'hidden');
  release();
  await Promise.all([first, second, third]);
  assert.equal(call.applied.at(-1).encodings[0].maxFramerate, 2);
  assert.equal(concurrentWrites, 0);
  assert.equal(active, 0);
  assert.deepEqual(call.transactionErrors, []);
  controller.stop();
});

test('removed and replaced calls cannot receive later queued settings or delete replacement', async () => {
  const controller = createStreamController({ sampleInterval: 0 });
  const old = fakeCall(), next = fakeCall();
  const pending = controller.add('a', old);
  const replaced = controller.add('a', next);
  await Promise.all([pending, replaced]);
  assert.equal(old.applied.length, 0);
  await controller.remove('a', old);
  await controller.setPreference('a', 'thumbnail');
  assert.equal(next.applied.at(-1).encodings[0].maxFramerate, 15);
  await controller.remove('a', next);
  await controller.refresh();
  assert.equal(next.listeners.size, 0);
  controller.stop();
});

test('unsupported degradation retries with fresh parameters and later failures remain contained', async () => {
  const controller = createStreamController({ sampleInterval: 0 });
  const call = fakeCall();
  const original = call.sender.setParameters;
  let rejected = false;
  call.sender.setParameters = async parameters => {
    if (parameters.degradationPreference) { rejected = true; throw new TypeError('Unsupported'); }
    await original(parameters);
  };
  await controller.add('a', call);
  assert.ok(rejected);
  assert.equal(call.applied.length, 1);
  assert.ok(!('degradationPreference' in call.applied[0]));
  assert.deepEqual(call.transactionErrors, []);
  call.sender.setParameters = async () => { throw new Error('Connection closed'); };
  await controller.setPreference('a', 'hidden');
  controller.stop();
});

test('removing a call during an in-flight update cancels its follow-up work', async () => {
  const controller = createStreamController({ sampleInterval: 0 });
  const call = fakeCall(), next = fakeCall();
  const original = call.sender.setParameters;
  let release, updates = 0;
  call.sender.setParameters = async parameters => {
    updates++;
    await new Promise(resolve => { release = resolve; });
    await original(parameters);
  };
  const pending = controller.add('a', call);
  await Promise.resolve();
  const preference = controller.setPreference('a', 'thumbnail');
  const replacement = controller.add('a', next);
  release();
  await Promise.all([pending, preference, replacement]);
  assert.equal(updates, 1);
  assert.equal(next.applied.at(-1).encodings[0].maxFramerate, 60);
  controller.stop();
});

test('empty negotiation parameters retry on connected state and sampling does not overlap', async () => {
  const controller = createStreamController({ sampleInterval: 0 });
  const call = fakeCall();
  const parameters = call.sender.getParameters;
  call.sender.getParameters = () => ({ encodings: [] });
  await controller.add('a', call);
  assert.equal(call.applied.length, 0);
  call.sender.getParameters = parameters;
  call.listeners.get('connectionstatechange')();
  await controller.refresh();
  assert.equal(call.applied.length, 1);
  let reads = 0, release;
  call.peerConnection.getStats = () => { reads++; return new Promise(resolve => { release = resolve; }); };
  const first = controller.sample();
  const second = controller.sample();
  assert.equal(reads, 1);
  release(new Map());
  await Promise.all([first, second]);
  controller.stop();
});

test('stop is reusable and cancels queued work', async () => {
  const controller = createStreamController({ sampleInterval: 0 });
  const old = fakeCall();
  const pending = controller.add('a', old);
  controller.stop();
  await pending;
  assert.equal(old.applied.length, 0);
  const next = fakeCall();
  await controller.add('b', next);
  assert.equal(next.applied.length, 1);
  controller.stop();
});


test('a rejected pending update does not hide concurrent writes or poison later queued updates', async () => {
  const controller = createStreamController({ sampleInterval: 0 });
  const call = fakeCall();
  const original = call.sender.setParameters;
  let release, active = 0, concurrentWrites = 0, writes = 0, failures = 0;
  call.sender.setParameters = async parameters => {
    writes++;
    active++;
    if (active > 1) concurrentWrites++;
    try {
      if (writes === 1) {
        await new Promise(resolve => { release = resolve; });
        failures++;
        throw new Error('Temporary encoder failure');
      }
      await original(parameters);
    } finally { active--; }
  };
  const first = controller.add('a', call);
  await Promise.resolve();
  const second = controller.setPreference('a', 'thumbnail');
  const third = controller.setPreference('a', 'hidden');
  release();
  await Promise.all([first, second, third]);
  assert.equal(failures, 1);
  assert.equal(writes, 2);
  assert.equal(concurrentWrites, 0);
  assert.equal(active, 0);
  assert.deepEqual(call.transactionErrors, []);
  assert.equal(call.applied.length, 1);
  assert.equal(call.applied[0].encodings[0].maxFramerate, 2);
  controller.stop();
});

test('preferH264 moves H.264 ahead of VP8 and keeps every codec', () => {
  const { preferH264 } = require('../public/streaming.js');
  const sdp = ['v=0', 'm=audio 9 UDP/TLS/RTP/SAVPF 111', 'a=rtpmap:111 opus/48000/2',
    'm=video 9 UDP/TLS/RTP/SAVPF 96 97 102 103 104',
    'a=rtpmap:96 VP8/90000', 'a=rtpmap:97 rtx/90000',
    'a=rtpmap:102 H264/90000', 'a=fmtp:102 profile-level-id=640c1f;packetization-mode=1',
    'a=rtpmap:103 H264/90000', 'a=fmtp:103 profile-level-id=42e01f;packetization-mode=1',
    'a=rtpmap:104 rtx/90000', ''].join('\r\n');
  const out = preferH264(sdp);
  assert.match(out, /m=video 9 UDP\/TLS\/RTP\/SAVPF 103 102 96 97 104\r\n/);
  assert.match(out, /m=audio 9 UDP\/TLS\/RTP\/SAVPF 111\r\n/);
  assert.equal(preferH264('m=video 9 X 96\r\na=rtpmap:96 VP8/90000\r\n'), 'm=video 9 X 96\r\na=rtpmap:96 VP8/90000\r\n');
  assert.equal(preferH264(undefined), undefined);
});
