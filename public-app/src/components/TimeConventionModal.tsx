import { useEffect } from 'react';
import { Clock, Globe, CheckCircle2, X, Sparkles } from 'lucide-react';
import { type TimeConvention } from '../utils/ethiopianTime';

interface Props {
  isOpen: boolean;
  currentPref: TimeConvention;
  onSelect: (pref: TimeConvention) => void;
  onClose: () => void;
}

export default function TimeConventionModal({
  isOpen,
  currentPref,
  onSelect,
  onClose,
}: Props) {
  // ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePick = (pref: TimeConvention) => {
    onSelect(pref);
    onClose();
  };

  return (
    <div className="convention-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="convention-modal-card" onClick={e => e.stopPropagation()}>
        <button
          type="button"
          className="convention-modal-close"
          onClick={onClose}
          aria-label="Close time convention popup"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="convention-modal-header">
          <div className="header-icon-wrap">
            <Sparkles className="w-5 h-5 text-emerald" />
          </div>
          <span className="convention-modal-badge">Clock & Schedule Convention</span>
          <h2>Select Your Time Display</h2>
          <p className="convention-modal-sub">
            Choose how consultation hours appear across your booking walkthrough. Your choice is remembered automatically and updates all slots instantly.
          </p>
        </div>

        <div className="convention-modal-grid">
          {/* OPTION 1: ETHIOPIAN LOCAL TIME */}
          <div
            className={`convention-choice-card ${currentPref === 'ethiopian' ? 'is-selected' : ''}`}
            onClick={() => handlePick('ethiopian')}
            role="button"
            tabIndex={0}
          >
            <div className="choice-card-top">
              <div className="choice-icon-box ethiopian">
                <Clock className="w-6 h-6 text-emerald" />
              </div>
              {currentPref === 'ethiopian' ? (
                <span className="selected-chip">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Active Display</span>
                </span>
              ) : (
                <span className="switch-chip">Click to Switch</span>
              )}
            </div>

            <div className="choice-card-body">
              <h3 className="choice-title">Ethiopian Local Time</h3>
              <span className="choice-amharic">የኢትዮጵያ ሰዓት አቆጣጠር</span>
              <p className="choice-desc">
                Traditional 12-hour daytime cycle starting at sunrise (6:00 AM Gregorian = 12:00 morning). Intuitive for local residents in Addis Ababa.
              </p>

              <div className="choice-preview-pill">
                <span className="preview-label">Sample Consultation:</span>
                <strong className="preview-val">ጥዋት 3:00 – 4:00</strong>
                <span className="preview-sub">(Equivalent to 09:00 AM EAT)</span>
              </div>
            </div>

            <button
              type="button"
              className={`btn-choice-action ${currentPref === 'ethiopian' ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handlePick('ethiopian');
              }}
            >
              {currentPref === 'ethiopian' ? 'Currently Selected ✓' : 'Switch to Ethiopian Time'}
            </button>
          </div>

          {/* OPTION 2: GREGORIAN GMT+3 TIME */}
          <div
            className={`convention-choice-card ${currentPref === 'gregorian' ? 'is-selected' : ''}`}
            onClick={() => handlePick('gregorian')}
            role="button"
            tabIndex={0}
          >
            <div className="choice-card-top">
              <div className="choice-icon-box gregorian">
                <Globe className="w-6 h-6 text-emerald" />
              </div>
              {currentPref === 'gregorian' ? (
                <span className="selected-chip">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Active Display</span>
                </span>
              ) : (
                <span className="switch-chip">Click to Switch</span>
              )}
            </div>

            <div className="choice-card-body">
              <h3 className="choice-title">GMT+3 International Time</h3>
              <span className="choice-amharic">ዓለም አቀፍ ሰዓት (East Africa Time)</span>
              <p className="choice-desc">
                Standard international 12h/24h Gregorian time in the UTC+3 timezone. Recommended for clients using digital calendar invites (Google, Outlook, Apple Calendar).
              </p>

              <div className="choice-preview-pill">
                <span className="preview-label">Sample Consultation:</span>
                <strong className="preview-val">09:00 AM – 10:00 AM</strong>
                <span className="preview-sub">(Equivalent to ጥዋት 3:00 local time)</span>
              </div>
            </div>

            <button
              type="button"
              className={`btn-choice-action ${currentPref === 'gregorian' ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handlePick('gregorian');
              }}
            >
              {currentPref === 'gregorian' ? 'Currently Selected ✓' : 'Switch to GMT+3 Time'}
            </button>
          </div>
        </div>

        {/* Live Conversion Quick Reference Strip */}
        <div className="convention-quick-reference">
          <span className="ref-title">Quick Conversion Reference:</span>
          <div className="ref-items">
            <span className="ref-item">Sunrise (06:00 AM) = <strong>ጥዋት 12:00</strong></span>
            <span className="ref-item">Morning (09:00 AM) = <strong>ጥዋት 3:00</strong></span>
            <span className="ref-item">Midday (12:00 PM) = <strong>ቀን 6:00</strong></span>
            <span className="ref-item">Afternoon (03:00 PM) = <strong>ቀን 9:00</strong></span>
          </div>
        </div>

        <div className="convention-modal-footer">
          <p className="footer-notice">
            Both conventions refer to the exact same physical time slot in Dr. Hana's clinic in Addis Ababa.
          </p>
        </div>
      </div>
    </div>
  );
}
