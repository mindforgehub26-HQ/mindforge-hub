import { Link } from "wouter";
import { site } from "@/lib/site";
export default function Contact() {
  return <section className="container page-intro"><p className="eyebrow">LET’S TALK ABOUT YOUR PROJECT</p><h1>Tell us what you want to build.</h1><p className="muted">Sign in with Google to submit an enquiry securely. Your requirements and project updates are visible only to you and our administrators.</p><div className="button-row mt-6"><Link href="/account/new" className="btn-primary">Submit enquiry</Link><Link href="/account/projects" className="btn-outline">My project status</Link></div><p className="muted mt-6">For general questions: <a className="text-link" href={"mailto:" + site.email}>{site.email}</a></p></section>;
}
