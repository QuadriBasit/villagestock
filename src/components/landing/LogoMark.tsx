export function LogoMark() {
  return (
    <span className="logo-mark" aria-hidden>
      <svg viewBox="0 0 24 24">
        <path d="M3 9l9-6 9 6v9a2 2 0 01-2 2h-4v-6H9v6H5a2 2 0 01-2-2V9z" />
      </svg>
    </span>
  );
}

export function Wordmark() {
  return (
    <>
      <LogoMark />
      village<span className="logo-accent">stock</span>
    </>
  );
}
