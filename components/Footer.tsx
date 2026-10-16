import Image from "next/image";
import Link from "next/link";
import { EVENT, ORG_NAME, ORG_SHORT, ORG_TAGLINE } from "@/lib/registration";

export default function Footer() {
  return (
    <footer id="about" className="site-footer ngo-section">
      <div className="container ngo-grid">
        <div className="ngo-identity">
          <span className="eyebrow">The people behind Saath</span>
          <span className="logo-badge"><Image src="/logo.jpg" alt={`${ORG_NAME} logo`} width={190} height={190} /></span>
          <p>“{ORG_TAGLINE}”</p>
        </div>
        <div className="ngo-copy">
          <span className="eyebrow">About {ORG_SHORT}</span>
          <h2>{ORG_NAME}</h2>
          <p>We are a non-profit dedicated to the wellbeing of underprivileged children. Every child deserves care, opportunity and the space to simply be a child.</p>
          <div className="footer-links">
            <div>
              <h4>Quick links</h4>
              <ul>
                <li><Link href="/#event">{EVENT.name}</Link></li>
                <li><Link href="/register">Register</Link></li>
              </ul>
            </div>
            <div>
              <h4>Contact</h4>
              <ul>
                <li>📍 ABES, Ghaziabad, India</li>
                <li>For any help, please approach the help desk.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      <div className="container">
        <p className="copyright">© {new Date().getFullYear()} {ORG_NAME} ({ORG_SHORT}). All rights reserved.</p>
      </div>
    </footer>
  );
}
