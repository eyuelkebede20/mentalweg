import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, 
  Plus, 
  UserPlus,
  Check, 
  X, 
  Phone, 
  MessageSquare, 
  Mail, 
  Copy, 
  Trash2, 
  Download, 
  Calendar as CalendarIcon, 
  CreditCard, 
  ShieldCheck, 
  AlertCircle
} from 'lucide-react';

interface Client {
  id: number;
  publicId: string;
  displayName: string;
  phoneE164: string;
  email?: string;
  isVerified: boolean;
  approvalStatus?: string;
  bookingToken?: string;
  note?: string;
  totalSessions: number;
  createdAt: string;
}

interface ClientDetail extends Client {
  sessions: Array<{
    id: number;
    startUtc: string;
    durationMin: number;
    status: string;
    source: string;
    feeWaived: boolean;
  }>;
  payments: Array<{
    id: number;
    provider: string;
    reference: string;
    amountCents: number;
    method: string;
    paidAt: string;
    verified: boolean;
  }>;
  changes: Array<{
    id: number;
    sessionId: number;
    fromStartUtc: string;
    toStartUtc: string;
    by: string;
    at: string;
  }>;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Add Client Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formVerified, setFormVerified] = useState(false);
  const [saving, setSaving] = useState(false);

  // Selected Client Details Drawer / Modal
  const [selectedClient, setSelectedClient] = useState<ClientDetail | null>(null);
  const [editNote, setEditNote] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadClients = () => {
    setLoading(true);
    fetch('/api/admin/clients')
      .then(r => r.json())
      .then(data => {
        setClients(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadClients();
  }, []);

  // Fetch full client details (including sessions, payments, and reschedule changes)
  const openClientDetail = async (client: Client) => {
    setSelectedClient(null);
    try {
      const res = await fetch(`/api/admin/clients/${client.id}`);
      if (res.ok) {
        const detail = await res.json();
        setSelectedClient(detail);
        setEditNote(detail.note || '');
      } else {
        showToast('Failed to load client details', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const toggleVerified = async (id: number, current: boolean) => {
    try {
      const res = await fetch(`/api/admin/clients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isVerified: !current })
      });
      if (res.ok) {
        const updated = await res.json();
        setClients(clients.map(c => c.id === id ? { ...c, isVerified: !current, bookingToken: updated.bookingToken } : c));
        if (selectedClient && selectedClient.id === id) {
          setSelectedClient({ ...selectedClient, isVerified: !current, bookingToken: updated.bookingToken });
        }
        showToast(`Client ${!current ? 'marked as verified' : 'unverified'}.`);
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const approvePatient = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/patients/${id}/approve`, { method: 'POST' });
      if (res.ok) {
        showToast('Patient account approved & welcome email sent!');
        loadClients();
      } else {
        showToast('Failed to approve patient', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleSaveNote = async () => {
    if (!selectedClient) return;
    setNoteSaving(true);
    try {
      const res = await fetch(`/api/admin/clients/${selectedClient.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: editNote })
      });
      if (res.ok) {
        setSelectedClient({ ...selectedClient, note: editNote });
        showToast('Practical note updated.');
      } else {
        showToast('Failed to update note', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setNoteSaving(false);
    }
  };

  const handleApprovePayment = async (paymentId: number) => {
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        showToast('Payment approved & session confirmed!');
        if (selectedClient) {
          setSelectedClient({
            ...selectedClient,
            payments: selectedClient.payments.map(p => p.id === paymentId ? { ...p, verified: true } : p)
          });
        }
      } else {
        showToast('Failed to approve payment', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formPhone) {
      showToast('Name and Phone are required.', 'error');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: formName,
          phoneE164: formPhone,
          email: formEmail || undefined,
          note: formNote || undefined,
          isVerified: formVerified,
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create client');
      }

      setAddModalOpen(false);
      setFormName('');
      setFormPhone('');
      setFormEmail('');
      setFormNote('');
      setFormVerified(false);
      showToast('New client successfully registered.');
      loadClients();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Export client record as JSON
  const handleExportClient = () => {
    if (!selectedClient) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(selectedClient, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${selectedClient.publicId}_${selectedClient.displayName.replace(/\s+/g, '_')}_record.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Client data export generated.');
  };

  // Anonymize and delete client
  const handleDeleteClient = async () => {
    if (!selectedClient) return;
    if (!confirm(`Are you sure you want to permanently delete and anonymize ${selectedClient.displayName}? Personal data will be scrubbed, but payment totals will remain intact for tax accounting.`)) return;

    try {
      const res = await fetch(`/api/admin/clients/${selectedClient.id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Client anonymized and deleted.');
        setSelectedClient(null);
        loadClients();
      } else {
        showToast('Failed to delete client', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const copyPrivateLink = (token?: string) => {
    if (!token) return;
    const url = `${window.location.origin}/m/${token}`;
    navigator.clipboard.writeText(url);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 3000);
    showToast('Private client link copied to clipboard.');
  };

  const filteredClients = clients.filter(c => {
    const query = search.toLowerCase();
    return (
      c.displayName.toLowerCase().includes(query) ||
      c.phoneE164.includes(query) ||
      c.publicId.toLowerCase().includes(query) ||
      (c.email && c.email.toLowerCase().includes(query))
    );
  });

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1050px', margin: '0 auto' }}>
      {/* Toast Banner */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          background: toastMessage.type === 'success' ? '#165b38' : '#9b1c1c',
          color: '#fff',
          padding: '10px 18px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13px',
          fontWeight: 600,
        }}>
          {toastMessage.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 style={{ fontSize: '24px', margin: '0 0 6px', color: 'var(--ink)' }}>Client Directory</h1>
          <p style={{ margin: 0, color: 'var(--mut)', fontSize: '14px' }}>
            Manage client profiles, contact numbers, verified weekly client links, and appointment records.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link
            to="/intake"
            style={{
              background: 'var(--acc)',
              color: '#fff',
              border: 'none',
              padding: '9px 16px',
              borderRadius: '8px',
              fontWeight: 600,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
            }}
          >
            <UserPlus className="w-4 h-4" /> New Patient Intake
          </Link>
          <button
            onClick={() => setAddModalOpen(true)}
            style={{
              background: 'var(--card)',
              color: 'var(--ink)',
              border: '1px solid var(--line)',
              padding: '9px 14px',
              borderRadius: '8px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
            }}
          >
            <Plus className="w-4 h-4" /> Quick Add
          </button>
        </div>
      </header>

      {/* Search Input */}
      <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
        <Search className="w-4 h-4" style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--mut)', pointerEvents: 'none' }} />
        <input
          type="text"
          placeholder="Search by client name, mobile phone (+251...), or Public ID (e.g. C-0001)..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="admin-input"
          style={{ paddingLeft: '36px' }}
        />
      </div>

      {loading && <p style={{ textAlign: 'center', color: 'var(--mut)', padding: '2rem' }}>Loading client directory...</p>}

      {!loading && filteredClients.length === 0 && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', padding: '3rem', textAlign: 'center', borderRadius: '12px' }}>
          <p style={{ color: 'var(--mut)', margin: 0 }}>No clients found matching "{search}".</p>
        </div>
      )}

      {/* Client Table */}
      {!loading && filteredClients.length > 0 && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--off)', borderBottom: '1px solid var(--line)', fontSize: '13px', color: 'var(--mut)' }}>
                <th style={{ padding: '12px 16px' }}>Public ID</th>
                <th style={{ padding: '12px 16px' }}>Client Name</th>
                <th style={{ padding: '12px 16px' }}>Phone Number</th>
                <th style={{ padding: '12px 16px' }}>Sessions</th>
                <th style={{ padding: '12px 16px' }}>Verified Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map(c => (
                <tr 
                  key={c.id} 
                  style={{ borderBottom: '1px solid var(--line)', fontSize: '14px', cursor: 'pointer' }}
                  onClick={() => openClientDetail(c)}
                >
                  <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--acc)', fontFamily: 'monospace' }}>
                    {c.publicId}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <strong>{c.displayName}</strong>
                    {c.email && (
                      <span style={{ display: 'block', fontSize: '12px', color: 'var(--mut)', marginTop: '2px' }}>
                        {c.email}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px', fontFamily: 'monospace' }}>
                    {c.phoneE164}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ background: 'var(--off)', padding: '3px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>
                      {c.totalSessions} sessions
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {c.approvalStatus === 'pending' ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#b45309', background: '#fffbeb', border: '1px solid #fed7aa', padding: '3px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700 }}>
                        Pending Approval
                      </span>
                    ) : c.isVerified ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#165b38', background: '#e3f7ed', padding: '3px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600 }}>
                        <ShieldCheck className="w-3.5 h-3.5" /> Verified
                      </span>
                    ) : (
                      <span style={{ color: 'var(--mut)', fontSize: '12px' }}>
                        Standard
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                      {c.approvalStatus === 'pending' && (
                        <button
                          onClick={() => approvePatient(c.id)}
                          className="btn-admin-primary"
                          style={{ padding: '5px 12px', fontSize: '11.5px' }}
                        >
                          Approve
                        </button>
                      )}
                      <button
                        onClick={() => openClientDetail(c)}
                        className="btn-admin-secondary"
                        style={{ padding: '5px 10px', fontSize: '11.5px' }}
                      >
                        View Record
                      </button>
                      <button
                        onClick={() => toggleVerified(c.id, c.isVerified)}
                        style={{
                          background: c.isVerified ? 'var(--off)' : 'var(--acc)',
                          color: c.isVerified ? 'var(--ink)' : '#fff',
                          border: '1px solid var(--line)',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      >
                        {c.isVerified ? 'Revoke' : 'Verify'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* DETAIL DRAWER / MODAL */}
      {selectedClient && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal-card" style={{ padding: '2rem', maxWidth: '640px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--acc)', fontSize: '14px' }}>
                    {selectedClient.publicId}
                  </span>
                  {selectedClient.isVerified && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#165b38', background: '#e3f7ed', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>
                      <ShieldCheck className="w-3.5 h-3.5" /> Verified Weekly Client
                    </span>
                  )}
                </div>
                <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--ink)' }}>{selectedClient.displayName}</h2>
              </div>
              <button onClick={() => setSelectedClient(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--mut)' }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Contact Bar */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '1.5rem', background: 'var(--off)', padding: '12px', borderRadius: '8px', border: '1px solid var(--line)' }}>
              <a
                href={`tel:${selectedClient.phoneE164}`}
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--line)',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  color: 'var(--ink)',
                  fontSize: '13px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Phone className="w-4 h-4 text-acc" /> Call {selectedClient.phoneE164}
              </a>

              <a
                href={`https://wa.me/${selectedClient.phoneE164.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--line)',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  color: '#165b38',
                  fontSize: '13px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <MessageSquare className="w-4 h-4" /> WhatsApp
              </a>

              {selectedClient.email && (
                <a
                  href={`mailto:${selectedClient.email}`}
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--line)',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    color: 'var(--ink)',
                    fontSize: '13px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Mail className="w-4 h-4" /> Email
                </a>
              )}
            </div>

            {/* Verified Client Tokenized Reschedule Link */}
            {selectedClient.isVerified && selectedClient.bookingToken && (
              <div style={{ background: 'var(--accbg)', border: '1px solid var(--acc)', padding: '14px', borderRadius: '8px', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <strong style={{ fontSize: '13px', color: 'var(--acct)' }}>Private Reschedule Link for Client:</strong>
                  <button
                    onClick={() => copyPrivateLink(selectedClient.bookingToken)}
                    style={{
                      background: 'var(--acc)',
                      color: '#fff',
                      border: 'none',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Copy className="w-3.5 h-3.5" /> {copySuccess ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>
                <code style={{ fontSize: '12px', color: 'var(--acct)', wordBreak: 'break-all' }}>
                  {typeof window !== 'undefined' ? window.location.origin : ''}/m/{selectedClient.bookingToken}
                </code>
                <p style={{ margin: '6px 0 0', fontSize: '11px', color: 'var(--acct)', opacity: 0.85 }}>
                  Verified clients open this link to manage upcoming sessions and reschedule without fees.
                </p>
              </div>
            )}

            {/* Practical Note (Strict Privacy Notice: Max 280 chars, No Health Info) */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label className="admin-label" style={{ margin: 0 }}>
                  Practical Administrative Note
                </label>
                <span style={{ fontSize: '11px', color: 'var(--mut)' }}>
                  {editNote.length}/280 characters
                </span>
              </div>
              <span style={{ display: 'block', fontSize: '11px', color: 'var(--danger)', marginBottom: '6px' }}>
                * Practical scheduling note only (e.g. prefers mornings). Strictly no clinical health information.
              </span>
              <textarea
                rows={2}
                maxLength={280}
                placeholder="e.g. Prefers afternoon consultations"
                value={editNote}
                onChange={e => setEditNote(e.target.value)}
                className="admin-textarea"
                style={{ minHeight: '60px' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={handleSaveNote}
                  disabled={noteSaving}
                  style={{
                    background: 'var(--acc)',
                    color: '#fff',
                    border: 'none',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {noteSaving ? 'Saving...' : 'Save Note'}
                </button>
              </div>
            </div>

            {/* Consultation History */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '14px', margin: '0 0 8px', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CalendarIcon className="w-4 h-4 text-acc" /> Appointment History ({selectedClient.sessions?.length || 0})
              </h4>
              {selectedClient.sessions?.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--mut)', margin: 0 }}>No sessions recorded yet.</p>
              ) : (
                <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid var(--line)', borderRadius: '6px' }}>
                  {selectedClient.sessions?.map(s => (
                    <div key={s.id} style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                      <div>
                        <strong>{new Date(s.startUtc).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong> at {new Date(s.startUtc).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        <span style={{ fontSize: '11px', color: 'var(--mut)', marginLeft: '6px' }}>({s.durationMin}m · {s.source})</span>
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'capitalize', padding: '2px 8px', borderRadius: '12px', background: 'var(--off)' }}>
                        {s.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payment History */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '14px', margin: '0 0 8px', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CreditCard className="w-4 h-4 text-acc" /> Fee Payment History ({selectedClient.payments?.length || 0})
              </h4>
              {selectedClient.payments?.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--mut)', margin: 0 }}>No payment receipts recorded.</p>
              ) : (
                <div style={{ maxHeight: '140px', overflowY: 'auto', border: '1px solid var(--line)', borderRadius: '6px' }}>
                  {selectedClient.payments?.map(p => (
                    <div key={p.id} style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                      <div>
                        <strong style={{ textTransform: 'uppercase' }}>{p.provider}</strong> · Ref: <code>{p.reference}</code>
                        <span style={{ display: 'block', fontSize: '11px', color: 'var(--mut)' }}>{p.paidAt ? new Date(p.paidAt).toLocaleDateString() : 'Pending'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ color: 'var(--acc)' }}>ETB {(p.amountCents / 100).toFixed(2)}</strong>
                        {!p.verified ? (
                          <button
                            type="button"
                            onClick={() => handleApprovePayment(p.id)}
                            style={{
                              background: '#16a34a',
                              color: '#fff',
                              border: 'none',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Approve
                          </button>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#165b38', fontWeight: 600 }}>Approved</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer with Export & Delete Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleExportClient}
                  style={{
                    background: 'var(--off)',
                    border: '1px solid var(--line)',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Download className="w-3.5 h-3.5" /> Export Data (JSON)
                </button>
                <button
                  type="button"
                  onClick={handleDeleteClient}
                  style={{
                    background: '#fff',
                    border: '1px solid #fecaca',
                    color: '#dc2626',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" /> Anonymize & Delete
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedClient(null)}
                style={{ padding: '8px 18px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--ink)', fontSize: '13px', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD CLIENT MODAL */}
      {addModalOpen && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal-card" style={{ padding: '2rem', maxWidth: '480px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--ink)' }}>Add New Client</h3>
              <button onClick={() => setAddModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--mut)' }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateClient}>
              <div className="admin-form-group">
                <label className="admin-label">Preferred Display Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hana Girma"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="admin-input"
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-label">Phone Number *</label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 0911234567 or +251911234567"
                  value={formPhone}
                  onChange={e => setFormPhone(e.target.value)}
                  className="admin-input"
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-label">Email (Optional)</label>
                <input
                  type="email"
                  placeholder="client@example.com"
                  value={formEmail}
                  onChange={e => setFormEmail(e.target.value)}
                  className="admin-input"
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-label">Practical Admin Note</label>
                <input
                  type="text"
                  placeholder="Practical note only (no clinical info)"
                  value={formNote}
                  onChange={e => setFormNote(e.target.value)}
                  className="admin-input"
                />
              </div>

              <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="chk-v"
                  checked={formVerified}
                  onChange={e => setFormVerified(e.target.checked)}
                />
                <label htmlFor="chk-v" style={{ fontSize: '13px', cursor: 'pointer', color: 'var(--ink)' }}>
                  Mark as Verified Weekly Client (Fee waived, generates private reschedule link)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setAddModalOpen(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--ink)', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: 'var(--acc)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                  {saving ? 'Saving...' : 'Add Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
