import { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Calendar, 
  Clock, 
  Lock, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft, 
  RefreshCw, 
  MapPin, 
  Phone, 
  Globe, 
  X
} from 'lucide-react';
import { 
  type TimeConvention, 
  formatTimeSlot, 
  formatEthiopianCalendarDate 
} from '../utils/ethiopianTime';

interface ClientSession {
  id: number;
  startUtc: string;
  durationMin: number;
  status: string;
  feeDueCents: number;
  feeWaived: boolean;
  daysUntilSession: number;
  canReschedule: boolean;
  canCancel: boolean;
  lockReason: string | null;
}

interface ClientPortalData {
  client: {
    id: number;
    publicId: string;
    displayName: string;
    phoneE164: string;
    email?: string;
    isVerified: boolean;
  };
  policy: {
    rescheduleLeadTimeDays: number;
    rescheduleWindowWeeks: number;
    allowClientCancellation: boolean;
    cancellationPolicyText: string;
  };
  practice: {
    practiceName: string;
    locationText: string;
    bio: string;
  };
  sessions: ClientSession[];
}

interface ClientPortalProps {
  token: string;
  timeConvention: TimeConvention;
  onToggleConvention: () => void;
  onBackToHome: () => void;
}

export default function ClientPortal({
  token,
  timeConvention,
  onToggleConvention,
  onBackToHome,
}: ClientPortalProps) {
  const [data, setData] = useState<ClientPortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reschedule Modal State
  const [reschedulingSession, setReschedulingSession] = useState<ClientSession | null>(null);
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedNewSlot, setSelectedNewSlot] = useState<string | null>(null);
  const [submittingReschedule, setSubmittingReschedule] = useState(false);
  const [rescheduleSuccessMessage, setRescheduleSuccessMessage] = useState<string | null>(null);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  const fetchPortalData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/m/${token}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Verified client access link is invalid or expired.');
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Failed to load client portal.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortalData();
  }, [token]);

  // Open Reschedule Modal & Fetch Slots
  const handleOpenReschedule = async (session: ClientSession) => {
    setReschedulingSession(session);
    setSelectedNewSlot(null);
    setRescheduleError(null);
    setRescheduleSuccessMessage(null);
    setLoadingSlots(true);

    try {
      const res = await fetch(`/api/m/${token}/slots?duration=${session.durationMin}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to load available reschedule slots.');
      }
      const json = await res.json();
      setAvailableSlots(json.slots || []);
    } catch (err: any) {
      setRescheduleError(err.message);
    } finally {
      setLoadingSlots(false);
    }
  };

  // Submit Reschedule Request
  const handleConfirmReschedule = async () => {
    if (!reschedulingSession || !selectedNewSlot) return;

    setSubmittingReschedule(true);
    setRescheduleError(null);

    try {
      const res = await fetch(`/api/m/${token}/sessions/${reschedulingSession.id}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newStartUtc: selectedNewSlot }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to reschedule appointment.');
      }

      setRescheduleSuccessMessage('Your appointment has been successfully moved.');
      // Refresh portal session data
      await fetchPortalData();
      setTimeout(() => {
        setReschedulingSession(null);
        setSelectedNewSlot(null);
        setRescheduleSuccessMessage(null);
      }, 2000);
    } catch (err: any) {
      setRescheduleError(err.message || 'Failed to process reschedule.');
    } finally {
      setSubmittingReschedule(false);
    }
  };

  if (loading) {
    return (
      <div className="portal-container" style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <RefreshCw className="w-8 h-8 animate-spin" style={{ color: 'var(--acc)', margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '18px', margin: '0 0 6px', color: 'var(--ink)' }}>Connecting to Verified Client Sanctuary...</h2>
          <p style={{ color: 'var(--mut)', fontSize: '14px', margin: 0 }}>Retrieving your clinical appointment schedule</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="portal-container" style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
        <div style={{ maxWidth: '480px', width: '100%', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '16px', padding: '2rem', textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#fff5f5', color: '#c53030', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 style={{ fontSize: '20px', margin: '0 0 8px', color: 'var(--ink)' }}>Access Link Not Recognized</h2>
          <p style={{ color: 'var(--mut)', fontSize: '14px', lineHeight: 1.5, margin: '0 0 1.5rem' }}>
            {error || 'This link may have expired or is not configured for verified client access. For privacy, verified links are unique to each practitioner.'}
          </p>
          <button
            onClick={onBackToHome}
            style={{
              background: 'var(--acc)',
              color: '#fff',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <ArrowLeft className="w-4 h-4" /> Return to Practice Home
          </button>
        </div>
      </div>
    );
  }

  const { client, policy, practice, sessions } = data;

  return (
    <div className="portal-page" style={{ maxWidth: '840px', margin: '0 auto', padding: '2rem 1.25rem 4rem' }}>
      {/* Navigation & Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '12px' }}>
        <button
          onClick={onBackToHome}
          className="btn-sanctuary-secondary"
          style={{ padding: '0.45rem 1rem', fontSize: '13px' }}
        >
          <ArrowLeft className="w-4 h-4" /> Back to Sanctuary
        </button>

        {/* Time convention switch */}
        <button
          onClick={onToggleConvention}
          className="btn-sanctuary-pill"
          title="Switch between Ethiopian Local Time and Gregorian (GMT+3)"
        >
          <Globe className="w-3.5 h-3.5 text-acc" />
          <span>Clock: {timeConvention === 'ethiopian' ? 'Ethiopian Local Time' : 'GMT+3 Gregorian'}</span>
        </button>
      </div>

      {/* Verified Member Badge Card */}
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: '16px',
        padding: '1.75rem',
        marginBottom: '2rem',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#e3f7ed', color: '#165b38', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>
            <ShieldCheck className="w-4 h-4" /> Verified Client Member
          </div>
          <h1 style={{ fontSize: '24px', margin: '0 0 4px', color: 'var(--ink)', fontWeight: 700 }}>
            Welcome, {client.displayName}
          </h1>
          <p style={{ margin: 0, color: 'var(--mut)', fontSize: '13px' }}>
            Client ID: <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--ink)' }}>{client.publicId}</span> · Phone: {client.phoneE164}
          </p>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '12px', color: 'var(--mut)', display: 'block' }}>Practice</span>
          <strong style={{ fontSize: '14px', color: 'var(--ink)' }}>{practice.practiceName}</strong>
        </div>
      </div>

      {/* Governance & Policy Overview Card */}
      <div style={{
        background: 'var(--off)',
        border: '1px solid var(--line)',
        borderRadius: '12px',
        padding: '1.25rem 1.5rem',
        marginBottom: '2rem',
        fontSize: '13px',
        color: 'var(--ink)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <Lock className="w-4 h-4 text-acc" />
          <strong style={{ fontSize: '14px' }}>Practice Rescheduling & Cancellation Policy</strong>
        </div>
        <p style={{ margin: 0, color: 'var(--mut)', lineHeight: 1.5 }}>
          {policy.cancellationPolicyText || `Appointments cannot be rescheduled or cancelled within ${policy.rescheduleLeadTimeDays} days of the scheduled time. Outside this window, you may freely move your session up to ${policy.rescheduleWindowWeeks} weeks in advance.`}
        </p>
      </div>

      {/* Upcoming Appointments Section */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '18px', margin: 0, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar className="w-5 h-5 text-acc" /> Upcoming Appointments ({sessions.length})
          </h2>
          <span style={{ fontSize: '12px', color: 'var(--mut)' }}>
            Schedule synced with therapist
          </span>
        </div>

        {sessions.length === 0 ? (
          <div style={{
            background: 'var(--card)',
            border: '1px dashed var(--line)',
            borderRadius: '14px',
            padding: '2.5rem 1.5rem',
            textAlign: 'center',
            color: 'var(--mut)'
          }}>
            <Calendar className="w-10 h-10" style={{ color: 'var(--mut)', margin: '0 auto 12px', opacity: 0.5 }} />
            <h3 style={{ fontSize: '16px', margin: '0 0 6px', color: 'var(--ink)' }}>No Upcoming Sessions</h3>
            <p style={{ margin: 0, fontSize: '13px' }}>
              You do not have any active appointments booked at this time. Please contact Dr. Hana to schedule your next session.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {sessions.map(session => {
              const sessionDate = new Date(session.startUtc);
              const ethDateStr = formatEthiopianCalendarDate(sessionDate);
              const timeFormatted = formatTimeSlot(sessionDate, timeConvention, session.durationMin);

              return (
                <div
                  key={session.id}
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--line)',
                    borderRadius: '14px',
                    padding: '1.25rem 1.5rem',
                    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)',
                    transition: 'border-color 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{
                          background: '#e3f7ed',
                          color: '#165b38',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          textTransform: 'uppercase'
                        }}>
                          {session.status}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--mut)', fontWeight: 600 }}>
                          {session.durationMin} Minutes
                        </span>
                        <span style={{ fontSize: '12px', color: session.canReschedule ? 'var(--acc)' : '#c53030', fontWeight: 600 }}>
                          · {session.daysUntilSession === 0 ? 'Today' : session.daysUntilSession === 1 ? 'Tomorrow' : `In ${session.daysUntilSession} days`}
                        </span>
                      </div>

                      <h3 style={{ fontSize: '18px', margin: '0 0 4px', color: 'var(--ink)', fontWeight: 700 }}>
                        {sessionDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                        {ethDateStr && <span style={{ fontSize: '14px', color: 'var(--mut)', fontWeight: 400, marginLeft: '8px' }}>({ethDateStr} E.C.)</span>}
                      </h3>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--ink)', fontSize: '15px', fontWeight: 600 }}>
                        <Clock className="w-4 h-4 text-acc" />
                        <span>{timeFormatted.primary}</span>
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--mut)', display: 'block', marginTop: '2px' }}>
                        {timeFormatted.secondary}
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                      {session.canReschedule ? (
                        <button
                          onClick={() => handleOpenReschedule(session)}
                          className="btn-sanctuary-primary"
                          style={{ padding: '0.55rem 1.15rem', fontSize: '13px' }}
                        >
                          <Calendar className="w-4 h-4" /> Reschedule Session
                        </button>
                      ) : (
                        <button
                          disabled
                          title={`Rescheduling locked within ${policy.rescheduleLeadTimeDays} days of appointment`}
                          className="btn-sanctuary-locked"
                        >
                          <Lock className="w-4 h-4" /> Reschedule Inactive
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Cutoff Inactivity Warning if locked */}
                  {!session.canReschedule && (
                    <div style={{
                      background: '#fff5f5',
                      border: '1px solid #fed7d7',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      marginTop: '8px',
                      fontSize: '12px',
                      color: '#9b2c2c',
                      lineHeight: 1.4
                    }}>
                      <Lock className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Rescheduling & Cancellation Inactive Online</strong>
                        <p style={{ margin: '2px 0 0' }}>
                          This appointment is scheduled in less than {policy.rescheduleLeadTimeDays} days. Self-service adjustments are locked to maintain therapeutic availability. Please contact Dr. Hana directly for any urgent adjustments.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Practitioner Office & Direct Contact Card */}
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: '16px',
        padding: '1.5rem',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '20px'
      }}>
        <div>
          <h4 style={{ fontSize: '14px', margin: '0 0 6px', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MapPin className="w-4 h-4 text-acc" /> In-Person Practice Location
          </h4>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--mut)', lineHeight: 1.5 }}>
            {practice.locationText || 'Bulgaria area, near the African Union, Addis Ababa'}
          </p>
        </div>

        <div>
          <h4 style={{ fontSize: '14px', margin: '0 0 6px', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Phone className="w-4 h-4 text-acc" /> Need Direct Assistance?
          </h4>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--mut)', lineHeight: 1.5 }}>
            For late changes, cancellations, or urgent concerns, please reach out directly via your registered clinical contact number.
          </p>
        </div>
      </div>

      {/* Reschedule Modal */}
      {reschedulingSession && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          zIndex: 9999
        }}>
          <div style={{
            background: 'var(--card)',
            border: '1px solid var(--line)',
            borderRadius: '16px',
            maxWidth: '560px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '17px', margin: 0, color: 'var(--ink)', fontWeight: 700 }}>
                  Reschedule Appointment
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--mut)' }}>
                  Select an available slot within the next {policy.rescheduleWindowWeeks} weeks
                </p>
              </div>
              <button
                onClick={() => setReschedulingSession(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--mut)', cursor: 'pointer', padding: '4px' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
              {rescheduleSuccessMessage ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                  <CheckCircle2 className="w-12 h-12" style={{ color: '#165b38', margin: '0 auto 12px' }} />
                  <h4 style={{ fontSize: '18px', margin: '0 0 6px', color: 'var(--ink)' }}>
                    {rescheduleSuccessMessage}
                  </h4>
                  <p style={{ color: 'var(--mut)', fontSize: '13px' }}>
                    Your therapist has been notified and your schedule has been updated.
                  </p>
                </div>
              ) : (
                <>
                  {rescheduleError && (
                    <div style={{ background: '#fff5f5', border: '1px solid #fed7d7', color: '#c53030', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '14px' }}>
                      {rescheduleError}
                    </div>
                  )}

                  <div style={{ marginBottom: '1.25rem', fontSize: '13px', color: 'var(--mut)' }}>
                    Current Time: <strong>{new Date(reschedulingSession.startUtc).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at {formatTimeSlot(reschedulingSession.startUtc, timeConvention).primary}</strong>
                  </div>

                  {loadingSlots ? (
                    <div style={{ textAlign: 'center', padding: '2.5rem 0', color: 'var(--mut)' }}>
                      <RefreshCw className="w-6 h-6 animate-spin" style={{ color: 'var(--acc)', margin: '0 auto 8px' }} />
                      <p style={{ fontSize: '13px', margin: 0 }}>Searching available clinical slots...</p>
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', border: '1px dashed var(--line)', borderRadius: '10px', color: 'var(--mut)' }}>
                      <p style={{ margin: 0, fontSize: '13px' }}>
                        No open slots found in the next {policy.rescheduleWindowWeeks} weeks. Please contact Dr. Hana directly.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', marginBottom: '8px' }}>
                        Available Open Slots ({availableSlots.length})
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '10px', maxHeight: '280px', overflowY: 'auto' }}>
                        {availableSlots.slice(0, 40).map(slot => {
                          const slotDate = new Date(slot.startUtc);
                          const isSelected = selectedNewSlot === slot.startUtc;
                          const formatted = formatTimeSlot(slotDate, timeConvention, reschedulingSession.durationMin);

                          return (
                            <button
                              key={slot.startUtc}
                              type="button"
                              onClick={() => setSelectedNewSlot(slot.startUtc)}
                              style={{
                                background: isSelected ? 'linear-gradient(180deg, var(--btn-forest-top) 0%, var(--btn-forest-bottom) 100%)' : 'var(--card)',
                                color: isSelected ? '#fff' : 'var(--ink)',
                                border: isSelected ? '1.5px solid rgba(255, 255, 255, 0.2)' : '1px solid var(--line)',
                                boxShadow: isSelected ? 'var(--btn-rim-light), 0 4px 12px rgba(20, 36, 30, 0.16)' : '0 1px 2px rgba(0, 0, 0, 0.03)',
                                padding: '10px 12px',
                                borderRadius: 'var(--btn-tile-radius)',
                                textAlign: 'left',
                                cursor: 'pointer',
                                transition: 'all 0.18s ease'
                              }}
                            >
                              <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '2px' }}>
                                {slotDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                              </div>
                              <div style={{ fontSize: '12px', fontWeight: 600 }}>
                                {formatted.primary}
                              </div>
                              <div style={{ fontSize: '10px', opacity: 0.8, marginTop: '2px' }}>
                                {formatted.secondary}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            {!rescheduleSuccessMessage && (
              <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--line)', background: 'var(--off)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setReschedulingSession(null)}
                  disabled={submittingReschedule}
                  className="btn-sanctuary-secondary"
                  style={{ padding: '0.55rem 1.25rem', fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReschedule}
                  disabled={!selectedNewSlot || submittingReschedule}
                  className="btn-sanctuary-primary"
                  style={{ padding: '0.55rem 1.45rem', fontSize: '13px' }}
                >
                  {submittingReschedule ? 'Rescheduling...' : 'Confirm Move'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
