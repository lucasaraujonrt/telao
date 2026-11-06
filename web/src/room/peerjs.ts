import { Peer } from 'peerjs'
import type { CreatePeer, SignalPeer } from './peer'

export const createPeerJs: CreatePeer = (id, options) => {
  const peer: SignalPeer = id ? new Peer(id, options) : new Peer(options)
  return peer
}
