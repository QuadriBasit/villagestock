import { useState } from 'react';
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

      <div className={`mobile-menu ${menuOpen ? 'open' : ''}`}>
        {navLinks.map((l) => (
          <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)}>{l.label}</a>
        ))}
        <Link to="/auth" className="landing-btn landing-btn-primary" onClick={() => setMenuOpen(false)}>
          Start free trial
        </Link>
      </div>
    </>
  );
}
