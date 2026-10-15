import { useState, useEffect } from "react";
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "firebase/auth";
import {
  collection, getDocs, updateDoc, deleteDoc, doc, setDoc,
  serverTimestamp, query, orderBy, runTransaction, getDoc
} from "firebase/firestore";
import { auth, db } from "../firebase/config";
import { useToast } from "../components/Toast";
import { isAllowedAdmin } from "../platform/admin-policy";
import { useLocation } from "wouter";



interface Lead {
  id: string; name: string; phone: string; email: string;
  projectType?: string; domain?: string; requirements?: string;
  deadline?: string; budget?: string; status: string; createdAt?: { toDate: () => Date };
}
interface Client {
  id: string; name: string; phone?: string; ownerUid?: string; project: string;
  status: string; totalAmount: number; paidAmount: number; progress: number;
}
interface Payment {
  id: string; customerId: string; txnId: string; amount: number;
  screenshotURL?: string; notes?: string; status: string;
  timestamp?: { toDate: () => Date };
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "new" || status === "pending" ? "badge-pending" :
    status === "accepted" || status === "verified" || status === "Completed" ? "badge-accepted" :
    status === "rejected" ? "badge-rejected" :
    status === "In Progress" ? "badge-progress" : "badge-new";
  return <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${cls}`}>{status}</span>;
}

export default function Admin() {
  const [, navigate] = useLocation();
  const { showToast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"leads" | "clients" | "payments">("leads");

  const [leads, setLeads] = useState<Lead[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  const [leadFilter, setLeadFilter] = useState("all");
  const [leadSearch, setLeadSearch] = useState("");
  const [editingLead, setEditingLead] = useState<Lead | null>(null);

  const [showAddClient, setShowAddClient] = useState(false);
  const [clientForm, setClientForm] = useState({
    name: "", phone: "", ownerUid: "", project: "", status: "Pending",
    totalAmount: "", paidAmount: "0", progress: "0",
  });

  const [editingClient, setEditingClient] = useState<Client | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      const permitted = u ? await Promise.all([u.getIdTokenResult(), getDoc(doc(db, "access", u.uid))]).then(([token, access])=> isAllowedAdmin(u.email) && token.signInProvider === "google.com" && token.claims.admin === true && access.data()?.role === "admin").catch(()=>false) : false;
      if (u && u.emailVerified && permitted) {
        setUser(u);
        fetchAll();
      } else if (u) {
        setUser(null); setLeads([]); setClients([]); setPayments([]);
        signOut(auth);
        showToast("Access denied. Not an admin account.", "error");
        navigate("/");
      }
      if (!u) { setUser(null); setLeads([]); setClients([]); setPayments([]); }
      setLoading(false);
    });
    return unsub;
  }, []);

  const fetchAll = async () => {
    try {
      const [leadsSnap, clientsSnap, paymentsSnap] = await Promise.all([
        getDocs(query(collection(db, "leads"), orderBy("createdAt", "desc"))),
        getDocs(collection(db, "clients")),
        getDocs(query(collection(db, "paymentProofs"), orderBy("timestamp", "desc"))),
      ]);
      setLeads(leadsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Lead)));
      setClients(clientsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Client)));
      setPayments(paymentsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Payment)));
    } catch (e) {
      showToast("Error loading data", "error");
    }
  };

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e) {
      showToast("Login failed", "error");
    }
  };

  const handleLogout = () => { signOut(auth); setUser(null); };

  const updateLeadStatus = async (id: string, status: string) => {
    try {
      const leadRef = doc(db, "leads", id);
      const clientRef = doc(collection(db, "clients"));
      await runTransaction(db, async tx => {
        const lead = await tx.get(leadRef);
        if (!lead.exists()) throw new Error("Missing lead");
        const data = lead.data();
        if (status === "accepted" && !data.clientId) {
          tx.set(clientRef, { id: clientRef.id, name: data.name || "", phone: data.phone || "", ownerUid: "", project: data.domain || data.projectType || "", status: "Pending", totalAmount: 0, paidAmount: 0, progress: 0, createdAt: serverTimestamp() });
          tx.update(leadRef, { status, clientId: clientRef.id });
        } else { tx.update(leadRef, { status }); }
      });
      showToast("Lead updated. Link the client's Firebase UID before sharing tracking access.", "success");
      await fetchAll();
    } catch { showToast("Update failed", "error"); }
  };

  const deleteLead = async (id: string) => {
    if (!confirm("Delete this lead?")) return;
    try {
      await deleteDoc(doc(db, "leads", id));
      setLeads((prev) => prev.filter((l) => l.id !== id));
      showToast("Lead deleted", "success");
    } catch { showToast("Delete failed", "error"); }
  };

  const generateClientId = async () => doc(collection(db, "clients")).id;

  const addClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newId = await generateClientId();
      const clientRef = doc(db, "clients", newId);
      await setDoc(clientRef, {
        ...clientForm,
        id: newId,
        totalAmount: Number(clientForm.totalAmount),
        paidAmount: Number(clientForm.paidAmount),
        progress: Number(clientForm.progress),
        createdAt: serverTimestamp(),
      });
      showToast(`Client ${newId} created!`, "success");
      setShowAddClient(false);
      setClientForm({ name: "", phone: "", ownerUid: "", project: "", status: "Pending", totalAmount: "", paidAmount: "0", progress: "0" });
      fetchAll();
    } catch (e) {
      showToast("Failed to add client", "error");
    }
  };

  const updateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    try {
      await updateDoc(doc(db, "clients", editingClient.id), {
        name: editingClient.name,
        phone: editingClient.phone || "",
        ownerUid: editingClient.ownerUid || "",
        project: editingClient.project,
        status: editingClient.status,
        totalAmount: Number(editingClient.totalAmount),
        paidAmount: Number(editingClient.paidAmount),
        progress: Number(editingClient.progress),
      });
      showToast("Client updated!", "success");
      setEditingClient(null);
      fetchAll();
    } catch { showToast("Update failed", "error"); }
  };

  const deleteClient = async (id: string) => {
    if (!confirm(`Delete client ${id}?`)) return;
    try {
      await deleteDoc(doc(db, "clients", id));
      setClients((prev) => prev.filter((c) => c.id !== id));
      showToast("Client deleted", "success");
    } catch { showToast("Delete failed", "error"); }
  };

  const updatePaymentStatus = async (id: string, status: string, _clientId: string, _amount: number) => {
    if (!confirm("Confirm you checked this transaction against your bank/payment-provider record. A screenshot alone is not proof of settlement.")) return;
    try {
      await runTransaction(db, async tx => {
        const paymentRef = doc(db, "paymentProofs", id);
        const snap = await tx.get(paymentRef);
        if (!snap.exists()) throw new Error("Missing payment");
        const payment = snap.data();
        if (payment.status !== "pending") throw new Error("This proof has already been reviewed.");
        if (status === "verified") {
          const amount = Number(payment.amount);
          if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid amount");
          const clientRef = doc(db, "clients", payment.customerId);
          // Unique bank transaction receipt prevents duplicate proof documents being credited twice.
          const receiptRef = doc(db, "verifiedTransactions", encodeURIComponent(String(payment.txnId).trim().toUpperCase()));
          const client = await tx.get(clientRef);
          const receipt = await tx.get(receiptRef);
          if (!client.exists() || receipt.exists()) throw new Error("Missing client or duplicate transaction");
          tx.update(clientRef, { paidAmount: Number(client.data().paidAmount || 0) + amount });
          tx.set(receiptRef, { paymentId: id, clientId: payment.customerId, amount, verifiedAt: serverTimestamp() });
        }
        tx.update(paymentRef, { status, reviewedAt: serverTimestamp() });
      });
      showToast("Payment review saved", "success"); await fetchAll();
    } catch { showToast("Review not saved: check access, record status and whether this transaction was already credited.", "error"); }
  };

  const filteredLeads = leads.filter((l) => {
    const matchStatus = leadFilter === "all" || l.status === leadFilter;
    const matchSearch = !leadSearch || l.name?.toLowerCase().includes(leadSearch.toLowerCase()) || l.phone?.includes(leadSearch);
    return matchStatus && matchSearch;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <svg className="animate-spin w-12 h-12 text-purple-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass rounded-2xl p-10 text-center max-w-sm">
          <div className="text-5xl mb-4">🔐</div>
          <h2 className="text-white font-bold text-2xl mb-2 font-display">Admin Access</h2>
          <p className="text-gray-400 text-sm mb-8">Sign in with your authorized Google account to access the admin panel.</p>
          <button onClick={handleLogin} className="btn-primary w-full justify-center py-3 gap-3">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-16 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-white font-display">Admin Dashboard</h1>
            <p className="text-gray-400 text-sm mt-1">Welcome, {user.displayName}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <div className="w-2 h-2 bg-green-400 rounded-full" />
              <span className="hidden sm:inline">{user.email}</span>
            </div>
            <button onClick={handleLogout} className="btn-outline text-sm py-2 px-4">
              Sign Out
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Total Leads", value: leads.length, color: "text-blue-400", icon: "📋" },
            { label: "Total Clients", value: clients.length, color: "text-purple-400", icon: "👥" },
            { label: "Pending Payments", value: payments.filter((p) => p.status === "pending").length, color: "text-yellow-400", icon: "💳" },
          ].map(({ label, value, color, icon }) => (
            <div key={label} className="glass rounded-2xl p-5 text-center">
              <div className="text-2xl mb-1">{icon}</div>
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
              <div className="text-gray-400 text-xs mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 glass rounded-xl p-1 w-fit">
          {(["leads", "clients", "payments"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                tab === t ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* LEADS TAB */}
        {tab === "leads" && (
          <div className="glass rounded-2xl p-6">
            <div className="flex flex-wrap gap-3 mb-5">
              <input
                value={leadSearch}
                onChange={(e) => setLeadSearch(e.target.value)}
                className="input-field w-auto flex-1 min-w-[200px]"
                placeholder="Search by name or phone..."
              />
              <select value={leadFilter} onChange={(e) => setLeadFilter(e.target.value)} className="input-field w-auto">
                <option value="all">All Status</option>
                <option value="new">New</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400 text-left">
                    <th className="py-3 pr-4">Name</th>
                    <th className="py-3 pr-4">Phone</th>
                    <th className="py-3 pr-4">Domain</th>
                    <th className="py-3 pr-4">Budget</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-3 pr-4 text-white font-medium">{lead.name}</td>
                      <td className="py-3 pr-4 text-gray-300">{lead.phone}</td>
                      <td className="py-3 pr-4 text-gray-300">{lead.domain || "-"}</td>
                      <td className="py-3 pr-4 text-gray-300">{lead.budget || "-"}</td>
                      <td className="py-3 pr-4"><StatusBadge status={lead.status} /></td>
                      <td className="py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateLeadStatus(lead.id, "accepted")}
                            className="p-1.5 bg-green-600/20 text-green-400 rounded-lg hover:bg-green-600/40 transition-colors" title="Accept">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button onClick={() => updateLeadStatus(lead.id, "rejected")}
                            className="p-1.5 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/40 transition-colors" title="Reject">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                          <button onClick={() => setEditingLead(lead)}
                            className="p-1.5 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/40 transition-colors" title="View">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          <button onClick={() => deleteLead(lead.id)}
                            className="p-1.5 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/40 transition-colors" title="Delete">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredLeads.length === 0 && (
                    <tr><td colSpan={6} className="py-8 text-center text-gray-500">No leads found</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Lead detail modal */}
            {editingLead && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="glass rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-white font-bold text-lg">Lead Details</h3>
                    <button onClick={() => setEditingLead(null)} className="text-gray-400 hover:text-white">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="space-y-3 text-sm">
                    {[
                      ["Name", editingLead.name], ["Phone", editingLead.phone], ["Email", editingLead.email],
                      ["Project Type", editingLead.projectType], ["Domain", editingLead.domain],
                      ["Budget", editingLead.budget], ["Deadline", editingLead.deadline],
                      ["Requirements", editingLead.requirements],
                    ].map(([k, v]) => v ? (
                      <div key={k}>
                        <p className="text-gray-500 text-xs">{k}</p>
                        <p className="text-gray-200">{v}</p>
                      </div>
                    ) : null)}
                  </div>
                  <div className="flex gap-2 mt-6">
                    <button onClick={() => { updateLeadStatus(editingLead.id, "accepted"); setEditingLead(null); }}
                      className="flex-1 bg-green-600/30 border border-green-500/40 text-green-300 py-2 rounded-xl text-sm hover:bg-green-600/50 transition-colors">
                      Accept
                    </button>
                    <button onClick={() => { updateLeadStatus(editingLead.id, "rejected"); setEditingLead(null); }}
                      className="flex-1 bg-red-600/30 border border-red-500/40 text-red-300 py-2 rounded-xl text-sm hover:bg-red-600/50 transition-colors">
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CLIENTS TAB */}
        {tab === "clients" && (
          <div className="glass rounded-2xl p-6">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-white font-semibold">Clients ({clients.length})</h3>
              <button onClick={() => setShowAddClient(!showAddClient)} className="btn-primary text-sm py-2 px-4">
                {showAddClient ? "Cancel" : "+ Add Client"}
              </button>
            </div>

            {showAddClient && (
              <form onSubmit={addClient} className="glass-dark rounded-xl p-5 mb-6 space-y-4">
<label className="block">Client Firebase Auth UID (for private tracking)<input className="input-field" value={clientForm.ownerUid} onChange={e => setClientForm({...clientForm, ownerUid:e.target.value.trim()})} /></label>
                <h4 className="text-white font-semibold mb-2">Add New Client</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-gray-300 text-xs block mb-1">Name *</label>
                    <input value={clientForm.name} onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                      className="input-field" placeholder="Client name" required />
                  </div>
                  <div>
                    <label className="text-gray-300 text-xs block mb-1">Phone</label>
                    <input value={clientForm.phone} onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
                      className="input-field" placeholder="Phone number" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-gray-300 text-xs block mb-1">Project Title *</label>
                    <input value={clientForm.project} onChange={(e) => setClientForm({ ...clientForm, project: e.target.value })}
                      className="input-field" placeholder="Project title" required />
                  </div>
                  <div>
                    <label className="text-gray-300 text-xs block mb-1">Status</label>
                    <select value={clientForm.status} onChange={(e) => setClientForm({ ...clientForm, status: e.target.value })} className="input-field">
                      <option>Pending</option>
                      <option>In Progress</option>
                      <option>Completed</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-300 text-xs block mb-1">Progress (%)</label>
                    <input type="number" min="0" max="100" value={clientForm.progress}
                      onChange={(e) => setClientForm({ ...clientForm, progress: e.target.value })}
                      className="input-field" />
                  </div>
                  <div>
                    <label className="text-gray-300 text-xs block mb-1">Total Amount (₹)</label>
                    <input type="number" value={clientForm.totalAmount}
                      onChange={(e) => setClientForm({ ...clientForm, totalAmount: e.target.value })}
                      className="input-field" placeholder="0" required />
                  </div>
                  <div>
                    <label className="text-gray-300 text-xs block mb-1">Advance Paid (₹)</label>
                    <input type="number" value={clientForm.paidAmount}
                      onChange={(e) => setClientForm({ ...clientForm, paidAmount: e.target.value })}
                      className="input-field" placeholder="0" />
                  </div>
                </div>
                <button type="submit" className="btn-primary w-full justify-center py-3">Create Client</button>
              </form>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400 text-left">
                    <th className="py-3 pr-4">ID</th>
                    <th className="py-3 pr-4">Name</th>
                    <th className="py-3 pr-4">Project</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4">Payment</th>
                    <th className="py-3 pr-4">Progress</th>
                    <th className="py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => {
                    const rem = client.totalAmount - client.paidAmount;
                    return (
                      <tr key={client.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="py-3 pr-4">
                          <span className="font-mono text-purple-300 font-medium">{client.id}</span>
                        </td>
                        <td className="py-3 pr-4 text-white">{client.name}</td>
                        <td className="py-3 pr-4 text-gray-300 max-w-[150px] truncate">{client.project}</td>
                        <td className="py-3 pr-4"><StatusBadge status={client.status} /></td>
                        <td className="py-3 pr-4 text-gray-300 text-xs">
                          <div>₹{client.paidAmount || 0} / ₹{client.totalAmount || 0}</div>
                          {rem > 0 && <div className="text-orange-400">Rem: ₹{rem}</div>}
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-white/10 rounded-full h-1.5">
                              <div className="h-1.5 rounded-full bg-purple-500" style={{ width: `${client.progress || 0}%` }} />
                            </div>
                            <span className="text-gray-400 text-xs">{client.progress || 0}%</span>
                          </div>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1">
                            <a href={`/track/${client.id}`} target="_blank" rel="noopener noreferrer"
                              className="p-1.5 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/40 transition-colors" title="View Track Link">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                            <button onClick={() => setEditingClient(client)}
                              className="p-1.5 bg-yellow-600/20 text-yellow-400 rounded-lg hover:bg-yellow-600/40 transition-colors" title="Edit">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button onClick={() => deleteClient(client.id)}
                              className="p-1.5 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/40 transition-colors" title="Delete">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {clients.length === 0 && (
                    <tr><td colSpan={7} className="py-8 text-center text-gray-500">No clients yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Edit client modal */}
            {editingClient && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="glass rounded-2xl p-6 max-w-md w-full">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-white font-bold">Edit Client: {editingClient.id}</h3>
                    <button onClick={() => setEditingClient(null)} className="text-gray-400 hover:text-white">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <form onSubmit={updateClient} className="space-y-3">
<label className="block">Client Firebase Auth UID (for private tracking)<input className="input-field" value={editingClient.ownerUid || ""} onChange={e => setEditingClient({...editingClient, ownerUid:e.target.value.trim()})} /></label>
                    {[
                      { label: "Name", key: "name" as const, type: "text" },
                      { label: "Project", key: "project" as const, type: "text" },
                      { label: "Progress (%)", key: "progress" as const, type: "number" },
                      { label: "Total Amount", key: "totalAmount" as const, type: "number" },
                      { label: "Paid Amount", key: "paidAmount" as const, type: "number" },
                    ].map(({ label, key, type }) => (
                      <div key={key}>
                        <label className="text-gray-300 text-xs block mb-1">{label}</label>
                        <input type={type} value={editingClient[key] as string | number}
                          onChange={(e) => setEditingClient({ ...editingClient, [key]: e.target.value })}
                          className="input-field" />
                      </div>
                    ))}
                    <div>
                      <label className="text-gray-300 text-xs block mb-1">Status</label>
                      <select value={editingClient.status}
                        onChange={(e) => setEditingClient({ ...editingClient, status: e.target.value })}
                        className="input-field">
                        <option>Pending</option>
                        <option>In Progress</option>
                        <option>Completed</option>
                      </select>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button type="submit" className="flex-1 btn-primary justify-center py-2.5">Save Changes</button>
                      <button type="button" onClick={() => setEditingClient(null)} className="flex-1 btn-outline justify-center py-2.5">Cancel</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PAYMENTS TAB */}
        {tab === "payments" && (
          <div className="glass rounded-2xl p-6">
            <h3 className="text-white font-semibold mb-5">Payment Proofs ({payments.length})</h3>
            <div className="space-y-4">
              {payments.map((p) => (
                <div key={p.id} className="glass-dark rounded-xl p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-purple-300 font-bold">{p.customerId}</span>
                        <StatusBadge status={p.status} />
                      </div>
                      <p className="text-white font-medium">Txn: {p.txnId}</p>
                      <p className="text-green-400 font-bold">₹{p.amount}</p>
                      {p.notes && <p className="text-gray-400 text-sm mt-1">{p.notes}</p>}
                      {p.timestamp && (
                        <p className="text-gray-500 text-xs mt-1">
                          {p.timestamp.toDate().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {p.screenshotURL && (
                        <a href={p.screenshotURL} target="_blank" rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-blue-600/20 border border-blue-500/40 text-blue-300 rounded-lg text-xs hover:bg-blue-600/40 transition-colors">
                          View Screenshot
                        </a>
                      )}
                      {p.status === "pending" && (
                        <>
                          <button onClick={() => updatePaymentStatus(p.id, "verified", p.customerId, p.amount)}
                            className="px-3 py-1.5 bg-green-600/20 border border-green-500/40 text-green-300 rounded-lg text-xs hover:bg-green-600/40 transition-colors">
                            Verify
                          </button>
                          <button onClick={() => updatePaymentStatus(p.id, "rejected", p.customerId, p.amount)}
                            className="px-3 py-1.5 bg-red-600/20 border border-red-500/40 text-red-300 rounded-lg text-xs hover:bg-red-600/40 transition-colors">
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {payments.length === 0 && (
                <div className="text-center py-12 text-gray-500">No payment proofs submitted yet</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
