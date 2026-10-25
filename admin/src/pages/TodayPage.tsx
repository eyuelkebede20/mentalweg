import { useState, useEffect } from 'react';
import { 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Mail, 
  MessageSquare, 
  Phone, 
  Eye, 
  Calendar as CalendarIcon, 
  RefreshCw,
  ShieldCheck,
  X
} from 'lucide-react';

interface ClientInfo {
  id: number;
  publicId: string;
  displayName: string;
  phoneE164: string;
  email?: string;
  isVerified: boolean;
}

interface ReminderRecord {
  channel: string;
  sentAt: string;
}

interface TodaySession {
  id: number;
  startUtc: string;
  durationMin: number;
  status: string;
  source: string;
  feeWaived: boolean;
  client: ClientInfo | null;
  isReminderDue: boolean;
  remindersSent: ReminderRecord[];
}

interface PendingPayment {
  id: number;
  provider: string;
  reference: string;
  amountCents: number;
  screenshotPath?: string;
  paidAt?: string;
  session?: {
    id: number;
    startUtc: string;
    durationMin: number;
    status: string;
  };
  client?: ClientInfo;
}

interface UnappliedPayment {
  id: number;
  provider: string;
  reference: string;
  amountCents: number;
  paidAt?: string;
  screenshotPath?: string;
}

interface RecentChange {
  id: number;
  sessionId: number;
  fromStartUtc: string;
  toStartUtc: string;
  by: string;
  at: string;
  clientName: string;
  clientPhone: string;
}

interface PendingPatientApproval {
  id: number;
  publicId: string;
  displayName: string;
  email?: string;
  phoneE164: string;
  createdAt: string;
}

interface TodayData {
  dateEAT: string;
  sessions: TodaySession[];
  pendingPayments: PendingPayment[];
  unappliedPayments: UnappliedPayment[];
  pendingPatientApprovals?: PendingPatientApproval[];
  recentChanges: RecentChange[];
  stats: {
    totalToday: number;
    confirmedToday: number;
    attendedToday: number;
    pendingReviewsCount: number;
  };
}

export default function TodayPage() {
  const [data, setData] = useState<TodayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [notificationMsg, setNotificationMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [viewScreenshotUrl, setViewScreenshotUrl] = useState<string | null>(null);

  const fetchTodayData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/today');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load today data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodayData();
    // Poll every 60 seconds
    const interval = setInterval(fetchTodayData, 60000);
    return () => clearInterval(interval);
  }, []);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setNotificationMsg({ text, type });
    setTimeout(() => setNotificationMsg(null), 5000);
  };

  // 1. Manual confirm payment
  const handleConfirmPayment = async (paymentId: number) => {
    setActionLoading(paymentId);
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        showToast('Payment verified successfully. Session confirmed!');
        fetchTodayData();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to confirm payment', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 2. Attendance change
  const handleAttendanceChange = async (sessionId: number, status: 'attended' | 'no_show' | 'confirmed') => {
    setActionLoading(sessionId);
    try {
      const res = await fetch(`/api/admin/sessions/${sessionId}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        showToast(`Session marked as ${status.replace('_', ' ')}.`);
        fetchTodayData();
      } else {
        showToast('Failed to update status', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 3. Patient Registration Approval
  const handleApprovePatient = async (id: number) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/patients/${id}/approve`, { method: 'POST' });
      if (res.ok) {
        showToast('Patient account approved and welcome email dispatched!');
        fetchTodayData();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to approve patient', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectPatient = async (id: number) => {
    if (!confirm('Are you sure you want to decline this patient registration?')) return;
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/patients/${id}/reject`, { method: 'POST' });
      if (res.ok) {
        showToast('Patient registration declined.');
        fetchTodayData();
      } else {
        showToast('Failed to decline registration', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 3. Send Email reminder
  const handleSendEmailReminder = async (sessionId: number) => {
    setActionLoading(sessionId);
    try {
      const res = await fetch(`/api/admin/sessions/${sessionId}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: 'email' }),
      });
      const resJson = await res.json();
      if (res.ok) {
        showToast(resJson.message || 'Reminder email sent to client.');
        fetchTodayData();
      } else {
        showToast(resJson.error || 'Failed to send reminder email.', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 4. Send SMS reminder (prefills Messages on iOS Safari or SMS app)
  const handleSendSmsReminder = async (sessionId: number) => {
    setActionLoading(sessionId);
    try {
      const res = await fetch(`/api/admin/sessions/${sessionId}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: 'sms' }),
      });
      const resJson = await res.json();
      if (res.ok && resJson.smsUrl) {
        // Trigger native device SMS application
        window.location.href = resJson.smsUrl;
        showToast('SMS composer opened with prefilled message.');
        fetchTodayData();
      } else {
        showToast(resJson.error || 'Failed to prepare SMS prompt.', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Format Ethiopian and Gregorian Date
  const today = new Date();
  const ethiopianDate = new Intl.DateTimeFormat('en-u-ca-ethiopic', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(today);

  const gregorianDate = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Africa/Addis_Ababa',
  });

  const needsAttentionCount = (data?.pendingPayments.length || 0) + (data?.unappliedPayments.length || 0) + (data?.pendingPatientApprovals?.length || 0);

  return (
    <div style={{ padding: '1.25rem', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Toast Notification Banner */}
      {notificationMsg && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          background: notificationMsg.type === 'success' ? '#165b38' : '#9b1c1c',
          color: '#fff',
          padding: '12px 20px',
          borderRadius: '8px',
          boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
          fontWeight: 600,
        }}>
          {notificationMsg.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <span>{notificationMsg.text}</span>
        </div>
      )}

      {/* Page Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h1 style={{ fontSize: '22px', margin: 0, color: 'var(--ink)' }}>Today's Clinical Practice</h1>
            <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '12px', background: 'var(--accbg)', color: 'var(--acct)', fontWeight: 600 }}>
              Addis Ababa (UTC+3)
            </span>
          </div>
          <div style={{ fontSize: '14px', color: 'var(--mut)' }}>
            <strong>{gregorianDate}</strong> · <span style={{ color: 'var(--acc)', fontWeight: 600 }}>{ethiopianDate}</span>
          </div>
        </div>

        <button
          onClick={fetchTodayData}
          disabled={loading}
          style={{
            background: 'var(--card)',
            border: '1px solid var(--line)',
            padding: '7px 12px',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            color: 'var(--ink)',
            fontWeight: 500,
          }}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </header>

      {/* Summary Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '1.5rem' }}>
        <div style={{ background: 'var(--card)', padding: '1.1rem 1.25rem', borderRadius: '10px', border: '1px solid var(--line)' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
            {data?.stats.totalToday ?? 0}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--mut)', marginTop: '6px' }}>
            Appointments today
          </div>
        </div>
        <div style={{ background: 'var(--card)', padding: '1.1rem 1.25rem', borderRadius: '10px', border: '1px solid var(--line)' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#165b38', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
            {data?.stats.confirmedToday ?? 0}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--mut)', marginTop: '6px' }}>
            Confirmed slots
          </div>
        </div>
        <div style={{ background: 'var(--card)', padding: '1.1rem 1.25rem', borderRadius: '10px', border: '1px solid var(--line)' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--acc)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
            {data?.stats.attendedToday ?? 0}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--mut)', marginTop: '6px' }}>
            Attended sessions
          </div>
        </div>
        <div style={{
          background: needsAttentionCount > 0 ? '#fdf2f2' : 'var(--card)',
          padding: '1.1rem 1.25rem',
          borderRadius: '10px',
          border: `1px solid ${needsAttentionCount > 0 ? '#f8b4b4' : 'var(--line)'}`
        }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: needsAttentionCount > 0 ? '#9b1c1c' : 'var(--ink)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
            {needsAttentionCount}
          </div>
          <div style={{ fontSize: '13px', color: needsAttentionCount > 0 ? '#9b1c1c' : 'var(--mut)', marginTop: '6px', fontWeight: needsAttentionCount > 0 ? 600 : 400 }}>
            Needs attention
          </div>
        </div>
      </div>

      {/* SECTION 1: NEEDS ATTENTION LIST (Pending bank receipts & unapplied payments) */}
      {needsAttentionCount > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <AlertTriangle className="w-5 h-5" style={{ color: '#c53030' }} />
            <h2 style={{ fontSize: '17px', margin: 0, color: 'var(--ink)' }}>Needs Attention ({needsAttentionCount})</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* 0. Pending Patient Account Approvals */}
            {data?.pendingPatientApprovals?.map(patient => (
              <div
                key={`patient-${patient.id}`}
                style={{
                  background: 'var(--card)',
                  border: '1px solid #fed7aa',
                  borderRadius: '10px',
                  padding: '1rem',
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ background: '#fffbeb', color: '#b45309', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px' }}>
                      Patient Approval Required
                    </span>
                    <strong style={{ fontSize: '15px' }}>{patient.displayName}</strong>
                    <span style={{ fontSize: '12px', color: 'var(--acc)', fontFamily: 'monospace', fontWeight: 600 }}>
                      {patient.publicId}
                    </span>
                  </div>

                  <div style={{ fontSize: '13px', color: 'var(--ink)', marginTop: '4px' }}>
                    Phone: <strong style={{ fontFamily: 'monospace' }}>{patient.phoneE164}</strong>
                    {patient.email && <span> · Email: <strong>{patient.email}</strong></span>}
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--mut)', marginTop: '2px', display: 'block' }}>
                    Registered: {new Date(patient.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => handleRejectPatient(patient.id)}
                    disabled={actionLoading === patient.id}
                    className="btn-admin-secondary"
                  >
                    Decline
                  </button>

                  <button
                    onClick={() => handleApprovePatient(patient.id)}
                    disabled={actionLoading === patient.id}
                    className="btn-admin-primary"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {actionLoading === patient.id ? 'Approving...' : 'Approve Patient'}
                  </button>
                </div>
              </div>
            ))}

            {/* 1. Pending Payments */}
            {data?.pendingPayments.map(p => (
              <div
                key={p.id}
                style={{
                  background: 'var(--card)',
                  border: '1px solid #f8b4b4',
                  borderRadius: '10px',
                  padding: '1rem',
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ background: '#fdf2f2', color: '#9b1c1c', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px' }}>
                      Pending review
                    </span>
                    <strong style={{ fontSize: '15px' }}>{p.client?.displayName || 'Client Booking'}</strong>
                    {p.client?.phoneE164 && (
                      <span style={{ fontSize: '12px', color: 'var(--mut)', fontFamily: 'monospace' }}>
                        {p.client.phoneE164}
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: '13px', color: 'var(--ink)', marginTop: '4px' }}>
                    Provider: <strong style={{ textTransform: 'uppercase' }}>{p.provider}</strong> · Ref: <code style={{ background: 'var(--off)', padding: '2px 5px', borderRadius: '4px' }}>{p.reference}</code> · Amount: <strong>ETB {(p.amountCents / 100).toFixed(2)}</strong>
                  </div>

                  {p.session && (
                    <div style={{ fontSize: '12px', color: 'var(--mut)', marginTop: '4px' }}>
                      Session Slot: {new Date(p.session.startUtc).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Africa/Addis_Ababa' })} ({p.session.durationMin} min)
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {p.screenshotPath && (
                    <button
                      onClick={() => setViewScreenshotUrl(p.screenshotPath!.startsWith('/') ? p.screenshotPath! : `/${p.screenshotPath}`)}
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
                        gap: '6px',
                        color: 'var(--ink)',
                      }}
                    >
                      <Eye className="w-4 h-4" /> View Screenshot
                    </button>
                  )}

                  <button
                    onClick={() => handleConfirmPayment(p.id)}
                    disabled={actionLoading === p.id}
                    style={{
                      background: 'var(--acc)',
                      border: 'none',
                      color: '#fff',
                      padding: '8px 14px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <CheckCircle className="w-4 h-4" />
                    {actionLoading === p.id ? 'Confirming...' : 'Confirm Manually'}
                  </button>
                </div>
              </div>
            ))}

            {/* 2. Unapplied Payments */}
            {data?.unappliedPayments.map(p => (
              <div
                key={p.id}
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--line)',
                  borderRadius: '10px',
                  padding: '1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <span style={{ background: 'var(--off)', color: 'var(--mut)', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px' }}>
                    Unapplied payment
                  </span>
                  <div style={{ fontSize: '13px', marginTop: '4px' }}>
                    Provider: <strong>{p.provider}</strong> · Ref: <code>{p.reference}</code> · Amount: <strong>ETB {(p.amountCents / 100).toFixed(2)}</strong>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--mut)' }}>Paid after hold expired or hold cancelled. Unlinked in database.</span>
                </div>
                {p.screenshotPath && (
                  <button
                    onClick={() => setViewScreenshotUrl(`/${p.screenshotPath}`)}
                    style={{
                      background: 'var(--off)',
                      border: '1px solid var(--line)',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    View Screenshot
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* SECTION 2: TODAY'S APPOINTMENTS TIMETABLE */}
      <section style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarIcon className="w-5 h-5 text-acc" />
            <h2 style={{ fontSize: '18px', margin: 0, color: 'var(--ink)' }}>Scheduled Appointments</h2>
          </div>
          <span style={{ fontSize: '13px', color: 'var(--mut)' }}>
            Chronological order · 4-hr reminder prompts
          </span>
        </div>

        {data?.sessions.length === 0 ? (
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', padding: '2.5rem', textAlign: 'center', borderRadius: '12px' }}>
            <p style={{ color: 'var(--mut)', margin: '0 0 8px' }}>No consultations scheduled for today.</p>
            <span style={{ fontSize: '12px', color: 'var(--mut)' }}>New public bookings and admin self-bookings will appear here.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {data?.sessions.map(s => {
              const start = new Date(s.startUtc);
              const endMs = start.getTime() + s.durationMin * 60000;
              const end = new Date(endMs);

              const timeRange = `${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Africa/Addis_Ababa' })} – ${end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Africa/Addis_Ababa' })}`;

              const isAttended = s.status === 'attended';
              const isNoShow = s.status === 'no_show';
              const isConfirmed = s.status === 'confirmed';

              return (
                <div
                  key={s.id}
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--line)',
                    borderRadius: '10px',
                    padding: '1.25rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
                    <div>
                      {/* Time and Duration */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ink)' }}>
                          {timeRange}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--mut)', background: 'var(--off)', padding: '2px 8px', borderRadius: '12px' }}>
                          {s.durationMin} minutes
                        </span>
                      </div>

                      {/* Client Name & Verification Badge */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '16px', color: 'var(--ink)' }}>
                          {s.client?.displayName || 'Reserved Slot'}
                        </strong>
                        {s.client?.isVerified && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#e3f7ed', color: '#165b38', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '12px' }}>
                            <ShieldCheck className="w-3.5 h-3.5" /> Verified Weekly Client
                          </span>
                        )}
                        {s.feeWaived && (
                          <span style={{ background: 'var(--off)', color: 'var(--mut)', fontSize: '11px', padding: '2px 6px', borderRadius: '4px' }}>
                            Fee Waived
                          </span>
                        )}
                      </div>

                      {/* Phone & Contact Shortcuts */}
                      {s.client?.phoneE164 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', fontSize: '13px' }}>
                          <span style={{ fontFamily: 'monospace', color: 'var(--mut)' }}>{s.client.phoneE164}</span>
                          <a
                            href={`tel:${s.client.phoneE164}`}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--acc)', textDecoration: 'none', fontWeight: 600 }}
                          >
                            <Phone className="w-3.5 h-3.5" /> Call
                          </a>
                          <a
                            href={`https://wa.me/${s.client.phoneE164.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#165b38', textDecoration: 'none', fontWeight: 600 }}
                          >
                            <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Status Badge & Attendance Actions */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                      <span style={{
                        textTransform: 'capitalize',
                        fontSize: '12px',
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: '20px',
                        background: isAttended ? '#dbeafe' : isNoShow ? '#fee2e2' : isConfirmed ? '#d6ebe4' : '#fef3c7',
                        color: isAttended ? '#1e40af' : isNoShow ? '#991b1b' : isConfirmed ? '#16382f' : '#92400e',
                      }}>
                        {s.status.replace('_', ' ')}
                      </span>

                      {/* Attendance Buttons */}
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {s.status !== 'attended' && (
                          <button
                            onClick={() => handleAttendanceChange(s.id, 'attended')}
                            disabled={actionLoading === s.id}
                            style={{
                              background: 'var(--card)',
                              border: '1px solid #bfdbfe',
                              color: '#1d4ed8',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Mark Attended
                          </button>
                        )}
                        {s.status !== 'no_show' && (
                          <button
                            onClick={() => handleAttendanceChange(s.id, 'no_show')}
                            disabled={actionLoading === s.id}
                            style={{
                              background: 'var(--card)',
                              border: '1px solid #fecaca',
                              color: '#dc2626',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Mark No-Show
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 4-HOUR REMINDER PROMPT (Spec Section 11) */}
                  {s.status === 'confirmed' && (
                    <div style={{
                      marginTop: '12px',
                      padding: '10px 14px',
                      background: 'var(--off)',
                      borderRadius: '8px',
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '10px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Clock className="w-4 h-4 text-acc" />
                        <span style={{ fontSize: '13px', color: 'var(--ink)' }}>
                          <strong>4-Hour Reminder Prompt:</strong> Remind {s.client?.displayName}?
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {s.remindersSent && s.remindersSent.length > 0 && (
                          <span style={{ fontSize: '11px', color: 'var(--mut)', marginRight: '6px' }}>
                            Last sent: {s.remindersSent[s.remindersSent.length - 1].channel.toUpperCase()}
                          </span>
                        )}

                        {s.client?.email && (
                          <button
                            onClick={() => handleSendEmailReminder(s.id)}
                            disabled={actionLoading === s.id}
                            style={{
                              background: 'var(--card)',
                              border: '1px solid var(--line)',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              color: 'var(--ink)'
                            }}
                          >
                            <Mail className="w-3.5 h-3.5" /> Send Email
                          </button>
                        )}

                        {s.client?.phoneE164 && (
                          <button
                            onClick={() => handleSendSmsReminder(s.id)}
                            disabled={actionLoading === s.id}
                            style={{
                              background: 'var(--acc)',
                              border: 'none',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              color: '#fff'
                            }}
                          >
                            <MessageSquare className="w-3.5 h-3.5" /> Send SMS
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SECTION 3: RECENT CLIENT RESCHEDULES LOG */}
      {data?.recentChanges && data.recentChanges.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '17px', margin: '0 0 10px', color: 'var(--ink)' }}>Recent Reschedules & Changes</h2>
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '10px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--off)', borderBottom: '1px solid var(--line)', color: 'var(--mut)' }}>
                  <th style={{ padding: '10px 14px' }}>Client</th>
                  <th style={{ padding: '10px 14px' }}>Previous Slot</th>
                  <th style={{ padding: '10px 14px' }}>New Slot</th>
                  <th style={{ padding: '10px 14px' }}>Changed By</th>
                  <th style={{ padding: '10px 14px' }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {data.recentChanges.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>{c.clientName}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--mut)' }}>
                      {new Date(c.fromStartUtc).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Addis_Ababa' })}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--acc)', fontWeight: 600 }}>
                      {new Date(c.toStartUtc).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Addis_Ababa' })}
                    </td>
                    <td style={{ padding: '10px 14px', textTransform: 'capitalize' }}>
                      <span style={{ background: 'var(--off)', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>
                        {c.by}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--mut)' }}>
                      {new Date(c.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* SCREENSHOT PREVIEW MODAL */}
      {viewScreenshotUrl && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal-card" style={{ maxWidth: '600px', width: '100%', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--line)' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--ink)' }}>Receipt Screenshot Preview</h3>
              <button
                onClick={() => setViewScreenshotUrl(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--mut)' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div style={{ padding: '1rem', background: '#000', display: 'flex', justifyContent: 'center', maxHeight: '70vh', overflow: 'auto' }}>
              <img
                src={viewScreenshotUrl}
                alt="Bank Transfer Receipt"
                style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: '6px' }}
              />
            </div>
            <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'flex-end', background: 'var(--off)', borderTop: '1px solid var(--line)' }}>
              <button
                onClick={() => setViewScreenshotUrl(null)}
                style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--ink)', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
