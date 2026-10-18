import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { 
  Plus, 
  UserPlus,
  X, 
  Trash2, 
  Ban, 
  Repeat, 
  Phone, 
  MessageSquare, 
  Mail, 
  CheckCircle, 
  AlertCircle, 
  Eye, 
  EyeOff,
  CreditCard
} from 'lucide-react';

interface ClientItem {
  id: number;
  displayName: string;
  phoneE164: string;
  email?: string;
  isVerified?: boolean;
}

export default function CalendarPage() {
  const [guestPreview, setGuestPreview] = useState(false);
  const [calendarView, setCalendarView] = useState<'timeGridWeek' | 'timeGridDay'>(
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'timeGridDay' : 'timeGridWeek'
  );
  const [events, setEvents] = useState<any[]>([]);
  const [clients, setClients] = useState<ClientItem[]>([]);

  // Self-Booking Modal State
  const [selfBookModal, setSelfBookModal] = useState(false);
  const [useExistingClient, setUseExistingClient] = useState(true);
  const [selectedClientId, setSelectedClientId] = useState<number | ''>('');
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [bookingStartUtc, setBookingStartUtc] = useState('');
  const [bookingDuration, setBookingDuration] = useState(60);
  const [bookingNote, setBookingNote] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);

  // Recurring Series Modal State
  const [seriesModal, setSeriesModal] = useState(false);
  const [seriesClientId, setSeriesClientId] = useState<number | ''>('');
  const [seriesWeekday, setSeriesWeekday] = useState<number>(1); // Monday default
  const [seriesStartTime, setSeriesStartTime] = useState('10:00');
  const [seriesDuration, setSeriesDuration] = useState(60);
  const [seriesStartsOn, setSeriesStartsOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [seriesEndsOn, setSeriesEndsOn] = useState('');
  const [seriesLoading, setSeriesLoading] = useState(false);

  // Selected Session Details / Status Modal State
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [viewScreenshotUrl, setViewScreenshotUrl] = useState<string | null>(null);

  // "Let client know?" Prompt Modal / Toast after Reschedule or Cancellation
  const [notifyPrompt, setNotifyPrompt] = useState<{
    sessionId: number;
    clientName: string;
    clientPhone?: string;
    clientEmail?: string;
    actionDescription: string;
  } | null>(null);

  // Block Out Time Modal State
  const [blockModal, setBlockModal] = useState(false);
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');
  const [blockReason, setBlockReason] = useState('Personal Off / Maintenance');

  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const calendarRef = useRef<FullCalendar>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Load clients and sessions
  const loadSessions = () => {
    const start = new Date();
    start.setDate(start.getDate() - 30);
    const end = new Date();
    end.setDate(end.getDate() + 45);

    fetch(`/api/admin/sessions?start=${start.toISOString()}&end=${end.toISOString()}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          const calendarEvents: any[] = [];
          data.forEach(d => {
            if (d.status === 'cancelled') return;

            const startMs = new Date(d.start).getTime();
            const endMs = startMs + d.durationMin * 60000;

            // Pick colors by status
            let bg = '#2f6b5c';
            let border = '#1d4239';
            if (d.status === 'attended') {
              bg = '#2563eb';
              border = '#1d4ed8';
            } else if (d.status === 'no_show') {
              bg = '#dc2626';
              border = '#b91c1c';
            } else if (d.status === 'awaiting_payment' || d.status === 'held') {
              bg = '#d97706';
              border = '#b45309';
            } else if (d.status === 'needs_review') {
              bg = '#9333ea';
              border = '#7e22ce';
            } else if (d.feeWaived) {
              bg = '#3a7262';
              border = '#24483e';
            }

            calendarEvents.push({
              id: String(d.id),
              title: `${d.clientName || 'Session'} (${d.status.replace('_', ' ')})`,
              start: d.start,
              end: new Date(endMs).toISOString(),
              backgroundColor: bg,
              borderColor: border,
              extendedProps: {
                rawSession: d,
                clientId: d.clientId,
                clientName: d.clientName,
                clientPhone: d.clientPhone,
                clientEmail: d.clientEmail,
                status: d.status,
                feeWaived: d.feeWaived,
                isBuffer: false,
              }
            });

            // 10-minute Hatched Buffer
            calendarEvents.push({
              id: `buffer-${d.id}`,
              start: new Date(endMs).toISOString(),
              end: new Date(endMs + 10 * 60000).toISOString(),
              editable: false,
              classNames: ['buffer-event'],
              extendedProps: { isBuffer: true }
            });
          });
          setEvents(calendarEvents);
        }
      });
  };

  useEffect(() => {
    loadSessions();
    fetch('/api/admin/clients')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setClients(data);
      });
  }, []);

  // Self-Book submission
  const handleSelfBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingStartUtc) {
      showToast('Please specify a date and start time.', 'error');
      return;
    }

    setBookingLoading(true);
    try {
      const payload: any = {
        startUtc: new Date(bookingStartUtc).toISOString(),
        durationMin: Number(bookingDuration),
        note: bookingNote,
      };

      if (useExistingClient) {
        if (!selectedClientId) {
          showToast('Please select an existing client.', 'error');
          setBookingLoading(false);
          return;
        }
        payload.clientId = Number(selectedClientId);
      } else {
        if (!newClientName || !newClientPhone) {
          showToast('Please enter client name and phone number.', 'error');
          setBookingLoading(false);
          return;
        }
        payload.clientName = newClientName;
        payload.clientPhone = newClientPhone;
        payload.clientEmail = newClientEmail;
      }

      const res = await fetch('/api/admin/sessions/self-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to self-book session');

      showToast('Session confirmed! Payment verification waived.');
      setSelfBookModal(false);
      setNewClientName('');
      setNewClientPhone('');
      setNewClientEmail('');
      setBookingNote('');
      loadSessions();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setBookingLoading(false);
    }
  };

  // Recurring Series Submission
  const handleSeriesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seriesClientId) {
      showToast('Please select a client.', 'error');
      return;
    }

    setSeriesLoading(true);
    try {
      const res = await fetch('/api/admin/series', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: Number(seriesClientId),
          weekday: Number(seriesWeekday),
          startLocalTime: seriesStartTime,
          durationMin: Number(seriesDuration),
          startsOn: seriesStartsOn,
          endsOn: seriesEndsOn || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create series');

      showToast(`Recurring series created! Materialized ${data.materializedCount} sessions.`);
      setSeriesModal(false);
      loadSessions();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSeriesLoading(false);
    }
  };

  // Change Session Status
  const handleStatusChange = async (sessionId: number, newStatus: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/sessions/${sessionId}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        showToast(`Session marked as ${newStatus.replace('_', ' ')}.`);
        if (selectedSession) {
          setSelectedSession({
            ...selectedSession,
            status: newStatus,
            ...(newStatus === 'confirmed' ? { paymentVerified: true } : {})
          });
        }
        loadSessions();
      } else {
        showToast('Failed to update status', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Approve Payment Directly
  const handleApprovePayment = async () => {
    if (!selectedSession) return;
    setActionLoading(true);
    try {
      let res;
      if (selectedSession.paymentId) {
        res = await fetch(`/api/admin/payments/${selectedSession.paymentId}/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
      } else {
        res = await fetch(`/api/admin/sessions/${selectedSession.id}/attendance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'confirmed' }),
        });
      }
      if (res.ok) {
        showToast('Payment approved & session confirmed!');
        setSelectedSession((prev: any) => ({
          ...prev,
          status: 'confirmed',
          paymentVerified: true,
        }));
        loadSessions();
      } else {
        showToast('Failed to approve payment', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Remove / Cancel Session
  const handleCancelSession = async () => {
    if (!selectedSession) return;
    if (!confirm(`Are you sure you want to remove and cancel this slot for ${selectedSession.clientName}?`)) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/sessions/${selectedSession.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showToast('Allotted time removed and session cancelled.');
        const cancelledSession = { ...selectedSession };
        setSelectedSession(null);
        loadSessions();

        // Prompt "Let client know?"
        setNotifyPrompt({
          sessionId: cancelledSession.id,
          clientName: cancelledSession.clientName,
          clientPhone: cancelledSession.clientPhone,
          clientEmail: cancelledSession.clientEmail,
          actionDescription: 'Session was cancelled',
        });
      } else {
        showToast('Failed to cancel session', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Block out time
  const handleBlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockStart || !blockEnd) {
      showToast('Please select both start and end time.', 'error');
      return;
    }
    try {
      const res = await fetch('/api/admin/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUtc: new Date(blockStart).toISOString(),
          endUtc: new Date(blockEnd).toISOString(),
          reason: blockReason,
        }),
      });
      if (res.ok) {
        showToast('Time range successfully blocked out.');
        setBlockModal(false);
      } else {
        showToast('Failed to block time.', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Drag and drop reschedule
  const handleEventDrop = (info: any) => {
    if (guestPreview) {
      info.revert();
      return;
    }
    fetch(`/api/admin/sessions/${info.event.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startUtc: info.event.start?.toISOString()
      })
    }).then(r => r.json()).then(data => {
      if (data.id) {
        loadSessions();
        showToast('Session moved to new time.');
        // Prompt "Let client know?"
        const raw = info.event.extendedProps;
        setNotifyPrompt({
          sessionId: Number(info.event.id),
          clientName: raw.clientName || 'Client',
          clientPhone: raw.clientPhone,
          clientEmail: raw.clientEmail,
          actionDescription: `Moved to ${info.event.start?.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
        });
      } else {
        info.revert();
        showToast('Conflict or error moving session.', 'error');
      }
    });
  };

  // Pull bottom edge to resize duration
  const handleEventResize = (info: any) => {
    if (guestPreview) {
      info.revert();
      return;
    }
    const newDurationMin = (info.event.end!.getTime() - info.event.start!.getTime()) / 60000;
    fetch(`/api/admin/sessions/${info.event.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        durationMin: newDurationMin
      })
    }).then(r => r.json()).then(data => {
      if (data.id) {
        loadSessions();
        showToast(`Duration adjusted to ${newDurationMin} minutes.`);
      } else {
        info.revert();
        showToast('Error resizing session.', 'error');
      }
    });
  };

  // Send Notification Helper
  const handleSendNotification = async (channel: 'email' | 'sms') => {
    if (!notifyPrompt) return;
    try {
      const res = await fetch(`/api/admin/sessions/${notifyPrompt.sessionId}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel }),
      });
      const data = await res.json();
      if (res.ok) {
        if (channel === 'sms' && data.smsUrl) {
          window.location.href = data.smsUrl;
        }
        showToast(data.message || 'Notification prepared/sent.');
        setNotifyPrompt(null);
      } else {
        showToast(data.error || 'Failed to send notification', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const goPrev = () => calendarRef.current?.getApi().prev();
  const goNext = () => calendarRef.current?.getApi().next();
  const goToday = () => calendarRef.current?.getApi().today();

  const switchView = (view: 'timeGridWeek' | 'timeGridDay') => {
    setCalendarView(view);
    calendarRef.current?.getApi().changeView(view);
  };

  const weekDayOptions = [
    { value: 1, label: 'Every Monday' },
    { value: 2, label: 'Every Tuesday' },
    { value: 3, label: 'Every Wednesday' },
    { value: 4, label: 'Every Thursday' },
    { value: 5, label: 'Every Friday' },
    { value: 6, label: 'Every Saturday' },
    { value: 0, label: 'Every Sunday' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '88vh' }}>
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
          {toastMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* "Let client know?" Prompt Banner */}
      {notifyPrompt && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          background: 'var(--ink)',
          color: '#fff',
          padding: '14px 20px',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          maxWidth: '90vw',
          flexWrap: 'wrap',
        }}>
          <div>
            <strong style={{ display: 'block', fontSize: '14px' }}>
              {notifyPrompt.actionDescription} for {notifyPrompt.clientName}
            </strong>
            <span style={{ fontSize: '12px', opacity: 0.85 }}>Let client know about this change?</span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {notifyPrompt.clientEmail && (
              <button
                onClick={() => handleSendNotification('email')}
                style={{
                  background: '#fff',
                  color: 'var(--ink)',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Mail className="w-3.5 h-3.5" /> Email
              </button>
            )}

            {notifyPrompt.clientPhone && (
              <button
                onClick={() => handleSendNotification('sms')}
                style={{
                  background: 'var(--acc)',
                  color: '#fff',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <MessageSquare className="w-3.5 h-3.5" /> SMS
              </button>
            )}

            <button
              onClick={() => setNotifyPrompt(null)}
              style={{
                background: 'transparent',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.4)',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Calendar Header with Actions */}
      <header className="calendar-header" style={{ padding: '1rem', background: 'var(--card)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h1 style={{ fontSize: '20px', margin: 0, color: 'var(--ink)' }}>Clinical Timetable & Schedule</h1>
            <div className="sub" style={{ color: 'var(--mut)', fontSize: '13px' }}>
              Full drag-and-drop calendar · 10-min post-session buffers · Ethiopian calendar headers
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <Link
              to="/intake"
              style={{
                background: 'var(--acc)',
                color: '#fff',
                border: 'none',
                padding: '8px 14px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '13px',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
              }}
            >
              <UserPlus className="w-4 h-4" /> New Patient Intake
            </Link>

            <button
              onClick={() => {
                const now = new Date();
                now.setMinutes(0, 0, 0);
                const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                setBookingStartUtc(localIso);
                setSelfBookModal(true);
              }}
              style={{
                background: 'var(--card)',
                color: 'var(--ink)',
                border: '1px solid var(--line)',
                padding: '8px 14px',
                borderRadius: '8px',
                fontWeight: 500,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Plus className="w-4 h-4" /> Quick Slot
            </button>

            <button
              onClick={() => setSeriesModal(true)}
              style={{
                background: 'var(--card)',
                color: 'var(--ink)',
                border: '1px solid var(--line)',
                padding: '8px 14px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Repeat className="w-4 h-4 text-acc" /> Weekly Series
            </button>

            <button
              onClick={() => {
                const now = new Date();
                const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                setBlockStart(localIso);
                setBlockEnd(localIso);
                setBlockModal(true);
              }}
              style={{
                background: 'var(--off)',
                color: 'var(--ink)',
                border: '1px solid var(--line)',
                padding: '8px 14px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Ban className="w-4 h-4" /> Block Time
            </button>
          </div>
        </div>

        {/* Navigation & View Switching Bar */}
        <div className="bar" style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={goPrev} aria-label="Previous">&lsaquo;</button>
          <button onClick={goToday}>Today</button>
          <button onClick={goNext} aria-label="Next">&rsaquo;</button>

          <div style={{ display: 'inline-flex', border: '1px solid var(--line)', borderRadius: '8px', overflow: 'hidden', marginLeft: '6px' }}>
            <button
              onClick={() => switchView('timeGridDay')}
              style={{
                border: 'none',
                borderRadius: 0,
                padding: '6px 12px',
                background: calendarView === 'timeGridDay' ? 'var(--acc)' : '#fff',
                color: calendarView === 'timeGridDay' ? '#fff' : 'var(--ink)',
                fontWeight: 600,
                fontSize: '12px',
              }}
            >
              Day
            </button>
            <button
              onClick={() => switchView('timeGridWeek')}
              style={{
                border: 'none',
                borderRadius: 0,
                padding: '6px 12px',
                background: calendarView === 'timeGridWeek' ? 'var(--acc)' : '#fff',
                color: calendarView === 'timeGridWeek' ? '#fff' : 'var(--ink)',
                fontWeight: 600,
                fontSize: '12px',
              }}
            >
              Week
            </button>
          </div>

          <span className="sp" style={{ flex: 1 }}></span>

          <button
            className={guestPreview ? 'on' : ''}
            onClick={() => setGuestPreview(!guestPreview)}
            style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {guestPreview ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            {guestPreview ? 'Guest View: On (Taken)' : 'Guest View: Off'}
          </button>
        </div>
      </header>

      {/* Calendar Grid */}
      <div className={`calendar-wrap ${guestPreview ? 'guest-preview' : ''}`} style={{ flex: 1, margin: '8px', borderRadius: '10px' }}>
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={calendarView}
          headerToolbar={false}
          allDaySlot={false}
          slotMinTime="08:00:00"
          slotMaxTime="19:00:00"
          expandRows={true}
          editable={!guestPreview}
          selectable={!guestPreview}
          selectMirror={true}
          dayMaxEvents={true}
          weekends={true}
          snapDuration="00:15:00"
          slotDuration="00:30:00"
          events={events}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
          eventClick={(info) => {
            if (info.event.extendedProps.isBuffer) return;
            const raw = info.event.extendedProps.rawSession || {
              id: info.event.id,
              clientName: info.event.extendedProps.clientName,
              clientPhone: info.event.extendedProps.clientPhone,
              clientEmail: info.event.extendedProps.clientEmail,
              status: info.event.extendedProps.status,
              feeWaived: info.event.extendedProps.feeWaived,
              start: info.event.startStr,
            };
            setSelectedSession(raw);
          }}
          dateClick={(info) => {
            if (guestPreview) return;
            const localIso = new Date(info.date.getTime() - info.date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
            setBookingStartUtc(localIso);
            setSelfBookModal(true);
          }}
          dayHeaderContent={(args) => {
            const ethiopianDate = new Intl.DateTimeFormat('en-u-ca-ethiopic', { day: 'numeric', month: 'short' }).format(args.date);
            const isToday = args.isToday;
            return (
              <div className={`hd ${isToday ? 'today' : ''}`}>
                <div>{args.date.toLocaleDateString('en-GB', { weekday: 'short' })}</div>
                <b>{args.date.getDate()}</b>
                <i>{ethiopianDate}</i>
              </div>
            );
          }}
          eventContent={(arg) => {
            if (arg.event.extendedProps.isBuffer) return <></>;
            return (
              <div style={{ padding: '2px', cursor: 'pointer' }}>
                <strong style={{ display: 'block', fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {guestPreview ? 'Taken' : arg.event.title}
                </strong>
                <small style={{ display: 'block', opacity: 0.85, fontSize: '10px' }}>
                  {arg.timeText}
                </small>
              </div>
            );
          }}
        />
      </div>

      {/* MODAL 1: SELF-BOOKING MODAL */}
      {selfBookModal && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal-card" style={{ padding: '1.75rem', maxWidth: '540px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--ink)' }}>Self-Book Consultation</h3>
                <span style={{ fontSize: '12px', color: 'var(--acc)', fontWeight: 600 }}>
                  Payment verification waived for admin self-bookings.
                </span>
              </div>
              <button onClick={() => setSelfBookModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--mut)' }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSelfBookSubmit}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '1.25rem' }}>
                <button
                  type="button"
                  onClick={() => setUseExistingClient(true)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '8px',
                    border: '1px solid var(--line)',
                    background: useExistingClient ? 'var(--acc)' : 'var(--card)',
                    color: useExistingClient ? '#fff' : 'var(--ink)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Existing Client
                </button>
                <button
                  type="button"
                  onClick={() => setUseExistingClient(false)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '8px',
                    border: '1px solid var(--line)',
                    background: !useExistingClient ? 'var(--acc)' : 'var(--card)',
                    color: !useExistingClient ? '#fff' : 'var(--ink)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  New Client
                </button>
              </div>

              {useExistingClient ? (
                <div className="admin-form-group">
                  <label className="admin-label">Select Client</label>
                  <select
                    value={selectedClientId}
                    onChange={e => setSelectedClientId(e.target.value ? Number(e.target.value) : '')}
                    className="admin-select"
                    required
                  >
                    <option value="">-- Choose client --</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.displayName} ({c.phoneE164}) {c.isVerified ? '★ Verified' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '1rem' }}>
                  <div>
                    <label className="admin-label">Preferred Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="Client Name"
                      value={newClientName}
                      onChange={e => setNewClientName(e.target.value)}
                      className="admin-input"
                    />
                  </div>
                  <div>
                    <label className="admin-label">Phone Number *</label>
                    <input
                      type="tel"
                      required
                      placeholder="0911234567"
                      value={newClientPhone}
                      onChange={e => setNewClientPhone(e.target.value)}
                      className="admin-input"
                    />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label className="admin-label">Email (Optional)</label>
                    <input
                      type="email"
                      placeholder="client@example.com"
                      value={newClientEmail}
                      onChange={e => setNewClientEmail(e.target.value)}
                      className="admin-input"
                    />
                  </div>
                  <div style={{ gridColumn: 'span 2', padding: '8px 10px', background: 'var(--line-subtle)', borderRadius: '6px', fontSize: '12px', color: 'var(--mut)' }}>
                    Need complete patient registration with private reschedule tokens?{' '}
                    <Link to="/intake" onClick={() => setSelfBookModal(false)} style={{ color: 'var(--acc)', fontWeight: 600, textDecoration: 'none' }}>
                      Open New Patient Intake →
                    </Link>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '1rem' }}>
                <div>
                  <label className="admin-label">Start Time (Local Date & Time)</label>
                  <input
                    type="datetime-local"
                    required
                    value={bookingStartUtc}
                    onChange={e => setBookingStartUtc(e.target.value)}
                    className="admin-input"
                  />
                </div>
                <div>
                  <label className="admin-label">Duration</label>
                  <select
                    value={bookingDuration}
                    onChange={e => setBookingDuration(Number(e.target.value))}
                    className="admin-select"
                  >
                    <option value={60}>60 Min (1 hr)</option>
                    <option value={90}>90 Min</option>
                  </select>
                </div>
              </div>

              <div className="admin-form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="admin-label">Private Admin Note</label>
                <input
                  type="text"
                  placeholder="e.g. In-person intake, referral"
                  value={bookingNote}
                  onChange={e => setBookingNote(e.target.value)}
                  className="admin-input"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setSelfBookModal(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--ink)', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bookingLoading}
                  style={{
                    background: 'var(--acc)',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 18px',
                    borderRadius: '8px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {bookingLoading ? 'Reserving...' : 'Confirm Self-Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RECURRING WEEKLY SERIES MODAL */}
      {seriesModal && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal-card" style={{ padding: '1.75rem', maxWidth: '500px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--ink)' }}>Create Recurring Series</h3>
                <span style={{ fontSize: '12px', color: 'var(--mut)' }}>
                  Schedules weekly appointments for regular clients up to horizon.
                </span>
              </div>
              <button onClick={() => setSeriesModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--mut)' }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSeriesSubmit}>
              <div className="admin-form-group">
                <label className="admin-label">Client</label>
                <select
                  value={seriesClientId}
                  onChange={e => setSeriesClientId(e.target.value ? Number(e.target.value) : '')}
                  className="admin-select"
                  required
                >
                  <option value="">-- Choose client --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.displayName} ({c.phoneE164}) {c.isVerified ? '★ Verified' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '1rem' }}>
                <div>
                  <label className="admin-label">Day of Week</label>
                  <select
                    value={seriesWeekday}
                    onChange={e => setSeriesWeekday(Number(e.target.value))}
                    className="admin-select"
                  >
                    {weekDayOptions.map(w => (
                      <option key={w.value} value={w.value}>{w.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="admin-label">Start Time (Local)</label>
                  <input
                    type="time"
                    required
                    value={seriesStartTime}
                    onChange={e => setSeriesStartTime(e.target.value)}
                    className="admin-input"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '1.25rem' }}>
                <div>
                  <label className="admin-label">Starts On *</label>
                  <input
                    type="date"
                    required
                    value={seriesStartsOn}
                    onChange={e => setSeriesStartsOn(e.target.value)}
                    className="admin-input"
                  />
                </div>
                <div>
                  <label className="admin-label">Ends On (Optional)</label>
                  <input
                    type="date"
                    value={seriesEndsOn}
                    onChange={e => setSeriesEndsOn(e.target.value)}
                    className="admin-input"
                  />
                </div>
                <div>
                  <label className="admin-label">Duration</label>
                  <select
                    value={seriesDuration}
                    onChange={e => setSeriesDuration(Number(e.target.value))}
                    className="admin-select"
                  >
                    <option value={60}>60 Min (1 hr)</option>
                    <option value={90}>90 Min</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setSeriesModal(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--ink)', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={seriesLoading}
                  style={{
                    background: 'var(--acc)',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 18px',
                    borderRadius: '8px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {seriesLoading ? 'Materializing...' : 'Create Series'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: SESSION DETAILS & ATTENDANCE ACTIONS */}
      {selectedSession && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal-card" style={{ padding: '1.75rem', maxWidth: '480px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--ink)' }}>Consultation Details</h3>
              <button onClick={() => setSelectedSession(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--mut)' }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div style={{ background: 'var(--off)', padding: '1.25rem', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '14px', border: '1px solid var(--line)' }}>
              <p style={{ margin: '0 0 6px' }}><strong>Client:</strong> {selectedSession.clientName}</p>
              <p style={{ margin: '0 0 6px' }}>
                <strong>Scheduled:</strong> {new Date(selectedSession.start).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Addis_Ababa' })}
              </p>
              <p style={{ margin: '0 0 6px' }}>
                <strong>Status:</strong> <span style={{ textTransform: 'capitalize', fontWeight: 700, color: 'var(--acc)' }}>{selectedSession.status?.replace('_', ' ')}</span>
              </p>
              {selectedSession.clientPhone && (
                <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <a href={`tel:${selectedSession.clientPhone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--acc)', textDecoration: 'none', fontWeight: 600 }}>
                    <Phone className="w-3.5 h-3.5" /> Call
                  </a>
                  <a href={`https://wa.me/${selectedSession.clientPhone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#165b38', textDecoration: 'none', fontWeight: 600 }}>
                    <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                  </a>
                </div>
              )}
            </div>

            {/* PAYMENT DETAILS & IMMEDIATE APPROVAL */}
            {(selectedSession.paymentReference || selectedSession.paymentId || selectedSession.paymentScreenshotPath || selectedSession.status === 'needs_review' || selectedSession.status === 'awaiting_payment') && (
              <div style={{
                background: selectedSession.paymentVerified ? '#f0fdf4' : '#fffbeb',
                border: `1px solid ${selectedSession.paymentVerified ? '#bbf7d0' : '#fde68a'}`,
                padding: '1rem',
                borderRadius: '8px',
                marginBottom: '1.25rem',
                fontSize: '13px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 700, color: selectedSession.paymentVerified ? '#166534' : '#92400e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CreditCard className="w-4 h-4" />
                    Payment Details: {selectedSession.paymentVerified ? 'Verified' : 'Pending Approval'}
                  </span>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: selectedSession.paymentVerified ? '#dcfce7' : '#fef3c7',
                    color: selectedSession.paymentVerified ? '#15803d' : '#b45309'
                  }}>
                    {selectedSession.paymentVerified ? 'Approved' : 'Needs Review'}
                  </span>
                </div>

                {selectedSession.paymentProvider && (
                  <p style={{ margin: '0 0 4px', color: 'var(--ink)' }}>
                    <strong>Provider:</strong> <span style={{ textTransform: 'uppercase' }}>{selectedSession.paymentProvider}</span>
                  </p>
                )}

                {selectedSession.paymentReference && (
                  <p style={{ margin: '0 0 4px', color: 'var(--ink)' }}>
                    <strong>Reference:</strong> <code style={{ background: 'var(--card)', border: '1px solid var(--line)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>{selectedSession.paymentReference}</code>
                  </p>
                )}

                <p style={{ margin: '0 0 8px', color: 'var(--ink)' }}>
                  <strong>Fee:</strong> ETB {((selectedSession.feeDueCents || 30000) / 100).toFixed(2)}
                </p>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                  {selectedSession.paymentScreenshotPath && (
                    <button
                      type="button"
                      onClick={() => setViewScreenshotUrl(selectedSession.paymentScreenshotPath.startsWith('/') ? selectedSession.paymentScreenshotPath : `/${selectedSession.paymentScreenshotPath}`)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--line)',
                        background: 'var(--card)',
                        color: 'var(--ink)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Eye className="w-3.5 h-3.5" /> View Receipt Slip
                    </button>
                  )}

                  {!selectedSession.paymentVerified && (
                    <button
                      type="button"
                      onClick={handleApprovePayment}
                      disabled={actionLoading}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        border: 'none',
                        background: '#16a34a',
                        color: '#fff',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      {actionLoading ? 'Approving...' : 'Approve Payment & Confirm Slot'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Attendance Buttons */}
            <div style={{ marginBottom: '1.25rem' }}>
              <span className="admin-label" style={{ fontSize: '12px', color: 'var(--mut)', marginBottom: '8px' }}>
                Update Attendance Status
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleStatusChange(selectedSession.id, 'attended')}
                  disabled={actionLoading}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '8px',
                    border: '1px solid #bfdbfe',
                    background: selectedSession.status === 'attended' ? '#2563eb' : 'var(--card)',
                    color: selectedSession.status === 'attended' ? '#fff' : '#1d4ed8',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  Attended
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusChange(selectedSession.id, 'no_show')}
                  disabled={actionLoading}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '8px',
                    border: '1px solid #fecaca',
                    background: selectedSession.status === 'no_show' ? '#dc2626' : 'var(--card)',
                    color: selectedSession.status === 'no_show' ? '#fff' : '#dc2626',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  No-Show
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusChange(selectedSession.id, 'confirmed')}
                  disabled={actionLoading}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '8px',
                    border: '1px solid var(--line)',
                    background: selectedSession.status === 'confirmed' ? 'var(--acc)' : 'var(--card)',
                    color: selectedSession.status === 'confirmed' ? '#fff' : 'var(--ink)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  Confirmed
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
              <button
                type="button"
                onClick={handleCancelSession}
                disabled={actionLoading}
                style={{
                  background: 'var(--card)',
                  color: '#dc2626',
                  border: '1px solid #fecaca',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '13px',
                }}
              >
                <Trash2 className="w-4 h-4" /> Cancel Time
              </button>
              <button
                type="button"
                onClick={() => setSelectedSession(null)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--ink)', fontSize: '13px', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: BLOCK OUT TIME */}
      {blockModal && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal-card" style={{ padding: '1.75rem', maxWidth: '480px', width: '100%' }}>
            <h3 style={{ margin: '0 0 0.5rem', color: 'var(--ink)' }}>Block Out Time Slot</h3>
            <p style={{ color: 'var(--mut)', fontSize: '13px', margin: '0 0 1.25rem' }}>
              Blocked times cannot be booked by public clients and appear as unavailable.
            </p>
            <form onSubmit={handleBlockSubmit}>
              <div className="admin-form-group">
                <label className="admin-label">Start Time</label>
                <input
                  type="datetime-local"
                  required
                  value={blockStart}
                  onChange={e => setBlockStart(e.target.value)}
                  className="admin-input"
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-label">End Time</label>
                <input
                  type="datetime-local"
                  required
                  value={blockEnd}
                  onChange={e => setBlockEnd(e.target.value)}
                  className="admin-input"
                />
              </div>

              <div className="admin-form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="admin-label">Reason / Label</label>
                <input
                  type="text"
                  required
                  value={blockReason}
                  onChange={e => setBlockReason(e.target.value)}
                  className="admin-input"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setBlockModal(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--ink)', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" style={{ background: 'var(--acc)', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
                  Save Block
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SCREENSHOT LIGHTBOX MODAL */}
      {viewScreenshotUrl && (
        <div
          onClick={() => setViewScreenshotUrl(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--card)',
              color: 'var(--ink)',
              padding: '16px',
              borderRadius: '12px',
              maxWidth: '90vw',
              maxHeight: '90vh',
              overflow: 'auto',
              textAlign: 'center',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontWeight: 600, fontSize: '14px' }}>Payment Receipt Slip Proof</span>
              <button
                onClick={() => setViewScreenshotUrl(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', color: 'var(--mut)' }}
              >
                ✕ Close
              </button>
            </div>
            <img
              src={viewScreenshotUrl}
              alt="Payment Slip Proof"
              style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: '8px', objectFit: 'contain' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
