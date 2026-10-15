import { useState } from "react";
import { Link, useLocation } from "wouter";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useSession } from "./Auth";
import Shell from "./Shell";
import { Heading, Empty, Status, Feedback, formValues } from "./Shared";
import { useRows, useRecord, submitEnquiry, dateText } from "./data";
import { whatsappUrl } from "@/lib/site";
export default function Customer() {
  const [path] = useLocation();
  const { user } = useSession();
  const projects = useRows("projects", user.uid),
    enquiries = useRows("enquiries", user.uid);
  const section = path.slice("/account".length);
  return (
    <Shell>
      {section.startsWith("/projects/") ? (
        <ProjectDetail id={section.split("/")[2]} />
      ) : section === "/new" ? (
        <EnquiryForm />
      ) : section === "/settings" ? (
        <Settings />
      ) : (
        <>
          <Heading
            title={
              section === "/projects"
                ? "My projects"
                : section === "/enquiries"
                  ? "My enquiries"
                  : `Welcome, ${user.displayName?.split(" ")[0] || "there"}.`
            }
            description="A clear view of your project, from first question to the next milestone."
            action={
              <Link className="btn-primary" href="/account/new">
                Submit a project enquiry
              </Link>
            }
          />
          {(projects.error || enquiries.error) && (
            <Feedback message={projects.error || enquiries.error} />
          )}
          {projects.loading || enquiries.loading ? (
            <p role="status">Loading your workspace…</p>
          ) : (
            <>
              {!section && (
                <div className="metric-grid">
                  <div className="metric">
                    <p>Active projects</p>
                    <strong>
                      {
                        projects.rows.filter(
                          (p) => !["Completed", "Cancelled"].includes(p.status),
                        ).length
                      }
                    </strong>
                  </div>
                  <div className="metric">
                    <p>Open enquiries</p>
                    <strong>
                      {
                        enquiries.rows.filter(
                          (e) => !e.archived && !e.projectId,
                        ).length
                      }
                    </strong>
                  </div>
                  <div className="metric">
                    <p>Completed projects</p>
                    <strong>
                      {
                        projects.rows.filter((p) => p.status === "Completed")
                          .length
                      }
                    </strong>
                  </div>
                </div>
              )}
              {section !== "/enquiries" && (
                <section>
                  <h2 className="section-heading">
                    {section ? "Your projects" : "Continue your work"}
                  </h2>
                  {projects.rows.length ? (
                    <div className="record-grid">
                      {projects.rows.map((p) => (
                        <Link
                          key={p.id}
                          href={"/account/projects/" + p.id}
                          className="record-card"
                        >
                          <div className="flex justify-between gap-3">
                            <span className="eyebrow">{p.domain}</span>
                            <Status>{p.status}</Status>
                          </div>
                          <h3>{p.title}</h3>
                          <p className="muted line-clamp-2">
                            {p.scope || "Scope will appear once agreed."}
                          </p>
                          <p className="text-sm muted mt-5">
                            Agreed deadline: {p.deadline || "To be agreed"}
                          </p>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <Empty title="Your next project starts here">
                      <Link href="/account/new" className="text-link">
                        Tell us what you are building.
                      </Link>
                    </Empty>
                  )}
                </section>
              )}
              {!section && projects.rows.length > 0 && (
                <section className="mt-9">
                  <h2 className="section-heading">
                    Latest progress & next milestones
                  </h2>
                  <div className="record-grid">
                    {projects.rows.slice(0, 3).map((p) => (
                      <RecentProgress key={p.id} id={p.id} title={p.title} />
                    ))}
                  </div>
                </section>
              )}
              {section !== "/projects" && (
                <section className="mt-9">
                  <h2 className="section-heading">Recent enquiries</h2>
                  {enquiries.rows.length ? (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Project idea</th>
                            <th>Status</th>
                            <th>Submitted</th>
                          </tr>
                        </thead>
                        <tbody>
                          {enquiries.rows.map((e) => (
                            <tr key={e.id}>
                              <td>
                                <details>
                                  <summary>{e.title}</summary>
                                  <p className="muted whitespace-pre-wrap mt-3">
                                    {e.requirements}
                                  </p>
                                  <p className="text-sm mt-2">
                                    {e.domain} ·{" "}
                                    {e.technologies || "Technology to discuss"}
                                  </p>
                                  {e.projectId && (
                                    <Link
                                      href={
                                        "/account/projects/" + e.projectId
                                      }
                                      className="text-link"
                                    >
                                      Open project
                                    </Link>
                                  )}
                                </details>
                              </td>
                              <td>
                                <Status>{e.status}</Status>
                              </td>
                              <td>{dateText(e.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty title="No enquiries yet" />
                  )}
                </section>
              )}
            </>
          )}
        </>
      )}
    </Shell>
  );
}
export function EnquiryForm() {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [id, setId] = useState(() => crypto.randomUUID());
  return (
    <>
      <Heading
        title="Tell us what you’re building."
        description="Share enough detail for a useful discussion. Scope, timelines and pricing are agreed before work starts."
      />
      <form
        className="panel form-stack max-w-3xl"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          const form = e.currentTarget;
          const data = formValues(form);
          setBusy(true);
          setMessage("");
          try {
            await submitEnquiry(id, data);
            setMessage(
              "Your enquiry has been saved. You can follow it in My enquiries.",
            );
            form.reset();
            setId(crypto.randomUUID());
          } catch (error) {
            setMessage(
              error instanceof Error && error.message.includes("minute")
                ? error.message
                : "Your enquiry could not be saved. Your details are still here; please retry.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Project title or idea
          <input name="title" required minLength={3} maxLength={160} />
        </label>
        <div className="form-grid">
          <label>
            Domain
            <select name="domain" required>
              <option value="">Select a domain</option>
              {[
                "Python",
                "Java",
                "AI / ML",
                "Web Development",
                "Documentation",
                "Viva Preparation",
                "Other software project",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Technology preferences
            <input
              name="technologies"
              maxLength={300}
              placeholder="For example, Python and Flask"
            />
          </label>
        </div>
        <label>
          Requirements and expected outcome
          <textarea
            name="requirements"
            required
            minLength={20}
            maxLength={5000}
            rows={5}
            placeholder="What have you built so far, and where do you need guidance?"
          />
        </label>
        <div className="form-grid">
          <label>
            Preferred deadline
            <input name="deadline" type="date" />
          </label>
          <label>
            Budget range (optional)
            <input name="budget" maxLength={100} placeholder="To discuss" />
          </label>
        </div>
        <label>
          Contact preference
          <select name="contactPreference">
            <option>Email</option>
            <option>WhatsApp</option>
          </select>
        </label>
        <p className="muted text-sm">
          No passwords or private student records, please. Choosing WhatsApp
          indicates your preference; you can start a chat from the contact page.{" "}
          <Link href="/privacy" className="text-link">
            How we use your information
          </Link>
          .
        </p>
        <button className="btn-primary" disabled={busy}>
          {busy ? "Saving…" : "Submit enquiry"}
        </button>
        <Feedback message={message} />
      </form>
    </>
  );
}
export function Settings() {
  const { user, admin } = useSession();
  const { data, error } = useRecord("users/" + user.uid);
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <>
      <Heading
        title="Profile & settings"
        description="Your Google account secures sign-in. Your contact preference helps us respond."
      />
      <div className="panel max-w-2xl">
        <p className="muted mb-5">
          Signed in as {user.email} · {admin ? "Administrator" : "Customer"}
        </p>
        {error ? (
          <Feedback message={error} />
        ) : data ? (
          <form
            key={data.id}
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await updateDoc(doc(db, "users", user.uid), {
                  ...formValues(e.currentTarget),
                  updatedAt: serverTimestamp(),
                });
                setMessage("Profile updated.");
              } catch {
                setMessage("Could not update your profile. Please retry.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Display name
              <input
                name="name"
                defaultValue={data.name}
                minLength={1}
                maxLength={100}
                required
              />
            </label>
            <label>
              Contact preference
              <select
                name="contactPreference"
                defaultValue={data.contactPreference}
              >
                <option>Email</option>
                <option>WhatsApp</option>
              </select>
            </label>
            <button className="btn-primary" disabled={busy}>
              {busy ? "Saving…" : "Save profile"}
            </button>
            <Feedback message={message} />
          </form>
        ) : (
          <p role="status">Loading profile…</p>
        )}
        <p className="muted text-sm mt-6">
          Roles cannot be edited here. Contact the business about account
          deletion or access changes.
        </p>
      </div>
    </>
  );
}
export function ProjectDetail({ id }: { id: string }) {
  const { data: p, error, loading } = useRecord("projects/" + id);
  const milestones = useRows(`projects/${id}/milestones`),
    updates = useRows(`projects/${id}/updates`);
  if (loading) return <p role="status">Loading project…</p>;
  if (error) return <><Heading title="Project unavailable"/><Feedback message={error} /></>;
  if (!p)
    return (
      <Empty title="Project unavailable">
        The record may not exist or may not be linked to your account.
      </Empty>
    );
  return (
    <>
      <Heading
        title={p.title}
        description={p.domain}
        action={<Status>{p.status}</Status>}
      />
      <div className="detail-grid">
        <section className="panel">
          <h2 className="section-heading">Agreed scope</h2>
          <p className="whitespace-pre-wrap muted">
            {p.scope || "To be agreed."}
          </p>
          <dl className="mt-6 space-y-3">
            <div>
              <dt className="muted">Deadline</dt>
              <dd>{p.deadline || "To be agreed"}</dd>
            </div>
            <div>
              <dt className="muted">Agreed price</dt>
              <dd>
                {p.price > 0
                  ? new Intl.NumberFormat("en-IN", {
                      style: "currency",
                      currency: "INR",
                    }).format(p.price)
                  : "To be agreed"}
              </dd>
            </div>
          </dl>
          <a
            href={whatsappUrl(
              `Hi, I have a question about my project: ${p.title}`,
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline mt-6"
          >
            Discuss this project
          </a>
        </section>
        <section className="panel">
          <h2 className="section-heading">Milestones</h2>
          {milestones.error ? (
            <Feedback message={milestones.error} />
          ) : milestones.rows.length ? (
            <ol className="space-y-5">
              {[...milestones.rows]
                .sort((a, b) =>
                  (a.dueDate || "").localeCompare(b.dueDate || ""),
                )
                .map((m) => (
                  <li key={m.id}>
                    <h3>{m.title}</h3>
                    <p className="muted text-sm">
                      {m.dueDate || "Date to be agreed"} · {m.status}
                    </p>
                  </li>
                ))}
            </ol>
          ) : (
            <p className="muted">Agreed milestones will appear here.</p>
          )}
        </section>
      </div>
      <section className="panel mt-6">
        <h2 className="section-heading">Project updates</h2>
        {updates.error ? (
          <Feedback message={updates.error} />
        ) : updates.rows.length ? (
          updates.rows.map((u) => (
            <article key={u.id} className="update-entry">
              <p className="muted text-xs mb-2">{dateText(u.createdAt)}</p>
              <p className="whitespace-pre-wrap">{u.body}</p>
            </article>
          ))
        ) : (
          <p className="muted">Updates will appear as the work progresses.</p>
        )}
      </section>
    </>
  );
}

function RecentProgress({ id, title }: { id: string; title: string }) {
  const updates = useRows("projects/" + id + "/updates"),
    milestones = useRows("projects/" + id + "/milestones");
  const next = milestones.rows
    .filter((m) => m.status !== "Completed")
    .sort((a, b) =>
      (a.dueDate || "9999").localeCompare(b.dueDate || "9999"),
    )[0];
  return (
    <article className="panel">
      <h3 className="section-heading">{title}</h3>
      {updates.error || milestones.error ? (
        <Feedback message={updates.error || milestones.error} />
      ) : updates.loading || milestones.loading ? (
        <p role="status" className="muted">
          Loading progress…
        </p>
      ) : (
        <>
          <p className="text-xs muted mb-2">Latest update</p>
          <p className="text-sm whitespace-pre-wrap">
            {updates.rows[0]?.body ||
              "Your first progress update will appear here."}
          </p>
          <p className="text-xs muted mt-5 mb-2">Next milestone</p>
          <p className="text-sm">
            {next
              ? next.title + " · " + (next.dueDate || "Date to agree")
              : "No outstanding milestone has been recorded."}
          </p>
        </>
      )}
      <Link className="text-link mt-5" href={"/account/projects/" + id}>
        Open project
      </Link>
    </article>
  );
}
