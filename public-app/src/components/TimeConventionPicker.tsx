import { useState } from 'react';
import { Clock, Globe, CheckCircle2, ArrowRight, ArrowLeft, Sun } from 'lucide-react';
import { type TimeConvention } from '../utils/ethiopianTime';

interface Props {
  currentPref: TimeConvention;
  onSelect: (pref: TimeConvention) => void;
  onBack: () => void;
}

export default function TimeConventionPicker({ currentPref, onSelect, onBack }: Props) {
  const [selected, setSelected] = useState<TimeConvention>(currentPref);

  const handleCardClick = (pref: TimeConvention) => {
    setSelected(pref);
  };

  const handleProceed = () => {
    onSelect(selected);
  };

  return (
    <div className="booking-step-container convention-step-page">
      {/* STEP HEADER */}
      <div className="step-header">
        <div className="step-top-nav">
          <button type="button" className="text-back-button" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Sanctuary Overview</span>
          </button>
        </div>

        <div className="step-header-content">
          <span className="step-eyebrow-chip">Step 1 of 3 · Time Convention Preference</span>
          <h1 className="step-main-title">How Would You Like Your Session Time Displayed?</h1>
          <p className="step-subtitle">
            Dr. Hana’s private practice conducts individual 1-hour in-person consultations in Addis Ababa.
            Choose the clock convention most intuitive for your schedule. We remember this choice for future visits.
          </p>
        </div>
      </div>

      {/* TWO PRIMARY CONVENTION CARDS */}
      <div className="time-options-grid dual-convention-deck">

        {/* CARD 1: ETHIOPIAN LOCAL TIME */}
        <div
          className={`time-card convention-card ${selected === 'ethiopian' ? 'selected' : ''}`}
          onClick={() => handleCardClick('ethiopian')}
          role="button"
          tabIndex={0}
        >
          <div className="card-top">
            <div className="card-icon-wrap ethiopian-theme">
              <Sun className="w-6 h-6 text-emerald" />
            </div>
            {selected === 'ethiopian' ? (
              <span className="selection-badge active">
                <CheckCircle2 className="w-4 h-4" />
                <span>Selected Display</span>
              </span>
            ) : (
              <span className="selection-badge inactive">Click to Select</span>
            )}
          </div>

          <div className="card-title-group">
            <h3>Ethiopian Local Time</h3>
            <span className="amharic-subtext">የኢትዮጵያ ሰዓት አቆጣጠር</span>
          </div>

          <p className="time-desc">
            The traditional 12-hour daytime cycle starting at sunrise (6:00 AM Gregorian is 12:00 morning).
            Standard and intuitive for local daily life in Addis Ababa.
          </p>

          <div className="convention-sample-box">
            <span className="sample-label">Sample Clinic Hours:</span>
            <div className="sample-times-list">
              <div className="sample-row">
                <span className="sample-period">Morning:</span>
                <strong>ጥዋት 3:00 – 4:00</strong>
                <span className="sample-hint">(09:00 AM EAT)</span>
              </div>
              <div className="sample-row">
                <span className="sample-period">Afternoon:</span>
                <strong>ቀን 8:00 – 9:00</strong>
                <span className="sample-hint">(02:00 PM EAT)</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            className={`btn-select-convention ${selected === 'ethiopian' ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onSelect('ethiopian');
            }}
          >
            {selected === 'ethiopian' ? 'Selected · Proceed to Calendar →' : 'Choose Ethiopian Local Time'}
          </button>
        </div>

        {/* CARD 2: GREGORIAN GMT+3 TIME */}
        <div
          className={`time-card convention-card ${selected === 'gregorian' ? 'selected' : ''}`}
          onClick={() => handleCardClick('gregorian')}
          role="button"
          tabIndex={0}
        >
          <div className="card-top">
            <div className="card-icon-wrap gregorian-theme">
              <Globe className="w-6 h-6 text-emerald" />
            </div>
            {selected === 'gregorian' ? (
              <span className="selection-badge active">
                <CheckCircle2 className="w-4 h-4" />
                <span>Selected Display</span>
              </span>
            ) : (
              <span className="selection-badge inactive">Click to Select</span>
            )}
          </div>

          <div className="card-title-group">
            <h3>GMT+3 International Time</h3>
            <span className="amharic-subtext">ዓለም አቀፍ ሰዓት (East Africa Time)</span>
          </div>

          <p className="time-desc">
            Standard international 12h/24h Gregorian clock in the UTC+3 timezone.
            Recommended for clients accustomed to syncing with Google, Apple, or Outlook calendars.
          </p>

          <div className="convention-sample-box">
            <span className="sample-label">Sample Clinic Hours:</span>
            <div className="sample-times-list">
              <div className="sample-row">
                <span className="sample-period">Morning:</span>
                <strong>09:00 AM – 10:00 AM</strong>
                <span className="sample-hint">(ጥዋት 3:00)</span>
              </div>
              <div className="sample-row">
                <span className="sample-period">Afternoon:</span>
                <strong>02:00 PM – 03:00 PM</strong>
                <span className="sample-hint">(ቀን 8:00)</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            className={`btn-select-convention ${selected === 'gregorian' ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onSelect('gregorian');
            }}
          >
            {selected === 'gregorian' ? 'Selected · Proceed to Calendar →' : 'Choose GMT+3 International Time'}
          </button>
        </div>

      </div>

      {/* TIME SYNCHRONIZATION REFERENCE BANNER */}
      <div className="convention-info-card">
        <div className="info-icon-circle">
          <Clock className="w-5 h-5 text-emerald" />
        </div>
        <div className="info-content">
          <h4>Seamless Dual-Clock Alignment</h4>
          <p>
            Whether you choose Ethiopian Local Time or GMT+3, our booking calendar clearly indicates the corresponding time in both conventions during slot selection, confirmation receipt, and downloadable calendar invite.
          </p>
          <div className="info-pills-row">
            <span className="mini-sync-pill">Dawn (06:00 AM) = ጥዋት 12:00</span>
            <span className="mini-sync-pill">Opening (09:00 AM) = ጥዋት 3:00</span>
            <span className="mini-sync-pill">Midday (12:00 PM) = ቀን 6:00</span>
            <span className="mini-sync-pill">Closing (05:00 PM) = ቀን 11:00</span>
          </div>
        </div>
      </div>

      {/* PROCEED ACTION ROW */}
      <div className="convention-footer-action">
        <button type="button" className="btn-confirm-proceed" onClick={handleProceed}>
          <span>Proceed to Appointment Calendar</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
