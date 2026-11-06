import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { prefs } from '@/lib/storage'
import { newRoomCode, type RoomCode } from '../../room/link'
import { joinNext, takeJoin } from '../session'
import { Home } from '../home/Home'
import { EndScreen } from './EndScreen'
import { RoomView } from './RoomView'
import { useRoom } from './useRoom'

/** The room route: the home form first (the join button waits for a click), then the room. */
export function RoomScreen({ code }: { code: RoomCode }) {
  const [name, setName] = useState(() => takeJoin(code))
  if (name === null) return <Home link={{ kind: 'room', code }} onSubmit={setName} />
  return <JoinedRoom code={code} name={name} />
}

function JoinedRoom({ code, name }: { code: RoomCode; name: string }) {
  const navigate = useNavigate()
  const [attempt, setAttempt] = useState(0)
  // A retry keeps a name changed in the room.
  const [current, setCurrent] = useState(name)
  const { room, snapshot } = useRoom(code, current, prefs.away.get(), attempt)
  if (snapshot.status.kind === 'closed') {
    return (
      <EndScreen
        reason={snapshot.status.reason}
        onAgain={() => { setCurrent(snapshot.name); setAttempt(value => value + 1) }}
        onNewRoom={() => {
          const next = newRoomCode()
          joinNext(next, snapshot.name)
          void navigate({ to: '/sala/$code', params: { code: next } })
        }}
      />
    )
  }
  return <RoomView room={room} snapshot={snapshot} />
}
