const { test } = require('node:test');
const assert = require('node:assert/strict');
const { network, runtime, until } = require('./helpers/room-runtime.cjs');

async function join(net, name, invitation, t) {
  const room = runtime(net, name, invitation);
  t.after(() => room.close());
  await until(() => room.state.state === 'connected', 'automatic room entry');
  return room;
}
async function mesh(...rooms) {
  rooms.forEach(room => room.tick(2000));
  await until(() => rooms.every(room => room.state.members.length === rooms.length - 1), 'connected member mesh');
}

test('opening the room link enters and receives an active stream without approval', async t => {
  const net = network(), host = await join(net, 'Lucas', null, t);
  await host.element('share').onclick();
  await until(() => host.tiles.has('me'), 'local capture');
  const guest = await join(net, 'Amigo', host.invitation, t);
  await mesh(host, guest);
  await until(() => guest.tiles.has(host.state.me), 'automatic screen reception');
  assert.equal(guest.invitation, host.invitation);
  assert.ok(net.calls.every(call => call.incoming.answered));
});

test('members exchange screens and cameras in both directions without identity handshakes', async t => {
  const net = network(), host = await join(net, 'Lucas', null, t);
  const guest = await join(net, 'Amigo', host.invitation, t);
  await mesh(host, guest);
  await host.element('share').onclick();
  await guest.element('share').onclick();
  await host.element('camera').onclick();
  await guest.element('camera').onclick();
  await until(() => host.tiles.has(guest.state.me) && guest.tiles.has(host.state.me) && host.tiles.has(guest.state.me + ':camera') && guest.tiles.has(host.state.me + ':camera'), 'two-way screens and cameras');
  assert.equal(net.calls.length, 4);
  assert.ok(net.calls.every(call => call.incoming.answered));
});

test('leaving a room closes peer media while other members keep streaming', async t => {
  const net = network(), host = await join(net, 'Lucas', null, t);
  const leaving = await join(net, 'Amigo', host.invitation, t);
  await mesh(host, leaving);
  const remaining = await join(net, 'Outro', host.invitation, t);
  await mesh(host, leaving, remaining);
  await leaving.element('share').onclick();
  await remaining.element('share').onclick();
  await until(() => remaining.tiles.has(leaving.state.me) && leaving.tiles.has(remaining.state.me), 'guest-to-guest streams');
  const leavingId = leaving.state.me;
  const stale = net.calls.find(call => call.sender === leavingId && call.receiver === remaining.state.me).incoming;
  leaving.close();
  await until(() => !remaining.state.members.includes(leavingId), 'peer cleanup');
  assert.equal(remaining.tiles.has(leavingId), false);
  assert.equal(remaining.tiles.has('me'), true);
  assert.ok(net.calls.filter(call => call.sender === leavingId || call.receiver === leavingId).every(call => call.outgoing.closed));
  stale.emit('stream', stale.stream);
  assert.equal(remaining.tiles.has(leavingId), false);
});

test('the remaining member reclaims the directory and new link visitors enter after creator departure', async t => {
  const net = network(), host = await join(net, 'Lucas', null, t);
  const guest = await join(net, 'Amigo', host.invitation, t);
  await mesh(host, guest);
  const invitation = host.invitation;
  host.close();
  guest.runTimeouts(2000);
  await until(() => guest.state.hosting, 'directory takeover');
  await until(() => net.peers.get('telao-' + invitation)?.connections.some(connection => connection.open), 'reconnected directory');
  const newcomer = await join(net, 'Outro', invitation, t);
  await mesh(guest, newcomer);
  assert.equal(guest.state.state, 'connected');
  assert.equal(newcomer.invitation, invitation);
});

test('viewer preferences still reduce secondary and hidden video and restore the primary screen', async t => {
  const net = network(), host = await join(net, 'Lucas', null, t);
  await host.element('share').onclick();
  await until(() => host.tiles.has('me'), 'local capture');
  const guest = await join(net, 'Amigo', host.invitation, t);
  await mesh(host, guest);
  await until(() => guest.tiles.has(host.state.me), 'automatic screen reception');
  const outgoing = net.calls.find(call => call.sender === host.state.me).outgoing;
  guest.sandbox.view.theater = true;
  guest.sandbox.view.focus = 'another-screen';
  guest.sandbox.updateStreamingPreferences();
  await until(() => outgoing.applied.at(-1)?.encodings[0].maxFramerate === 15, 'thumbnail video');
  guest.sandbox.document.visibilityState = 'hidden';
  guest.sandbox.updateStreamingPreferences();
  await until(() => outgoing.applied.at(-1)?.encodings[0].maxFramerate === 2, 'hidden video');
  guest.sandbox.document.visibilityState = 'visible';
  guest.sandbox.view.theater = false;
  guest.sandbox.updateStreamingPreferences();
  await until(() => outgoing.applied.at(-1)?.encodings[0].maxFramerate === 60, 'primary video restored');
});

test('a directory error releases ownership so the room recovers without refreshing or stopping capture', async t => {
  const net = network(), host = await join(net, 'Lucas', null, t);
  await host.element('share').onclick();
  await until(() => host.tiles.has('me'), 'local capture');
  const directoryId = 'telao-' + host.invitation;
  const previous = net.peers.get(directoryId);
  previous.emit('error', { type: 'network' });
  assert.equal(host.state.hosting, false);
  host.tick(2000);
  await until(() => host.state.hosting && net.peers.get(directoryId) !== previous, 'directory recovery');
  const guest = await join(net, 'Amigo', host.invitation, t);
  await mesh(host, guest);
  await until(() => guest.tiles.has(host.state.me), 'video after directory recovery');
  assert.equal(host.tiles.get('me').stream.getVideoTracks()[0].stopped, false);
});

test('the room capacity limits the mesh to eight people without adding approval', async t => {
  const net = network(), host = await join(net, 'Lucas', null, t);
  const members = [host];
  for (let i = 0; i < 7; i++) members.push(await join(net, 'Amigo ' + i, host.invitation, t));
  await mesh(...members);
  const overflow = runtime(net, 'Outro', host.invitation);
  t.after(() => overflow.close());
  await until(() => overflow.state.state === 'closed', 'capacity rejection');
  assert.match(overflow.element('lede').textContent, /oito pessoas/);
  assert.equal(overflow.sandbox.entered, undefined);
  assert.ok(members.every(member => member.state.members.length === 7));
});
