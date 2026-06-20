import { Link } from 'react-router-dom';
import { Wordmark } from './LogoMark';

export function LandingFooter() {
  return (
    <footer className="landing-footer">
      <div className="footer-top">
        <div className="footer-brand">
          <div className="landing-logo">
            <Wordmark />
          </div>
          <p className="footer-tagline">The offline-first business OS for electronics &amp; gadget retailers.</p>
        </div>
        <div className="footer-cols">
          <div className="footer-col">
            <h5>Product</h5>
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="footer-col">
            <h5>Company</h5>
            <a href="#who">Who it's for</a>
            <a href="mailto:hello@villagestock.com">Contact</a>
            <a href="#top">Back to top</a>
          </div>
          <div className="footer-col">
            <h5>Get started</h5>
            <Link to="/auth">Sign in</Link>
            <Link to="/auth">Create account</Link>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <p className="footer-copy">© {new Date().getFullYear()} VillageStock. All rights reserved.</p>
        <ul className="footer-links">
          <li><a href="#">Privacy</a></li>
          <li><a href="#">Terms</a></li>
          <li><a href="mailto:hello@villagestock.com">Contact</a></li>
        </ul>
      </div>
    </footer>
  );
}
