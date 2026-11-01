import { useState } from 'react';
import { 
  X, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Eye, 
  Copy, 
  Check, 
  ExternalLink, 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  Mail, 
  FileText,
  Maximize2,
  RefreshCw
} from 'lucide-react';

export interface PaymentReviewDetails {
  id: number;
  provider: string;
  reference: string;
  amountCents: number;
  paidAt?: string | null;
  screenshotPath?: string | null;
  client?: {
    displayName?: string | null;
    phoneE164?: string | null;
    email?: string | null;
    publicId?: string | null;
  } | null;
  session?: {
    id?: number | null;
    startUtc?: string | Date | null;
    durationMin?: number | null;
    status?: string | null;
    feeDueCents?: number | null;
  } | null;
}

interface PaymentReviewModalProps {
  payment: PaymentReviewDetails | null;
  isOpen: boolean;
  onClose: () => void;
  onPaymentConfirmed?: (paymentId: number) => void;
  onPaymentRejected?: (paymentId: number) => void;
}

const REJECTION_REASONS = [
  'Payment not received on bank statement',
  'Invalid or unverified reference code',
  'Amount transferred is incorrect',
  'Duplicate or already applied receipt',
  'Counterfeit or altered screenshot',
  'Other (specify note below)',
];

export function PaymentReviewModal({
  payment,
  isOpen,
  onClose,
  onPaymentConfirmed,
  onPaymentRejected,
}: PaymentReviewModalProps) {
  const [copiedRef, setCopiedRef] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState(REJECTION_REASONS[0]);
  const [customRejectNote, setCustomRejectNote] = useState('');
  const [actionLoading, setActionLoading] = useState<'accept' | 'reject' | 'reverify' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reverifyFeedback, setReverifyFeedback] = useState<string | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);

  if (!isOpen || !payment) return null;

  const handleCopyReference = () => {
    navigator.clipboard.writeText(payment.reference);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  const handleReverify = async () => {
    try {
      setActionLoading('reverify');
      setErrorMessage(null);
      setReverifyFeedback(null);
      const res = await fetch(`/api/admin/payments/${payment.id}/reverify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.verified) {
        throw new Error(data.message || data.error || 'Re-verification failed. Slip could not be verified automatically.');
      }
      setReverifyFeedback(data.message || 'Payment verified automatically via Verifier API!');
      setTimeout(() => {
        onPaymentConfirmed?.(payment.id);
        onClose();
      }, 1400);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error running automatic verification');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAccept = async () => {
    try {
      setActionLoading('accept');
      setErrorMessage(null);
      const res = await fetch(`/api/admin/payments/${payment.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to confirm payment.');
      }
      onPaymentConfirmed?.(payment.id);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error confirming payment');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    try {
      setActionLoading('reject');
      setErrorMessage(null);
      const finalReason = rejectReason === 'Other (specify note below)'
        ? (customRejectNote.trim() || 'Payment rejected by administrator')
        : rejectReason;

      const res = await fetch(`/api/admin/payments/${payment.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: finalReason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reject payment.');
      }
      onPaymentRejected?.(payment.id);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error rejecting payment');
    } finally {
      setActionLoading(null);
    }
  };

  const normalizedScreenshotUrl = payment.screenshotPath
    ? (payment.screenshotPath.startsWith('/') ? payment.screenshotPath : `/${payment.screenshotPath}`)
    : null;

  const formatSessionTime = (utcStr?: string | Date | null, durationMin = 60) => {
    if (!utcStr) return 'No appointment slot attached';
    const d = new Date(utcStr);
    return `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Africa/Addis_Ababa' })} · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Africa/Addis_Ababa' })} (${durationMin} min)`;
  };

  const providerUpper = payment.provider.toUpperCase();
  const getProviderBadgeColor = (p: string) => {
    const low = p.toLowerCase();
    if (low.includes('telebirr')) return { bg: '#e0f2fe', text: '#0284c7', border: '#bae6fd' };
    if (low.includes('cbe')) return { bg: '#f3e8ff', text: '#7e22ce', border: '#e9d5ff' };
    if (low.includes('dashen')) return { bg: '#dbeafe', text: '#1d4ed8', border: '#bfdbfe' };
    if (low.includes('abyssinia') || low.includes('boa')) return { bg: '#fef9c3', text: '#a16207', border: '#fef08a' };
    return { bg: 'var(--off)', text: 'var(--ink)', border: 'var(--line)' };
  };
  const providerColors = getProviderBadgeColor(payment.provider);

  return (
    <div className="admin-modal-backdrop" onClick={onClose} style={{ zIndex: 10000 }}>
      <div 
        className="admin-modal-card" 
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '820px',
          width: '94%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
        }}
      >
        {/* HEADER */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--card)',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--ink)' }}>
                Verify & Review Payment Receipt
              </h2>
              <span style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '12px',
                background: '#fef3c7',
                color: '#b45309',
                border: '1px solid #fde68a',
              }}>
                Needs Decision
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--mut)' }}>
              Inspect the client's transfer details and slip before confirming or cancelling this appointment.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--mut)',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ERROR BANNER */}
        {errorMessage && (
          <div style={{
            padding: '10px 1.5rem',
            background: '#fef2f2',
            borderBottom: '1px solid #fecaca',
            color: '#b91c1c',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* RE-VERIFY SUCCESS BANNER */}
        {reverifyFeedback && (
          <div style={{
            padding: '10px 1.5rem',
            background: '#ecfdf5',
            borderBottom: '1px solid #a7f3d0',
            color: '#065f46',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <span>{reverifyFeedback}</span>
          </div>
        )}

        {/* BODY */}
        <div style={{
          padding: '1.25rem 1.5rem',
          overflowY: 'auto',
          flex: 1,
          display: 'grid',
          gridTemplateColumns: normalizedScreenshotUrl ? 'repeat(auto-fit, minmax(320px, 1fr))' : '1fr',
          gap: '1.25rem',
        }}>
          {/* LEFT: PAYMENT & APPOINTMENT DETAILS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Transfer Summary Card */}
            <div style={{
              background: 'var(--off)',
              border: '1px solid var(--line)',
              borderRadius: '8px',
              padding: '1rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  background: providerColors.bg,
                  color: providerColors.text,
                  border: `1px solid ${providerColors.border}`,
                }}>
                  {providerUpper}
                </span>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '11px', color: 'var(--mut)', display: 'block' }}>Payment Amount</span>
                  <strong style={{ fontSize: '18px', color: 'var(--acc)', fontWeight: 800 }}>
                    ETB {(payment.amountCents / 100).toFixed(2)}
                  </strong>
                </div>
              </div>

              {/* Reference */}
              <div style={{
                background: 'var(--card)',
                border: '1px solid var(--line)',
                borderRadius: '6px',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '8px',
              }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--mut)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Reference Number
                  </div>
                  <code style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)' }}>
                    {payment.reference}
                  </code>
                </div>

                <button
                  type="button"
                  onClick={handleCopyReference}
                  style={{
                    background: copiedRef ? '#ecfdf5' : 'var(--off)',
                    border: `1px solid ${copiedRef ? '#a7f3d0' : 'var(--line)'}`,
                    color: copiedRef ? '#059669' : 'var(--ink)',
                    padding: '5px 10px',
                    borderRadius: '5px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title="Copy reference code"
                >
                  {copiedRef ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedRef ? 'Copied' : 'Copy'}
                </button>
              </div>

              {payment.paidAt && (
                <div style={{ fontSize: '12px', color: 'var(--mut)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Clock className="w-3.5 h-3.5" />
                  Transaction Date: {new Date(payment.paidAt).toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' })}
                </div>
              )}

              {payment.session?.feeDueCents !== undefined && payment.session?.feeDueCents !== null && (
                <div style={{ 
                  fontSize: '12px', 
                  marginTop: '8px', 
                  padding: '6px 10px', 
                  borderRadius: '6px', 
                  background: payment.amountCents >= payment.session.feeDueCents ? '#ecfdf5' : '#fffbeb',
                  color: payment.amountCents >= payment.session.feeDueCents ? '#065f46' : '#92400e',
                  border: `1px solid ${payment.amountCents >= payment.session.feeDueCents ? '#a7f3d0' : '#fde68a'}`,
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                }}>
                  <span>Timely Rate Required:</span>
                  <strong>ETB {(payment.session.feeDueCents / 100).toFixed(2)}</strong>
                </div>
              )}
            </div>

            {/* Client Info Card */}
            <div style={{
              background: 'var(--card)',
              border: '1px solid var(--line)',
              borderRadius: '8px',
              padding: '1rem',
            }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--mut)', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <User className="w-3.5 h-3.5" /> Client Information
              </div>

              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink)', marginBottom: '4px' }}>
                {payment.client?.displayName || 'Client Booking'}
              </div>

              {payment.client?.phoneE164 && (
                <div style={{ fontSize: '13px', color: 'var(--ink)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Phone className="w-3.5 h-3.5 text-mut" />
                  <a href={`tel:${payment.client.phoneE164}`} style={{ color: 'var(--acc)', textDecoration: 'none', fontWeight: 600 }}>
                    {payment.client.phoneE164}
                  </a>
                </div>
              )}

              {payment.client?.email && (
                <div style={{ fontSize: '13px', color: 'var(--ink)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Mail className="w-3.5 h-3.5 text-mut" />
                  <a href={`mailto:${payment.client.email}`} style={{ color: 'var(--ink)', textDecoration: 'none' }}>
                    {payment.client.email}
                  </a>
                </div>
              )}
            </div>

            {/* Appointment Slot Details */}
            {payment.session && (
              <div style={{
                background: 'var(--card)',
                border: '1px solid var(--line)',
                borderRadius: '8px',
                padding: '1rem',
              }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--mut)', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar className="w-3.5 h-3.5" /> Appointment Reserved Slot
                </div>

                <div style={{ fontSize: '13px', color: 'var(--ink)', fontWeight: 600 }}>
                  {formatSessionTime(payment.session.startUtc, payment.session.durationMin || 60)}
                </div>

                <div style={{ fontSize: '12px', color: 'var(--mut)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Status:</span>
                  <span style={{
                    textTransform: 'capitalize',
                    fontWeight: 600,
                    color: payment.session.status === 'confirmed' ? '#15803d' : '#b45309',
                  }}>
                    {payment.session.status?.replace('_', ' ')}
                  </span>
                  <span>·</span>
                  <span>Fee due: ETB {((payment.session.feeDueCents || payment.amountCents) / 100).toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: RECEIPT IMAGE PREVIEW */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--mut)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Eye className="w-3.5 h-3.5" /> Receipt Screenshot Slip
              </span>

              {normalizedScreenshotUrl && (
                <a
                  href={normalizedScreenshotUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: '12px',
                    color: 'var(--acc)',
                    textDecoration: 'none',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open Full Image
                </a>
              )}
            </div>

            {normalizedScreenshotUrl ? (
              <div 
                style={{
                  background: '#0f1714',
                  borderRadius: '8px',
                  border: '1px solid var(--line)',
                  padding: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '260px',
                  maxHeight: '380px',
                  overflow: 'hidden',
                  position: 'relative',
                  cursor: 'pointer',
                }}
                onClick={() => setIsZoomed(!isZoomed)}
                title="Click to toggle zoom"
              >
                <img
                  src={normalizedScreenshotUrl}
                  alt="Client Transfer Receipt Slip"
                  style={{
                    maxWidth: '100%',
                    maxHeight: isZoomed ? '500px' : '360px',
                    objectFit: 'contain',
                    borderRadius: '4px',
                    transition: 'all 0.2s ease',
                  }}
                />
                <div style={{
                  position: 'absolute',
                  bottom: '8px',
                  right: '8px',
                  background: 'rgba(0,0,0,0.65)',
                  color: '#fff',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  backdropFilter: 'blur(2px)',
                }}>
                  <Maximize2 className="w-3 h-3" />
                  {isZoomed ? 'Fit to box' : 'Zoom in'}
                </div>
              </div>
            ) : (
              <div style={{
                background: 'var(--off)',
                border: '1px dashed var(--line)',
                borderRadius: '8px',
                padding: '2.5rem 1.5rem',
                textAlign: 'center',
                color: 'var(--mut)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                minHeight: '220px',
              }}>
                <FileText className="w-10 h-10" style={{ strokeWidth: 1.5, marginBottom: '10px', opacity: 0.6 }} />
                <strong style={{ color: 'var(--ink)', fontSize: '14px', marginBottom: '4px' }}>
                  No Image Slip Uploaded
                </strong>
                <p style={{ margin: 0, fontSize: '12px', maxWidth: '280px', lineHeight: 1.4 }}>
                  The client submitted their booking with a bank reference code only without attaching a screenshot image.
                </p>
                <p style={{ margin: '8px 0 0', fontSize: '11px', color: 'var(--mut)' }}>
                  Verify this reference in your <strong>{providerUpper}</strong> transactions list before confirming.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* REJECTION REASON SELECTION PANEL (Reveals if admin clicks Reject) */}
        {showRejectForm && (
          <div style={{
            padding: '1rem 1.5rem',
            background: '#fff1f2',
            borderTop: '1px solid #fecdd3',
            borderBottom: '1px solid #fecdd3',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#be123c', fontWeight: 700, fontSize: '13px', marginBottom: '8px' }}>
              <AlertTriangle className="w-4 h-4" />
              Specify Rejection Reason (Cancels Session Reservation)
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <select
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #f43f5e',
                  background: '#fff',
                  fontSize: '13px',
                  color: '#1e293b',
                }}
              >
                {REJECTION_REASONS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              {rejectReason === 'Other (specify note below)' && (
                <input
                  type="text"
                  placeholder="Enter rejection explanation for practice records..."
                  value={customRejectNote}
                  onChange={(e) => setCustomRejectNote(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #f43f5e',
                    fontSize: '13px',
                  }}
                />
              )}

              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#9f1239' }}>
                Rejecting will mark the transfer invalid and cancel the slot, allowing other clients to book it.
              </p>
            </div>
          </div>
        )}

        {/* FOOTER ACTIONS */}
        <div style={{
          padding: '1rem 1.5rem',
          background: 'var(--off)',
          borderTop: '1px solid var(--line)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
        }}>
          <div>
            <button
              type="button"
              onClick={onClose}
              disabled={actionLoading !== null}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid var(--line)',
                background: 'var(--card)',
                color: 'var(--ink)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel / Close
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {!showRejectForm ? (
              <button
                type="button"
                onClick={() => setShowRejectForm(true)}
                disabled={actionLoading !== null}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid #fecaca',
                  background: '#fff',
                  color: '#dc2626',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <XCircle className="w-4 h-4" /> Reject Payment
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowRejectForm(false)}
                  disabled={actionLoading !== null}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--line)',
                    background: 'var(--card)',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={actionLoading !== null}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#dc2626',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <XCircle className="w-4 h-4" />
                  {actionLoading === 'reject' ? 'Rejecting...' : 'Confirm Rejection & Cancel Slot'}
                </button>
              </div>
            )}

            {!showRejectForm && (
              <>
                <button
                  type="button"
                  onClick={handleReverify}
                  disabled={actionLoading !== null}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--line)',
                    background: 'var(--card)',
                    color: 'var(--ink)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                  title="Query the verifier API directly to verify this receipt automatically"
                >
                  <RefreshCw className={`w-4 h-4 ${actionLoading === 'reverify' ? 'animate-spin' : ''}`} />
                  {actionLoading === 'reverify' ? 'Verifying...' : 'Re-verify with API'}
                </button>

                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={actionLoading !== null}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--acc)',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px rgba(22, 91, 56, 0.25)',
                  }}
                >
                  <CheckCircle className="w-4 h-4" />
                  {actionLoading === 'accept' ? 'Accepting...' : 'Accept & Confirm Payment'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
