import { expect, test, type Browser, type Page } from '@playwright/test'

// Three people in one room over the real PeerJS cloud: A shares a screen, B turns on a camera, C
// arrives through an old /#code link. Media comes from Chrome's fake devices.

interface TileInfo { key: string; width: number; height: number }

// Uncaught errors from any page fail the test, reported even when an earlier step failed.
const errors: string[] = []
test.beforeEach(() => { errors.length = 0 })
test.afterEach(() => { expect(errors).toEqual([]) })

async function person(browser: Browser, name: string): Promise<Page> {
  const context = await browser.newContext()
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(`${name}: ${error.message}`))
  return page
}

async function enter(page: Page, name: string) {
  await page.getByLabel('Seu nome').fill(name)
  await page.getByRole('button', { name: /^(Entrar na sala|Criar sala)$/ }).click()
  await expect(page.getByRole('navigation', { name: 'Pessoas na sala' })).toBeVisible()
}

const people = (page: Page) => page.getByRole('navigation', { name: 'Pessoas na sala' }).getByRole('listitem')
const row = (page: Page, name: string) => people(page).filter({ hasText: name })

/** Every tile on the page with the size of the frames its video is decoding. */
const tiles = (page: Page): Promise<TileInfo[]> => page.evaluate(() =>
  [...document.querySelectorAll<HTMLElement>('[data-tile-key]')].map(node => {
    const video = node.querySelector('video')
    return { key: node.dataset.tileKey!, width: video?.videoWidth ?? 0, height: video?.videoHeight ?? 0 }
  }).sort((a, b) => a.key.localeCompare(b.key)))

/** Waits until the page shows exactly these tiles (by kind) and every one has frames flowing. */
async function expectTiles(page: Page, expected: { mine: string[]; screens: number; cameras: number }) {
  await expect.poll(async () => {
    const list = await tiles(page)
    const remote = list.filter(tile => !tile.key.startsWith('me'))
    return {
      mine: list.filter(tile => tile.key.startsWith('me')).map(tile => tile.key).sort(),
      screens: remote.filter(tile => !tile.key.endsWith(':camera')).length,
      cameras: remote.filter(tile => tile.key.endsWith(':camera')).length,
      flowing: list.every(tile => tile.width > 0 && tile.height > 0),
    }
  }, { timeout: 45_000 }).toEqual({ ...expected, mine: [...expected.mine].sort(), flowing: true })
  return tiles(page)
}

/** The dock hides after 3 s without the pointer; moving it brings the dock back. */
async function wake(page: Page) {
  await page.mouse.move(640, 300)
  await page.mouse.move(650, 310)
}

test('three people share a screen and a camera, see each other, and leave', async ({ browser }) => {
  const a = await person(browser, 'A')
  const b = await person(browser, 'B')
  const c = await person(browser, 'C')

  await test.step('A creates a room from the home', async () => {
    await a.goto('/')
    await enter(a, 'Ana')
    await expect(a).toHaveURL(/\/sala\/[a-z0-9]{24}$/)
  })
  const code = new URL(a.url()).pathname.split('/').pop()!

  await test.step('B joins through the room link; the join button waits for a click', async () => {
    await b.goto(`/sala/${code}`)
    await expect(b.getByRole('button', { name: 'Entrar na sala' })).toBeFocused()
    await expect(b.getByRole('navigation', { name: 'Pessoas na sala' })).toHaveCount(0)
    await enter(b, 'Beto')
  })

  await test.step('C opens an old /#code link and lands on the room', async () => {
    await c.goto(`/#${code}`)
    await expect(c).toHaveURL(new RegExp(`/sala/${code}$`))
    await expect(c.getByRole('button', { name: 'Entrar na sala' })).toBeFocused()
    await enter(c, 'Caio')
  })

  await test.step('everyone sees all three people', async () => {
    for (const page of [a, b, c]) {
      await expect(people(page)).toHaveCount(3, { timeout: 45_000 })
      for (const name of ['Ana', 'Beto', 'Caio']) await expect(row(page, name)).toBeVisible()
      // "conectando…" stays in the row, faded out and hidden from assistive tech, once the name arrives.
      await expect(people(page).locator('span[aria-hidden="false"]', { hasText: 'conectando…' })).toHaveCount(0)
    }
  })

  await test.step('A shares a screen and B turns on a camera', async () => {
    await wake(a)
    await a.getByRole('button', { name: 'Mostrar minha tela' }).first().click()
    await expect(a.getByRole('toolbar', { name: 'Controles da sala' }).getByText('Ao vivo')).toBeVisible()
    await expect(a).toHaveTitle('● Telão (3)')
    await expect(b).toHaveTitle('Telão (3)')
    await wake(b)
    await b.getByRole('button', { name: 'Ligar câmera' }).first().click()
    await expect(b.getByRole('button', { name: 'Desligar câmera' }).first()).toBeVisible()
  })

  await test.step('every member sees the right tiles with frames flowing', async () => {
    // A's own share starts hidden: no tile and no <video> for it.
    const seenByA = await expectTiles(a, { mine: [], screens: 0, cameras: 1 })
    const seenByB = await expectTiles(b, { mine: ['me:camera'], screens: 1, cameras: 0 })
    const seenByC = await expectTiles(c, { mine: [], screens: 1, cameras: 1 })
    // B and C see the same screen (A's), A and C the same camera (B's).
    const screenKey = (list: TileInfo[]) => list.find(tile => !tile.key.startsWith('me') && !tile.key.endsWith(':camera'))!.key
    const cameraKey = (list: TileInfo[]) => list.find(tile => !tile.key.startsWith('me') && tile.key.endsWith(':camera'))!.key
    expect(screenKey(seenByB)).toBe(screenKey(seenByC))
    expect(cameraKey(seenByA)).toBe(cameraKey(seenByC))

    for (const page of [b, c]) {
      await expect(row(page, 'Ana').getByRole('img', { name: 'ao vivo' })).toBeVisible()
    }
    for (const page of [a, c]) await expect(row(page, 'Beto').getByRole('img', { name: 'Câmera ligada' })).toBeVisible()
    await expect(c.locator('[data-tile-key]').getByText('Ana', { exact: true })).toBeVisible()
    await expect(c.locator('[data-tile-key]').getByText('Beto', { exact: true })).toBeVisible()
    // Every remote tile starts muted.
    for (const page of [b, c]) await expect(page.getByRole('button', { name: 'Ativar som' })).toHaveCount(1)
  })

  await test.step('A sees a hidden preview of their own share and can show it', async () => {
    const preview = a.locator('[data-self-preview]')
    await expect(preview).toHaveAttribute('data-self-preview', 'hidden')
    await expect(preview).toContainText('Você está ao vivo')
    await expect(a.locator('[data-tile-key="me"]')).toHaveCount(0)
    await wake(a)
    await a.getByRole('button', { name: 'Ver minha tela' }).click()
    await expect(preview).toHaveAttribute('data-self-preview', 'shown')
    await expectTiles(a, { mine: ['me'], screens: 0, cameras: 1 })
    await expect(preview.getByText('Sua tela', { exact: true })).toBeVisible()
  })

  await test.step('the diagnostics toggle shows measured lines on the screen tile', async () => {
    const tile = c.locator('[data-tile-key]').filter({ hasText: 'Ana' })
    await expect(tile.locator('dl')).toHaveCount(0)
    await wake(c)
    await c.getByRole('button', { name: 'Ajustes' }).click()
    await c.getByRole('switch').click()
    await expect(c.getByRole('switch')).toBeChecked()
    for (const label of ['Codec', 'Resolução', 'Quadros', 'Taxa']) await expect(tile.locator('dl dt', { hasText: label })).toBeVisible()
    // The first sample can still read "medindo…"; a later one has real numbers.
    await expect(tile.locator('dl dd').nth(1)).toHaveText(/\d+\s*[x×]\s*\d+/)
    await c.keyboard.press('Escape')
  })

  await test.step('C drags the camera divider and the size survives a reload', async () => {
    const camera = c.locator('[data-tile-key$=":camera"]')
    const screen = c.locator('[data-tile-key]').filter({ hasText: 'Ana' })
    const before = { camera: (await camera.boundingBox())!, screen: (await screen.boundingBox())! }
    const handle = (await c.getByRole('separator', { name: 'Tamanho das câmeras' }).boundingBox())!
    await c.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
    await c.mouse.down()
    await c.mouse.move(handle.x + handle.width / 2, handle.y - 60, { steps: 8 })
    await c.mouse.move(handle.x + handle.width / 2, handle.y - 120, { steps: 8 })
    await c.mouse.up()
    const after = { camera: (await camera.boundingBox())!, screen: (await screen.boundingBox())! }
    expect(after.camera.height).toBeGreaterThan(before.camera.height + 80)
    expect(after.screen.height).toBeLessThan(before.screen.height - 40)

    // The handle also moves from the keyboard.
    await c.getByRole('separator', { name: 'Tamanho das câmeras' }).focus()
    for (let i = 0; i < 5; i++) await c.keyboard.press('ArrowDown')
    const keyed = (await camera.boundingBox())!
    expect(keyed.height).toBeLessThan(after.camera.height - 10)
    for (let i = 0; i < 3; i++) await c.keyboard.press('ArrowUp')
    const saved = (await camera.boundingBox())!
    expect(saved.height).toBeGreaterThan(keyed.height + 5)

    await c.reload()
    await c.getByRole('button', { name: 'Entrar na sala' }).click()
    await expectTiles(c, { mine: [], screens: 1, cameras: 1 })
    await expect.poll(async () => Math.round((await camera.boundingBox())!.height)).toBe(Math.round(saved.height))
    await expect(people(a)).toHaveCount(3, { timeout: 45_000 })
  })

  await test.step('C leaves and the others see two people', async () => {
    await c.getByRole('button', { name: 'Mais opções' }).click()
    await c.getByRole('menuitem', { name: 'Sair da sala' }).click()
    await expect(c.getByRole('heading', { name: 'Você saiu da sala' })).toBeVisible()
    for (const page of [a, b]) {
      await expect(people(page)).toHaveCount(2, { timeout: 30_000 })
      await expect(row(page, 'Caio')).toHaveCount(0)
    }
    // B still sees A's screen after C is gone.
    await expectTiles(b, { mine: ['me:camera'], screens: 1, cameras: 0 })
  })

  await test.step('A stops sharing and the screen tile goes away for B', async () => {
    await wake(a)
    await a.locator('[data-self-preview]').hover()
    await a.getByRole('button', { name: 'Parar de mostrar' }).click()
    await expect(a.locator('[data-self-preview]')).toHaveCount(0)
    await expectTiles(b, { mine: ['me:camera'], screens: 0, cameras: 0 })
    await expect(row(b, 'Ana').getByRole('img', { name: 'ao vivo' })).toHaveCount(0)
  })

  for (const page of [a, b, c]) await page.context().close()
})
