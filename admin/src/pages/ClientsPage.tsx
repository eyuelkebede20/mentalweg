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
  AlertCircle,
  Key,
  Users,
  UserCheck,
  UserX,
  Globe
} from 'lucide-react';
import { PaymentReviewModal, type PaymentReviewDetails } from '../components/PaymentReviewModal';

interface Client {
  id: number;
  publicId: string;
  displayName: string;
  phoneE164: string;
  email?: string;
  isVerified: boolean;
  approvalStatus?: string;
  bookingToken?: string;
  googleId?: string;
  passwordHash?: string;
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
    screenshotPath?: string;
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
  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'patients' | 'verified'>('all');
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
  const [reviewPayment, setReviewPayment] = useState<PaymentReviewDetails | null>(null);

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
        if (selectedClient && selectedClient.id === id) {
          setSelectedClient({ ...selectedClient, approvalStatus: 'approved' });
        }
      } else {
        showToast('Failed to approve patient', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const rejectPatient = async (id: number) => {
    if (!confirm('Are you sure you want to decline / reject this patient account registration?')) return;
    try {
      const res = await fetch(`/api/admin/patients/${id}/reject`, { method: 'POST' });
      if (res.ok) {
        showToast('Patient registration declined.');
        loadClients();
        if (selectedClient && selectedClient.id === id) {
          setSelectedClient({ ...selectedClient, approvalStatus: 'rejected' });
        }
      } else {
        showToast('Failed to decline patient registration', 'error');
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

  const pendingCount = clients.filter(c => c.approvalStatus === 'pending').length;
  const portalPatientsCount = clients.filter(c => Boolean(c.passwordHash || c.googleId || c.approvalStatus === 'approved')).length;
  const verifiedCount = clients.filter(c => c.isVerified).length;

  const filteredClients = clients.filter(c => {
    const query = search.toLowerCase();
    const matches = (
      c.displayName.toLowerCase().includes(query) ||
      c.phoneE164.includes(query) ||
      c.publicId.toLowerCase().includes(query) ||
      (c.email && c.email.toLowerCase().includes(query))
    );
    if (!matches) return false;

    if (filterTab === 'pending') return c.approvalStatus === 'pending';
    if (filterTab === 'patients') return Boolean(c.passwordHash || c.googleId || c.approvalStatus === 'approved');
    if (filterTab === 'verified') return c.isVerified;
    return true;
  });

  const getAuthBadge = (c: Client) => {
    if (c.googleId) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
          <Globe className="w-3 h-3" /> Google
        </span>
      );
    }
    if (c.passwordHash) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: '#f5f3ff', color: '#6d28d9', border: '1px solid #ddd6fe', padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
          <Key className="w-3 h-3" /> Password
        </span>
      );
    }
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'var(--off)', color: 'var(--mut)', border: '1px solid var(--line)', padding: '2px 7px', borderRadius: '4px', fontSize: '11px' }}>
        Walk-in
      </span>
    );
  };

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
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 style={{ fontSize: '24px', margin: '0 0 6px', color: 'var(--ink)' }}>Users & Patients Management</h1>
          <p style={{ margin: 0, color: 'var(--mut)', fontSize: '14px' }}>
            Manage client profiles, patient account registrations, approval decisions, and verified portal access.
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

      {/* KPI Stats Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '1.25rem' }}>
        <div
          onClick={() => setFilterTab('all')}
          style={{
            background: filterTab === 'all' ? 'var(--card)' : 'var(--off)',
            border: `2px solid ${filterTab === 'all' ? 'var(--acc)' : 'var(--line)'}`,
            padding: '12px 16px',
            borderRadius: '10px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Registered</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--ink)', marginTop: '4px' }}>{clients.length}</div>
          <div style={{ fontSize: '11px', color: 'var(--mut)', marginTop: '2px' }}>All users & intake records</div>
        </div>

        <div
          onClick={() => setFilterTab('pending')}
          style={{
            background: filterTab === 'pending' ? '#fffbeb' : (pendingCount > 0 ? '#fffdf7' : 'var(--off)'),
            border: `2px solid ${filterTab === 'pending' ? '#d97706' : (pendingCount > 0 ? '#fde68a' : 'var(--line)')}`,
            padding: '12px 16px',
            borderRadius: '10px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pending Approvals</span>
            {pendingCount > 0 && (
              <span style={{ background: '#d97706', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '999px' }}>Action Req.</span>
            )}
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#b45309', marginTop: '4px' }}>{pendingCount}</div>
          <div style={{ fontSize: '11px', color: '#92400e', marginTop: '2px' }}>{pendingCount === 1 ? '1 registration awaiting review' : `${pendingCount} registrations awaiting review`}</div>
        </div>

        <div
          onClick={() => setFilterTab('patients')}
          style={{
            background: filterTab === 'patients' ? 'var(--card)' : 'var(--off)',
            border: `2px solid ${filterTab === 'patients' ? 'var(--acc)' : 'var(--line)'}`,
            padding: '12px 16px',
            borderRadius: '10px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Portal Patients</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--ink)', marginTop: '4px' }}>{portalPatientsCount}</div>
          <div style={{ fontSize: '11px', color: 'var(--mut)', marginTop: '2px' }}>With password or Google login</div>
        </div>

        <div
          onClick={() => setFilterTab('verified')}
          style={{
            background: filterTab === 'verified' ? 'var(--card)' : 'var(--off)',
            border: `2px solid ${filterTab === 'verified' ? 'var(--acc)' : 'var(--line)'}`,
            padding: '12px 16px',
            borderRadius: '10px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Verified Clients</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--ink)', marginTop: '4px' }}>{verifiedCount}</div>
          <div style={{ fontSize: '11px', color: 'var(--mut)', marginTop: '2px' }}>With private weekly booking links</div>
        </div>
      </div>

      {/* Segmented Filter Pills */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setFilterTab('all')}
          style={{
            background: filterTab === 'all' ? 'var(--acc)' : 'var(--card)',
            color: filterTab === 'all' ? '#fff' : 'var(--ink)',
            border: '1px solid var(--line)',
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '12.5px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Users className="w-3.5 h-3.5" /> All Users ({clients.length})
        </button>

        <button
          onClick={() => setFilterTab('pending')}
          style={{
            background: filterTab === 'pending' ? '#d97706' : (pendingCount > 0 ? '#fffbeb' : 'var(--card)'),
            color: filterTab === 'pending' ? '#fff' : (pendingCount > 0 ? '#b45309' : 'var(--ink)'),
            border: `1px solid ${pendingCount > 0 ? '#fed7aa' : 'var(--line)'}`,
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '12.5px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <AlertCircle className="w-3.5 h-3.5" /> Pending Approvals ({pendingCount})
        </button>

        <button
          onClick={() => setFilterTab('patients')}
          style={{
            background: filterTab === 'patients' ? 'var(--acc)' : 'var(--card)',
            color: filterTab === 'patients' ? '#fff' : 'var(--ink)',
            border: '1px solid var(--line)',
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '12.5px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Key className="w-3.5 h-3.5" /> Portal Patients ({portalPatientsCount})
        </button>

        <button
          onClick={() => setFilterTab('verified')}
          style={{
            background: filterTab === 'verified' ? 'var(--acc)' : 'var(--card)',
            color: filterTab === 'verified' ? '#fff' : 'var(--ink)',
            border: '1px solid var(--line)',
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '12.5px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <ShieldCheck className="w-3.5 h-3.5" /> Verified Clients ({verifiedCount})
        </button>
      </div>

      {/* Search Input */}
      <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
        <Search className="w-4 h-4" style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--mut)', pointerEvents: 'none' }} />
        <input
          type="text"
          placeholder="Search by client/patient name, mobile phone (+251...), or Public ID (e.g. C-0001)..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="admin-input"
          style={{ paddingLeft: '36px' }}
        />
      </div>

      {loading && <p style={{ textAlign: 'center', color: 'var(--mut)', padding: '2rem' }}>Loading user directory...</p>}

      {!loading && filteredClients.length === 0 && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', padding: '3rem', textAlign: 'center', borderRadius: '12px' }}>
          <p style={{ color: 'var(--mut)', margin: 0 }}>No users found matching current filters.</p>
        </div>
      )}

      {/* Client Table */}
      {!loading && filteredClients.length > 0 && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--off)', borderBottom: '1px solid var(--line)', fontSize: '13px', color: 'var(--mut)' }}>
                <th style={{ padding: '12px 16px' }}>Public ID</th>
                <th style={{ padding: '12px 16px' }}>User / Patient Name</th>
                <th style={{ padding: '12px 16px' }}>Auth Method</th>
                <th style={{ padding: '12px 16px' }}>Phone Number</th>
                <th style={{ padding: '12px 16px' }}>Sessions</th>
                <th style={{ padding: '12px 16px' }}>Account Status</th>
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
                  <td style={{ padding: '14px 16px' }}>
                    {getAuthBadge(c)}
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
                        <AlertCircle className="w-3 h-3" /> Pending Approval
                      </span>
                    ) : c.approvalStatus === 'rejected' ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '3px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700 }}>
                        <UserX className="w-3 h-3" /> Declined
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
                        <>
                          <button
                            onClick={() => approvePatient(c.id)}
                            className="btn-admin-primary"
                            style={{ padding: '5px 10px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }}
                            title="Approve patient account and send confirmation email"
                          >
                            <UserCheck className="w-3.5 h-3.5" /> Approve
                          </button>
                          <button
                            onClick={() => rejectPatient(c.id)}
                            style={{ background: '#fff', border: '1px solid #f87171', color: '#dc2626', padding: '5px 8px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                            title="Decline patient registration"
                          >
                            <UserX className="w-3.5 h-3.5" /> Decline
                          </button>
                        </>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--acc)', fontSize: '14px' }}>
                    {selectedClient.publicId}
                  </span>
                  {getAuthBadge(selectedClient)}
                  {selectedClient.approvalStatus === 'pending' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: '#fffbeb', color: '#b45309', border: '1px solid #fed7aa', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
                      <AlertCircle className="w-3 h-3" /> Awaiting Approval
                    </span>
                  ) : selectedClient.approvalStatus === 'rejected' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
                      <UserX className="w-3 h-3" /> Declined
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>
                      <Check className="w-3 h-3" /> Approved
                    </span>
                  )}
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

            {/* Pending Registration Action Alert */}
            {selectedClient.approvalStatus === 'pending' && (
              <div style={{ background: '#fffbeb', border: '1px solid #fed7aa', borderRadius: '8px', padding: '14px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <strong style={{ fontSize: '13px', color: '#92400e', display: 'block' }}>Pending Registration Review</strong>
                  <span style={{ fontSize: '12px', color: '#b45309' }}>This patient has created an account and requested portal access. Approving sends a welcome email.</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => approvePatient(selectedClient.id)}
                    className="btn-admin-primary"
                    style={{ padding: '6px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <UserCheck className="w-3.5 h-3.5" /> Approve Account
                  </button>
                  <button
                    onClick={() => rejectPatient(selectedClient.id)}
                    style={{ background: '#fff', border: '1px solid #f87171', color: '#dc2626', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <UserX className="w-3.5 h-3.5" /> Decline
                  </button>
                </div>
              </div>
            )}

            {/* Declined Alert */}
            {selectedClient.approvalStatus === 'rejected' && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 14px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <strong style={{ fontSize: '13px', color: '#991b1b', display: 'block' }}>Patient Registration Declined</strong>
                  <span style={{ fontSize: '12px', color: '#b91c1c' }}>This account is currently blocked from signing into the patient portal.</span>
                </div>
                <button
                  onClick={() => approvePatient(selectedClient.id)}
                  className="btn-admin-primary"
                  style={{ padding: '5px 12px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <UserCheck className="w-3.5 h-3.5" /> Re-Approve Account
                </button>
              </div>
            )}

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
                            onClick={() => setReviewPayment({
                              id: p.id,
                              provider: p.provider,
                              reference: p.reference,
                              amountCents: p.amountCents,
                              paidAt: p.paidAt,
                              screenshotPath: p.screenshotPath,
                              client: {
                                displayName: selectedClient.displayName,
                                phoneE164: selectedClient.phoneE164,
                                email: selectedClient.email,
                                publicId: selectedClient.publicId,
                              }
                            })}
                            style={{
                              background: 'var(--acc)',
                              color: '#fff',
                              border: 'none',
                              padding: '4px 10px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Review & Decide
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
      {/* PAYMENT REVIEW MODAL */}
      <PaymentReviewModal
        payment={reviewPayment}
        isOpen={Boolean(reviewPayment)}
        onClose={() => setReviewPayment(null)}
        onPaymentConfirmed={(paymentId) => {
          showToast('Payment approved & session confirmed!');
          if (selectedClient) {
            setSelectedClient({
              ...selectedClient,
              payments: selectedClient.payments.map(p => p.id === paymentId ? { ...p, verified: true } : p)
            });
          }
        }}
        onPaymentRejected={(paymentId) => {
          showToast('Payment rejected and session slot cancelled.');
          if (selectedClient) {
            setSelectedClient({
              ...selectedClient,
              payments: selectedClient.payments.map(p => p.id === paymentId ? { ...p, verified: false, method: 'rejected' } : p)
            });
          }
        }}
      />
    </div>
  );
}
