import { Link } from "wouter";
export default function TrackLookup() {
 return <section className="container page-intro"><h1>My project status</h1><p className="muted">Sign in with the Google account linked to your project to see your agreed scope, milestones and progress.</p><Link href="/account/projects" className="btn-primary mt-6">View my projects</Link></section>;
}
