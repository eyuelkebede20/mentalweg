import { CheckCircle2, MapPin, Download, ArrowRight, ShieldCheck, Clock } from 'lucide-react';
import { type TimeConvention, formatTimeSlot, formatEthiopianCalendarDate } from '../utils/ethiopianTime';

interface Props {
  bookingResult: {
    sessionId: number;
    clientPublicId: string;
    clientName: string;
    clientPhone: string;
    slotStartUtc: string;
    status: string;
    feeEtb: number;
    message?: string;
  };
  timeConvention: TimeConvention;
  locationText: string;
  onDone: () => void;
  onOpenConventionModal?: () => void;
}

export default function BookingConfirmation({
  bookingResult,
  timeConvention,
  locationText,
  onDone,
  onOpenConventionModal,
}: Props) {
  const { sessionId, clientPublicId, clientName, slotStartUtc, status, message } = bookingResult;
  const isConfirmed = status === 'confirmed';
  const timeFormatted = formatTimeSlot(slotStartUtc, timeConvention, 60);
  const startDate = new Date(slotStartUtc);

  // Generate .ics calendar download
  const handleDownloadIcs = () => {
    const end = new Date(startDate.getTime() + 60 * 60000);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const toIcsDate = (d: Date) =>
      `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Mentalweg//Psychology Practice//EN',
      'BEGIN:VEVENT',
      `UID:mentalweg-session-${sessionId}@mentalweg.et`,
      `DTSTAMP:${toIcsDate(new Date())}`,
      `DTSTART:${toIcsDate(startDate)}`,
      `DTEND:${toIcsDate(end)}`,
      `SUMMARY:Psychology Consultation with Dr. Hana`,
      `DESCRIPTION:Confidential 1-hour individual therapy consultation. Reference: ${clientPublicId}`,
      `LOCATION:${locationText}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `appointment-dr-hana-${sessionId}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="booking-step-container confirmation-wrapper">
      <div className="confirmation-card">
        <div className="confirmation-icon-wrap">
          <CheckCircle2 className="w-16 h-16 text-emerald" />
        </div>

        <span className="status-badge-chip">
          {isConfirmed ? 'Appointment Confirmed' : 'Payment Submitted & Under Review'}
        </span>

        <h2>
          {isConfirmed ? 'You are scheduled, ' + clientName : 'Thank You, ' + clientName}
        </h2>
        <p className="confirmation-subtitle">
          {message || (isConfirmed
            ? 'Your 1-hour confidential consultation with Dr. Hana is officially booked.'
            : 'Your payment proof has been submitted. Dr. Hana will review the slip and finalize your spot.')}
        </p>

        <div className="confirmation-meta-box">
          <div className="meta-row">
            <span className="meta-label">Reference ID</span>
            <strong className="meta-value font-mono">{clientPublicId} (Session #{sessionId})</strong>
          </div>

          <div className="meta-row">
            <span className="meta-label">Date</span>
            <strong className="meta-value">
              {startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              <span className="eth-sub"> (Ethiopian Date: {formatEthiopianCalendarDate(startDate)})</span>
            </strong>
          </div>

          <div className="meta-row">
            <span className="meta-label">Session Time</span>
            <div className="meta-value-col">
              <strong className="meta-value">{timeFormatted.primary}</strong>
              <span className="meta-secondary">{timeFormatted.secondary}</span>
              {onOpenConventionModal && (
                <button
                  type="button"
                  className="convention-inline-switch-btn mt-1"
                  onClick={onOpenConventionModal}
                >
                  <span>Clock: {timeConvention === 'ethiopian' ? 'የኢትዮጵያ ሰዓት' : 'GMT+3'}</span>
                  <span className="switch-text">Switch ▾</span>
                </button>
              )}
            </div>
          </div>

          <div className="meta-row">
            <span className="meta-label">Location</span>
            <strong className="meta-value">{locationText}</strong>
          </div>
        </div>

        <div className="confirmation-instructions">
          <div className="instruction-item">
            <Clock className="w-5 h-5 text-emerald" />
            <div>
              <strong>Arrive 5 Minutes Early</strong>
              <p>Please arrive slightly before your scheduled hour to enjoy a calm transition into the session.</p>
            </div>
          </div>
          <div className="instruction-item">
            <MapPin className="w-5 h-5 text-emerald" />
            <div>
              <strong>In-Person Clinical Office</strong>
              <p>Located in the quiet residential corridor of the Bulgaria area, near the African Union.</p>
            </div>
          </div>
          <div className="instruction-item">
            <ShieldCheck className="w-5 h-5 text-emerald" />
            <div>
              <strong>Absolute Privacy</strong>
              <p>Your session is private and held in strict clinical confidentiality.</p>
            </div>
          </div>
        </div>

        <div className="confirmation-actions">
          <button type="button" className="btn-calendar-download" onClick={handleDownloadIcs}>
            <Download className="w-4 h-4" />
            <span>Add to Google / Apple Calendar (.ics)</span>
          </button>
          <button type="button" className="btn-primary" onClick={onDone}>
            <span>Return to Practice Home</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
