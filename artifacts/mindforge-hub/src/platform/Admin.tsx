import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { collection, doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/firebase/config";
import Shell from "./Shell";
import LegacyAdmin from "@/pages/Admin";
import { Settings } from "./Customer";
import {
  Heading,
  Empty,
  Feedback,
  Status,
  formValues,
  enquiryStatuses,
  projectStatuses,
} from "./Shared";
import {
  useRows,
  useRecord,
  saveRecord,
  projectFromEnquiry,
  addUpdate,
  dateText,
  type Row,
} from "./data";

import VisitorStats from "./VisitorStats";
function SaveForm({
  children,
  save,
  label = "Save changes",
  className = "panel form-stack",
  afterSave,
}: {
  children: ReactNode;
  save: (data: Record<string, string>) => Promise<unknown>;
  label?: string;
  className?: string;
  afterSave?: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const values = formValues(e.currentTarget);
    setBusy(true);
    setMessage("");
    try {
      await save(values);
      setMessage("Saved successfully.");
      afterSave?.();
    } catch (error) {
      setMessage(
        error instanceof Error && error.message.startsWith("Confirm")
          ? error.message
          : "Could not save. Check the fields and your connection, then retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className={className} onSubmit={submit}>
      <fieldset disabled={busy} className="contents">
        {children}
        <div>
          <button className="btn-primary" disabled={busy}>
            {busy ? "Saving…" : label}
          </button>
        </div>
      </fieldset>
      <Feedback message={message} />
    </form>
  );
}
function Notes({ id }: { id: string }) {
  const { data, error, loading } = useRecord("internalNotes/" + id);
  return (
    <section className="mt-6">
      <h2 className="section-heading">Internal notes</h2>
      <p className="muted text-sm mb-3">Visible only to administrators.</p>
      {loading ? (
        <p>Loading notes…</p>
      ) : error ? (
        <Feedback message={error} />
      ) : (
        <SaveForm
          save={(d) =>
            saveRecord("internalNotes/" + id, d, "Update internal note")
          }
        >
          <label>
            Notes
            <textarea
              name="body"
              rows={4}
              maxLength={10000}
              defaultValue={data?.body || ""}
            />
          </label>
        </SaveForm>
      )}
    </section>
  );
}
function Search({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="search-field">
      Search records
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search by title, name or email"
      />
    </label>
  );
}
const matches = (r: Row, q: string) =>
  [r.title, r.name, r.email, r.domain, r.ownerUid].some((x) =>
    String(x || "")
      .toLowerCase()
      .includes(q.toLowerCase()),
  );
export default function Admin() {
  const [path] = useLocation();
  const section = path.slice("/admin".length);
  return (
    <Shell admin>
      {section === "/legacy" ? (
        <>
          <Heading
            title="Existing records"
            description="Original client tracking and payment records, preserved for continuity."
          />
          <LegacyAdmin />
        </>
      ) : section.startsWith("/enquiries/") ? (
        <Enquiry id={section.split("/")[2]} />
      ) : section.startsWith("/projects/") ? (
        <ProjectEditor id={section.split("/")[2]} />
      ) : section === "/enquiries" ? (
        <Enquiries />
      ) : section === "/customers" ? (
        <Customers />
      ) : section === "/projects" ? (
        <Projects />
      ) : section === "/portfolio" ? (
        <PortfolioEditor />
      ) : section === "/content" ? (
        <ContentEditor />
      ) : section === "/activity" ? (
        <Activity />
      ) : section === "/settings" ? (
        <Settings />
      ) : section === "" ? (
        <Overview />
      ) : (
        <Empty title="Page not found">
          <Link href="/admin">Return to overview</Link>
        </Empty>
      )}
    </Shell>
  );
}
function Overview() {
  const enquiries = useRows("enquiries"),
    projects = useRows("projects"),
    customers = useRows("users"),
    activity = useRows("activity");
  const error = enquiries.error || projects.error || customers.error;
  return (
    <>
      <VisitorStats />
      <Heading
        title="Business overview"
        description="Real enquiries, active work and the next decisions to make."
      />
      {error ? (
        <Feedback message={error} />
      ) : enquiries.loading || projects.loading || customers.loading ? (
        <p role="status">Loading overview…</p>
      ) : (
        <>
          <div className="metric-grid">
            <Link href="/admin/enquiries" className="metric">
              <p>Open enquiries</p>
              <strong>
                {
                  enquiries.rows.filter((e) => !e.archived && !e.projectId)
                    .length
                }
              </strong>
            </Link>
            <Link href="/admin/projects" className="metric">
              <p>Active projects</p>
              <strong>
                {
                  projects.rows.filter(
                    (p) => !["Completed", "Cancelled"].includes(p.status),
                  ).length
                }
              </strong>
            </Link>
            <Link href="/admin/customers" className="metric">
              <p>Registered accounts</p>
              <strong>{customers.rows.length}</strong>
            </Link>
            <div className="metric">
              <p>Total enquiries</p>
              <strong>{enquiries.rows.length}</strong>
            </div>
            <div className="metric">
              <p>Awaiting first response</p>
              <strong>
                {
                  enquiries.rows.filter((e) => e.status === "Enquiry Received")
                    .length
                }
              </strong>
            </div>
            <div className="metric">
              <p>Completed projects</p>
              <strong>
                {projects.rows.filter((p) => p.status === "Completed").length}
              </strong>
            </div>
          </div>
          <div className="detail-grid mb-8">
            <section className="panel">
              <h2 className="section-heading">Upcoming agreed deadlines</h2>
              {projects.rows
                .filter(
                  (p) =>
                    p.deadline &&
                    !["Completed", "Cancelled"].includes(p.status),
                )
                .sort((a, b) => a.deadline.localeCompare(b.deadline))
                .slice(0, 5)
                .map((p) => (
                  <p key={p.id} className="text-sm mb-3">
                    <Link
                      className="text-link"
                      href={"/admin/projects/" + p.id}
                    >
                      {p.title}
                    </Link>{" "}
                    · {p.deadline}
                  </p>
                ))}
              {!projects.rows.some(
                (p) =>
                  p.deadline && !["Completed", "Cancelled"].includes(p.status),
              ) && (
                <p className="muted text-sm">
                  No active projects with agreed deadlines.
                </p>
              )}
            </section>
            <section className="panel">
              <h2 className="section-heading">Recent activity</h2>
              {activity.error ? (
                <Feedback message={activity.error} />
              ) : activity.rows.length ? (
                activity.rows.slice(0, 4).map((a) => (
                  <p key={a.id} className="text-sm mb-3">
                    {a.action}{" "}
                    <span className="muted">· {dateText(a.createdAt)}</span>
                  </p>
                ))
              ) : (
                <p className="muted text-sm">
                  {activity.loading
                    ? "Loading activity…"
                    : "No recorded changes yet."}
                </p>
              )}
              <Link href="/admin/activity" className="text-link">
                Open activity log
              </Link>
            </section>
          </div>
          <h2 className="section-heading">Recent enquiries</h2>
          <EnquiryTable rows={enquiries.rows.slice(0, 8)} />
          <div className="panel mt-6">
            <h2 className="section-heading">Keep the next step clear</h2>
            <p className="muted">
              Confirm scope with the customer, mark their enquiry Confirmed,
              then create its project. Publish progress updates and milestones
              from the project record.
            </p>
          </div>
        </>
      )}
    </>
  );
}
function EnquiryTable({ rows }: { rows: Row[] }) {
  return rows.length ? (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Enquiry</th>
            <th>Domain</th>
            <th>Status</th>
            <th>Submitted</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id}>
              <td>
                <Link href={"/admin/enquiries/" + e.id} className="text-link">
                  {e.title}
                </Link>
              </td>
              <td>{e.domain}</td>
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
    <Empty title="No matching enquiries" />
  );
}
function Enquiries() {
  const { rows, loading, error } = useRows("enquiries");
  const [q, setQ] = useState(""),
    [status, setStatus] = useState(""),
    [domain, setDomain] = useState(""),
    [since, setSince] = useState("");
  return (
    <>
      <Heading
        title="Enquiries"
        description="Review requests, agree scope and turn confirmed work into projects."
      />
      <div className="filter-bar">
        <Search value={q} onChange={setQ} />
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {enquiryStatuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Domain
          <select value={domain} onChange={(e) => setDomain(e.target.value)}>
            <option value="">All domains</option>
            {[...new Set(rows.map((r) => r.domain))].sort().map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Submitted from
          <input
            type="date"
            value={since}
            onChange={(e) => setSince(e.target.value)}
          />
        </label>
      </div>
      {error ? (
        <Feedback message={error} />
      ) : loading ? (
        <p>Loading enquiries…</p>
      ) : (
        <EnquiryTable
          rows={rows.filter(
            (r) =>
              matches(r, q) &&
              (!status || r.status === status) &&
              (!domain || r.domain === domain) &&
              (!since ||
                (r.createdAt?.toDate?.()?.getTime() || 0) >=
                  new Date(since).getTime()),
          )}
        />
      )}
    </>
  );
}
function Enquiry({ id }: { id: string }) {
  const { data: e, error, loading } = useRecord("enquiries/" + id);
  const [, navigate] = useLocation();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  if (loading) return <p>Loading enquiry…</p>;
  if (error || !e) return <Empty title={error || "Enquiry not found"} />;
  return (
    <>
      <Heading
        title={e.title}
        description={e.domain}
        action={<Status>{e.status}</Status>}
      />
      <div className="detail-grid">
        <section className="panel">
          <h2 className="section-heading">Customer request</h2>
          <p className="whitespace-pre-wrap muted">{e.requirements}</p>
          <dl className="details-list">
            <dt>Technology</dt>
            <dd>{e.technologies || "To discuss"}</dd>
            <dt>Preferred deadline</dt>
            <dd>{e.deadline || "To discuss"}</dd>
            <dt>Budget</dt>
            <dd>{e.budget || "To discuss"}</dd>
            <dt>Contact preference</dt>
            <dd>{e.contactPreference}</dd>
            <dt>Customer ID</dt>
            <dd className="break-all">{e.ownerUid}</dd>
          </dl>
          <Link
            className="text-link"
            href={"/admin/customers?customer=" + encodeURIComponent(e.ownerUid)}
          >
            View customer
          </Link>
        </section>
        <SaveForm
          save={(d) =>
            saveRecord(
              "enquiries/" + id,
              { status: d.status, archived: d.status === "Archived" },
              "Update enquiry status",
              true,
            )
          }
        >
          <label>
            Enquiry status
            <select name="status" defaultValue={e.status}>
              {enquiryStatuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <p className="muted text-sm">
            Confirm only after scope and expectations have been agreed with the
            customer.
          </p>
          {e.projectId ? (
            <Link className="text-link" href={"/admin/projects/" + e.projectId}>
              Open linked project
            </Link>
          ) : (
            <>
              <button
                type="button"
                className="btn-outline"
                disabled={e.status !== "Confirmed" || busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const pid = await projectFromEnquiry(id);
                    navigate("/admin/projects/" + pid);
                  } catch {
                    setMessage(
                      "Could not create the project. Confirm the enquiry and retry; existing projects cannot be duplicated.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Creating…" : "Create project from confirmed enquiry"}
              </button>
              <Feedback message={message} />
            </>
          )}
        </SaveForm>
      </div>
      <Notes id={"enquiry-" + id} />
    </>
  );
}
function Customers() {
  const customers = useRows("users"),
    projects = useRows("projects"),
    enquiries = useRows("enquiries");
  const [q, setQ] = useState(
    () => new URLSearchParams(window.location.search).get("customer") || "",
  );
  return (
    <>
      <Heading
        title="Customers"
        description="Account details and project history. Roles are provisioned outside this interface."
      />
      <Search value={q} onChange={setQ} />
      {customers.error || projects.error || enquiries.error ? (
        <Feedback
          message={customers.error || projects.error || enquiries.error}
        />
      ) : customers.loading ? (
        <p>Loading customers…</p>
      ) : (
        customers.rows
          .filter((c) => matches({ ...c, ownerUid: c.id }, q))
          .map((c) => (
            <details className="panel mb-4" key={c.id}>
              <summary>
                <strong>{c.name}</strong>{" "}
                <span className="muted">{c.email}</span>
              </summary>
              <p className="muted text-sm my-4">
                {c.contactPreference} preferred · Joined {dateText(c.createdAt)}{" "}
                · {c.id}
              </p>
              <h3 className="section-heading">Projects</h3>
              <ul className="space-y-2">
                {projects.rows
                  .filter((p) => p.ownerUid === c.id)
                  .map((p) => (
                    <li key={p.id}>
                      <Link
                        href={"/admin/projects/" + p.id}
                        className="text-link"
                      >
                        {p.title}
                      </Link>{" "}
                      · {p.status}
                    </li>
                  ))}
              </ul>
              <h3 className="section-heading mt-5">Enquiries</h3>
              <EnquiryTable
                rows={enquiries.rows.filter((e) => e.ownerUid === c.id)}
              />
              <Notes id={"customer-" + c.id} />
            </details>
          ))
      )}
    </>
  );
}
function Projects() {
  const { rows, loading, error } = useRows("projects");
  const [q, setQ] = useState(""),
    [status, setStatus] = useState("");
  return (
    <>
      <Heading
        title="Projects"
        description="Manage scope, pricing, milestones and customer-visible updates."
        action={
          <Link href="/admin/projects/new" className="btn-primary">
            New project
          </Link>
        }
      />
      <div className="filter-bar">
        <Search value={q} onChange={setQ} />
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {projectStatuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      {error ? (
        <Feedback message={error} />
      ) : loading ? (
        <p>Loading projects…</p>
      ) : rows.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Project</th>
                <th>Status</th>
                <th>Deadline</th>
                <th>Agreed price</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .filter(
                  (r) => matches(r, q) && (!status || r.status === status),
                )
                .map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link
                        className="text-link"
                        href={"/admin/projects/" + p.id}
                      >
                        {p.title}
                      </Link>
                      <p className="muted text-xs">{p.domain}</p>
                    </td>
                    <td>
                      <Status>{p.status}</Status>
                    </td>
                    <td>{p.deadline || "To agree"}</td>
                    <td>
                      {p.price
                        ? `₹${p.price.toLocaleString("en-IN")}`
                        : "To agree"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="No projects yet" />
      )}
    </>
  );
}
function ProjectEditor({ id }: { id: string }) {
  return id === "new" ? <NewProject /> : <ExistingProject id={id} />;
}
function ProjectFields({ p, customers }: { p?: Row; customers?: Row[] }) {
  return (
    <>
      {customers ? (
        <label>
          Customer
          <select name="ownerUid" required>
            <option value="">Choose a registered customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.email}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="muted text-sm break-all">
          Customer: {p?.ownerUid}. Ownership is fixed to prevent accidental
          reassignment.
        </p>
      )}
      <label>
        Project title
        <input
          name="title"
          required
          minLength={3}
          maxLength={160}
          defaultValue={p?.title}
        />
      </label>
      <div className="form-grid">
        <label>
          Domain
          <input
            name="domain"
            required
            maxLength={100}
            defaultValue={p?.domain}
          />
        </label>
        <label>
          Status
          <select
            name="status"
            defaultValue={p?.status || "Awaiting Confirmation"}
          >
            {projectStatuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Agreed scope
        <textarea
          name="scope"
          rows={5}
          maxLength={10000}
          defaultValue={p?.scope}
        />
      </label>
      <div className="form-grid">
        <label>
          Agreed deadline
          <input name="deadline" type="date" defaultValue={p?.deadline} />
        </label>
        <label>
          Agreed price (INR; 0 = to be agreed)
          <input
            name="price"
            type="number"
            required
            min="0"
            max="10000000"
            step="0.01"
            defaultValue={p?.price || 0}
          />
        </label>
      </div>
    </>
  );
}
function NewProject() {
  const customers = useRows("users");
  const [, navigate] = useLocation();
  return (
    <>
      <Heading
        title="Create a project"
        description="For a registered customer. To retain an enquiry link, create the project from its confirmed enquiry instead."
      />
      {customers.error ? (
        <Feedback message={customers.error} />
      ) : (
        <SaveForm
          label="Create project"
          save={async (d) => {
            const id = doc(collection(db, "projects")).id;
            await saveRecord(
              "projects/" + id,
              {
                ...d,
                price: Number(d.price),
                sourceEnquiryId: "",
                createdAt: serverTimestamp(),
              },
              "Create project",
            );
            navigate("/admin/projects/" + id);
          }}
        >
          <ProjectFields customers={customers.rows} />
        </SaveForm>
      )}
    </>
  );
}
function ExistingProject({ id }: { id: string }) {
  const { data: p, error, loading } = useRecord("projects/" + id);
  if (loading) return <p>Loading project…</p>;
  if (error || !p) return <Empty title={error || "Project not found"} />;
  return (
    <>
      <Heading
        title={p.title}
        description="Changes to scope, price, milestones and updates are visible to this customer."
      />
      <SaveForm
        save={(d) =>
          saveRecord(
            "projects/" + id,
            { ...d, price: Number(d.price) },
            "Update project",
            true,
          )
        }
      >
        <ProjectFields p={p} />
      </SaveForm>
      <Milestones id={id} />
      <Progress id={id} />
      <Notes id={"project-" + id} />
    </>
  );
}
function Milestones({ id }: { id: string }) {
  const { rows, error, loading } = useRows(`projects/${id}/milestones`);
  const [version, setVersion] = useState(0);
  function fields(m?: Row) {
    return (
      <>
        <label>
          Milestone
          <input
            name="title"
            required
            maxLength={160}
            defaultValue={m?.title}
          />
        </label>
        <div className="form-grid">
          <label>
            Due date
            <input name="dueDate" type="date" defaultValue={m?.dueDate} />
          </label>
          <label>
            Status
            <select name="status" defaultValue={m?.status || "Planned"}>
              {["Planned", "In Progress", "Completed"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
      </>
    );
  }
  return (
    <section className="mt-8">
      <h2 className="section-heading">Milestones</h2>
      {error ? (
        <Feedback message={error} />
      ) : loading ? (
        <p>Loading milestones…</p>
      ) : (
        rows.map((m) => (
          <details key={m.id} className="panel mb-3">
            <summary>
              {m.title} · {m.status}
            </summary>
            <SaveForm
              className="form-stack mt-4"
              save={(d) =>
                saveRecord(
                  `projects/${id}/milestones/${m.id}`,
                  d,
                  "Update milestone",
                )
              }
            >
              {fields(m)}
            </SaveForm>
          </details>
        ))
      )}
      <SaveForm
        key={version}
        label="Add milestone"
        afterSave={() => setVersion((v) => v + 1)}
        save={(d) =>
          saveRecord(
            `projects/${id}/milestones/${doc(collection(db, "activity")).id}`,
            d,
            "Add milestone",
          )
        }
      >
        {fields()}
      </SaveForm>
    </section>
  );
}
function Progress({ id }: { id: string }) {
  const updates = useRows(`projects/${id}/updates`);
  const [version, setVersion] = useState(0);
  return (
    <section className="mt-8">
      <h2 className="section-heading">Customer-visible progress</h2>
      <SaveForm
        key={version}
        label="Publish update"
        afterSave={() => setVersion((v) => v + 1)}
        save={(d) => addUpdate(id, d.body)}
      >
        <label>
          Progress update
          <textarea name="body" required maxLength={3000} rows={4} />
        </label>
        <p className="muted text-sm">
          Published updates remain in the project history. Add a new update to
          correct earlier information.
        </p>
      </SaveForm>
      <Feedback message={updates.error} />
      {updates.rows.map((u) => (
        <article className="update-entry" key={u.id}>
          <p className="text-xs muted mb-2">{dateText(u.createdAt)}</p>
          <p className="whitespace-pre-wrap">{u.body}</p>
        </article>
      ))}
    </section>
  );
}
function PortfolioEditor() {
  const { rows, error, loading } = useRows("portfolio");
  const [selected, setSelected] = useState("new"),
    [version, setVersion] = useState(0);
  const item = rows.find((r) => r.id === selected);
  return (
    <>
      <Heading
        title="Portfolio"
        description="Publish only work you can substantiate. Demonstrations must be labelled; never add invented client claims."
      />
      <div className="filter-bar">
        <label>
          Edit entry
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="new">New entry</option>
            {rows.map((r) => (
              <option value={r.id} key={r.id}>
                {r.title} ({r.published ? "published" : "draft"})
              </option>
            ))}
          </select>
        </label>
      </div>
      {error ? (
        <Feedback message={error} />
      ) : loading ? (
        <p>Loading portfolio…</p>
      ) : (
        <SaveForm
          key={selected + version}
          save={async (d) => {
            const id =
              selected === "new"
                ? doc(collection(db, "portfolio")).id
                : selected;
            await saveRecord(
              "portfolio/" + id,
              { ...d, published: d.published === "true" },
              "Save portfolio entry",
            );
            setSelected(id);
            setVersion((v) => v + 1);
          }}
        >
          <label>
            Title
            <input
              name="title"
              required
              minLength={3}
              maxLength={160}
              defaultValue={item?.title}
            />
          </label>
          <div className="form-grid">
            <label>
              Domain
              <input
                name="domain"
                required
                maxLength={100}
                defaultValue={item?.domain}
              />
            </label>
            <label>
              Technologies
              <input
                name="technologies"
                maxLength={300}
                defaultValue={item?.technologies}
              />
            </label>
          </div>
          <label>
            Description
            <textarea
              name="description"
              required
              minLength={20}
              maxLength={3000}
              rows={5}
              defaultValue={item?.description}
            />
          </label>
          <label>
            Demo URL (optional, HTTPS)
            <input
              name="demoUrl"
              type="url"
              pattern="https://.*"
              maxLength={1000}
              defaultValue={item?.demoUrl}
            />
          </label>
          <div className="form-grid">
            <label>
              Evidence category
              <select name="kind" defaultValue={item?.kind || "Demonstration"}>
                <option>Demonstration</option>
                <option>Verified client project</option>
              </select>
            </label>
            <label>
              Visibility
              <select
                name="published"
                defaultValue={String(item?.published || false)}
              >
                <option value="false">Draft / unpublished</option>
                <option value="true">Published</option>
              </select>
            </label>
          </div>
          <p className="muted text-sm">
            Unpublish an entry to remove it from the website while preserving
            its record.
          </p>
        </SaveForm>
      )}
    </>
  );
}
function ContentEditor() {
  const { data, error, loading } = useRecord("siteContent/main");
  return (
    <>
      <Heading
        title="Website content"
        description="Plain-text announcements and pricing guidance. Changes appear on the public site after saving."
      />
      {error ? (
        <Feedback message={error} />
      ) : loading ? (
        <p>Loading content…</p>
      ) : (
        <SaveForm
          save={(d) =>
            saveRecord("siteContent/main", d, "Update website content")
          }
        >
          <label>
            Announcement (blank hides it)
            <input
              name="announcement"
              maxLength={200}
              defaultValue={data?.announcement || ""}
            />
          </label>
          <label>
            Pricing guidance
            <textarea
              name="pricingNote"
              required
              maxLength={500}
              rows={4}
              defaultValue={
                data?.pricingNote ||
                "Pricing depends on scope, technology and timeline. Request a written estimate before work begins."
              }
            />
          </label>
        </SaveForm>
      )}
    </>
  );
}
function Activity() {
  const { rows, error, loading } = useRows("activity");
  return (
    <>
      <Heading
        title="Activity"
        description="Append-only records of changes to new platform records. Legacy operational changes retain their original workflow."
      />
      {error ? (
        <Feedback message={error} />
      ) : loading ? (
        <p>Loading activity…</p>
      ) : rows.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Action</th>
                <th>Record</th>
                <th>Administrator</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.action}</td>
                  <td className="break-all">{r.entityPath}</td>
                  <td className="break-all">{r.actorUid}</td>
                  <td>{dateText(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="No recorded changes yet" />
      )}
    </>
  );
}
