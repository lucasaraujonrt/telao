import { defineConfig } from '@playwright/test'
import base from './playwright.config'

// Records the README demo against a deployed site: DEMO=1 npx playwright test -c playwright.demo.config.ts
export default defineConfig({
  ...base,
  testMatch: 'demo.spec.ts',
  webServer: undefined,
  use: { ...base.use, baseURL: process.env.DEMO_URL ?? 'https://telao-snowy.vercel.app' },
})
