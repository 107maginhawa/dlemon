/**
 * Appearance toggle — Default ↔ White. Client-only, persisted per-device in
 * localStorage. The "White" theme is two CSS classes on <html>: the `theme-white`
 * color preset + the `skin-line` skin (soft corners, Shantell/Nunito, no shadow),
 * both defined in src/styles/globals.css.
 *
 * Pre-paint application (avoiding a flash on load) is done by the inline script
 * in index.html; keep that script's classes in sync with WHITE_CLASSES below.
 *
 * ponytail: two looks → a boolean is enough; graduate to a named-preset registry
 * only if more themes get added.
 */
const KEY = 'dl-theme';
const WHITE_CLASSES = ['theme-white', 'skin-line'] as const;

export function isWhiteTheme(): boolean {
  try {
    return localStorage.getItem(KEY) === 'white';
  } catch {
    return false;
  }
}

export function setWhiteTheme(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? 'white' : '');
  } catch {
    /* private mode / storage disabled — still apply for this session */
  }
  WHITE_CLASSES.forEach((c) => document.documentElement.classList.toggle(c, on));
}
