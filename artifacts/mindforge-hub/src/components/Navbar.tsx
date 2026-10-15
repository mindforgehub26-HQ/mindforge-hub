import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, ArrowUpRight } from "lucide-react";
import AccountActions from "./AccountActions";
import ThemeToggle from "./ThemeToggle";
const links = [
  ["/", "Home"],
  ["/services", "Services"],
  ["/portfolio", "Portfolio"],
  ["/how-it-works", "How it works"],
  ["/faq", "FAQs"],
  ["/contact", "Contact"],
];
export default function Navbar() {
  const [path] = useLocation();
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="site-nav container">
        <Link href="/" className="brand">
          <img src="/logo.png" alt="" width="34" height="34" />
          MindForge Hub<span className="brand-dot">.</span>
        </Link>
        <nav className="desktop-nav" aria-label="Main navigation">
          {links.map(([url, label]) => (
            <Link
              href={url}
              key={url}
              aria-current={url === path ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="nav-actions">
          <ThemeToggle />
          <div className="nav-sign-in flex items-center gap-3"><AccountActions /></div>
          <Link className="btn-primary nav-cta" href="/contact">
            Discuss your project
            <ArrowUpRight size={16} />
          </Link>
          <button
            className="icon-button nav-menu"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            aria-controls="mobile-navigation"
            onClick={() => setOpen(!open)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
            }}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {open && (
        <nav
          className="mobile-nav container"
          id="mobile-navigation"
          aria-label="Mobile navigation"
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        >
          {links.map(([url, label]) => (
            <Link
              href={url}
              key={url}
              onClick={() => setOpen(false)}
              aria-current={url === path ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
          <AccountActions />
          <Link
            href="/contact"
            className="btn-primary"
            onClick={() => setOpen(false)}
          >
            Discuss your project
          </Link>
        </nav>
      )}
    </header>
  );
}
