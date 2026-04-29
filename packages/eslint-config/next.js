import tseslint from 'typescript-eslint';
import nextPlugin from '@next/eslint-plugin-next';
import react from './react.js';

/** ESLint flat config for Next.js apps. Extends the React config with Next-specific rules. */
export default tseslint.config(
  ...react,
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    plugins: {
      '@next/next': nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },
);
