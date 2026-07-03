export const DEFAULT_SHELL_ACCENT = '#a78bfa';

/** Apply shop receipt / brand color to the authenticated app shell and portaled overlays. */
export function applyShellAccent(color: string, root?: HTMLElement | null) {
  const accent = color?.trim() || DEFAULT_SHELL_ACCENT;
  const shell = root ?? document.querySelector<HTMLElement>('.app-shell');
  shell?.style.setProperty('--accent', accent);
  // Modals portal to document.body — outside .app-shell — so accent must live on :root too.
  document.documentElement.style.setProperty('--accent', accent);
}

export function resetShellAccent(root?: HTMLElement | null) {
  applyShellAccent(DEFAULT_SHELL_ACCENT, root);
}
