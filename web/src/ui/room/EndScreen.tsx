import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useColorScheme } from '../hooks'

const COPY = {
  closed: { heading: 'Você saiu da sala', line: 'Abre o link de novo pra voltar.', again: 'Voltar pra sala' },
  full: { heading: 'A sala tá cheia', line: 'Já tem oito pessoas. Espera alguém sair e tenta de novo.', again: 'Tentar de novo' },
}

export function EndScreen({ reason, onAgain, onNewRoom }: { reason: 'closed' | 'full'; onAgain: () => void; onNewRoom: () => void }) {
  useColorScheme('system')
  const copy = COPY[reason]
  useEffect(() => { document.title = 'Telão' }, [])
  return (
    <div className="flex min-h-svh flex-col bg-page text-text">
      <header className="px-6 pt-6 t-heading md:px-16 md:pt-10">Telão</header>
      <main className="grid flex-1 place-items-center px-6 pb-24">
        <div className="grid max-w-[44ch] justify-items-center gap-2 text-center">
          <h1 className="t-title">{copy.heading}</h1>
          <p className="t-body text-text-2">{copy.line}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button autoFocus onClick={onAgain}>{copy.again}</Button>
            <Button variant="secondary" onClick={onNewRoom}>Criar outra sala</Button>
          </div>
        </div>
      </main>
    </div>
  )
}
