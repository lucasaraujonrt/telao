import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Toaster } from '@/components/ui/sonner'
import { useColorScheme } from '../hooks'
import { prefs } from '@/lib/storage'
import { NAME_LENGTH } from '../../room/protocol'
import type { RoomLink } from '../../room/link'
import { Miniature } from './Miniature'

const LEDE: Record<RoomLink['kind'], string> = {
  none: 'Cria a sala, manda o link no Discord e até quatro mostram a tela juntos.',
  room: 'Te chamaram pra uma sala. Escolhe um nome e entra.',
  invalid: 'Esse link não abre nenhuma sala. Pede outro no Discord ou cria uma nova.',
}

/** The home: a name and one button. With a room link the button joins it, but only when pressed. */
export function Home({ link, onSubmit }: { link: RoomLink; onSubmit: (name: string) => void }) {
  const theme = useColorScheme('system')
  const [name, setName] = useState(prefs.nick.get)
  const [error, setError] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const joining = link.kind === 'room'

  useEffect(() => {
    document.title = 'Telão'
    if (joining) button.current?.focus()
    else input.current?.focus()
  }, [joining])

  function submit(event: FormEvent) {
    event.preventDefault()
    const value = name.trim().slice(0, NAME_LENGTH)
    if (!value) { setError(true); input.current?.focus(); return }
    prefs.nick.set(value)
    onSubmit(value)
  }

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-page text-text md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[600px_minmax(0,1fr)] xl:grid-cols-[minmax(640px,44%)_minmax(0,1fr)]">
      <main className="relative z-10 flex min-h-svh flex-col justify-center px-6 py-16 md:px-16 max-md:min-h-0 max-md:pt-20 max-md:pb-10">
        <div className="w-full max-w-[520px]">
          <h1 className="t-display">Telão</h1>
          <p className="mt-4 max-w-[46ch] t-lede text-balance text-text-2">{LEDE[link.kind]}</p>
          <form onSubmit={submit} noValidate className="mt-10 flex gap-2 max-md:flex-col">
            <div className="min-w-0 flex-1">
              <label htmlFor="nick" className="sr-only">Seu nome</label>
              <Input
                id="nick"
                ref={input}
                value={name}
                maxLength={NAME_LENGTH}
                autoComplete="nickname"
                placeholder="Seu nome"
                aria-invalid={error || undefined}
                aria-describedby={error ? 'nick-error' : undefined}
                onChange={event => { setName(event.target.value); if (error) setError(false) }}
              />
              {error && <p id="nick-error" role="alert" className="mt-2 t-small text-danger">Coloca um nome pra entrar.</p>}
            </div>
            <Button ref={button} type="submit" size="lg">{joining ? 'Entrar na sala' : 'Criar sala'}</Button>
          </form>
        </div>
        <p className="mt-16 t-small text-text-2 md:absolute md:bottom-10 md:left-16 md:mt-0">da Tropa do Soca Fofo</p>
      </main>
      <div className="relative min-h-[260px] flex-1 overflow-hidden md:h-auto">
        {/* Runs off the right and bottom edges of the window: 24 px past the bottom at 1.3x. */}
        <div className="absolute top-0 left-6 [--mini-h:600px] md:top-[14svh] md:left-0 md:[--mini-h:calc(86svh/1.3+24px)]">
          <Miniature />
        </div>
      </div>
      <Toaster position="bottom-center" theme={theme} />
    </div>
  )
}
