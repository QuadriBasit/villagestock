import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useScrolled } from './hooks';
import { Wordmark } from './LogoMark';

const navLinks = [
  { href: '#features', label: 'Features' },
  { href: '#how', label: 'How it works' },
  { href: '#who', label: "Who it's for" },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
];

export function LandingNav() {
  const scrolled = useScrolled();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const scrollY = window.scrollY;
    const { style } = document.body;
    const prev = {
      position: style.position,
      top: style.top,
      left: style.left,
      right: style.right,
      width: style.width,
    };
    style.position = 'fixed';
    style.top = `-${scrollY}px`;
    style.left = '0';
    style.right = '0';
    style.width = '100%';
    return () => {
      style.position = prev.position;
      style.top = prev.top;
      style.left = prev.left;
      style.right = prev.right;
      style.width = prev.width;
      window.scrollTo(0, scrollY);
    };
  }, [menuOpen]);

  useEffect(() => {
    const close = () => setMenuOpen(false);
    window.addEventListener('hashchange', close);
    return () => window.removeEventListener('hashchange', close);
  }, []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <nav className={`landing-nav ${scrolled ? 'is-scrolled' : ''}`}>
        <a href="#top" className="landing-logo">
          <Wordmark />
        </a>

        <ul className="landing-nav-links">
          {navLinks.map((l) => (
            <li key={l.href}><a href={l.href}>{l.label}</a></li>
          ))}
        </ul>

        <div className="nav-actions">
          <Link to="/auth" className="landing-btn landing-btn-ghost nav-signin">Sign in</Link>
          <Link to="/auth" className="landing-btn landing-btn-primary">Start free trial</Link>
          <button
            className="nav-burger"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span /><span /><span />
          </button>
        </div>
      </nav>

      <button
        type="button"
        className={`mobile-menu-backdrop${menuOpen ? ' open' : ''}`}
        aria-label="Close menu"
        tabIndex={menuOpen ? 0 : -1}
        onPointerDown={closeMenu}
      />

      <div className={`mobile-menu ${menuOpen ? 'open' : ''}`} aria-hidden={!menuOpen}>
        {navLinks.map((l) => (
          <a key={l.href} href={l.href} onClick={closeMenu}>{l.label}</a>
        ))}
        <Link to="/auth" className="landing-btn landing-btn-primary" onClick={closeMenu}>
          Start free trial
        </Link>
      </div>
    </>
  );
}
