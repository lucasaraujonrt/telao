const fs = require('node:fs');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const Streaming = require('../../public/streaming.js');
const Camera = require('../../public/camera-source.js');
const html = fs.readFileSync(require('node:path').join(__dirname, '../../public/index.html'), 'utf8');
const source = html.slice(html.indexOf('function start(code)'), html.indexOf('\nfunction enterRoom('));

class Element {
  constructor() {
    this.children = []; this.style = {}; this.dataset = {}; this.attributes = {};
    this.textContent = ''; this.value = ''; this.disabled = false;
    const classes = new Set();
    this.classList = {
      add: value => classes.add(value), remove: value => classes.delete(value), contains: value => classes.has(value),
      toggle(value, enabled = !classes.has(value)) { enabled ? classes.add(value) : classes.delete(value); },
    };
  }
  append(...children) { this.children.push(...children); }
  appendChild(child) { this.append(child); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(key, value) { this.attributes[key] = value; }
  querySelector(selector) { this.parts ||= new Map(); if (!this.parts.has(selector)) this.parts.set(selector, new Element()); return this.parts.get(selector); }
  hasAttribute(key) { return Object.hasOwn(this.attributes, key); }
  play() { return Promise.resolve(); }
  pause() {}
}

function mediaStream() {
  const track = { kind: 'video', stopped: false, stop() { this.stopped = true; }, getSettings: () => ({ displaySurface: 'window' }) };
  return { getTracks: () => [track], getVideoTracks: () => [track], getAudioTracks: () => [] };
}

class Connection extends EventEmitter {
  constructor(peer) { super(); this.peer = peer; this.open = false; this.closed = false; }
  send(message) {
    if (!this.open) return;
    queueMicrotask(() => { if (this.other.open) this.other.emit('data', structuredClone(message)); });
  }
  close() {
    if (this.closed) return;
    this.closed = true; this.open = false; this.emit('close'); this.other?.close();
  }
}

class MediaCall extends EventEmitter {
  constructor(peer, stream, metadata) {
    super(); this.peer = peer; this.stream = stream; this.metadata = metadata; this.closed = false; this.answered = false;
    const sender = { track: stream.getVideoTracks()[0], getParameters: () => ({ encodings: [{}] }), setParameters: async () => {}, replaceTrack: async next => { sender.track = next; } };
    this.applied = [];
    sender.setParameters = async parameters => { this.applied.push(structuredClone(parameters)); };
    this.peerConnection = { getSenders: () => [sender], getStats: async () => new Map(), addEventListener() {}, removeEventListener() {} };
  }
  answer() { this.answered = true; queueMicrotask(() => { if (!this.closed) this.emit('stream', this.stream); }); }
  close() { if (this.closed) return; this.closed = true; this.emit('close'); this.other?.close(); }
}

function network() {
  const peers = new Map(), calls = [], errors = [];
  let sequence = 0;
  class Peer extends EventEmitter {
    constructor(id = `peer-${++sequence}`) {
      super(); this.id = id; this.destroyed = false; this.connections = [];
      if (peers.has(id)) { queueMicrotask(() => this.emit('error', { type: 'unavailable-id' })); return; }
      peers.set(id, this); queueMicrotask(() => { if (!this.destroyed) this.emit('open', id); });
    }
    connect(id) {
      const outgoing = new Connection(id), incoming = new Connection(this.id);
      outgoing.other = incoming; incoming.other = outgoing; this.connections.push(outgoing);
      queueMicrotask(() => {
        const target = peers.get(id);
        if (!target) { this.emit('error', { type: 'peer-unavailable', message: id }); outgoing.close(); return; }
        target.connections.push(incoming); target.emit('connection', incoming);
        if (incoming.closed || outgoing.closed) return;
        incoming.open = outgoing.open = true; incoming.emit('open'); outgoing.emit('open');
      });
      return outgoing;
    }
    call(id, stream, options = {}) {
      const outgoing = new MediaCall(id, stream, options.metadata);
      const incoming = new MediaCall(this.id, stream, options.metadata);
      outgoing.other = incoming; incoming.other = outgoing;
      calls.push({ sender: this.id, receiver: id, outgoing, incoming });
      queueMicrotask(() => peers.get(id)?.emit('call', incoming));
      return outgoing;
    }
    destroy() { if (this.destroyed) return; this.destroyed = true; if (peers.get(this.id) === this) peers.delete(this.id); this.connections.forEach(connection => connection.close()); this.emit('close'); }
    reconnect() {}
  }
  return { Peer, peers, calls, errors };
}

async function until(predicate, label = 'condition') {
  for (let i = 0; i < 500; i++) {
    if (predicate()) return;
    await new Promise(setImmediate);
  }
  throw Error(`Did not reach ${label}`);
}

function runtime(net, name, invitation = null) {
  const elements = new Map(), tiles = new Map(), listeners = new Map(), intervals = new Set(), timeouts = new Set();
  const element = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  element('streamQuality').value = 'game'; element('cameraEffect').value = 'normal'; element('cameraMirror').checked = true;
  const sandbox = {
    console, crypto, TextEncoder, btoa, atob, structuredClone, PREFIX: 'telao-', MAX: 4, Peer: net.Peer,
    TelaoStreaming: { createStreamController: options => Streaming.createStreamController({ ...options, sampleInterval: 0 }) },
    TelaoCamera: Camera,
    $: element, myName: name, names: new Map(), notifOk: new Map(), awayIds: new Set(),
    game: null, invite: null, view: { theater: false, focus: null }, updateCaptureBusy() {}, updateStreamingPreferences() {},
    render() {}, rename() {}, broadcast() {}, sendTo() {}, nameOf() {}, toWire() {}, fromWire() {}, announce() {},
    hello: () => ({ t: 'hello', name, notif: false, away: false }), watch() {},
    store: { set() {} }, color: () => '#fff', member: () => new Element(),
    enterRoom(hash) { sandbox.entered = hash; },
    addTile(id, stream) { const tile = new Element(); tile.dataset.id = id; tile.stream = stream; if (id.endsWith(':camera')) tile.attributes['data-camera'] = true; tiles.set(id, tile); },
    dropTile: id => tiles.delete(id), tileOf: id => tiles.get(id),
    labelBtn(id, label) { element(id).setAttribute('aria-label', label); },
    toast() {}, alert() {},
    document: { visibilityState: 'visible', querySelectorAll: selector => [...tiles.values()].filter(tile => selector.includes(':not') ? !tile.dataset.id.endsWith(':camera') : selector.includes('[data-camera]') ? tile.dataset.id.endsWith(':camera') : true), createElement: () => new Element() },
    navigator: { mediaDevices: { getDisplayMedia: async () => mediaStream(), getUserMedia: async () => mediaStream() } },
    location: { pathname: '/', assign() {} },
    addEventListener(event, listener) { if (!listeners.has(event)) listeners.set(event, new Set()); listeners.get(event).add(listener); },
    removeEventListener(event, listener) { listeners.get(event)?.delete(listener); },
    setInterval(callback, ms) { const timer = { callback, ms }; intervals.add(timer); return timer; },
    clearInterval: timer => intervals.delete(timer),
    setTimeout(callback, ms) { const timer = { callback, ms }; timeouts.add(timer); return timer; },
    clearTimeout: timer => timeouts.delete(timer),
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox); vm.runInContext(source, sandbox, { filename: 'index-start.js' }); sandbox.start(invitation || 'open-room-123');
  return {
    sandbox, element, tiles, intervals, listeners,
    get state() { return sandbox.telaoDebug?.(); },
    get invitation() { return sandbox.entered; },
    tick(ms) { for (const timer of [...intervals]) if (timer.ms === ms) timer.callback(); },
    runTimeouts(maxMs = Infinity) { for (const timer of [...timeouts]) if (timer.ms <= maxMs) { timeouts.delete(timer); timer.callback(); } },
    close() { for (const listener of listeners.get('pagehide') || []) listener(); },
  };
}

module.exports = { network, runtime, until, mediaStream, Connection };
