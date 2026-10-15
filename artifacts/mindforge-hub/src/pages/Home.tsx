import { Link } from "wouter";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  Terminal,
  GitBranch,
} from "lucide-react";
import { ServiceGrid, CallToAction, steps } from "@/components/PublicSections";
import { Announcement, PricingNote } from "@/components/PublicContent";
import { faqs } from "./Faq";
export default function Home() {
  return (
    <>
      <Announcement />
      <section className="container hero">
        <div>
          <p className="eyebrow">
            <span className="small-dot" />
            ACADEMIC PROJECTS & SOFTWARE SUPPORT
          </p>
          <h1>
            Your ideas.
            <br />A clearer path
            <br />
            <span>to building them.</span>
          </h1>
          <p className="hero-copy">
            Software project guidance, documentation and viva support for students. Practical help for your software project,
            documentation and presentation. Understand the work. Make your next
            step count.
          </p>
          <div className="button-row">
            <Link href="/account/new" className="btn-primary">
              Submit project enquiry
              <ArrowUpRight size={18} />
            </Link>
            <Link href="/services" className="btn-outline">
              Explore services
              <ArrowRight size={17} />
            </Link>
          </div>
          <Link href="/sign-in" className="btn-outline mt-5">Sign up / Sign in with Google</Link>
          <p className="hero-footnote">
            Indicative prices: PPT ₹300–₹1,000 · reports ₹500–₹1,500. Software projects are quoted after reviewing your requirements.
          </p>
        </div>
        <div
          className="project-visual"
          aria-label="Illustration of a structured project workflow"
        >
          <div className="visual-toolbar">
            <span>
              <Terminal size={16} /> A PROJECT, WITH DIRECTION
            </span>
            <GitBranch size={17} />
          </div>
          <div className="visual-body">
            <div className="visual-line">
              <span className="eyebrow">01 / THE STARTING POINT</span>
              <span className="status-tag">Your idea</span>
            </div>
            <h2>
              From “where do I start?”
              <br />
              to “here’s how it works.”
            </h2>
            <div className="visual-steps">
              {[
                ["Define the problem", "A useful outcome, a realistic scope"],
                ["Build and understand", "Decisions, implementation, testing"],
                ["Explain with confidence", "Documentation, demo, viva"],
              ].map(([title, body], i) => (
                <div className="visual-step" key={title}>
                  <span>
                    {i === 0 ? (
                      <Check size={16} />
                    ) : (
                      String(i + 1).padStart(2, "0")
                    )}
                  </span>
                  <div>
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="visual-code">
              <span className="muted">const</span> nextStep ={" "}
              <span>"make it understandable"</span>;<br />
              <span className="muted">// Small steps. Real understanding.</span>
            </div>
          </div>
        </div>
      </section>
      <div className="domain-strip">
        <div className="container">
          <span>GUIDANCE ACROSS</span>
          <Link href="/domains">Python</Link>
          <Link href="/domains">Java</Link>
          <Link href="/domains">AI / ML</Link>
          <Link href="/domains">Web development</Link>
        </div>
      </div>
      <section className="container section-space">
        <div className="section-top">
          <div>
            <p className="eyebrow">SUPPORT THAT MEETS YOU WHERE YOU ARE</p>
            <h2>Get unstuck. Build with understanding.</h2>
          </div>
          <Link href="/services" className="text-link">
            All services
            <ArrowUpRight size={16} />
          </Link>
        </div>
        <ServiceGrid compact />
        <p className="muted mt-7">
          Preparing to present? We also help with{" "}
          <Link href="/services" className="text-link">
            presentations and viva preparation.
          </Link>
        </p>
      </section>
      <section className="section-muted">
        <div className="container section-space">
          <div className="section-top">
            <div>
              <p className="eyebrow">HOW WE WORK</p>
              <h2>One clear step at a time.</h2>
            </div>
            <Link href="/how-it-works" className="text-link">
              Our process
              <ArrowUpRight size={16} />
            </Link>
          </div>
          <ol className="process-grid">
            {steps.map(([title, body], i) => (
              <li key={title}>
                <span className="step-number">0{i + 1}</span>
                <h3>{title}</h3>
                <p className="muted">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className="container section-space split-section">
        <div>
          <p className="eyebrow">THE WORK, AND THE WAY WE WORK</p>
          <h2>
            Clear expectations.
            <br />
            Useful guidance.
          </h2>
          <p className="muted mt-5">
            You should know what support you are getting, what it costs and what
            comes next. We agree these details before starting.
          </p>
          <Link href="/portfolio" className="text-link mt-6">
            Explore the project portfolio
            <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="principles">
          {[
            [
              "A scope you can review",
              "Deliverables, timelines and revision terms agreed in writing.",
            ],
            [
              "Work you can understand",
              "Guidance centred on your learning, implementation and explanation.",
            ],
            [
              "Progress you can follow",
              "A private workspace for your enquiries, projects and agreed updates.",
            ],
          ].map(([a, b]) => (
            <div key={a}>
              <Check size={18} />
              <div>
                <h3>{a}</h3>
                <p className="muted">{b}</p>
              </div>
            </div>
          ))}
          <div>
            <ArrowUpRight size={18} />
            <div>
              <h3>Pricing for your requirements</h3>
              <PricingNote />
              <Link href="/services" className="text-link mt-2">
                View service pricing
              </Link>
            </div>
          </div>
        </div>
      </section>
      <section className="container faq-section">
        <div>
          <p className="eyebrow">A FEW THINGS TO KNOW</p>
          <h2>Before you get started.</h2>
          <Link href="/faq" className="text-link mt-5">
            All questions
            <ArrowUpRight size={16} />
          </Link>
        </div>
        <div>
          {faqs.slice(0, 4).map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p className="muted">{a}</p>
            </details>
          ))}
        </div>
      </section>
      <CallToAction />
    </>
  );
}
