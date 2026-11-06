import { useState, type FormEvent } from 'react'
import { Moon, Square, Undo2, Volume2, VolumeX, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import { Tip } from '../../ui/tip'
import type { Sounds, SoundState } from '../sounds'
import { addMeme, allMemes, hotkeyOf, resetBoard, toggleMeme } from './board'
import { cleanLabel, isCustom, keyFromLink, LABEL_LENGTH } from './catalog'
import type { MemesBoard } from './useMemes'

/** The side panel's Memes board: the room's sounds, your board, and editing it. */
export function MemesPanel({ memes, sounds, soundState, away, onClose }: {
  memes: MemesBoard
  sounds: Sounds
  soundState: SoundState
  away: boolean
  onClose?: () => void
}) {
  const [editing, setEditing] = useState(false)
  const { board, setBoard } = memes

  return (
    <section aria-label="Memes" className="flex h-full w-full flex-col bg-page">
      <div className="flex h-14 flex-none items-center justify-between gap-2 pr-2 pl-5">
        <h2 className="t-heading">Memes</h2>
        <div className="flex items-center gap-1">
          {!away && (
            <Button variant="ghost" size="sm" aria-pressed={editing} onClick={() => setEditing(!editing)}>
              {editing ? 'Pronto' : 'Editar'}
            </Button>
          )}
          {onClose && (
            <Tip label="Fechar" shortcut="B">
              <Button variant="icon" size="icon" aria-label="Fechar memes" onClick={onClose}><X /></Button>
            </Tip>
          )}
        </div>
      </div>

      {away ? (
        <div className="grid flex-1 place-content-center justify-items-center gap-2 px-8 text-center">
          <Moon className="size-5 text-text-2" strokeWidth={1.75} />
          <p className="t-body text-text-2">Você está ausente. Memes, arremessos e reações ficam de fora até você voltar.</p>
        </div>
      ) : (
        <>
          <SoundRow sounds={sounds} state={soundState} />
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            <p className="px-2 pb-3 t-small text-text-2">
              {editing
                ? 'Clica num meme pra esconder ou apagar.'
                : 'Toca pra sala toda. Mouse em cima de um meme + Q, W, E ou R fixa a tecla.'}
            </p>
            <ul className="grid grid-cols-2 gap-1.5" role="list">
              {allMemes(board).filter(([key]) => editing || !board.hidden.has(key)).map(([key, label]) => {
                const hidden = board.hidden.has(key)
                const hotkey = hotkeyOf(board, key)
                return (
                  <li key={key} className="min-w-0">
                    <button
                      type="button"
                      disabled={!editing && memes.cooling}
                      title={editing ? (hidden ? 'Mostrar de novo' : isCustom(key) ? 'Apagar' : 'Esconder') : label}
                      className={cn(
                        'press flex h-10 w-full min-w-0 items-center gap-2 rounded-md border border-hairline bg-surface px-3 text-left t-small text-text shadow-1 transition-colors duration-160 hover:bg-surface-2 disabled:text-text-3',
                        memes.flash === key && 'border-accent-blue bg-accent-soft',
                        editing && hidden && 'text-text-3 line-through',
                      )}
                      onPointerEnter={() => { if (!editing) memes.hovered.current = key }}
                      onPointerLeave={() => { if (memes.hovered.current === key) memes.hovered.current = null }}
                      onClick={() => editing ? setBoard(toggleMeme(board, key)) : memes.fire(key)}
                    >
                      <span className="min-w-0 flex-1 truncate">{label}</span>
                      {editing
                        ? (hidden ? <Undo2 className="size-3.5 flex-none text-text-2" /> : <X className="size-3.5 flex-none text-text-2" />)
                        : hotkey && <kbd className="flex-none rounded-[4px] bg-fill px-1.5 t-micro text-text-2">{hotkey.toUpperCase()}</kbd>}
                    </button>
                  </li>
                )
              })}
            </ul>
            {editing && <AddMeme onAdd={(key, label) => setBoard(addMeme(board, key, label))} onReset={() => setBoard(resetBoard(board))} />}
          </div>
        </>
      )}
    </section>
  )
}

function SoundRow({ sounds, state }: { sounds: Sounds; state: SoundState }) {
  const percent = Math.round(state.level * 100)
  const label = state.on ? 'Desligar os sons da sala' : 'Ligar os sons da sala'
  return (
    <div className="grid flex-none gap-1 px-3 pb-3">
      <div className="flex items-center gap-1 rounded-md bg-surface-2 p-1 pr-3">
        <Tip label={label}>
          <Button variant="icon" size="icon" aria-label={label} aria-pressed={state.on} onClick={() => { sounds.setOn(!state.on); toast(state.on ? 'Sons da sala desligados.' : 'Sons da sala ligados.') }}>
            {state.on ? <Volume2 /> : <VolumeX />}
          </Button>
        </Tip>
        <Tip label="Parar os memes tocando agora">
          <Button variant="icon" size="icon" aria-label="Parar os memes tocando agora" onClick={sounds.hush}><Square className="size-4!" /></Button>
        </Tip>
        <Slider
          aria-label="Volume dos memes"
          min={0}
          max={100}
          value={[percent]}
          onValueChange={value => sounds.setLevel((Array.isArray(value) ? value[0] : value) / 100)}
          className="mx-2 flex-1"
        />
        <span className="w-9 text-right t-small tnum text-text-2">{percent}%</span>
      </div>
      {!state.on && <p className="px-2 t-small text-text-2">Os sons começam desligados. Liga aqui pra ouvir os memes.</p>}
      {state.on && state.deaf && <p className="px-2 t-small text-text-2">Tudo mutado: os memes também.</p>}
    </div>
  )
}

function AddMeme({ onAdd, onReset }: { onAdd: (key: string, label: string) => void; onReset: () => void }) {
  const [label, setLabel] = useState('')
  const [link, setLink] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const key = keyFromLink(link), name = cleanLabel(label)
    if (!key) { toast('Usa o link .mp3 do myinstants (botão direito em “Download MP3”).'); return }
    if (!name) { toast('Dá um nome pro meme.'); return }
    onAdd(key, name)
    setLabel(''); setLink('')
    toast(`${name} adicionado.`)
  }
  return (
    <form className="mt-4 grid gap-2 border-t border-hairline px-1 pt-4" onSubmit={submit}>
      <p className="px-1 t-small text-text-2">No myinstants, clica com o botão direito em “Download MP3”, copia o link e cola aqui.</p>
      <Input value={label} onChange={event => setLabel(event.target.value)} placeholder="Nome do meme" maxLength={LABEL_LENGTH} aria-label="Nome do meme" />
      <Input value={link} onChange={event => setLink(event.target.value)} placeholder="https://www.myinstants.com/media/sounds/….mp3" aria-label="Link do MP3" inputMode="url" />
      <Button type="submit">Adicionar meme</Button>
      <Button type="button" variant="ghost" onClick={onReset}>Voltar pros memes padrão</Button>
    </form>
  )
}
