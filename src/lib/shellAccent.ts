export const DEFAULT_SHELL_ACCENT = '#a78bfa';

/** Apply shop receipt / brand color to the authenticated app shell. */
export function applyShellAccent(color: string, root?: HTMLElement | null) {
  const el = root ?? document.querySelector<HTMLElement>('.app-shell');
  if (!el) return;
  const accent = color?.trim() || DEFAULT_SHELL_ACCENT;
  el.style.setProperty('--accent', accent);
}

export function resetShellAccent(root?: HTMLElement | null) {
  applyShellAccent(DEFAULT_SHELL_ACCENT, root);
}
