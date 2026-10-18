import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  UserPlus, 
  Calendar, 
  Clock, 
  Phone, 
  Mail, 
  ShieldCheck, 
  Check, 
  Copy, 
  MessageSquare, 
  ArrowRight, 
  AlertCircle
} from 'lucide-react';

interface CreatedPatientResult {
  client: {
    id: number;
    publicId: string;
    displayName: string;
    phoneE164: string;
    email?: string;
    isVerified: boolean;
    bookingToken?: string;
    note?: string;
  };
  session?: {
    id: number;
    startUtc: string;
    durationMin: number;
    status: string;
    feeWaived: boolean;
  };
}

export default function IntakePage() {
  // Patient details state
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isVerified, setIsVerified] = useState(true); // Default verified for manual admin intake
  const [adminNote, setAdminNote] = useState('');

  // Initial consultation session state
  const [scheduleSession, setScheduleSession] = useState(true);
  
  // Tomorrow at 10:00 AM as a sane default
  const getDefaultDateTime = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    const dateStr = d.toISOString().split('T')[0];
    return { date: dateStr, time: '10:00' };
  };

  const [sessionDate, setSessionDate] = useState(() => getDefaultDateTime().date);
  const [sessionTime, setSessionTime] = useState(() => getDefaultDateTime().time);
  const [durationMin, setDurationMin] = useState(60);

  // Submission & status state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreatedPatientResult | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Live Ethiopian phone normalization helper
  const getNormalizedPhonePreview = (input: string): { normalized: string; valid: boolean } => {
    const cleaned = input.replace(/[\s\-\(\)]/g, '');
    if (!cleaned) return { normalized: '', valid: false };

    // Format +251 9/7...
    if (/^\+251[79]\d{8}$/.test(cleaned)) {
      return { normalized: cleaned, valid: true };
    }
    // Format 09... or 07... (10 digits)
    if (/^0[79]\d{8}$/.test(cleaned)) {
      return { normalized: `+251${cleaned.substring(1)}`, valid: true };
    }
    // Format 9... or 7... (9 digits)
    if (/^[79]\d{8}$/.test(cleaned)) {
      return { normalized: `+251${cleaned}`, valid: true };
    }
    // Format 2519... or 2517... (12 digits)
    if (/^251[79]\d{8}$/.test(cleaned)) {
      return { normalized: `+${cleaned}`, valid: true };
    }

    return { normalized: cleaned, valid: false };
  };

  const phonePreview = getNormalizedPhonePreview(phone);

  const resetForm = () => {
    setDisplayName('');
    setPhone('');
    setEmail('');
    setIsVerified(true);
    setAdminNote('');
    setScheduleSession(true);
    const defaults = getDefaultDateTime();
    setSessionDate(defaults.date);
    setSessionTime(defaults.time);
    setDurationMin(60);
    setError(null);
    setResult(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!displayName.trim()) {
      setError('Patient name is required.');
      return;
    }

    if (!phone.trim()) {
      setError('Patient phone number is required.');
      return;
    }

    if (!phonePreview.valid) {
      setError('Please provide a valid Ethiopian mobile phone number (09... / 07... or +2519...).');
      return;
    }

    setLoading(true);

    try {
      if (scheduleSession) {
        // Construct combined UTC timestamp from local date and time inputs
        const [year, month, day] = sessionDate.split('-').map(Number);
        const [hours, minutes] = sessionTime.split(':').map(Number);
        const localDate = new Date(year, month - 1, day, hours, minutes);

        if (isNaN(localDate.getTime())) {
          throw new Error('Please select a valid consultation date and time.');
        }

        const res = await fetch('/api/admin/sessions/self-book', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientName: displayName.trim(),
            clientPhone: phonePreview.normalized,
            clientEmail: email.trim() || undefined,
            isVerified: isVerified,
            startUtc: localDate.toISOString(),
            durationMin: Number(durationMin),
            note: adminNote.trim() || undefined,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to complete patient intake');
        }

        setResult({
          client: data.client || {
            id: data.session.clientId,
            publicId: 'Registered',
            displayName: displayName.trim(),
            phoneE164: phonePreview.normalized,
            email: email.trim() || undefined,
            isVerified,
            note: adminNote.trim() || undefined,
          },
          session: data.session,
        });
      } else {
        // Direct patient registration without an initial session
        const res = await fetch('/api/admin/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName: displayName.trim(),
            phoneE164: phonePreview.normalized,
            email: email.trim() || undefined,
            note: adminNote.trim() || undefined,
            isVerified: isVerified,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to create patient profile');
        }

        setResult({
          client: data,
        });
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during patient intake.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, type: 'link' | 'id') => {
    navigator.clipboard.writeText(text);
    if (type === 'link') {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } else {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2500);
    }
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 20px 60px' }}>
      {/* Top Header Breadcrumb / Title */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '6px', 
            padding: '3px 8px', 
            borderRadius: '6px', 
            background: 'var(--accbg)', 
            color: 'var(--acct)', 
            fontSize: '12px', 
            fontWeight: 600,
            letterSpacing: '0.2px'
          }}>
            <UserPlus style={{ width: '13px', height: '13px' }} />
            Manual Patient Intake
          </span>
          <span style={{ fontSize: '12px', color: 'var(--mut)' }}>· Fee Waived & Payment Bypass</span>
        </div>
        <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.4px' }}>
          New Patient Registration
        </h1>
        <p style={{ margin: '6px 0 0', color: 'var(--mut)', fontSize: '14px', lineHeight: 1.5 }}>
          Onboard a patient directly into the clinical practice. Creates client records and optionally books their initial intake consultation without requiring telebirr or CBE receipt proof.
        </p>
      </div>

      {/* Success Confirmation Card */}
      {result ? (
        <div style={{
          background: 'var(--card)',
          border: '1px solid var(--line)',
          borderRadius: '12px',
          padding: '28px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06)',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '22px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: 'var(--accbg)',
              color: 'var(--acc)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <ShieldCheck style={{ width: '24px', height: '24px' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--ink)' }}>
                  {result.client.displayName}
                </h2>
                <button
                  type="button"
                  onClick={() => copyToClipboard(result.client.publicId, 'id')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: 'var(--line-subtle)',
                    border: '1px solid var(--line)',
                    color: 'var(--ink)',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                  title="Click to copy Patient ID"
                >
                  {result.client.publicId}
                  {copiedId ? <Check style={{ width: '12px', height: '12px', color: 'var(--acc)' }} /> : <Copy style={{ width: '12px', height: '12px', color: 'var(--mut)' }} />}
                </button>
                {result.client.isVerified && (
                  <span style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: 'var(--accbg)',
                    color: 'var(--acct)',
                    fontWeight: 600
                  }}>
                    Verified Client
                  </span>
                )}
              </div>
              <p style={{ margin: '4px 0 0', color: 'var(--mut)', fontSize: '13.5px' }}>
                Patient registered successfully. All records and practice flags are now active.
              </p>
            </div>
          </div>

          {/* Quick Communication Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
            marginBottom: '24px',
            padding: '16px',
            background: 'var(--line-subtle)',
            borderRadius: '8px',
            border: '1px solid var(--line)'
          }}>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--mut)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                Phone Number
              </span>
              <a 
                href={`tel:${result.client.phoneE164}`} 
                style={{ color: 'var(--ink)', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Phone style={{ width: '14px', height: '14px', color: 'var(--acc)' }} />
                {result.client.phoneE164}
              </a>
            </div>

            {result.client.email && (
              <div>
                <span style={{ fontSize: '11px', color: 'var(--mut)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                  Email Address
                </span>
                <a 
                  href={`mailto:${result.client.email}`} 
                  style={{ color: 'var(--ink)', fontWeight: 500, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Mail style={{ width: '14px', height: '14px', color: 'var(--mut)' }} />
                  {result.client.email}
                </a>
              </div>
            )}

            <div>
              <span style={{ fontSize: '11px', color: 'var(--mut)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                Quick Messaging
              </span>
              <a 
                href={`https://wa.me/${result.client.phoneE164.replace('+', '')}`} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ color: 'var(--acc)', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <MessageSquare style={{ width: '14px', height: '14px' }} />
                Open WhatsApp Chat
              </a>
            </div>
          </div>

          {/* Initial Session Details if Scheduled */}
          {result.session && (
            <div style={{
              padding: '16px 18px',
              borderRadius: '8px',
              background: 'var(--accbg)',
              border: '1px solid var(--acc)',
              marginBottom: '24px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--acct)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar style={{ width: '16px', height: '16px' }} />
                  Initial Consultation Scheduled
                </span>
                <span style={{ fontSize: '11px', fontWeight: 600, background: 'var(--acc)', color: '#fff', padding: '2px 8px', borderRadius: '4px' }}>
                  CONFIRMED · ZERO FEE
                </span>
              </div>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', color: 'var(--ink)', fontSize: '13.5px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock style={{ width: '14px', height: '14px', color: 'var(--acc)' }} />
                  <span>
                    {new Date(result.session.startUtc).toLocaleString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    })}
                  </span>
                </div>
                <div>Duration: <b>{result.session.durationMin} minutes</b></div>
                <div>Status: <b style={{ textTransform: 'capitalize' }}>{result.session.status}</b></div>
              </div>
            </div>
          )}

          {/* Private Client Booking Link if verified */}
          {result.client.bookingToken && (
            <div style={{
              padding: '14px 16px',
              borderRadius: '8px',
              background: 'var(--card-elevated, var(--card))',
              border: '1px solid var(--line)',
              marginBottom: '24px'
            }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: '4px' }}>
                Private Patient Reschedule & Self-Booking Link
              </span>
              <p style={{ margin: '0 0 10px', fontSize: '12.5px', color: 'var(--mut)' }}>
                Share this personalized link with the patient so they can book or manage future sessions without telebirr/CBE payment verification.
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/m/${result.client.bookingToken}`}
                  className="admin-input"
                  style={{ fontFamily: 'monospace', fontSize: '12px' }}
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(`${window.location.origin}/m/${result.client.bookingToken}`, 'link')}
                  className="nav-item-link"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--line)',
                    background: 'var(--card)',
                    color: 'var(--ink)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {copiedLink ? <Check style={{ width: '14px', height: '14px', color: 'var(--acc)' }} /> : <Copy style={{ width: '14px', height: '14px' }} />}
                  {copiedLink ? 'Copied Link!' : 'Copy Link'}
                </button>
              </div>
            </div>
          )}

          {/* Next Action Buttons */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', paddingTop: '8px', borderTop: '1px solid var(--line)' }}>
            <button
              type="button"
              onClick={resetForm}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                borderRadius: '8px',
                background: 'var(--acc)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 600,
                fontSize: '13.5px',
                cursor: 'pointer'
              }}
            >
              <UserPlus style={{ width: '16px', height: '16px' }} />
              Register Another Patient
            </button>

            {result.session && (
              <Link
                to="/calendar"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  background: 'var(--card)',
                  color: 'var(--ink)',
                  border: '1px solid var(--line)',
                  fontWeight: 600,
                  fontSize: '13.5px',
                  textDecoration: 'none'
                }}
              >
                <Calendar style={{ width: '16px', height: '16px' }} />
                View in Calendar
              </Link>
            )}

            <Link
              to="/clients"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                borderRadius: '8px',
                background: 'var(--card)',
                color: 'var(--ink)',
                border: '1px solid var(--line)',
                fontWeight: 600,
                fontSize: '13.5px',
                textDecoration: 'none'
              }}
            >
              <ArrowRight style={{ width: '16px', height: '16px' }} />
              View in Client Directory
            </Link>
          </div>
        </div>
      ) : (
        /* The Patient Intake Form */
        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 16px',
              borderRadius: '8px',
              background: 'var(--danger-bg)',
              color: 'var(--danger)',
              border: '1px solid var(--danger)',
              marginBottom: '20px',
              fontSize: '13.5px'
            }}>
              <AlertCircle style={{ width: '18px', height: '18px', flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            
            {/* Card 1: Patient Details */}
            <div style={{
              background: 'var(--card)',
              border: '1px solid var(--line)',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  background: 'var(--accbg)',
                  color: 'var(--acc)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <UserPlus style={{ width: '16px', height: '16px' }} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--ink)' }}>
                    Patient Identification
                  </h2>
                  <span style={{ fontSize: '12px', color: 'var(--mut)' }}>Primary contact & identity</span>
                </div>
              </div>

              {/* Full Name */}
              <div style={{ marginBottom: '16px' }}>
                <label className="admin-label">
                  Full Name <span style={{ color: 'var(--acc)' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Aster Bekele or Dawit Haile"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  className="admin-input"
                  autoFocus
                />
              </div>

              {/* Ethiopian Phone Number */}
              <div style={{ marginBottom: '16px' }}>
                <label className="admin-label">
                  Ethiopian Phone Number <span style={{ color: 'var(--acc)' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="tel"
                    required
                    placeholder="0911234567 or 0711234567"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="admin-input"
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '5px' }}>
                  <span style={{ fontSize: '12px', color: phonePreview.valid ? 'var(--acc)' : 'var(--mut)' }}>
                    {phone ? (
                      phonePreview.valid ? (
                        <>✓ Normalized: <b>{phonePreview.normalized}</b></>
                      ) : (
                        'Format: 09/07XXXXXXXX or +2519/7XXXXXXXX'
                      )
                    ) : (
                      'Accepts 09..., 07..., or +251'
                    )}
                  </span>
                </div>
              </div>

              {/* Email (Optional) */}
              <div style={{ marginBottom: '16px' }}>
                <label className="admin-label">
                  Email Address <span style={{ fontSize: '11px', color: 'var(--mut)', fontWeight: 400 }}>(Optional)</span>
                </label>
                <input
                  type="email"
                  placeholder="patient@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="admin-input"
                />
                <span style={{ fontSize: '11px', color: 'var(--mut)', display: 'block', marginTop: '4px' }}>
                  Used for calendar invites and appointment updates.
                </span>
              </div>

              {/* Practice Verification Toggle */}
              <div style={{
                marginTop: '18px',
                padding: '14px',
                borderRadius: '8px',
                background: 'var(--line-subtle)',
                border: '1px solid var(--line)'
              }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={isVerified}
                    onChange={e => setIsVerified(e.target.checked)}
                    style={{ marginTop: '3px', accentColor: 'var(--acc)' }}
                  />
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--ink)', display: 'block' }}>
                      Mark as Verified Client
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--mut)', lineHeight: 1.4, display: 'block', marginTop: '2px' }}>
                      Bypasses future upfront scheduling fees and generates a dedicated private reschedule link (`/m/:token`).
                    </span>
                  </div>
                </label>
              </div>

            </div>

            {/* Card 2: Initial Consultation & Logistics */}
            <div style={{
              background: 'var(--card)',
              border: '1px solid var(--line)',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  background: 'var(--accbg)',
                  color: 'var(--acc)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Calendar style={{ width: '16px', height: '16px' }} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--ink)' }}>
                    Intake Appointment & Logistics
                  </h2>
                  <span style={{ fontSize: '12px', color: 'var(--mut)' }}>Direct calendar scheduling</span>
                </div>
              </div>

              {/* Consultation Scheduling Toggle */}
              <div style={{
                padding: '14px',
                borderRadius: '8px',
                background: scheduleSession ? 'var(--accbg)' : 'var(--line-subtle)',
                border: `1px solid ${scheduleSession ? 'var(--acc)' : 'var(--line)'}`,
                marginBottom: '18px',
                transition: 'all 0.15s ease'
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={scheduleSession}
                    onChange={e => setScheduleSession(e.target.checked)}
                    style={{ accentColor: 'var(--acc)' }}
                  />
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--ink)' }}>
                      Schedule Initial Consultation Now
                    </span>
                    <span style={{ display: 'block', fontSize: '12px', color: 'var(--mut)', marginTop: '2px' }}>
                      Locks slot on calendar with zero fee and payment verification bypassed.
                    </span>
                  </div>
                </label>
              </div>

              {scheduleSession && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  marginBottom: '18px',
                  padding: '14px',
                  borderRadius: '8px',
                  background: 'var(--line-subtle)',
                  border: '1px solid var(--line)'
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label className="admin-label">Date</label>
                      <input
                        type="date"
                        required={scheduleSession}
                        value={sessionDate}
                        onChange={e => setSessionDate(e.target.value)}
                        className="admin-input"
                      />
                    </div>
                    <div>
                      <label className="admin-label">Time</label>
                      <input
                        type="time"
                        required={scheduleSession}
                        value={sessionTime}
                        onChange={e => setSessionTime(e.target.value)}
                        className="admin-input"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="admin-label">Duration</label>
                    <select
                      value={durationMin}
                      onChange={e => setDurationMin(Number(e.target.value))}
                      className="admin-select"
                    >
                      <option value={60}>60 Minutes (Standard Consultation)</option>
                      <option value={90}>90 Minutes (Comprehensive Intake)</option>
                      <option value={45}>45 Minutes (Short Check-in)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Administrative Note */}
              <div style={{ marginTop: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label className="admin-label" style={{ margin: 0 }}>
                    Administrative & Referral Note
                  </label>
                  <span style={{ fontSize: '11px', color: adminNote.length > 250 ? 'var(--warning)' : 'var(--mut)' }}>
                    {adminNote.length}/280
                  </span>
                </div>
                <textarea
                  rows={3}
                  maxLength={280}
                  placeholder="e.g. Referred by Dr. Selam; prefers morning appointments; guardian: 0911..."
                  value={adminNote}
                  onChange={e => setAdminNote(e.target.value)}
                  className="admin-textarea"
                />
                <span style={{ fontSize: '11px', color: 'var(--mut)', display: 'block', marginTop: '4px', lineHeight: 1.3 }}>
                  Strict non-clinical note. Never enter diagnostic, medication, or psychiatric medical history here.
                </span>
              </div>

            </div>

          </div>

          {/* Form Action Footer */}
          <div style={{
            marginTop: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <span style={{ fontSize: '12.5px', color: 'var(--mut)' }}>
              No telebirr or CBE payment verification required for manual intake.
            </span>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={resetForm}
                disabled={loading}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: '1px solid var(--line)',
                  background: 'var(--card)',
                  color: 'var(--ink)',
                  fontSize: '13.5px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Clear Form
              </button>

              <button
                type="submit"
                disabled={loading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 22px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--acc)',
                  color: '#ffffff',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.75 : 1,
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                }}
              >
                {loading ? (
                  <>
                    <Clock style={{ width: '15px', height: '15px', animation: 'spin 1s linear infinite' }} />
                    Registering Patient...
                  </>
                ) : (
                  <>
                    <UserPlus style={{ width: '15px', height: '15px' }} />
                    {scheduleSession ? 'Register Patient & Schedule Slot' : 'Register Patient Profile'}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
