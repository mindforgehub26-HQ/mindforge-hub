import { Link, useLocation } from "wouter";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  FolderKanban,
  MessageSquare,
  Users,
  Image,
  FileText,
  Activity,
  Settings,
  LogOut,
  Menu,
  X,
  ArrowUpRight,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/firebase/config";
import { useSession } from "./Auth";
import ThemeToggle from "@/components/ThemeToggle";
export default function Shell({
  children,
  admin = false,
}: {
  children: ReactNode;
  admin?: boolean;
}) {
  const [path] = useLocation();
  const [open, setOpen] = useState(false);
  const session = useSession();
  const base = admin ? "/admin" : "/account";
  const links = admin
    ? ([
        ["", "Overview", LayoutDashboard],
        ["/enquiries", "Enquiries", MessageSquare],
        ["/customers", "Customers", Users],
        ["/projects", "Projects", FolderKanban],
        ["/portfolio", "Portfolio", Image],
        ["/content", "Website content", FileText],
        ["/activity", "Activity", Activity],
        ["/settings", "Settings", Settings],
        ["/legacy", "Existing records", FolderKanban],
      ] as const)
    : ([
        ["", "Overview", LayoutDashboard],
        ["/projects", "My projects", FolderKanban],
        ["/enquiries", "My enquiries", MessageSquare],
        ["/new", "Submit enquiry", FileText],
        ["/settings", "Profile & settings", Settings],
      ] as const);
  if (!admin) return <section className="container py-10"><nav className="button-row mb-8" aria-label="My account"><Link href="/">Home</Link><Link href="/account/new">Submit enquiry</Link><Link href="/account/projects">My project status</Link><Link href="/account/enquiries">My enquiries</Link><Link href="/account/settings">My profile</Link></nav>{children}</section>;
  return (
    <div className="workspace">
      <aside className={`workspace-sidebar ${open ? "is-open" : ""}`}>
        <div className="flex justify-between items-center">
          <Link href="/" className="brand">
            <img src="/logo.png" width="32" height="32" alt="" />
            MindForge Hub
          </Link>
          <button
            className="icon-button mobile-only"
            aria-label="Close workspace navigation"
            onClick={() => setOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <p className="eyebrow mt-9 mb-4">
          {admin ? "BUSINESS WORKSPACE" : "CUSTOMER WORKSPACE"}
        </p>
        <nav aria-label="Workspace navigation">
          {links.map(([url, label, Icon]) => (
            <Link
              key={url}
              href={base + url}
              onClick={() => setOpen(false)}
              aria-current={path === base + url ? "page" : undefined}
              className={`workspace-link ${path === base + url ? "active" : ""}`}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link href="/" className="workspace-link">
            <ArrowUpRight size={18} />
            Visit website
          </Link>
          {session.admin && (
            <Link
              className="workspace-link"
              href={admin ? "/account" : "/admin"}
            >
              {admin ? "Customer workspace" : "Admin workspace"}
            </Link>
          )}
          <button
            className="workspace-link w-full"
            onClick={() => signOut(auth)}
          >
            <LogOut size={18} />
            Sign out
          </button>
          <p className="text-xs muted mt-4 break-all">{session.user.email}</p>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="workspace-header">
          <button
            className="icon-button mobile-only"
            aria-label="Open workspace navigation"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            <Menu size={20} />
          </button>
          <span className="text-sm muted">
            {admin ? "Administration" : "Your workspace"}
          </span>
          <div className="flex items-center gap-3">
            <span className="text-sm">
              {session.user.displayName || "Account"}
            </span>
            <ThemeToggle />
          </div>
        </header>
        <div className="workspace-content">{children}</div>
      </div>
    </div>
  );
}
