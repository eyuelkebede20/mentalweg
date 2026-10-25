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
  CreditCard,
  Calendar as CalendarIcon
} from 'lucide-react';
import { ClientSearchSelect, type ClientItem } from '../components/ClientSearchSelect';

const BLOCK_REASON_PRESETS = [
  'Personal Off / Maintenance',
  'Lunch / Rest Break',
  'Administrative Work',
  'Clinical Supervision',
  'Out of Office / Leave',
];

export default function CalendarPage() {
  const [guestPreview, setGuestPreview] = useState(false);
  const [calendarView, setCalendarView] = useState<'timeGridWeek' | 'timeGridDay'>(
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'timeGridDay' : 'timeGridWeek'
  );
  const [events, setEvents] = useState<any[]>([]);
  const [clients, setClients] = useState<ClientItem[]>([]);

  // UNIFIED SLOT ACTION MODAL STATE
  const [slotModalOpen, setSlotModalOpen] = useState(false);
  const [slotModalTab, setSlotModalTab] = useState<'quick_slot' | 'block_time' | 'weekly_series'>('quick_slot');
  const [selectedSlotDisplay, setSelectedSlotDisplay] = useState<{
    dateLabel: string;
    timeLabel: string;
    durationLabel: string;
  } | null>(null);

  // Quick Slot / Patient Booking State
  const [useExistingClient, setUseExistingClient] = useState(true);
  const [selectedClientId, setSelectedClientId] = useState<number | ''>('');
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [bookingStartUtc, setBookingStartUtc] = useState('');
  const [bookingDuration, setBookingDuration] = useState(60);
  const [bookingNote, setBookingNote] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);

  // Block Out Time State
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');
  const [blockReason, setBlockReason] = useState('Personal Off / Maintenance');
  const [blockLoading, setBlockLoading] = useState(false);

  // Selected Block Details Modal State (when clicking on a blocked event on the grid)
  const [selectedBlock, setSelectedBlock] = useState<{
    id: number;
    reason: string;
    start: string;
    end: string;
  } | null>(null);

  // Recurring Series Modal State
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

  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const calendarRef = useRef<FullCalendar>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Load clients, sessions, and blocks
  const loadSessions = async () => {
    const start = new Date();
    start.setDate(start.getDate() - 30);
    const end = new Date();
    end.setDate(end.getDate() + 45);

    try {
      const [sessionsRes, blocksRes] = await Promise.all([
        fetch(`/api/admin/sessions?start=${start.toISOString()}&end=${end.toISOString()}`),
        fetch('/api/admin/blocks')
      ]);

      const sessionsData = await sessionsRes.json();
      const blocksData = await blocksRes.json();

      const calendarEvents: any[] = [];

      // 1. Process Sessions
      if (Array.isArray(sessionsData)) {
        sessionsData.forEach(d => {
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
              isBlock: false,
            }
          });

          // 10-minute Hatched Buffer
          calendarEvents.push({
            id: `buffer-${d.id}`,
            start: new Date(endMs).toISOString(),
            end: new Date(endMs + 10 * 60000).toISOString(),
            editable: false,
            classNames: ['buffer-event'],
            extendedProps: { isBuffer: true, isBlock: false }
          });
        });
      }

      // 2. Process Blocks (Blocked Time Ranges)
      if (Array.isArray(blocksData)) {
        blocksData.forEach(b => {
          const startStr = typeof b.startUtc === 'string' ? b.startUtc : new Date(b.startUtc).toISOString();
          const endStr = typeof b.endUtc === 'string' ? b.endUtc : new Date(b.endUtc).toISOString();
          calendarEvents.push({
            id: `block-${b.id}`,
            title: `🚫 ${b.reason || 'Blocked Time'}`,
            start: startStr,
            end: endStr,
            backgroundColor: '#475569',
            borderColor: '#334155',
            classNames: ['blocked-time-event'],
            editable: false,
            extendedProps: {
              isBuffer: false,
              isBlock: true,
              blockId: b.id,
              reason: b.reason || 'Blocked Time',
              startUtc: startStr,
              endUtc: endStr,
            }
          });
        });
      }

      setEvents(calendarEvents);
    } catch (err: any) {
      console.error('Failed to load sessions/blocks:', err);
      showToast('Error loading schedule events.', 'error');
    }
  };

  useEffect(() => {
    loadSessions();
    fetch('/api/admin/clients')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setClients(data);
      });
  }, []);

  // Handle slot selection (either click or drag range)
  const handleSlotSelect = (start: Date, end: Date, defaultTab?: 'quick_slot' | 'block_time' | 'weekly_series') => {
    if (guestPreview) return;

    // Convert start and end to datetime-local strings
    const startIsoLocal = new Date(start.getTime() - start.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const endIsoLocal = new Date(end.getTime() - end.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const durationMin = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000));

    setSelectedSlotDisplay({
      dateLabel: start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
      timeLabel: `${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} – ${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`,
      durationLabel: `${durationMin} min`,
    });

    // Pre-fill booking fields
    setBookingStartUtc(startIsoLocal);
    setBookingDuration(durationMin >= 90 ? 90 : (durationMin <= 30 ? 30 : 60));

    // Pre-fill block time fields
    setBlockStart(startIsoLocal);
    setBlockEnd(endIsoLocal);

    // Pre-fill series fields
    setSeriesWeekday(start.getDay());
    setSeriesStartTime(start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    setSeriesStartsOn(start.toISOString().slice(0, 10));
    setSeriesDuration(durationMin >= 90 ? 90 : 60);

    if (defaultTab) {
      setSlotModalTab(defaultTab);
    }

    setSlotModalOpen(true);
  };

  // Header quick launcher helpers
  const openHeaderQuickSlot = () => {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    const end = new Date(now.getTime() + 60 * 60000);
    handleSlotSelect(now, end, 'quick_slot');
  };

  const openHeaderBlockTime = () => {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    const end = new Date(now.getTime() + 60 * 60000);
    handleSlotSelect(now, end, 'block_time');
  };

  const openHeaderWeeklySeries = () => {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    const end = new Date(now.getTime() + 60 * 60000);
    handleSlotSelect(now, end, 'weekly_series');
  };

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
      setSlotModalOpen(false);
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

  // Block out time submission
  const handleBlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockStart || !blockEnd) {
      showToast('Please select both start and end time.', 'error');
      return;
    }
    setBlockLoading(true);
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
        setSlotModalOpen(false);
        loadSessions();
      } else {
        showToast('Failed to block time.', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setBlockLoading(false);
    }
  };

  // Delete Block (Unblock slot)
  const handleDeleteBlock = async (blockId: number) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/blocks/${blockId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showToast('Time slot unblocked and now available.');
        setSelectedBlock(null);
        loadSessions();
      } else {
        showToast('Failed to delete block', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
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
      setSlotModalOpen(false);
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

  // Drag and drop reschedule
  const handleEventDrop = (info: any) => {
    if (guestPreview || info.event.extendedProps.isBlock || info.event.extendedProps.isBuffer) {
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
    if (guestPreview || info.event.extendedProps.isBlock || info.event.extendedProps.isBuffer) {
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
              Click or drag any slot to schedule patients, block time, or create weekly series.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <Link
              to="/intake"
              className="btn-admin-primary"
              style={{
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                fontSize: '13px'
              }}
            >
              <UserPlus className="w-4 h-4" /> New Patient Intake
            </Link>

            <button
              onClick={openHeaderQuickSlot}
              className="btn-admin-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                fontSize: '13px'
              }}
            >
              <Plus className="w-4 h-4 text-acc" /> Quick Slot
            </button>

            <button
              onClick={openHeaderBlockTime}
              className="btn-admin-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                fontSize: '13px'
              }}
            >
              <Ban className="w-4 h-4" style={{ color: '#dc2626' }} /> Block Time
            </button>

            <button
              onClick={openHeaderWeeklySeries}
              className="btn-admin-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                fontSize: '13px'
              }}
            >
              <Repeat className="w-4 h-4 text-acc" /> Weekly Series
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
          select={(selectionInfo) => {
            if (guestPreview) return;
            handleSlotSelect(selectionInfo.start, selectionInfo.end);
            calendarRef.current?.getApi().unselect();
          }}
          dateClick={(info) => {
            if (guestPreview) return;
            const start = info.date;
            const end = new Date(start.getTime() + 60 * 60000);
            handleSlotSelect(start, end);
          }}
          eventClick={(info) => {
            if (info.event.extendedProps.isBuffer) return;
            if (info.event.extendedProps.isBlock) {
              setSelectedBlock({
                id: info.event.extendedProps.blockId,
                reason: info.event.extendedProps.reason,
                start: info.event.extendedProps.startUtc,
                end: info.event.extendedProps.endUtc,
              });
              return;
            }
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
            if (arg.event.extendedProps.isBlock) {
              return (
                <div style={{ padding: '3px 4px', cursor: 'pointer', height: '100%', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <strong style={{ fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--ink)' }}>
                      {guestPreview ? 'Unavailable / Blocked' : `🚫 ${arg.event.extendedProps.reason}`}
                    </strong>
                  </div>
                  <small style={{ display: 'block', opacity: 0.85, fontSize: '10px', color: 'var(--mut)' }}>
                    {arg.timeText}
                  </small>
                </div>
              );
            }
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

      {/* UNIFIED MODAL: MANAGE TIME SLOT (QUICK SLOT / BLOCK TIME / WEEKLY SERIES) */}
      {slotModalOpen && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal-card" style={{ padding: '1.75rem', maxWidth: '560px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--ink)' }}>Schedule Time Slot</h3>
                <span style={{ fontSize: '12px', color: 'var(--mut)' }}>
                  Choose an action for this selected calendar time slot
                </span>
              </div>
              <button
                onClick={() => setSlotModalOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--mut)', padding: '4px' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selected Slot Time Banner */}
            {selectedSlotDisplay && (
              <div className="slot-action-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CalendarIcon className="w-4 h-4 text-acc" />
                  <div>
                    <strong style={{ display: 'block', fontSize: '13px', color: 'var(--ink)' }}>
                      {selectedSlotDisplay.dateLabel}
                    </strong>
                    <span style={{ fontSize: '12px', color: 'var(--mut)' }}>
                      {selectedSlotDisplay.timeLabel}
                    </span>
                  </div>
                </div>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '4px 8px',
                  borderRadius: '6px',
                  background: 'var(--card)',
                  color: 'var(--acc)',
                  border: '1px solid rgba(36, 87, 74, 0.2)'
                }}>
                  {selectedSlotDisplay.durationLabel}
                </span>
              </div>
            )}

            {/* 3 Main Action Mode Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '1.25rem' }}>
              <button
                type="button"
                onClick={() => setSlotModalTab('quick_slot')}
                style={{
                  flex: 1,
                  padding: '10px 8px',
                  borderRadius: '8px',
                  border: '1.5px solid',
                  borderColor: slotModalTab === 'quick_slot' ? 'var(--acc)' : 'var(--line)',
                  background: slotModalTab === 'quick_slot' ? 'var(--accbg)' : 'var(--card)',
                  color: slotModalTab === 'quick_slot' ? 'var(--acct)' : 'var(--mut)',
                  fontWeight: 700,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <UserPlus className="w-4 h-4" /> Quick Slot
              </button>

              <button
                type="button"
                onClick={() => setSlotModalTab('block_time')}
                style={{
                  flex: 1,
                  padding: '10px 8px',
                  borderRadius: '8px',
                  border: '1.5px solid',
                  borderColor: slotModalTab === 'block_time' ? '#ef4444' : 'var(--line)',
                  background: slotModalTab === 'block_time' ? 'rgba(239, 68, 68, 0.08)' : 'var(--card)',
                  color: slotModalTab === 'block_time' ? '#b91c1c' : 'var(--mut)',
                  fontWeight: 700,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <Ban className="w-4 h-4" /> Block Out Time
              </button>

              <button
                type="button"
                onClick={() => setSlotModalTab('weekly_series')}
                style={{
                  flex: 1,
                  padding: '10px 8px',
                  borderRadius: '8px',
                  border: '1.5px solid',
                  borderColor: slotModalTab === 'weekly_series' ? 'var(--acc)' : 'var(--line)',
                  background: slotModalTab === 'weekly_series' ? 'var(--accbg)' : 'var(--card)',
                  color: slotModalTab === 'weekly_series' ? 'var(--acct)' : 'var(--mut)',
                  fontWeight: 700,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <Repeat className="w-4 h-4" /> Weekly Series
              </button>
            </div>

            {/* TAB 1: QUICK SLOT (PATIENT) */}
            {slotModalTab === 'quick_slot' && (
              <form onSubmit={handleSelfBookSubmit}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '1.25rem', background: 'var(--off)', padding: '4px', borderRadius: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setUseExistingClient(true)}
                    style={{
                      flex: 1,
                      padding: '7px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      background: useExistingClient ? 'var(--card)' : 'transparent',
                      color: useExistingClient ? 'var(--ink)' : 'var(--mut)',
                      fontWeight: useExistingClient ? 700 : 500,
                      fontSize: '12.5px',
                      cursor: 'pointer',
                      boxShadow: useExistingClient ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    }}
                  >
                    Existing Patient
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseExistingClient(false)}
                    style={{
                      flex: 1,
                      padding: '7px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      background: !useExistingClient ? 'var(--card)' : 'transparent',
                      color: !useExistingClient ? 'var(--ink)' : 'var(--mut)',
                      fontWeight: !useExistingClient ? 700 : 500,
                      fontSize: '12.5px',
                      cursor: 'pointer',
                      boxShadow: !useExistingClient ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    }}
                  >
                    + Add New Patient
                  </button>
                </div>

                {useExistingClient ? (
                  <div className="admin-form-group">
                    <ClientSearchSelect
                      clients={clients}
                      value={selectedClientId}
                      onChange={setSelectedClientId}
                      label="Select Existing Patient *"
                      onSwitchToNewClient={(prefillName) => {
                        setNewClientName(prefillName);
                        setUseExistingClient(false);
                      }}
                    />
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '1rem' }}>
                    <div>
                      <label className="admin-label">Patient Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Abebe Bikila"
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
                        placeholder="e.g. 0911234567"
                        value={newClientPhone}
                        onChange={e => setNewClientPhone(e.target.value)}
                        className="admin-input"
                      />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label className="admin-label">Email (Optional)</label>
                      <input
                        type="email"
                        placeholder="patient@example.com"
                        value={newClientEmail}
                        onChange={e => setNewClientEmail(e.target.value)}
                        className="admin-input"
                      />
                    </div>
                    <div style={{ gridColumn: 'span 2', padding: '8px 10px', background: 'var(--line-subtle)', borderRadius: '6px', fontSize: '12px', color: 'var(--mut)' }}>
                      Need complete clinical onboarding with private reschedule tokens & medical intake?{' '}
                      <Link to="/intake" onClick={() => setSlotModalOpen(false)} style={{ color: 'var(--acc)', fontWeight: 600, textDecoration: 'none' }}>
                        Open Full Patient Intake →
                      </Link>
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '1rem' }}>
                  <div>
                    <label className="admin-label">Start Time (Local)</label>
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
                      <option value={30}>30 Min</option>
                      <option value={60}>60 Min (1 hr)</option>
                      <option value={90}>90 Min (1.5 hr)</option>
                      <option value={120}>120 Min (2 hr)</option>
                    </select>
                  </div>
                </div>

                <div className="admin-form-group" style={{ marginBottom: '1.25rem' }}>
                  <label className="admin-label">Private Clinical / Admin Note</label>
                  <input
                    type="text"
                    placeholder="e.g. In-person consultation, referral follow-up"
                    value={bookingNote}
                    onChange={e => setBookingNote(e.target.value)}
                    className="admin-input"
                  />
                </div>

                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 12px', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '12px', color: '#166534' }}>
                  <strong>Direct Scheduling:</strong> Payment verification is automatically waived for clinical self-bookings. The appointment is immediately confirmed.
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setSlotModalOpen(false)}
                    className="btn-admin-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={bookingLoading}
                    className="btn-admin-primary"
                  >
                    {bookingLoading ? 'Scheduling...' : 'Confirm Patient Slot'}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: BLOCK OUT TIME */}
            {slotModalTab === 'block_time' && (
              <form onSubmit={handleBlockSubmit}>
                <p style={{ color: 'var(--mut)', fontSize: '13px', margin: '0 0 1rem' }}>
                  Blocked times prevent clients from booking this slot and appear as unavailable on your clinical timetable.
                </p>

                {/* Quick Reason Presets */}
                <div style={{ marginBottom: '1rem' }}>
                  <label className="admin-label">Quick Reason Presets</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {BLOCK_REASON_PRESETS.map(preset => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setBlockReason(preset)}
                        className={`preset-chip ${blockReason === preset ? 'active' : ''}`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="admin-form-group">
                  <label className="admin-label">Reason / Label *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Personal Time, Maintenance, Clinical Supervision"
                    value={blockReason}
                    onChange={e => setBlockReason(e.target.value)}
                    className="admin-input"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '1.25rem' }}>
                  <div>
                    <label className="admin-label">Block Start (Local)</label>
                    <input
                      type="datetime-local"
                      required
                      value={blockStart}
                      onChange={e => setBlockStart(e.target.value)}
                      className="admin-input"
                    />
                  </div>
                  <div>
                    <label className="admin-label">Block End (Local)</label>
                    <input
                      type="datetime-local"
                      required
                      value={blockEnd}
                      onChange={e => setBlockEnd(e.target.value)}
                      className="admin-input"
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setSlotModalOpen(false)}
                    className="btn-admin-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={blockLoading}
                    className="btn-admin-danger"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Ban className="w-4 h-4" />
                    {blockLoading ? 'Blocking...' : 'Block This Time Slot'}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 3: WEEKLY RECURRING SERIES */}
            {slotModalTab === 'weekly_series' && (
              <form onSubmit={handleSeriesSubmit}>
                <p style={{ color: 'var(--mut)', fontSize: '13px', margin: '0 0 1rem' }}>
                  Establish recurring weekly appointments for regular patients at this exact day and time up to the horizon.
                </p>

                <div className="admin-form-group">
                  <ClientSearchSelect
                    clients={clients}
                    value={seriesClientId}
                    onChange={setSeriesClientId}
                    label="Select Patient for Series *"
                    placeholder="Search by name, phone (+251...), or email..."
                    required
                  />
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
                      <option value={30}>30 Min</option>
                      <option value={60}>60 Min (1 hr)</option>
                      <option value={90}>90 Min (1.5 hr)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setSlotModalOpen(false)}
                    className="btn-admin-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={seriesLoading}
                    className="btn-admin-primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Repeat className="w-4 h-4" />
                    {seriesLoading ? 'Materializing...' : 'Create Weekly Series'}
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

      {/* MODAL: BLOCKED TIME DETAILS (WHEN CLICKING AN EXISTING BLOCKED TIME) */}
      {selectedBlock && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal-card" style={{ padding: '1.75rem', maxWidth: '440px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Ban className="w-4 h-4" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', color: 'var(--ink)' }}>Blocked Time Range</h3>
                  <span style={{ fontSize: '12px', color: 'var(--mut)' }}>Unavailable for public booking</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedBlock(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--mut)' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div style={{ background: 'var(--off)', padding: '1rem', borderRadius: '8px', marginBottom: '1.25rem', border: '1px solid var(--line)', fontSize: '13px' }}>
              <p style={{ margin: '0 0 6px' }}><strong>Reason:</strong> {selectedBlock.reason}</p>
              <p style={{ margin: '0 0 6px' }}>
                <strong>Start:</strong> {new Date(selectedBlock.start).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </p>
              <p style={{ margin: 0 }}>
                <strong>End:</strong> {new Date(selectedBlock.end).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
              <button
                type="button"
                onClick={() => handleDeleteBlock(selectedBlock.id)}
                disabled={actionLoading}
                className="btn-admin-danger"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Trash2 className="w-4 h-4" />
                {actionLoading ? 'Unblocking...' : 'Remove Block (Make Available)'}
              </button>
              <button
                type="button"
                onClick={() => setSelectedBlock(null)}
                className="btn-admin-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SESSION DETAILS & ATTENDANCE ACTIONS */}
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
                className="btn-admin-danger"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Trash2 className="w-4 h-4" /> Cancel Time
              </button>
              <button
                type="button"
                onClick={() => setSelectedSession(null)}
                className="btn-admin-secondary"
              >
                Close
              </button>
            </div>
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
