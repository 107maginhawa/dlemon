/**
 * Test environment setup. Preloaded by `bunfig.toml` before any test file runs.
 *
 * Registers happy-dom globals (window, document, navigator, etc.) so React
 * Testing Library and any code path that touches the DOM works under
 * `bun test`. Without this, component tests fail with
 * `ReferenceError: document is not defined`.
 */

import { GlobalRegistrator } from '@happy-dom/global-registrator'

if (!GlobalRegistrator.isRegistered) {
  GlobalRegistrator.register({
    url: 'http://localhost/',
  })
}
