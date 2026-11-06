import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { newRoomCode, parseRoomCode, parseRoomLink } from '../room/link'
import { DISCARDED } from './copy'
import { Home } from './home/Home'
import { RoomScreen } from './room/RoomScreen'
import { joinNext } from './session'

export function Root() {
  useEffect(() => {
    if (!(document as Document & { wasDiscarded?: boolean }).wasDiscarded) return
    const timer = setTimeout(() => toast(DISCARDED, { duration: 8000 }), 1500)
    return () => clearTimeout(timer)
  }, [])
  return (
    <TooltipProvider delay={500} closeDelay={0}>
      <Outlet />
    </TooltipProvider>
  )
}

export function HomePage() {
  const navigate = useNavigate()
  const hash = useRouterState({ select: state => state.location.hash })
  const link = parseRoomLink(hash)
  return (
    <Home
      link={link.kind === 'invalid' ? link : { kind: 'none' }}
      onSubmit={name => {
        const code = newRoomCode()
        joinNext(code, name)
        void navigate({ to: '/sala/$code', params: { code }, hash: '' })
      }}
    />
  )
}

export function RoomPage({ code }: { code: string }) {
  const room = parseRoomCode(code)
  return room ? <RoomScreen key={room} code={room} /> : null
}
