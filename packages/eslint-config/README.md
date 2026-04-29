# @monobase/eslint-config

Shared ESLint flat configs for the Monobase monorepo.

## Usage

Add the package as a dependency in any workspace:

```jsonc
{
  "devDependencies": {
    "@monobase/eslint-config": "workspace:*"
  }
}
```

Then create an `eslint.config.js` in the workspace root:

```js
// Node/TypeScript packages and services
import config from '@monobase/eslint-config/base';
export default config;

// React (Vite) apps and component packages
import config from '@monobase/eslint-config/react';
export default config;

// Next.js apps
import config from '@monobase/eslint-config/next';
export default config;
```

## Exports

- `./base` — TypeScript + recommended rules. For Node/Bun packages.
- `./react` — base + React + react-hooks. For Vite/React apps and component libraries.
- `./next` — react + Next.js plugin (core web vitals). For Next.js apps.
