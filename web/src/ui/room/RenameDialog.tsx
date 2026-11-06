import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { NAME_LENGTH } from '../../room/protocol'

export function RenameDialog({ open, name, onOpenChange, onSave }: {
  open: boolean
  name: string
  onOpenChange: (open: boolean) => void
  onSave: (name: string) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        {open && <RenameForm name={name} onSave={onSave} />}
      </DialogContent>
    </Dialog>
  )
}

function RenameForm({ name, onSave }: { name: string; onSave: (name: string) => void }) {
  const [value, setValue] = useState(name)
  const [error, setError] = useState(false)
  function submit(event: FormEvent) {
    event.preventDefault()
    const next = value.trim().slice(0, NAME_LENGTH)
    if (!next) { setError(true); return }
    onSave(next)
  }
  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <DialogTitle className="t-heading">Trocar nome</DialogTitle>
      <div className="grid gap-2">
        <label htmlFor="rename" className="t-small text-text-2">Seu nome na sala</label>
        <Input
          id="rename"
          autoFocus
          className="h-9"
          value={value}
          maxLength={NAME_LENGTH}
          aria-invalid={error || undefined}
          aria-describedby={error ? 'rename-error' : undefined}
          onChange={event => { setValue(event.target.value); setError(false) }}
        />
        {error && <p id="rename-error" role="alert" className="t-small text-danger">O nome não pode ficar vazio.</p>}
      </div>
      <div className="flex justify-end gap-2">
        <DialogClose render={<Button variant="ghost" type="button" />}>Cancelar</DialogClose>
        <Button type="submit">Salvar</Button>
      </div>
    </form>
  )
}
