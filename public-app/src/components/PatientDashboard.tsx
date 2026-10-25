import { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  Lock, 
  Plus, 
  LogOut, 
  Globe, 
  MapPin, 
  Phone, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  X,
  History
} from 'lucide-react';
import { 
  type TimeConvention, 
  formatTimeSlot, 
  formatEthiopianCalendarDate 
} from '../utils/ethiopianTime';

interface PatientDashboardProps {
  timeConvention: TimeConvention;
  onToggleConvention: () => void;
  onLogout: () => void;
}

export default function PatientDashboard({
  timeConvention,
  onToggleConvention,
  onLogout,
}: PatientDashboardProps) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Booking Modal State
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [bookingSlots, setBookingSlots] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedBookingSlot, setSelectedBookingSlot] = useState<string | null>(null);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);

  // Reschedule Modal State
  const [reschedulingSession, setReschedulingSession] = useState<any | null>(null);
  const [rescheduleSlots, setRescheduleSlots] = useState<any[]>([]);
  const [loadingRescheduleSlots, setLoadingRescheduleSlots] = useState(false);
  const [selectedRescheduleSlot, setSelectedRescheduleSlot] = useState<string | null>(null);
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);
  const [rescheduleSuccess, setRescheduleSuccess] = useState<string | null>(null);

  const fetchDashboard = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/patient/dashboard');
      if (res.status === 401) {
        onLogout();
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to load patient dashboard.');
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  // Fetch available slots for booking
  const handleOpenBooking = async () => {
    setBookingModalOpen(true);
    setSelectedBookingSlot(null);
    setBookingSuccess(null);
    setLoadingSlots(true);

    try {
      const from = new Date();
      const to = new Date();
      to.setDate(to.getDate() + 30);
      const res = await fetch(`/api/public/slots?from=${from.toISOString()}&to=${to.toISOString()}&duration=60`);
      if (res.ok) {
        const slots = await res.json();
        setBookingSlots(slots || []);
      }
    } catch {
      setBookingSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  // Submit Instant Booking
  const handleConfirmBooking = async () => {
    if (!selectedBookingSlot) return;
    setBookingSubmitting(true);
    try {
      const res = await fetch('/api/patient/sessions/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startUtc: selectedBookingSlot, durationMin: 60 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to book appointment');

      setBookingSuccess('Your session has been successfully booked!');
      await fetchDashboard();
      setTimeout(() => {
        setBookingModalOpen(false);
        setBookingSuccess(null);
      }, 2000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBookingSubmitting(false);
    }
  };

  // Open Reschedule Modal & Fetch Slots
  const handleOpenReschedule = async (session: any) => {
    setReschedulingSession(session);
    setSelectedRescheduleSlot(null);
    setRescheduleSuccess(null);
    setLoadingRescheduleSlots(true);

    try {
      const token = data?.client?.bookingToken;
      const res = await fetch(`/api/m/${token}/slots?duration=${session.durationMin}`);
      if (res.ok) {
        const json = await res.json();
        setRescheduleSlots(json.slots || []);
      }
    } catch {
      setRescheduleSlots([]);
    } finally {
      setLoadingRescheduleSlots(false);
    }
  };

  // Confirm Reschedule
  const handleConfirmReschedule = async () => {
    if (!reschedulingSession || !selectedRescheduleSlot) return;
    setRescheduleSubmitting(true);

    try {
      const token = data?.client?.bookingToken;
      const res = await fetch(`/api/m/${token}/sessions/${reschedulingSession.id}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newStartUtc: selectedRescheduleSlot }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to reschedule session');

      setRescheduleSuccess('Your appointment has been successfully rescheduled.');
      await fetchDashboard();
      setTimeout(() => {
        setReschedulingSession(null);
        setRescheduleSuccess(null);
      }, 2000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRescheduleSubmitting(false);
    }
  };

  const handleLogoutClick = async () => {
    try {
      await fetch('/api/patient/logout', { method: 'POST' });
    } catch {}
    onLogout();
  };

  if (loading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <RefreshCw className="w-8 h-8 animate-spin" style={{ color: 'var(--acc)', margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '18px', color: 'var(--ink)', margin: '0 0 6px' }}>Loading Patient Sanctuary...</h2>
          <p style={{ color: 'var(--mut)', fontSize: '14px', margin: 0 }}>Syncing clinical calendar & appointments</p>
        </div>
      </div>
    );
  }

  if (errorMsg || !data) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
        <div style={{ maxWidth: '440px', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '16px', padding: '2rem', textAlign: 'center' }}>
          <AlertCircle className="w-8 h-8" style={{ color: '#c53030', margin: '0 auto 12px' }} />
          <h2 style={{ fontSize: '18px', margin: '0 0 8px', color: 'var(--ink)' }}>Dashboard Error</h2>
          <p style={{ color: 'var(--mut)', fontSize: '14px', margin: '0 0 1.5rem' }}>{errorMsg}</p>
          <button
            onClick={fetchDashboard}
            style={{ background: 'var(--acc)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const { client, policy, practice, upcomingSessions, pastSessions } = data;

  return (
    <div style={{ maxWidth: '880px', margin: '0 auto', padding: '2rem 1.25rem 4rem' }}>
      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--acc)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {practice.practiceName}
          </span>
          <h1 style={{ fontSize: '24px', margin: '2px 0 0', color: 'var(--ink)', fontWeight: 700 }}>
            Patient Portal
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Clock format switch */}
          <button
            onClick={onToggleConvention}
            style={{
              background: 'var(--off)',
              border: '1px solid var(--line)',
              color: 'var(--ink)',
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Globe className="w-3.5 h-3.5 text-acc" />
            <span>Clock: {timeConvention === 'ethiopian' ? 'Ethiopian' : 'GMT+3'}</span>
          </button>

          {/* Logout button */}
          <button
            onClick={handleLogoutClick}
            style={{
              background: 'transparent',
              border: '1px solid var(--line)',
              color: 'var(--mut)',
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </div>

      {/* Patient Profile & Quick Actions Banner */}
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: '16px',
        padding: '1.75rem',
        marginBottom: '2rem',
        boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <span style={{ fontSize: '13px', color: 'var(--mut)' }}>Welcome back,</span>
          <h2 style={{ fontSize: '22px', margin: '2px 0 4px', color: 'var(--ink)', fontWeight: 700 }}>
            {client.displayName}
          </h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', color: 'var(--mut)' }}>
            <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--ink)' }}>{client.publicId}</span>
            <span>·</span>
            <span>{client.phoneE164}</span>
          </div>
        </div>

        <div>
          <button
            onClick={handleOpenBooking}
            style={{
              background: 'var(--acc)',
              color: '#fff',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(36, 87, 74, 0.2)'
            }}
          >
            <Plus className="w-4 h-4" /> Book New Session
          </button>
        </div>
      </div>

      {/* Reschedule & Policy Governance Notice */}
      <div style={{
        background: 'var(--off)',
        border: '1px solid var(--line)',
        borderRadius: '12px',
        padding: '1rem 1.25rem',
        marginBottom: '2rem',
        fontSize: '13px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px'
      }}>
        <Lock className="w-4 h-4 text-acc shrink-0 mt-0.5" />
        <p style={{ margin: 0, color: 'var(--ink)', lineHeight: 1.4 }}>
          {policy.cancellationPolicyText || `Appointments cannot be rescheduled or cancelled within ${policy.rescheduleLeadTimeDays} days of the scheduled time. Outside this window, you can freely move any session.`}
        </p>
      </div>

      {/* Upcoming Sessions */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h3 style={{ fontSize: '17px', margin: '0 0 1rem', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar className="w-5 h-5 text-acc" /> Upcoming Appointments ({upcomingSessions.length})
        </h3>

        {upcomingSessions.length === 0 ? (
          <div style={{
            background: 'var(--card)',
            border: '1px dashed var(--line)',
            borderRadius: '14px',
            padding: '2.5rem 1.5rem',
            textAlign: 'center',
            color: 'var(--mut)'
          }}>
            <Calendar className="w-8 h-8" style={{ color: 'var(--mut)', margin: '0 auto 8px', opacity: 0.5 }} />
            <p style={{ margin: '0 0 12px', fontSize: '14px' }}>You have no upcoming appointments.</p>
            <button
              onClick={handleOpenBooking}
              style={{
                background: 'var(--acc)',
                color: '#fff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Book an Appointment
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {upcomingSessions.map((session: any) => {
              const sessionDate = new Date(session.startUtc);
              const ethDateStr = formatEthiopianCalendarDate(sessionDate);
              const formattedTime = formatTimeSlot(sessionDate, timeConvention, session.durationMin);

              return (
                <div
                  key={session.id}
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--line)',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ background: '#e3f7ed', color: '#165b38', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
                        {session.status}
                      </span>
                      <span style={{ fontSize: '12px', color: session.canReschedule ? 'var(--acc)' : '#c53030', fontWeight: 600 }}>
                        · {session.daysUntilSession === 0 ? 'Today' : session.daysUntilSession === 1 ? 'Tomorrow' : `In ${session.daysUntilSession} days`}
                      </span>
                    </div>

                    <h4 style={{ fontSize: '17px', margin: '0 0 4px', color: 'var(--ink)' }}>
                      {sessionDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                      {ethDateStr && <span style={{ fontSize: '13px', color: 'var(--mut)', fontWeight: 400, marginLeft: '6px' }}>({ethDateStr} E.C.)</span>}
                    </h4>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>
                      <Clock className="w-4 h-4 text-acc" />
                      <span>{formattedTime.primary}</span>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--mut)', display: 'block', marginTop: '2px' }}>
                      {formattedTime.secondary}
                    </span>

                    {!session.canReschedule && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', fontSize: '12px', color: '#c53030' }}>
                        <Lock className="w-3.5 h-3.5" />
                        <span>Changes locked online within {policy.rescheduleLeadTimeDays} days</span>
                      </div>
                    )}
                  </div>

                  <div>
                    {session.canReschedule ? (
                      <button
                        onClick={() => handleOpenReschedule(session)}
                        style={{
                          background: 'var(--acc)',
                          color: '#fff',
                          border: 'none',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <Calendar className="w-4 h-4" /> Reschedule
                      </button>
                    ) : (
                      <button
                        disabled
                        style={{
                          background: 'var(--off)',
                          color: 'var(--mut)',
                          border: '1px solid var(--line)',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'not-allowed',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          opacity: 0.6
                        }}
                      >
                        <Lock className="w-4 h-4" /> Reschedule Locked
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Past Session History */}
      {pastSessions && pastSessions.length > 0 && (
        <div style={{ marginBottom: '2.5rem' }}>
          <h3 style={{ fontSize: '16px', margin: '0 0 1rem', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History className="w-4 h-4 text-mut" /> Past Sessions
          </h3>
          <div style={{ border: '1px solid var(--line)', borderRadius: '12px', overflow: 'hidden', background: 'var(--card)' }}>
            {pastSessions.map((s: any) => (
              <div key={s.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                <div>
                  <strong>{new Date(s.startUtc).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong> at {new Date(s.startUtc).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </div>
                <span style={{ textTransform: 'capitalize', color: s.status === 'attended' ? '#165b38' : 'var(--mut)', fontSize: '12px', fontWeight: 600 }}>
                  {s.status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Practice Location Card */}
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
          <h4 style={{ fontSize: '14px', margin: '0 0 4px', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MapPin className="w-4 h-4 text-acc" /> Office Location
          </h4>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--mut)', lineHeight: 1.5 }}>
            {practice.locationText}
          </p>
        </div>

        <div>
          <h4 style={{ fontSize: '14px', margin: '0 0 4px', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Phone className="w-4 h-4 text-acc" /> Need Direct Adjustments?
          </h4>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--mut)', lineHeight: 1.5 }}>
            For late changes within the lock cutoff window, please contact Dr. Hana directly via phone or text.
          </p>
        </div>
      </div>

      {/* MODAL 1: BOOKING MODAL */}
      {bookingModalOpen && (
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
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '17px', margin: 0, color: 'var(--ink)', fontWeight: 700 }}>
                  Book Additional Appointment
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--mut)' }}>
                  As an approved patient, your session is scheduled directly without re-entering profile details.
                </p>
              </div>
              <button
                onClick={() => setBookingModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--mut)', cursor: 'pointer', padding: '4px' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
              {bookingSuccess ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                  <CheckCircle2 className="w-12 h-12" style={{ color: '#165b38', margin: '0 auto 12px' }} />
                  <h4 style={{ fontSize: '18px', margin: '0 0 6px', color: 'var(--ink)' }}>{bookingSuccess}</h4>
                  <p style={{ color: 'var(--mut)', fontSize: '13px' }}>Your therapist has been notified.</p>
                </div>
              ) : loadingSlots ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 0', color: 'var(--mut)' }}>
                  <RefreshCw className="w-6 h-6 animate-spin" style={{ color: 'var(--acc)', margin: '0 auto 8px' }} />
                  <p style={{ fontSize: '13px', margin: 0 }}>Searching available clinical calendar slots...</p>
                </div>
              ) : bookingSlots.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', border: '1px dashed var(--line)', borderRadius: '10px', color: 'var(--mut)' }}>
                  <p style={{ margin: 0, fontSize: '13px' }}>No open slots found for the next 30 days. Please contact Dr. Hana directly.</p>
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Choose an Open Slot ({bookingSlots.length})
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '10px', maxHeight: '280px', overflowY: 'auto' }}>
                    {bookingSlots.slice(0, 40).map(slot => {
                      const slotDate = new Date(slot.startUtc);
                      const isSelected = selectedBookingSlot === slot.startUtc;
                      const formatted = formatTimeSlot(slotDate, timeConvention, 60);

                      return (
                        <button
                          key={slot.startUtc}
                          type="button"
                          onClick={() => setSelectedBookingSlot(slot.startUtc)}
                          style={{
                            background: isSelected ? 'var(--acc)' : 'var(--card)',
                            color: isSelected ? '#fff' : 'var(--ink)',
                            border: isSelected ? '1px solid var(--acc)' : '1px solid var(--line)',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            textAlign: 'left',
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '2px' }}>
                            {slotDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </div>
                          <div style={{ fontSize: '12px', fontWeight: 600 }}>{formatted.primary}</div>
                          <div style={{ fontSize: '10px', opacity: 0.8, marginTop: '2px' }}>{formatted.secondary}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {!bookingSuccess && (
              <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--line)', background: 'var(--off)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setBookingModalOpen(false)}
                  disabled={bookingSubmitting}
                  style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBooking}
                  disabled={!selectedBookingSlot || bookingSubmitting}
                  style={{
                    background: selectedBookingSlot ? 'var(--acc)' : 'var(--off)',
                    color: selectedBookingSlot ? '#fff' : 'var(--mut)',
                    border: 'none',
                    padding: '8px 18px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: selectedBookingSlot ? 'pointer' : 'not-allowed'
                  }}
                >
                  {bookingSubmitting ? 'Confirming...' : 'Confirm Appointment'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: RESCHEDULE MODAL */}
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
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '17px', margin: 0, color: 'var(--ink)', fontWeight: 700 }}>
                  Reschedule Appointment
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--mut)' }}>
                  Select an available slot within the forward reschedule window
                </p>
              </div>
              <button
                onClick={() => setReschedulingSession(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--mut)', cursor: 'pointer', padding: '4px' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
              {rescheduleSuccess ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                  <CheckCircle2 className="w-12 h-12" style={{ color: '#165b38', margin: '0 auto 12px' }} />
                  <h4 style={{ fontSize: '18px', margin: '0 0 6px', color: 'var(--ink)' }}>{rescheduleSuccess}</h4>
                  <p style={{ color: 'var(--mut)', fontSize: '13px' }}>Your calendar has been updated.</p>
                </div>
              ) : loadingRescheduleSlots ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 0', color: 'var(--mut)' }}>
                  <RefreshCw className="w-6 h-6 animate-spin" style={{ color: 'var(--acc)', margin: '0 auto 8px' }} />
                  <p style={{ fontSize: '13px', margin: 0 }}>Searching available slots...</p>
                </div>
              ) : rescheduleSlots.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', border: '1px dashed var(--line)', borderRadius: '10px', color: 'var(--mut)' }}>
                  <p style={{ margin: 0, fontSize: '13px' }}>No alternative slots available. Please contact Dr. Hana.</p>
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Available Open Slots ({rescheduleSlots.length})
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '10px', maxHeight: '280px', overflowY: 'auto' }}>
                    {rescheduleSlots.slice(0, 40).map(slot => {
                      const slotDate = new Date(slot.startUtc);
                      const isSelected = selectedRescheduleSlot === slot.startUtc;
                      const formatted = formatTimeSlot(slotDate, timeConvention, reschedulingSession.durationMin);

                      return (
                        <button
                          key={slot.startUtc}
                          type="button"
                          onClick={() => setSelectedRescheduleSlot(slot.startUtc)}
                          style={{
                            background: isSelected ? 'var(--acc)' : 'var(--card)',
                            color: isSelected ? '#fff' : 'var(--ink)',
                            border: isSelected ? '1px solid var(--acc)' : '1px solid var(--line)',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            textAlign: 'left',
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '2px' }}>
                            {slotDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </div>
                          <div style={{ fontSize: '12px', fontWeight: 600 }}>{formatted.primary}</div>
                          <div style={{ fontSize: '10px', opacity: 0.8, marginTop: '2px' }}>{formatted.secondary}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {!rescheduleSuccess && (
              <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--line)', background: 'var(--off)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setReschedulingSession(null)}
                  disabled={rescheduleSubmitting}
                  style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReschedule}
                  disabled={!selectedRescheduleSlot || rescheduleSubmitting}
                  style={{
                    background: selectedRescheduleSlot ? 'var(--acc)' : 'var(--off)',
                    color: selectedRescheduleSlot ? '#fff' : 'var(--mut)',
                    border: 'none',
                    padding: '8px 18px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: selectedRescheduleSlot ? 'pointer' : 'not-allowed'
                  }}
                >
                  {rescheduleSubmitting ? 'Rescheduling...' : 'Confirm Move'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
