/**
 * Test environment setup. Preloaded by `bunfig.toml` before any test file runs.
 *
 * Registers happy-dom globals (window, document, navigator, etc.) so React
 * Testing Library works under `bun test`. The afterAll cleanup is critical —
 * without it, GlobalRegistrator keeps the event loop alive after tests finish,
 * causing `bun test` to hang indefinitely.
 */

import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { afterAll } from 'bun:test'

if (!GlobalRegistrator.isRegistered) {
  GlobalRegistrator.register({ url: 'http://localhost/' })
}

afterAll(async () => {
  if (GlobalRegistrator.isRegistered) {
    await GlobalRegistrator.unregister()
  }
})
