# Telão design

The design spec for the React app in `web/`. It covers Phase 2 (the shell) and reserves space for Phase 3. The old `public/index.html` is the behavioral reference only. This document replaces its look.

## Direction

Telão is the big screen the group watches together every night, next to Discord. The interface is quiet product chrome around live video. It borrows the visual language of the stageshow kit: quiet grays, generous space, soft large radii, light borders, layered soft shadows, controls that feel native, and one calm blue.

Three rules decide every choice:

1. **The video is the hero.** The room is a black stage. Chrome sits at the edges, in dark gray steps, and gets out of the way.
2. **Few words.** A control has an icon and a tooltip, or a short label. Real words go where a decision is made.
3. **One light, one meaning.** Blue means "you can act here." Red means "this person is live." Nothing else has color.

Out of scope for this look: gradients, glows, glass over color, sparkles, purple, ALL-CAPS labels, monospace data, emoji in chrome, a decorative grid background.

## Color

Two themes. The home follows `prefers-color-scheme`. The room is always dark, because it frames video.

Every value is a CSS variable in `web/src/index.css`, mapped onto the shadcn variable names (`--background`, `--foreground`, `--card`, `--popover`, `--primary`, `--muted`, `--border`, `--input`, `--ring`, `--destructive`) so that the shadcn components pick them up without edits.

### Light (home)

| Token | Hex | Role |
|---|---|---|
| `--page` | `#F4F4F6` | Page ground |
| `--surface` | `#FFFFFF` | Cards, inputs, popovers |
| `--surface-2` | `#F9F9FA` | Inset areas, hover fill on ghost buttons |
| `--fill` | `#ECECEF` | Segmented track, switch off track, slider rail |
| `--text` | `#1C1C1E` | Primary text |
| `--text-2` | `#6C6C72` | Secondary text, field labels |
| `--text-3` | `#A3A3A9` | Placeholders, disabled text |
| `--border` | `rgba(0,0,0,0.07)` | Hairline on cards and inputs |
| `--border-strong` | `rgba(0,0,0,0.12)` | Input hover |
| `--accent` | `#1D6FEA` | Primary button, focus ring, selected segment text |
| `--accent-hover` | `#155FD3` | Primary button hover |
| `--accent-soft` | `#E6F0FE` | Selected segment fill, selected menu row |
| `--live` | `#E5342B` | The tally (live state) only |
| `--danger` | `#D92D20` | Error text under a field |

### Dark (room, and home in dark mode)

The stage ground is pure black, `#000000`, because video letterboxes on black and any tint shows as a band around the picture. Depth comes from four gray surface steps on top of it, never from a tinted near-black.

| Token | Hex | Role |
|---|---|---|
| `--stage` | `#000000` | Stage ground behind tiles, letterbox |
| `--page` | `#0E0E10` | Room frame around the stage, sidebar ground, home ground in dark mode |
| `--surface` | `#1A1A1D` | Popovers, dialogs, the dock, cards |
| `--surface-2` | `#242428` | Hovered rows, tile placeholder while connecting |
| `--fill` | `#2E2E33` | Segmented track, switch off track, slider rail |
| `--text` | `#F2F2F4` | Primary text |
| `--text-2` | `#A0A0A8` | Secondary text |
| `--text-3` | `#66666E` | Placeholders, disabled |
| `--border` | `rgba(255,255,255,0.07)` | Hairline on surfaces |
| `--border-strong` | `rgba(255,255,255,0.12)` | Hover hairline, dividers in the dock |
| `--accent` | `#2B78F0` | Primary button, focus ring, selected state |
| `--accent-hover` | `#1D6FEA` | Primary button hover |
| `--accent-soft` | `rgba(43,120,240,0.18)` | Selected segment fill, pressed toggle fill |
| `--live` | `#FF453A` | The tally only |
| `--danger` | `#FF6961` | Error text |
| `--scrim` | `linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0))` | 56 px band at the foot of a tile, under the name and controls |
| `--chip-on-video` | `rgba(20,20,22,0.62)` with `backdrop-filter: blur(12px)` | Name chip and tile buttons over video |

Contrast: `--text-2` on `--page` passes 4.5:1 in both themes. `--text-3` is used only for placeholders and disabled states. White text on `--accent` is about 4.7:1 in light and 4.2:1 in dark; button labels use weight 550, and the dark value still clears the 3:1 bar for UI components.

`--live` never appears on a button, a border, or a background larger than a pill. `--danger` is text only. Destructive actions ("Sair da sala", "Parar de mostrar") use neutral buttons with clear labels, not red fills.

## Type

**Inter**, one family, self-hosted from `@fontsource-variable/inter`. Import its optical-size stylesheet if the installed version ships one (check the package for `opsz.css`), otherwise its default `index.css`; the scale below works with either. The group is on Windows, where the system stack falls back to Segoe UI with different metrics. Self-hosting gives the same rhythm on every machine. Fallback: `"Inter Variable", ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif`.

Global settings: `font-optical-sizing: auto`, `font-feature-settings: "cv11", "ss03"` (single-storey a, rounder digits), `-webkit-font-smoothing: antialiased`. Numbers that change in place (the tally timer, volume, diagnostics, member count) use `font-variant-numeric: tabular-nums`.

| Token | Size / line height | Weight | Tracking | Use |
|---|---|---|---|---|
| `display` | 56 / 60 | 650 | -0.03em | The "Telão" wordmark on the home |
| `title` | 22 / 28 | 600 | -0.015em | Closed and full screens, empty stage heading |
| `heading` | 15 / 20 | 600 | -0.005em | Dialog titles, popover titles |
| `body` | 14 / 20 | 450 | 0 | Default UI text, member names, buttons |
| `lede` | 16 / 24 | 450 | -0.005em | The one line under the home wordmark |
| `small` | 13 / 18 | 450 | 0 | Secondary text, hints under options, toasts |
| `micro` | 12 / 16 | 550 | 0.005em | Name chips on tiles, the "ao vivo" pill, diagnostics values |

Weights in use: 450, 550, 600, 650. No italics. No uppercase transforms. Sentence case everywhere, including buttons. Line length stays under 60 characters in any running text (the home lede and the end screens).

## Space, radius, border, shadow

### Spacing

A 4 px base. Tokens: `--s-1` 4, `--s-2` 8, `--s-3` 12, `--s-4` 16, `--s-5` 20, `--s-6` 24, `--s-8` 32, `--s-10` 40, `--s-16` 64.

- Gaps between tiles: 8.
- Stage inset from the room frame: 8 on all sides. The stage is a rounded panel inside the frame.
- Inside popovers and dialogs: 16 padding, 12 between rows.
- Sidebar rows: 8 vertical, 12 horizontal, 2 between rows.
- One gutter per container. If a child needs air, it uses the same value as its parent's padding.

### Radius

Radius follows the size of the object, and nested radii are concentric (inner radius = outer radius minus the inset).

| Token | Value | Use |
|---|---|---|
| `--r-pill` | 999px | Segmented controls, switches, the dock, chips, the tally, icon buttons |
| `--r-xl` | 20px | The stage panel, dialogs |
| `--r-lg` | 16px | Popovers, home card |
| `--r-tile` | 12px | Tiles (the stage is radius 20 with 8 px inner padding, so 20 minus 8) |
| `--r-md` | 12px | Inputs, buttons with text, menu rows |
| `--r-sm` | 8px | Selected segment inside a track (track 999, thumb inset 3) and sidebar rows |

### Border

One hairline, 1 px `--border`, on surfaces that sit on a same-color ground (cards on the page, popovers on the stage). Inputs use `--border` and move to `--border-strong` on hover. Tiles have no border. Video is its own edge.

### Shadow

Layered and soft, built from three stops. Light theme values; dark theme multiplies alpha by 2.2 because shadows read weaker on dark.

| Token | Value | Use |
|---|---|---|
| `--shadow-1` | `0 1px 1px rgba(0,0,0,.04), 0 1px 3px rgba(0,0,0,.05)` | Inputs, segmented thumb, switch thumb |
| `--shadow-2` | `0 1px 2px rgba(0,0,0,.04), 0 4px 12px rgba(0,0,0,.06), 0 12px 24px -8px rgba(0,0,0,.06)` | Home card, the dock |
| `--shadow-3` | `0 2px 4px rgba(0,0,0,.05), 0 12px 32px rgba(0,0,0,.10), 0 32px 64px -16px rgba(0,0,0,.14)` | Popovers, dialogs, toasts |
| `--shadow-accent` | `0 1px 2px rgba(29,111,234,.25), 0 6px 16px -4px rgba(29,111,234,.35)` | The primary button only |

### Focus

Every interactive element shows `outline: 2px solid var(--accent); outline-offset: 2px` on `:focus-visible`, following its radius. Over video, the outline gets a 4 px `rgba(0,0,0,.5)` halo so it reads on bright frames.

### Icons

`lucide-react`, 1.75 stroke, 18 px in the dock and sidebar, 16 px on tiles and in menus. The icons carry the controls. Labels live in tooltips.

## Layouts

Desktop Chrome on Windows at 1280 to 1920 wide is the primary target. Narrow layouts (under 768) work, but the group almost never uses them.

### Home, desktop

The home is light (or dark with the system). It is a left-aligned column on the left and a still miniature of the room on the right, running off the right and bottom edges of the window. The miniature is built from the same tile and sidebar components with placeholder bars, and its job is to show what you get before you have a room. The copy column is left-aligned on a 520 px measure, vertically centered.

```
+--------------------------------------------------------------------------+
|                                                                          |
|                                          +-------------------------------+
|   Telão                                   | o  ▬▬▬▬     |  ######  ######|
|                                           | o  ▬▬▬      |  ######  ######|
|   Cria a sala, manda o link no            | o  ▬▬▬▬▬    |  ######  ######|
|   Discord e até quatro mostram a          |             |  ######  ######|
|   tela juntos.                            |             |  ######  ######|
|                                           |             |                |
|   +---------------------+ +-----------+   |             |  ######  ######|
|   | Seu nome            | | Criar sala|   |             |  ######  ######|
|   +---------------------+ +-----------+   |             |   ( o  o  o )  |
|                                           |             |                |
|   da Tropa do Soca Fofo                   +-------------|----------------+
+--------------------------------------------------------------------------+
     520 px column, left aligned            miniature: dark, 1.3x room scale,
                                            cropped by the window, no plate
```

In every wireframe, emoji and symbols stand in for lucide icons. The product itself uses no emoji in its chrome.

- The miniature is a static picture with `aria-hidden="true"`. Two screen tiles show dark placeholder frames, one tally dot on the first, three people in the sidebar as bars with avatars, and the dock at its foot. No real names, no fake video.
- The input and the button form one row. The button is the primary (blue) button. With a valid link the button says "Entrar na sala" and receives focus on load (it does not join on its own). With an invalid link the line under the wordmark changes and the button says "Criar sala".
- "da Tropa do Soca Fofo" sits at the foot of the column in `small`, `--text-2`. It is the one personal touch on the page.

### Home, narrow (< 768)

The miniature moves under the form as a strip cropped at the bottom of the screen. The column takes the full width with 24 px gutters.

```
+------------------------------+
|                              |
|  Telão                       |
|                              |
|  Cria a sala, manda o link   |
|  no Discord e até quatro     |
|  mostram a tela juntos.      |
|                              |
|  +------------------------+  |
|  | Seu nome               |  |
|  +------------------------+  |
|  +------------------------+  |
|  |       Criar sala       |  |
|  +------------------------+  |
|                              |
|  da Tropa do Soca Fofo       |
|  +--------------------------+|
|  | ######  ######           ||
|  | ######  ######           ||
+--+--------------------------++
```

### Room, desktop

Three columns: the people sidebar (248 px), the stage (flexible), and the Phase 3 side panel (320 px, absent in Phase 2). The stage is a black rounded panel inset 8 px from the room frame. The dock floats over the stage foot, centered, 16 px from its bottom edge.

```
+--------------------------------------------------------------------------+
| Telão            [🔗] |+------------------------------------------------+ |
|                       ||                                                | |
| Na sala  3            ||  +--------------------+ +--------------------+ | |
|                       ||  |                    | |                    | | |
| (o) Lucas (você)  ●   ||  |   screen tile      | |   screen tile      | | |
| (o) Bia        ● cam  ||  |                    | |                    | | |
| (o) Japa       ☾      ||  | ● Lucas    [🔇][⛶] | | Bia        [🔇][⛶] | | |
| ( ) conectando…       ||  +--------------------+ +--------------------+ | |
|                       ||                                                | |
|                       ||   +-------+ +-------+                          | |
|                       ||   | cam   | | cam   |   camera strip           | |
|                       ||   +-------+ +-------+                          | |
|                       ||                                                | |
|-----------------------||      ( [● Ao vivo 12:04 ▾] [📷▾] [🔇] [⚙] )     | |
| (o) Lucas      [☾][…] |+------------------------------------------------+ |
+--------------------------------------------------------------------------+
  sidebar 248              stage, black, radius 20, inset 8        (panel 320
                                                                    in Phase 3)
```

Sidebar, top to bottom:

- Wordmark "Telão" in `heading` weight and the copy-link icon button on the same row.
- "Na sala" with the count in `--text-2`.
- The member list. You come first with "(você)". Each row: a 24 px avatar (initial on `--surface-2`), the name, and status marks on the right in a fixed order: tally dot (live), camera icon, moon (away). A member with `name === null` shows "conectando…" in `--text-3` and a pulsing avatar outline.
- The foot: your row again as the "me" bar, with the away toggle (moon icon button, pressed state) and a "…" menu (Trocar nome, Sair da sala).

Stage:

- The stage has 8 px inner padding, so tiles sit 8 from its edge and 8 from each other.
- **Screens** take the stage. One screen fills it at 16:9, letterboxed on black. Two sit side by side. Three or four make a 2 × 2 grid (with three, the third spans one cell and the fourth cell stays black, so tiles keep their size when a fourth arrives).
- **Cameras** dock in a strip under the screens: 16:9 tiles 112 px tall, left-aligned, 8 px gaps. When nobody else shares a screen, cameras fill the stage with the same grid rules as screens.
- **Your own share** never takes the stage. It is a small 16:9 card at the start of the strip (centered on the stage when nothing else is on it). Hidden by default: a `--surface` card with the tally dot, "Você está ao vivo" and "Ver minha tela", and no `<video>` mounted. Shown: a thumbnail tile "Sua tela" with "Esconder minha tela" and "Parar de mostrar" on hover; a click focuses it in Destaque. The choice persists in `telao-self-view`.
- **Resizing** (Grade). The 8 px gaps between screens, and the gap above the strip, are resizable panel handles (shadcn `Resizable`): invisible until hover, then a 2 px `--border-strong` line, `--accent` while dragging or focused. Arrow keys move a focused handle; a double click resets it. The strip handle sets the camera size (88 px up to half the stage). Sizes are saved per shape (rows by columns, and the strip) in `telao-layout-*`, not per person. "Restaurar tamanhos" in Ajustes clears them.
- **Thumbnail quality.** Any screen tile drawn narrower than 360 px is reported to the core as a thumbnail through `setViewing`, so its sender lowers the quality, the same as the theater strip.
- **Empty** (no screens, no cameras): the empty state, centered.
- **Connecting** (`status.kind === 'connecting'`): the stage shows "Entrando na sala…" centered in `--text-2` with a small spinner. The dock is visible but disabled.

Dock (floating pill, `--surface` at 88% opacity with `backdrop-filter: blur(20px)`, `--shadow-2`, `--r-pill`, height 52, 6 px inner padding):

1. Share control. Off: "Mostrar minha tela" as an icon button with a chevron segment that opens the quality popover. Live: the tally (see "Signature").
2. Camera control: icon button plus chevron segment that opens the camera popover (effect, mirror).
3. Deafen all: icon button, pressed state when everything is muted.
4. Settings: icon button that opens the settings popover (diagnostics switch).
5. Layout, after a divider: a segmented control "Grade" / "Destaque". Hidden on narrow screens and on an empty stage.
6. Phase 3 toolbar slot, after a divider (see "Phase 3").

The dock fades to 0 opacity after 3 s without pointer movement over the stage, and returns on any pointer movement or keyboard focus inside the room. It never hides while a popover is open or while focus is inside it.

### Room, empty stage

```
|+------------------------------------------------+|
||                                                ||
||                                                ||
||                 Telão apagado                  ||
||        Ninguém está mostrando a tela.          ||
||                                                ||
||              [ Mostrar minha tela ]            ||
||                                                ||
||                                                ||
||         ( [🖥▾] [📷▾] [🔇] [⚙] )                ||
|+------------------------------------------------+|
```

The heading is `title`, the line is `body` in `--text-2`, and the button is primary. It calls `shareScreen` with the current profile.

### Room, theater

Theater mode ("Destaque" in the UI) focuses one tile. A single click on a grid tile opens it, and the dock's "Grade" segment returns. The sidebar collapses to 0 (it slides out), the focused tile fills the stage, and the other tiles sit in a 96 px strip along the stage foot, above the dock, fading out with the dock. `T` toggles it. `Esc` leaves it. It calls `setViewing({ hidden, focus: key })`.

```
+--------------------------------------------------------------------------+
|+------------------------------------------------------------------------+|
||                                                                        ||
||                         focused screen tile                            ||
||                                                                        ||
||                                                                        ||
||  [▭][▭][▭]  other tiles, 96 px                                          ||
||                 ( [● Ao vivo 12:04 ▾] [📷▾] [🔇] [⚙] [⤡] )              ||
|+------------------------------------------------------------------------+|
+--------------------------------------------------------------------------+
```

The dock's layout switch shows "Destaque" selected; "Grade" or Esc leaves it. Fullscreen uses the browser Fullscreen API on a single tile (double-click or the tile's fullscreen button). It also calls `setViewing` with that tile as `focus`.

### Room, narrow (< 768)

The sidebar becomes a sheet from the left, opened by a people button at the top-left of the stage that shows the count. Tiles stack in one column at 16:9. The camera strip scrolls sideways. The dock stays at the foot and keeps every control. Theater and the side panel are not offered on narrow screens.

```
+------------------------------+
| [👥 3]                  [🔗] |
|+----------------------------+|
||   screen tile              ||
||                            ||
|| ● Lucas            [🔇][⛶] ||
|+----------------------------+|
|+----------------------------+|
||   screen tile              ||
|| Bia                [🔇][⛶] ||
|+----------------------------+|
| [cam][cam][cam] →            |
|  ( [🖥▾] [📷▾] [🔇] [⚙] )    |
+------------------------------+
```

### Closed and full

Both are a centered column on the home ground (light or dark with the system), with the same wordmark at the top-left. Heading in `title`, one line in `body` `--text-2`, then the buttons. No illustration.

```
+--------------------------------------------+
| Telão                                      |
|                                            |
|                                            |
|            Você saiu da sala               |
|      Abre o link de novo pra voltar.       |
|                                            |
|     [ Voltar pra sala ]  [ Criar outra ]   |
|                                            |
+--------------------------------------------+
```

## Components

All components come from shadcn/ui on Base UI (`npx shadcn@latest init -b base`), restyled through the tokens above. Restyle through the variables and the component's own class slots. Do not fork a primitive to change its geometry.

### Where each control's state lives

| Control | Source of truth |
|---|---|
| Share and stop, quality profile | Core: `shareScreen(profile)`, `stopScreen()`, `snapshot.screen` |
| Camera, effect | Core: `startCamera()`, `stopCamera()`, `setCameraEffect(effect)`, `snapshot.camera` |
| Rename | Core: `setName(name)`, `snapshot.name` |
| Away | Core: `setAway(away)`, `snapshot.away`, `member.away` |
| Theater focus, fullscreen, page hidden | Core is told: `setViewing({ hidden, focus })` |
| Diagnostics values | Core: `sampleStats()` every 2 s while the overlay is on |
| Leave | Core: `leave()` |
| Per-tile mute and volume, deafen all | UI only (the `<video>` elements) |
| Camera mirror | UI only (a CSS transform on your own camera tile) |
| Diagnostics on/off, theater on/off, dock visibility, chosen profile, own share shown, panel sizes | UI only, persisted in `localStorage` |
| Tally timer | UI only, started when `screen.status` becomes `live` |

The capture audio options are frozen (`systemAudio: "exclude"`, `windowAudio: "window"`, no audio from `monitor`). No control in this design changes them, and none may be added. The UI only reports `screen.hasAudio`.

### Inventory

**Button** (shadcn `Button`). Variants:
- `primary`: `--accent` fill, white text, `--shadow-accent`, 40 tall, `--r-md`, 16 px horizontal padding. Hover `--accent-hover`. Pressed scales to 0.97. Disabled: 40% opacity, no shadow.
- `secondary`: `--surface` fill, `--border` hairline, `--text`. Hover `--surface-2`.
- `ghost`: no fill. Hover `--surface-2`.
- `icon`: 40 × 40 pill. Off: no fill, `--text-2` icon. Hover: `--surface-2` fill, `--text` icon. Pressed (`aria-pressed="true"`): `--accent-soft` fill, `--accent` icon. Disabled: `--text-3`.
- `split`: an icon button and a 24 px chevron segment joined in one pill, divided by a 1 px `--border-strong` line inset 10 px top and bottom. Each half has its own hover and focus.

**Input** (shadcn `Input` inside `Field`). 44 tall on the home, 36 in dialogs. `--surface`, `--border`, `--r-md`, `--shadow-1`. Hover `--border-strong`. Focus: the accent ring. Invalid: `aria-invalid`, a `--danger` line of `small` text under the field. Placeholder `--text-3`. Max length 24 for names.

**Segmented control** (shadcn `ToggleGroup`, single). Track `--fill`, `--r-pill`, 3 px inset. Selected item: `--surface` thumb with `--shadow-1` in light, `--surface-2` in dark, `--r-pill`, text `--text` at weight 550. Unselected: `--text-2`. The thumb slides between items (see "Motion"). Used for the quality profile and the camera effect.

**Switch** (shadcn `Switch`). 44 × 26, track `--fill` off, `--accent` on, white thumb with `--shadow-1`. The row label sits left, the switch right. Used for diagnostics and mirror.

**Slider** (shadcn `Slider`). Rail 4 px `--fill`, range `--text` (not accent: volume is not a primary action), thumb 18 px white with `--shadow-1`. Shows the value in a tooltip while dragging, in `tabular-nums`.

**Tooltip** (shadcn `Tooltip`). `--surface` in dark, `small` text, `--r-md`, 6 × 10 padding, 500 ms delay, 0 ms when moving between neighbors. Shows the shortcut in `--text-3` after the label when there is one.

**Popover** (shadcn `Popover`). `--surface`, `--border`, `--r-lg`, `--shadow-3`, 16 padding, 280 wide. Opens above the dock with an 8 px offset. Title in `heading`.

**Dialog** (shadcn `Dialog`). Used once, for "Trocar nome". 360 wide, `--r-xl`, 20 padding, title, input, then "Cancelar" (ghost) and "Salvar" (primary) right-aligned. Enter saves, Esc cancels.

**Menu** (shadcn `DropdownMenu`). The "…" menu on your sidebar row. Rows 32 tall, `--r-sm`, hover `--surface-2`.

**Toast** (Sonner, through shadcn `Sonner`). Bottom center on the home, top center in the room (the dock owns the bottom). `--surface`, `--border`, `--r-lg`, `--shadow-3`, `small` text, max 360 wide, 4 s, 8 s for the discarded-tab toast. No icons except the live dot when a toast is about someone going live (Phase 3 notifications).

**Avatar** (shadcn `Avatar`). 24 px circle, the first letter of the name in `micro` on `--surface-2`. The letter keeps its case. No generated colors: one gray for everyone.

**Member row**. States:
- default: name in `--text`.
- you: "(você)" after the name in `--text-2`.
- connecting (`name === null`): "conectando…" in `--text-3`, avatar is an empty circle with a 1 px `--border-strong` outline that pulses in opacity.
- live: the tally dot (6 px `--live`) right of the name, with the tooltip "ao vivo".
- camera on: camera icon 14 px in `--text-2`.
- away: moon icon 14 px in `--text-2`, and the name drops to `--text-2`.
- hover: `--surface-2` fill. Rows are not clickable in Phase 2, except your own, which opens the menu.

**Screen tile**. A `<video>` on `--stage`, `object-fit: contain`, `--r-tile`, overflow hidden. Overlays live in the bottom 56 px over `--scrim`:
- bottom-left: the name chip (`--chip-on-video`, `micro`, pill, 24 tall). With a live owner, the tally dot sits inside the chip before the name. Your own screen says "Sua tela".
- bottom-right: the volume button and the fullscreen button (32 px icon buttons on `--chip-on-video`), then the theater button.
States:
- connecting (stream not playing yet): `--surface-2` fill and a centered spinner.
- muted (default for every tile): the volume button shows the muted speaker icon and stays visible even when the other overlays hide. This is the one overlay that never fades, because a muted tile has to say so.
- unmuted: speaker icon; hovering it opens a vertical slider popover above it.
- hover: the scrim and all buttons fade in.
- focused (theater or fullscreen): no rounded corners in fullscreen; in theater the tile keeps its radius.
- yours: no volume button (you never hear your own share), and a "Parar de mostrar" button on hover.
- away owner: the name chip shows the moon icon after the name.
The core shows no "away" on tiles, so only the chip changes.

**Camera tile**. Same structure at a smaller size: name chip only, no scrim until hover, volume button visible only when unmuted or hovered (cameras rarely carry sound you want, but each starts muted like every tile). Your own camera is mirrored when "Espelhar" is on. Effects are applied by the core, so the tile has no effect state of its own.

**The tally** (signature, below).

**Quality popover**. Title "Qualidade". A vertical list of three rows (radio behavior, `ToggleGroup` in vertical orientation): profile name in `body` 550, the hint under it in `small` `--text-2`. The selected row gets `--accent-soft` and an `--accent` check on the right. Below: the primary button "Mostrar minha tela" (when off) or "Trocar tela" (when live, calls `stopScreen()` then `shareScreen(profile)`). The choice persists locally.

**Camera popover**. Title "Câmera". The on/off button ("Ligar câmera" / "Desligar câmera"), then "Efeito" with a segmented control of five items (two rows on narrow screens), then the "Espelhar" switch. While `camera.status === 'starting'` the on button shows a spinner and is disabled.

**Settings popover**. Title "Ajustes". One switch row: "Mostrar diagnóstico nas telas". Space below the switch is left for Phase 3 viewer preferences.

**Diagnostics overlay**. When on, each tile shows a panel at its top-left: `--chip-on-video`, `--r-md`, 8 × 10 padding, `micro` text in Inter with `tabular-nums` (no monospace). Two columns, label in `--text-2`, value in `--text`. Rows: Codec, Resolução, Quadros, Taxa, Limite. For your own share it shows what you send; for others, what you receive. It updates every 2 s without animating the numbers.

**Empty state**. Heading, line, primary button, centered on the stage, max width 320.

**People sheet** (narrow only, shadcn `Sheet` from the left, 280 wide). Holds the same sidebar.

## Signature: the tally

In a TV studio, the tally is the red light on the camera that is on air. Telão has one, and it means exactly one thing: this person's screen is live right now.

- **On your dock**, the share button turns into the tally when your screen goes live: a pill with a 6 px `--live` dot, the label "Ao vivo", and the elapsed time in `tabular-nums` ("12:04"). The pill keeps the split chevron, which opens the quality popover with "Trocar tela" and "Parar de mostrar". When `screen.hasAudio` is false, a muted-speaker icon sits after the time with the tooltip "Sem som: só o som de uma aba vai junto".
- **On the tile**, the same dot sits inside the owner's name chip.
- **In the sidebar**, the same dot sits after the owner's name.

The dot is the only red in the product, and it is always 6 px and always a circle. It never marks errors, notifications, unread counts or the record button of anything. Cameras do not get a tally: a camera is presence, not a broadcast.

The share-to-tally change is the one control that morphs. The icon cross-fades into the dot, the pill widens to fit "Ao vivo 0:00" (width animated by measuring the label, never stretching text), and the dot lights from 0 to full over 240 ms. While `screen.status === 'starting'`, the share button shows "Escolhendo tela…" in `--text-2` and the dot is an outline.

## Motion

Base curves: `--ease-out: cubic-bezier(0.22, 1, 0.36, 1)` for things that enter and respond, `--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1)` for things that move between two places. No bounce, no spring overshoot, nothing longer than 400 ms.

### The one orchestrated moment: lights on

When the stage goes from empty to its first screen, the empty state fades out (120 ms), the tile grows from 96% scale and 0 opacity to full (320 ms, `--ease-out`), and the sidebar row of the person who started sharing gets its tally dot at the same time. This happens once per empty-to-live change. Every later tile arrives with the normal response below. Nothing animates on page load, on the home, or on entering the room, apart from the toast.

### Responses to actions

| Action | Motion |
|---|---|
| A tile joins or leaves | The grid reflows with FLIP: existing tiles move to their new places (240 ms `--ease-in-out`), the new one fades in at its place (180 ms). A leaving tile fades out (140 ms) before the others move. |
| Theater on or off | The sidebar width animates to 0 (240 ms), the focused tile moves to full stage with FLIP, the others shrink into the strip. |
| Segmented change | The thumb slides to the new item (200 ms `--ease-out`). Text color changes with it. |
| Switch | The thumb slides (160 ms), the track color cross-fades. |
| Popover, tooltip, menu | Opens with opacity 0 to 1 and scale 0.97 to 1 from the side of its anchor (160 ms `--ease-out`). Closes faster (100 ms). |
| Dialog | Opacity and scale 0.98 to 1 (180 ms). Backdrop fades to `rgba(0,0,0,.4)`. |
| Toast | Slides 8 px from its edge and fades (200 ms). |
| Button press | Scales to 0.97 while pressed (80 ms), back on release (120 ms). |
| Dock auto-hide | Opacity only (200 ms out, 120 ms in). |
| Copy link | The link icon cross-fades to a check for 1.5 s, then back. The toast confirms. |
| Member joins | The row fades in and the rows below move down (200 ms). "conectando…" changes to the name with a cross-fade, never a jump. |

### Reduced motion

Under `prefers-reduced-motion: reduce`, nothing moves or scales. Opacity changes remain, at most 120 ms. The grid reflows instantly. The tally dot appears without the lights-on fade. The "conectando…" avatar stops pulsing and shows a static outline.

## Copy (pt-BR)

The group's voice: casual, short, "pra", "tá", "você". Sentence case. No exclamation marks except where the group would shout. Each action keeps one name through the flow: the button "Mostrar minha tela" leads to the tally "Ao vivo", and "Parar de mostrar" ends it.

### Home

| Key | Text |
|---|---|
| Wordmark | Telão |
| Lede, no link | Cria a sala, manda o link no Discord e até quatro mostram a tela juntos. |
| Lede, valid link | Te chamaram pra uma sala. Escolhe um nome e entra. |
| Lede, invalid link | Esse link não abre nenhuma sala. Pede outro no Discord ou cria uma nova. |
| Name label (screen readers) | Seu nome |
| Name placeholder | Seu nome |
| Name empty error | Coloca um nome pra entrar. |
| Button, no link or invalid link | Criar sala |
| Button, valid link | Entrar na sala |
| Signature line | da Tropa do Soca Fofo |
| Page title | Telão |

### Room status

| Key | Text |
|---|---|
| Connecting | Entrando na sala… |
| Page title in a room | Telão (3), with the count of people |
| Page title while you are live | ● Telão (3) |

### Closed and full

| Key | Text |
|---|---|
| Closed heading | Você saiu da sala |
| Closed line | Abre o link de novo pra voltar. |
| Closed buttons | Voltar pra sala / Criar outra sala |
| Full heading | A sala tá cheia |
| Full line | Já tem oito pessoas. Espera alguém sair e tenta de novo. |
| Full buttons | Tentar de novo / Criar outra sala |

### Sidebar

| Key | Text |
|---|---|
| Section | Na sala |
| Count | 3 (just the number, `--text-2`) |
| Alone | Só você por aqui. Copia o link e manda no Discord. |
| You suffix | (você) |
| Connecting member | conectando… |
| Live tooltip | ao vivo |
| Camera tooltip | Câmera ligada |
| Away tooltip | Ausente |
| Copy link button | Copiar link da sala |
| Copy link toast | Link copiado. Cola no Discord. |
| Away button, off | Ficar ausente |
| Away button, on | Estou de volta |
| Away tooltip, off | Avisa a sala que você saiu de perto. As lives continuam tocando. |
| Menu | Trocar nome / Sair da sala |
| People button (narrow) | Pessoas na sala |

### Rename dialog

| Key | Text |
|---|---|
| Title | Trocar nome |
| Field label | Seu nome na sala |
| Buttons | Cancelar / Salvar |
| Empty error | O nome não pode ficar vazio. |

### Dock and popovers

| Key | Text |
|---|---|
| Share button | Mostrar minha tela |
| Share starting | Escolhendo tela… |
| Share at the cap (disabled, tooltip) | Já tem quatro mostrando a tela. Espera alguém parar. |
| Tally | Ao vivo 12:04 |
| Tally without audio (tooltip) | Sem som: só o som de uma aba vai junto |
| Tally with audio (tooltip) | Com o som da aba |
| Quality popover title | Qualidade |
| Profile `game` | Jogos 720p60 |
| Profile `game` hint | Pra jogo rápido. |
| Profile `detail` | Texto 1080p30 |
| Profile `detail` hint | Pra ler texto e código. |
| Profile `light` | Leve 720p30 |
| Profile `light` hint | Pra internet fraca. |
| Switch screens | Trocar tela |
| Stop | Parar de mostrar |
| Camera button, off | Ligar câmera |
| Camera button, on | Desligar câmera |
| Camera popover title | Câmera |
| Effect label | Efeito |
| Effect `normal` | Normal |
| Effect `mono` | Cinema P&B |
| Effect `vhs` | VHS da tropa |
| Effect `neon` | Neon |
| Effect `pixel` | Pixelado |
| Mirror | Espelhar |
| Deafen, off | Mutar tudo |
| Deafen, on | Desmutar tudo |
| Settings button | Ajustes |
| Diagnostics switch | Mostrar diagnóstico nas telas |
| Reset panel sizes | Restaurar tamanhos |
| Layout switch | Grade / Destaque |

### Stage and tiles

| Key | Text |
|---|---|
| Empty heading | Telão apagado |
| Empty line | Ninguém está mostrando a tela. |
| Empty button | Mostrar minha tela |
| Your screen chip | Sua tela |
| Your camera chip | Você |
| Unmute | Ativar som |
| Mute | Mutar |
| Volume | Volume |
| Fullscreen | Tela cheia (duplo clique) |
| Exit fullscreen | Sair da tela cheia (Esc) |
| Theater | Destaque (T) |
| Stop on your tile | Parar de mostrar |
| Your share, hidden | Você está ao vivo |
| Show your share | Ver minha tela |
| Hide your share | Esconder minha tela |

### Diagnostics

| Key | Text |
|---|---|
| Codec | `H264, hardware` or `VP8, software` |
| Resolução | `1280×720` |
| Quadros | `60 fps` |
| Taxa | `2.400 kbps` (pt-BR thousands separator) |
| Limite | `rede`, `CPU`, `outro`, or `nenhum` |
| No data yet | medindo… |

### Notices and toasts

| Source | Text |
|---|---|
| `share-denied` | A tela não foi compartilhada. Escolhe uma tela ou aba e clica em Compartilhar. |
| `camera-not-allowed` | Libera a câmera no navegador pra ligar. |
| `camera-not-found` | Nenhuma câmera encontrada. |
| `camera-failed` | Não deu pra ligar a câmera. Vê se outro app tá usando ela. |
| `camera-effect-failed` | Não deu pra aplicar o efeito. Tenta de novo. |
| Autoplay blocked | Clica em qualquer lugar pra ouvir. |
| Chrome discarded the tab (`document.wasDiscarded`) | O Chrome descarregou esta aba pra poupar memória. Em chrome://settings/performance, coloca este site em "Sempre manter ativos". |
| Link copied | Link copiado. Cola no Discord. |
| Name saved | Agora você é {nome}. |

### Open questions for Phase 2

- The core exposes no reconnecting state after a drop. If one is added, it needs a line ("Reconectando…") in the stage status, not a toast.
- "Voltar pra sala" on the closed screen rejoins the same code. Confirm this is wanted when the room closed because the last person left.

## Phase 3 homes

Phase 3 adds memes, combos, throwables, reactions, pranks, the four modes (pod, 4:20, tiger, aura), notifications and the game. They get two reserved places. Neither shows in Phase 2 as an empty box or a disabled button: the dock is simply shorter and the stage simply wider.

### The dock toolbar (quick, one-tap things)

After a divider at the right of the dock, a row of icon buttons for things you do while watching, aimed at the screen: reactions (five slots, keys 1 to 5), throwables (tomato, egg, slipper, keys Z, X, C, armed then clicked on a live tile), and a memes button that opens the side panel. The dock grows to the right with the same 40 px buttons and 4 px gaps. On narrow screens the toolbar moves into a second dock row.

Throwables and reactions land on tiles, so their effects live in a layer above the tile video and below the tile overlays, clipped to the tile radius.

### The side panel (things you browse and set up)

A 320 px column at the right of the room, the same `--page` ground and hairline as the sidebar, toggled from the dock (key B, as in the old app). Tabs at its top with a segmented control: Memes, Modos, Pegadinhas, Joguinho. The memes board, combo editor, mode starters, prank picker, crosshair editor and the game lobby live here. When it opens, the stage loses 320 px and the grid reflows with the same FLIP motion as theater.

Room-wide modes (pod, 4:20, tiger, aura) are the one place where Phase 3 may break the restraint: they take over the stage on purpose, for their 15 seconds, then return it exactly as it was. The game takes the whole stage the same way. Notifications use the toast. Away mode hides the toolbar group and the panel's interactive tabs for you, matching the old behavior.
