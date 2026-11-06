import { mkdirSync, writeFileSync } from 'node:fs'
import { expect, test, type Browser, type Page } from '@playwright/test'

// Records the demo video for the README, not a regression test.
// Ana shares a screen and a camera, Beto turns on a camera, Caio (recorded) joins and messes with them.

test.skip(!process.env.DEMO, 'demo only: DEMO=1 npx playwright test -c playwright.demo.config.ts')

const SIZE = { width: 1280, height: 720 }

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

async function person(browser: Browser, name: string, hue: number, record = false): Promise<Page> {
  const context = await browser.newContext({ viewport: SIZE })
  const page = await context.newPage()
  if (record) await screencast(page)
  await page.addInitScript(fakeMedia, { label: name, hue })
  return page
}

const DIR = 'e2e/demo'

/** Saves Chrome's screencast frames and an ffconcat list, turned into a GIF by scripts/demo-gif.sh. */
async function screencast(page: Page) {
  mkdirSync(DIR, { recursive: true })
  const session = await page.context().newCDPSession(page)
  const frames: Array<{ file: string; time: number }> = []
  session.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    const file = `frame-${String(frames.length).padStart(5, '0')}.jpg`
    writeFileSync(`${DIR}/${file}`, Buffer.from(data, 'base64'))
    frames.push({ file, time: metadata.timestamp ?? 0 })
    const list = frames.map((frame, i) => `file '${frame.file}'\nduration ${((frames[i + 1]?.time ?? frame.time + 0.1) - frame.time).toFixed(3)}`)
    writeFileSync(`${DIR}/frames.ffconcat`, `ffconcat version 1.0\n${list.join('\n')}\n`)
    void session.send('Page.screencastFrameAck', { sessionId })
  })
  await session.send('Page.startScreencast', { format: 'jpeg', quality: 85, maxWidth: SIZE.width, maxHeight: SIZE.height })
}

async function enter(page: Page, name: string, slow = false) {
  const field = page.getByLabel('Seu nome')
  if (slow) await field.pressSequentially(name, { delay: 90 })
  else await field.fill(name)
  await page.getByRole('button', { name: /^(Entrar na sala|Criar sala)$/ }).click()
  await expect(page.getByRole('navigation', { name: 'Pessoas na sala' })).toBeVisible()
}

async function wake(page: Page) {
  await page.mouse.move(640, 300)
  await page.mouse.move(650, 310)
}

test('demo', async ({ browser }) => {
  test.setTimeout(180_000)
  const a = await person(browser, 'Ana', 210)
  const b = await person(browser, 'Beto', 20)
  await a.goto('/')
  await enter(a, 'Ana')
  const code = new URL(a.url()).pathname.split('/').pop()!
  await b.goto(`/sala/${code}`)
  await enter(b, 'Beto')
  await wake(a)
  await a.getByRole('button', { name: 'Mostrar minha tela' }).first().click()
  await a.getByRole('button', { name: 'Ligar câmera' }).first().click()
  await wake(b)
  await b.getByRole('button', { name: 'Ligar câmera' }).first().click()

  const c = await person(browser, 'Caio', 140, true)
  await c.goto(`/sala/${code}`)
  await c.waitForTimeout(800)
  await enter(c, 'Caio', true)
  await expect.poll(() => c.evaluate(() => [...document.querySelectorAll('video')].filter(v => v.videoWidth > 0).length), { timeout: 45_000 }).toBe(3)
  await c.waitForTimeout(1200)

  const screen = c.locator('[data-tile-key]').filter({ hasText: 'Ana' }).first()
  const box = (await screen.boundingBox())!
  const at = (fx: number, fy: number) => ({ x: box.x + box.width * fx, y: box.y + box.height * fy })

  // Tomato, egg and slipper on Ana's screen.
  for (const [key, fx, fy] of [['z', 0.35, 0.4], ['x', 0.65, 0.35], ['c', 0.5, 0.6]] as const) {
    await c.keyboard.press(key)
    const p = at(fx, fy)
    await c.mouse.move(p.x, p.y, { steps: 15 })
    await c.mouse.click(p.x, p.y)
    await c.waitForTimeout(900)
  }
  await c.keyboard.press('Escape')

  // Reactions on the same screen.
  const p = at(0.5, 0.5)
  await c.mouse.move(p.x, p.y, { steps: 10 })
  for (const key of ['1', '3', '3', '2', '1']) {
    await c.keyboard.press(key)
    await c.waitForTimeout(250)
  }
  await c.waitForTimeout(1500)

  // Memes panel.
  await c.keyboard.press('b')
  await c.waitForTimeout(900)
  const meme = c.getByRole('region', { name: 'Memes' }).getByRole('listitem').nth(2).getByRole('button').first()
  if (await meme.isVisible()) { await meme.hover(); await c.waitForTimeout(300); await meme.click() }
  await c.waitForTimeout(2500)

  await c.context().close()
  for (const page of [a, b]) await page.context().close()
})
