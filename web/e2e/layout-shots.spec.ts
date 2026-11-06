import { expect, test, type Browser, type Page } from '@playwright/test'

// Screenshots of the stage layouts for review, not a regression test: run with SHOTS=1.
// Two people share a screen and turn on a camera, a third watches. Each stream is a canvas with the
// person's name, so the pictures tell the tiles apart.

test.skip(!process.env.SHOTS, 'screenshots only: SHOTS=1 npx playwright test layout-shots')

const DIR = 'e2e/screenshots/layout'

function fakeMedia({ label, hue }: { label: string; hue: number }) {
  const stream = (kind: string, width: number, height: number) => {
    const canvas = Object.assign(document.createElement('canvas'), { width, height })
    const ctx = canvas.getContext('2d')!
    let frame = 0
    setInterval(() => {
      frame++
      const gradient = ctx.createLinearGradient(0, 0, width, height)
      gradient.addColorStop(0, `hsl(${hue} 35% 22%)`)
      gradient.addColorStop(1, `hsl(${hue + 40} 40% 12%)`)
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, width, height)
      ctx.fillStyle = `hsl(${hue} 60% 70% / 0.5)`
      ctx.fillRect((frame * 6) % width, 0, width / 12, height)
      ctx.fillStyle = 'white'
      ctx.font = `600 ${Math.round(height / 9)}px sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText(`${kind} de ${label}`, width / 2, height / 2)
    }, 33)
    return canvas.captureStream(30)
  }
  navigator.mediaDevices.getDisplayMedia = async () => stream('Tela', 1280, 720)
  navigator.mediaDevices.getUserMedia = async () => stream('Câmera', 640, 360)
}

async function person(browser: Browser, name: string, hue: number): Promise<Page> {
  const page = await (await browser.newContext()).newPage()
  await page.addInitScript(fakeMedia, { label: name, hue })
  return page
}

async function enter(page: Page, name: string) {
  await page.getByLabel('Seu nome').fill(name)
  await page.getByRole('button', { name: /^(Entrar na sala|Criar sala)$/ }).click()
  await expect(page.getByRole('navigation', { name: 'Pessoas na sala' })).toBeVisible()
}

async function wake(page: Page) {
  await page.mouse.move(640, 300)
  await page.mouse.move(650, 310)
}

/** Every tile's video is decoding frames. */
async function settle(page: Page, count: number) {
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('video')].filter(video => video.videoWidth > 0).length), { timeout: 45_000 }).toBe(count)
}

async function drag(page: Page, name: string, index: number, dx: number, dy: number) {
  const box = (await page.getByRole('separator', { name }).nth(index).boundingBox())!
  const x = box.x + box.width / 2, y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y + dy, { steps: 12 })
  await page.mouse.up()
}

async function shot(page: Page, name: string) {
  await page.mouse.move(2, 2)
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${DIR}/${name}.png` })
}

test('stage layouts', async ({ browser }) => {
  const a = await person(browser, 'Ana', 210)
  const b = await person(browser, 'Beto', 20)
  const c = await person(browser, 'Caio', 140)
  await a.goto('/')
  await enter(a, 'Ana')
  const code = new URL(a.url()).pathname.split('/').pop()!
  for (const [page, name] of [[b, 'Beto'], [c, 'Caio']] as const) {
    await page.goto(`/sala/${code}`)
    await enter(page, name)
  }
  for (const page of [a, b, c]) await expect(page.getByRole('navigation', { name: 'Pessoas na sala' }).getByRole('listitem')).toHaveCount(3, { timeout: 45_000 })
  for (const page of [a, b]) {
    await wake(page)
    await page.getByRole('button', { name: 'Mostrar minha tela' }).first().click()
    await expect(page.getByRole('toolbar', { name: 'Controles da sala' }).getByText('Ao vivo')).toBeVisible()
    await page.getByRole('button', { name: 'Ligar câmera' }).first().click()
  }
  await settle(c, 4)

  await shot(c, '01-grade-2-screens-2-cameras')
  await wake(c)
  await c.locator('[data-tile-key]').first().hover()
  await shot(c, '01b-grade-hover')

  await drag(c, 'Tamanho das telas', 0, 180, 0)
  await drag(c, 'Tamanho das câmeras', 0, 0, -90)
  await shot(c, '02-grade-resized')
  // A handle shows on hover.
  const handle = (await c.getByRole('separator', { name: 'Tamanho das telas' }).boundingBox())!
  await c.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await c.waitForTimeout(300)
  await c.screenshot({ path: `${DIR}/02b-handle-hover.png` })
  await c.reload()
  await c.getByRole('button', { name: 'Entrar na sala' }).click()
  await settle(c, 4)
  await shot(c, '02c-resized-after-reload')

  await c.locator('[data-tile-key]').filter({ hasText: 'Beto' }).first().click({ position: { x: 100, y: 60 } })
  await expect(c.getByRole('button', { name: 'Destacar esta tela' })).toHaveCount(3)
  await wake(c)
  await shot(c, '03-destaque')
  await wake(c)
  await c.screenshot({ path: `${DIR}/03b-destaque-dock.png` })
  await c.keyboard.press('Escape')

  await settle(a, 3)
  await wake(a)
  await a.screenshot({ path: `${DIR}/04-own-share-hidden.png` })
  await a.getByRole('button', { name: 'Ver minha tela' }).click()
  await settle(a, 4)
  await a.locator('[data-self-preview]').hover()
  await a.screenshot({ path: `${DIR}/05-own-share-shown.png` })

  for (const page of [a, b, c]) await page.context().close()
})
