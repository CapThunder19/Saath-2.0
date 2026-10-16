import Image from "next/image";
import Link from "next/link";
import { ORG_NAME } from "@/lib/registration";

export default function Header() {
  return (
    <header className="site-header">
      <nav className="container nav" aria-label="Main navigation">
        <Link href="/" className="logo" aria-label={`${ORG_NAME} home`}>
          <span className="logo-badge">
            <Image src="/logo.jpg" alt={`${ORG_NAME} logo`} width={52} height={52} preload />
          </span>
          <span className="logo-text">Saath<small>by HUHC</small></span>
        </Link>
        <div className="nav-actions">
          <Link href="/ticket" className="btn btn-outline">View ticket</Link>
          <Link href="/register" className="btn btn-primary">Register now</Link>
        </div>
      </nav>
    </header>
  );
}
