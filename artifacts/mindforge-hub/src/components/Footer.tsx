import { Link } from "wouter";
import { site, whatsappUrl } from "@/lib/site";
export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Link href="/" className="brand">
              <img src="/logo.png" width="32" height="32" alt="" />
              MindForge Hub.
            </Link>
            <p className="muted max-w-sm mt-5">
              Practical guidance for the software you build and the ideas you
              want to explain.
            </p>
          </div>
          <div>
            <h2>Explore</h2>
            {[
              ["/services", "Services & pricing"],
              ["/domains", "Technical domains"],
              ["/portfolio", "Project portfolio"],
              ["/blog", "Learning resources"],
              ["/track", "Existing project tracking"],
            ].map(([url, label]) => (
              <Link href={url} key={url}>
                {label}
              </Link>
            ))}
          </div>
          <div>
            <h2>Let’s talk</h2>
            <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer">
              WhatsApp: +91 80567 27034
            </a>
            <a className="break-all" href={"mailto:" + site.email}>
              {site.email}
            </a>
            <a href={site.instagram} target="_blank" rel="noopener noreferrer">
              Instagram ↗
            </a>
            <Link href="/sign-in">Google signup / Customer workspace</Link>
            <Link href="/admin">Admin portal</Link>
          </div>
        </div>
        <div className="integrity-note">
          Educational guidance and software support. You remain responsible for
          understanding your work, citing sources and following your
          institution’s academic integrity rules.
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} MindForge Hub</span>
          <div>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Service terms</Link>
            <Link href="/faq">FAQs</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
