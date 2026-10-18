import { useState, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, Clock, X, ChevronLeft, ChevronRight, Check, AlertCircle } from 'lucide-react';
import { type TimeConvention, formatTimeSlot, formatEthiopianCalendarDate } from '../utils/ethiopianTime';

interface SlotData {
  startUtc: string;
  durationMin: number;
}

interface Props {
  timeConvention: TimeConvention;
  shiftStart: string;
  shiftEnd: string;
  selectedSlot: SlotData | null;
  onSelectSlot: (slot: SlotData) => void;
  onRemoveSlot: () => void;
  onContinue: () => void;
  onBack: () => void;
  onChangeConvention: () => void;
}

export default function CalendarTimelinePicker({
  timeConvention,
  shiftStart,
  shiftEnd,
  selectedSlot,
  onSelectSlot,
  onRemoveSlot,
  onContinue,
  onBack,
  onChangeConvention,
}: Props) {
  const [slots, setSlots] = useState<SlotData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View state: 'calendar' (date grid) or 'timeline' (weekly/daily timeline)
  const [viewMode, setViewMode] = useState<'calendar' | 'timeline'>('calendar');
  const [activeDate, setActiveDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // Calendar month navigation
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // Fetch 30 days of slots
  useEffect(() => {
    setLoading(true);
    const from = new Date().toISOString();
    const to = new Date(Date.now() + 30 * 24 * 3600000).toISOString();

    fetch(`/api/public/slots?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&duration=60`)
      .then(r => {
        if (!r.ok) throw new Error('Failed to load slots');
        return r.json();
      })
      .then(data => {
        setSlots(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Unable to load open appointments');
        setLoading(false);
      });
  }, []);

  // Map slots by Date string YYYY-MM-DD
  const slotsByDate = useMemo(() => {
    const map = new Map<string, SlotData[]>();
    slots.forEach(s => {
      // Addis Ababa time is UTC+3
      const d = new Date(s.startUtc);
      const eatMs = d.getTime() + 3 * 3600000;
      const eatDate = new Date(eatMs);
      const key = eatDate.toISOString().split('T')[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    return map;
  }, [slots]);

  // Generate days for Calendar view
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun, 1 = Mon...
    // We start week on Monday (index 1), so adjust Sunday (0) to 7
    const adjustedStart = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days: Array<{
      date: Date;
      dateKey: string;
      isCurrentMonth: boolean;
      isPast: boolean;
      slotsCount: number;
    }> = [];

    // Padding before 1st of month
    for (let i = adjustedStart; i > 0; i--) {
      const d = new Date(year, month, 1 - i);
      const dateKey = d.toISOString().split('T')[0];
      days.push({
        date: d,
        dateKey,
        isCurrentMonth: false,
        isPast: d < today,
        slotsCount: slotsByDate.get(dateKey)?.length || 0,
      });
    }

    // Days in current month
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const dateKey = d.toISOString().split('T')[0];
      days.push({
        date: d,
        dateKey,
        isCurrentMonth: true,
        isPast: d < today,
        slotsCount: slotsByDate.get(dateKey)?.length || 0,
      });
    }

    return days;
  }, [currentMonth, slotsByDate]);

  // Handle clicking a date in calendar
  const handleDateClick = (d: Date, count: number) => {
    if (count === 0) return;
    setActiveDate(d);
    setViewMode('timeline');
  };

  // Generate Week Days centered on activeDate
  const currentWeekDays = useMemo(() => {
    const current = new Date(activeDate);
    const day = current.getDay();
    // Monday as start (1)
    const diff = current.getDate() - (day === 0 ? 6 : day - 1);
    const monday = new Date(current.setDate(diff));

    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const wDay = new Date(monday);
      wDay.setDate(monday.getDate() + i);
      week.push(wDay);
    }
    return week;
  }, [activeDate]);

  // Hourly slots for activeDate
  const activeDateKey = activeDate.toISOString().split('T')[0];
  const activeDaySlots = slotsByDate.get(activeDateKey) || [];

  // Parse shift range in hours
  const startHour = parseInt(shiftStart.split(':')[0], 10) || 9;
  const endHour = parseInt(shiftEnd.split(':')[0], 10) || 16;

  // Build full working-hours timeline for active day
  const timelineHours = useMemo(() => {
    const hours: Array<{
      hour24: number;
      slotMatch: SlotData | null;
      isAvailable: boolean;
      utcEstimatedDate: Date;
    }> = [];

    for (let h = startHour; h < endHour; h++) {
      // Hour h in East Africa Time (UTC+3) corresponds to UTC hour (h - 3)
      const dateCopy = new Date(activeDate);
      dateCopy.setUTCHours(h - 3, 0, 0, 0);

      // Check if slotMatch exists in activeDaySlots
      const match = activeDaySlots.find(s => {
        const sDate = new Date(s.startUtc);
        const sEatHour = (sDate.getUTCHours() + 3) % 24;
        return sEatHour === h;
      }) || null;

      hours.push({
        hour24: h,
        slotMatch: match,
        isAvailable: match !== null,
        utcEstimatedDate: dateCopy,
      });
    }
    return hours;
  }, [startHour, endHour, activeDate, activeDaySlots]);

  return (
    <div className="booking-step-container">
      {/* Step Header */}
      <div className="step-header">
        <div className="top-nav-row">
          <button type="button" className="text-back-button" onClick={onBack}>
            <ChevronLeft className="w-4 h-4" />
            <span>Back to Time Preference</span>
          </button>
          <button type="button" className="convention-chip" onClick={onChangeConvention}>
            <span>Convention:</span>
            <strong>{timeConvention === 'ethiopian' ? 'የኢትዮጵያ ሰዓት (Local)' : 'GMT+3 (Gregorian)'}</strong>
            <span className="change-link">Change</span>
          </button>
        </div>
        <span className="step-badge">Step 2 of 3</span>
        <h2>Select an Appointment Slot</h2>
        <p className="step-subtitle">
          Sessions are strictly 1-hour individual consultations. Choose a date with open openings, then select your hour on the timeline.
        </p>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="view-mode-tabs">
        <button
          type="button"
          className={`tab-btn ${viewMode === 'calendar' ? 'active' : ''}`}
          onClick={() => setViewMode('calendar')}
        >
          <CalendarIcon className="w-4 h-4" />
          <span>Month Calendar</span>
        </button>
        <button
          type="button"
          className={`tab-btn ${viewMode === 'timeline' ? 'active' : ''}`}
          onClick={() => setViewMode('timeline')}
        >
          <Clock className="w-4 h-4" />
          <span>Weekly Timeline ({activeDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})</span>
        </button>
      </div>

      {loading && (
        <div className="calendar-loading-state">
          <div className="spinner" />
          <p>Finding open clinical slots in Addis Ababa...</p>
        </div>
      )}

      {error && (
        <div className="calendar-error-state">
          <AlertCircle className="w-6 h-6 text-red-500" />
          <p>{error}</p>
          <button onClick={() => window.location.reload()} className="btn-retry">Try Again</button>
        </div>
      )}

      {/* CALENDAR VIEW */}
      {!loading && !error && viewMode === 'calendar' && (
        <div className="calendar-card">
          <div className="calendar-month-header">
            <button
              type="button"
              className="month-nav-btn"
              onClick={() => {
                const prev = new Date(currentMonth);
                prev.setMonth(prev.getMonth() - 1);
                setCurrentMonth(prev);
              }}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="month-title-wrap">
              <h3>
                {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h3>
              <span className="ethiopian-month-badge">
                {formatEthiopianCalendarDate(currentMonth)}
              </span>
            </div>
            <button
              type="button"
              className="month-nav-btn"
              onClick={() => {
                const next = new Date(currentMonth);
                next.setMonth(next.getMonth() + 1);
                setCurrentMonth(next);
              }}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="calendar-weekdays-row">
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
            <span>Sun</span>
          </div>

          <div className="calendar-grid">
            {calendarDays.map((cd, idx) => {
              const isSelected = cd.dateKey === activeDateKey;
              const hasSlots = cd.slotsCount > 0 && !cd.isPast;

              return (
                <div
                  key={idx}
                  className={`calendar-cell ${!cd.isCurrentMonth ? 'outside' : ''} ${cd.isPast ? 'past' : ''} ${hasSlots ? 'available' : 'unavailable'} ${isSelected ? 'selected-date' : ''}`}
                  onClick={() => handleDateClick(cd.date, cd.slotsCount)}
                  role={hasSlots ? 'button' : undefined}
                  tabIndex={hasSlots ? 0 : -1}
                >
                  <span className="cell-day-num">{cd.date.getDate()}</span>
                  <span className="cell-ethiopian-num">
                    {formatEthiopianCalendarDate(cd.date).split(' ')[1] || ''}
                  </span>
                  {hasSlots ? (
                    <span className="slot-pill">{cd.slotsCount} open</span>
                  ) : (
                    <span className="off-pill">Off</span>
                  )}
                </div>
              );
            })}
          </div>

          <p className="calendar-legend-text">
            Dates in green have open 1-hour sessions. Click any date to open the timeline.
          </p>
        </div>
      )}

      {/* WEEKLY TIMELINE VIEW */}
      {!loading && !error && viewMode === 'timeline' && (
        <div className="timeline-card">
          <div className="timeline-week-nav">
            <span className="timeline-week-label">Weekly Timeline:</span>
            <div className="week-buttons-row">
              {currentWeekDays.map((wDate, idx) => {
                const wKey = wDate.toISOString().split('T')[0];
                const count = slotsByDate.get(wKey)?.length || 0;
                const isCurrent = wKey === activeDateKey;

                return (
                  <button
                    key={idx}
                    type="button"
                    className={`week-day-pill ${isCurrent ? 'active' : ''} ${count === 0 ? 'no-slots' : ''}`}
                    onClick={() => setActiveDate(wDate)}
                  >
                    <span className="w-day-name">
                      {wDate.toLocaleDateString('en-US', { weekday: 'short' })}
                    </span>
                    <span className="w-day-num">{wDate.getDate()}</span>
                    <span className="w-day-eth">{formatEthiopianCalendarDate(wDate)}</span>
                    <span className="w-day-count">{count > 0 ? `${count} open` : 'Off'}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="timeline-header-meta">
            <h4>
              Appointments for {activeDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </h4>
            <span className="ethiopian-date-tag">
              Ethiopian Date: {formatEthiopianCalendarDate(activeDate)}
            </span>
          </div>

          <div className="timeline-slots-grid">
            {timelineHours.map((th) => {
              const formatted = formatTimeSlot(th.utcEstimatedDate, timeConvention, 60);
              const isSelected = selectedSlot && new Date(selectedSlot.startUtc).getTime() === (th.slotMatch ? new Date(th.slotMatch.startUtc).getTime() : -1);

              if (!th.isAvailable || !th.slotMatch) {
                return (
                  <div key={th.hour24} className="timeline-slot-row disabled">
                    <div className="slot-time-block">
                      <span className="slot-primary-time">{formatted.primary}</span>
                      <span className="slot-secondary-time">{formatted.secondary}</span>
                    </div>
                    <span className="slot-status-pill unavailable">Unavailable / Held</span>
                  </div>
                );
              }

              return (
                <div
                  key={th.hour24}
                  className={`timeline-slot-row open ${isSelected ? 'selected' : ''}`}
                  onClick={() => onSelectSlot(th.slotMatch!)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="slot-time-block">
                    <span className="slot-primary-time">{formatted.primary}</span>
                    <span className="slot-secondary-time">{formatted.secondary}</span>
                  </div>
                  <div className="slot-action-area">
                    {isSelected ? (
                      <span className="selected-indicator">
                        <Check className="w-4 h-4" />
                        <span>Selected</span>
                      </span>
                    ) : (
                      <span className="hover-select-cue">Click to Select (1 hr)</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SELECTED SLOT CREATED WITH 'x' REMOVE AFFORDANCE */}
      {selectedSlot && (
        <div className="selected-slot-banner">
          <div className="banner-details">
            <span className="banner-title">Selected Session (1 Hour):</span>
            <strong className="banner-time">
              {formatTimeSlot(selectedSlot.startUtc, timeConvention, 60).primary}
            </strong>
            <span className="banner-sub">
              {new Date(selectedSlot.startUtc).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} · {formatTimeSlot(selectedSlot.startUtc, timeConvention, 60).secondary}
            </span>
          </div>
          <div className="banner-actions">
            <button
              type="button"
              className="remove-slot-btn"
              onClick={onRemoveSlot}
              title="Remove this slot"
            >
              <X className="w-4 h-4" />
              <span>Remove</span>
            </button>
            <button
              type="button"
              className="btn-proceed"
              onClick={onContinue}
            >
              <span>Proceed to Booking Details</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
