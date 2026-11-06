import { z } from 'zod'

// Every data-channel message is parsed here; anything that does not match is dropped.
// Field rules match the prototype in public/index.html so both versions can share a room.

export const MAX_MEMBERS = 8
export const MAX_SHARERS = 4
export const NAME_LENGTH = 24
const PEER_ID = /^[A-Za-z0-9_-]{1,100}$/

export type PeerId = string

const message = <T extends string, S extends z.ZodRawShape>(t: T, shape: S) => z.object({ t: z.literal(t), ...shape })
const session = z.int()

/* Hub to member, on the connection to the directory peer. */
const Peers = message('peers', { ids: z.array(z.unknown()).max(MAX_MEMBERS) })
export const HubMessage = z.discriminatedUnion('t', [
  Peers,
  message('grant', {}),
  message('deny', {}),
  message('full', {}),
])
export type HubMessage = z.infer<typeof HubMessage>

// The prototype keeps the valid ids of a peers list and ignores the rest.
export const validPeerIds = (ids: readonly unknown[]): PeerId[] =>
  ids.filter((id): id is string => typeof id === 'string' && PEER_ID.test(id))

/* Member to hub. */
export const HubRequest = z.discriminatedUnion('t', [
  message('sharing', {}),
  message('stop', {}),
  message('want', {}),
])
export type HubRequest = z.infer<typeof HubRequest>

/* Member to member. The core owns the first five; feature modules subscribe to the rest. */
const Hello = message('hello', {
  name: z.string().transform(name => name.slice(0, NAME_LENGTH)),
  notif: z.unknown().transform(value => value === true),
  away: z.unknown().transform(value => value === true),
})
const CoreMessages = [
  Hello,
  message('member-ready', {}),
  message('stream-preference', { preference: z.enum(['primary', 'thumbnail', 'hidden']) }),
  message('stop', {}),
  message('camera-stop', { session }),
] as const

// Leaf values such as meme keys, items and emoji stay strings: each feature checks its own list.
const duel = <T extends string, S extends z.ZodRawShape>(t: T, shape: S) => message(t, { d: z.string(), ...shape })
const FeatureMessages = [
  message('troll', { kind: z.string(), target: z.string(), k: z.string().optional(), text: z.string().optional(), n: z.number().optional() }),
  message('meme', { k: z.string(), label: z.string().optional() }),
  message('combo', { ks: z.array(z.unknown()) }),
  message('react', { e: z.string(), target: z.string() }),
  message('throw', { item: z.string(), target: z.string(), x: z.number(), y: z.number() }),
  message('mode', { mode: z.string(), track: z.string(), reels: z.array(z.number()).optional(), cobra: z.number().optional(), aura: z.unknown().optional() }),
  message('game', { r: z.string(), seed: z.number() }),
  message('gscore', { r: z.string(), s: z.number(), done: z.boolean() }),
  duel('duel', {}),
  duel('duelok', {}),
  duel('duelno', { busy: z.boolean().optional() }),
  duel('dpos', { x: z.number(), y: z.number(), z: z.number(), yaw: z.number(), dead: z.boolean() }),
  duel('dshot', { e: z.array(z.number()).length(3) }),
  duel('dhit', { dmg: z.number(), head: z.boolean() }),
  duel('ddie', { head: z.boolean() }),
  duel('dleave', {}),
] as const

export const MemberMessage = z.discriminatedUnion('t', [...CoreMessages, ...FeatureMessages])
export type MemberMessage = z.infer<typeof MemberMessage>

const FeatureMessage = z.discriminatedUnion('t', [...FeatureMessages])
export type FeatureMessage = z.infer<typeof FeatureMessage>
export type FeatureType = FeatureMessage['t']
export type FeatureMessageOf<T extends FeatureType> = Extract<FeatureMessage, { t: T }>
const featureTypes = new Set<string>(FeatureMessages.map(schema => schema.shape.t.value))
export const isFeatureMessage = (message: MemberMessage): message is FeatureMessage => featureTypes.has(message.t)

/* Media call metadata: a camera call carries its session so stale calls lose to newer ones. */
export const CameraCallMetadata = z.object({ kind: z.literal('camera'), session })
export type CameraCallMetadata = z.infer<typeof CameraCallMetadata>

export function parse<T>(schema: z.ZodType<T>, data: unknown): T | null {
  const result = schema.safeParse(data)
  return result.success ? result.data : null
}
