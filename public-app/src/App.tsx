import { useState, useEffect } from 'react';
import LandingPage from './LandingPage';
import TimeConventionPicker from './components/TimeConventionPicker';
import CalendarTimelinePicker from './components/CalendarTimelinePicker';
import BookingPaymentForm from './components/BookingPaymentForm';
import BookingConfirmation from './components/BookingConfirmation';
import TimeConventionModal from './components/TimeConventionModal';
import ClientPortal from './components/ClientPortal';
import PatientAuthPage from './components/PatientAuthPage';
import PatientDashboard from './components/PatientDashboard';
import { type TimeConvention, getStoredTimeConvention, setStoredTimeConvention } from './utils/ethiopianTime';
import { Clock, Globe, ArrowLeft, Check, Moon, Sun } from 'lucide-react';
import './LandingPage.css';

export default function App() {
  const [step, setStep] = useState<number>(0);
  const [timeConvention, setTimeConvention] = useState<TimeConvention>(() => getStoredTimeConvention());
  const [isConventionModalOpen, setIsConventionModalOpen] = useState<boolean>(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Immediate unregister & redirect if public-app bundle loads on /admin or /amdin
  const isNavigatingToAdmin = typeof window !== 'undefined' && (
    window.location.pathname.startsWith('/admin') || window.location.pathname.startsWith('/amdin')
  );

  useEffect(() => {
    if (isNavigatingToAdmin) {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => {
          for (const reg of regs) {
            reg.unregister();
          }
        });
      }
      const raw = window.location.pathname;
      const target = raw.replace(/^\/amdin/, '/admin');
      const finalUrl = target === '/admin' ? '/admin/' : target;
      window.location.replace(finalUrl);
    }
  }, [isNavigatingToAdmin]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const [config, setConfig] = useState<any>({
    practiceName: 'Mentalweg',
    quote: 'Healing begins when we find a space to speak without fear of judgment.',
    quoteAuthor: 'Dr. Hana Almaz, Clinical Psychologist',
    bio: 'A dedicated, confidential therapeutic practice providing compassionate clinical care and psychoeducation in Addis Ababa.',
    locationText: 'Bulgaria area, near the African Union, Addis Ababa',
    shiftStart: '09:00',
    shiftEnd: '17:00',
    hourlyRateEtb: 1200,
    schedulingFeePercent: 25,
    feeEtb: 300,
    trainingPosters: [],
    paymentAccounts: [],
  });

  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [bookingResult, setBookingResult] = useState<any | null>(null);

  // Check if viewing a verified client portal link: /m/:token or ?m=:token
  const getVerifiedToken = () => {
    if (typeof window === 'undefined') return null;
    const match = window.location.pathname.match(/^\/m\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) return match[1];
    const q = new URLSearchParams(window.location.search).get('m');
    return q || null;
  };

  const [verifiedToken, setVerifiedToken] = useState<string | null>(getVerifiedToken);

  // Hidden Patient Portal detection: /patient, /patient/login, /patient/signup, /patient/reset, /portal
  const isPatientPath = typeof window !== 'undefined' && (
    window.location.pathname.startsWith('/patient') || window.location.pathname.startsWith('/portal')
  );

  const [patientView, setPatientView] = useState<boolean>(isPatientPath);
  const [patientUser, setPatientUser] = useState<any | null>(null);
  const [checkingPatientAuth, setCheckingPatientAuth] = useState<boolean>(isPatientPath);

  useEffect(() => {
    if (patientView) {
      setCheckingPatientAuth(true);
      fetch('/api/patient/me')
        .then(r => r.json())
        .then(data => {
          if (data && data.authenticated && data.client) {
            setPatientUser(data.client);
          } else {
            setPatientUser(null);
          }
        })
        .catch(() => setPatientUser(null))
        .finally(() => setCheckingPatientAuth(false));
    }
  }, [patientView]);

  const getPatientMode = (): 'login' | 'signup' | 'forgot' | 'reset' => {
    if (typeof window === 'undefined') return 'login';
    const path = window.location.pathname;
    if (path.includes('/signup')) return 'signup';
    if (path.includes('/forgot')) return 'forgot';
    if (path.includes('/reset')) return 'reset';
    return 'login';
  };

  const getResetTokenFromUrl = (): string => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('token') || '';
  };

  // Load practice config from API
  useEffect(() => {
    fetch('/api/public/config')
      .then(r => r.json())
      .then(data => {
        if (data && data.practiceName) {
          setConfig(data);
        }
      })
      .catch(err => {
        console.warn('Using default config fallback:', err);
      });
  }, []);

  const handleSelectConvention = (pref: TimeConvention) => {
    setTimeConvention(pref);
    setStoredTimeConvention(pref);
    setStep(2); // Advance to Calendar/Timeline
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBookingSuccess = (result: any) => {
    setBookingResult(result);
    setStep(4); // Advance to Confirmation
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStartBooking = () => {
    setStep(1); // Step 1: Choose time convention
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isNavigatingToAdmin) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--sand-50, #fbfaf8)', color: 'var(--forest-900, #14241e)', fontFamily: 'sans-serif' }}>
        <p style={{ fontSize: '1.05rem', fontWeight: 600 }}>Opening Mental Weg Clinical Admin...</p>
      </div>
    );
  }

  // Render Verified Client Portal if accessed via private token link
  if (verifiedToken) {
    return (
      <div className="app-shell" data-theme={theme}>
        <ClientPortal
          token={verifiedToken}
          timeConvention={timeConvention}
          onToggleConvention={() => {
            const next = timeConvention === 'ethiopian' ? 'gregorian' : 'ethiopian';
            setTimeConvention(next);
            setStoredTimeConvention(next);
          }}
          onBackToHome={() => {
            if (typeof window !== 'undefined') {
              window.history.pushState({}, '', '/');
            }
            setVerifiedToken(null);
            setStep(0);
          }}
        />
      </div>
    );
  }

  // Render Hidden Patient Portal: Login / Signup / Dashboard
  if (patientView) {
    if (checkingPatientAuth) {
      return (
        <div className="app-shell" data-theme={theme} style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: 'var(--mut)', fontSize: '14px' }}>Connecting to Patient Sanctuary...</p>
        </div>
      );
    }

    if (patientUser) {
      return (
        <div className="app-shell" data-theme={theme}>
          <PatientDashboard
            timeConvention={timeConvention}
            onToggleConvention={() => {
              const next = timeConvention === 'ethiopian' ? 'gregorian' : 'ethiopian';
              setTimeConvention(next);
              setStoredTimeConvention(next);
            }}
            onLogout={() => {
              setPatientUser(null);
              setPatientView(false);
              if (typeof window !== 'undefined') {
                window.history.pushState({}, '', '/');
              }
            }}
          />
        </div>
      );
    }

    return (
      <div className="app-shell" data-theme={theme}>
        <PatientAuthPage
          initialMode={getPatientMode()}
          resetToken={getResetTokenFromUrl()}
          onSuccessLogin={(client) => setPatientUser(client)}
          onBackToSanctuary={() => {
            setPatientView(false);
            if (typeof window !== 'undefined') {
              window.history.pushState({}, '', '/');
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="app-shell" data-theme={theme}>
      {/* 1. PERSISTENT AMBIENT BACKDROP ACROSS THE ENTIRE WALKTHROUGH */}
      {step > 0 && (
        <div className="static-ambient-backdrop walkthrough-ambient" aria-hidden="true">
          <div className="ambient-radial-glow ambient-glow-1" />
          <div className="ambient-radial-glow ambient-glow-2" />
          <div className="ambient-radial-glow ambient-glow-3" />
          <div className="ambient-texture-overlay" />
        </div>
      )}

      {/* STEP 0: LANDING PAGE */}
      {step === 0 && (
        <LandingPage
          config={config}
          onBook={handleStartBooking}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      )}

      {/* STEPS 1-4: CONSISTENT WALKTHROUGH EXPERIENCE */}
      {step > 0 && (
        <div className="walkthrough-shell">
          {/* TOP WALKTHROUGH NAVIGATION BAR */}
          <header className="walkthrough-navbar">
            <div
              className="walkthrough-brand"
              onClick={() => {
                setStep(0);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              role="button"
              tabIndex={0}
              title="Return to Practice Sanctuary"
            >
              <div className="brand-emblem">MW</div>
              <div className="brand-text">
                <span className="brand-name">{config.practiceName || 'Mentalweg'}</span>
                <span className="brand-sub">Addis Ababa · In-Person Therapy</span>
              </div>
            </div>

            {/* Stepper Progress Indicator */}
            <div className="walkthrough-stepper" aria-label="Booking walkthrough progress">
              <div className={`stepper-node ${step === 1 ? 'active' : step > 1 ? 'completed' : ''}`}>
                <span className="node-circle">
                  {step > 1 ? <Check className="w-3.5 h-3.5" /> : '1'}
                </span>
                <span className="node-text">Convention</span>
              </div>

              <span className="stepper-track-divider" />

              <div className={`stepper-node ${step === 2 ? 'active' : step > 2 ? 'completed' : ''}`}>
                <span className="node-circle">
                  {step > 2 ? <Check className="w-3.5 h-3.5" /> : '2'}
                </span>
                <span className="node-text">Select Slot</span>
              </div>

              <span className="stepper-track-divider" />

              <div className={`stepper-node ${step === 3 ? 'active' : step > 3 ? 'completed' : ''}`}>
                <span className="node-circle">
                  {step > 3 ? <Check className="w-3.5 h-3.5" /> : '3'}
                </span>
                <span className="node-text">Details & Payment</span>
              </div>

              <span className="stepper-track-divider" />

              <div className={`stepper-node ${step === 4 ? 'active completed' : ''}`}>
                <span className="node-circle">
                  {step === 4 ? <Check className="w-3.5 h-3.5" /> : '4'}
                </span>
                <span className="node-text">Confirmed</span>
              </div>
            </div>

            {/* Top Right Actions: Ethiopian / Gregorian Switcher + Dark Mode Toggle + Exit */}
            <div className="walkthrough-nav-actions">
              <button
                type="button"
                className="theme-toggle-btn"
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              <button
                type="button"
                className="nav-convention-pill-btn"
                onClick={() => setIsConventionModalOpen(true)}
                title="Open Ethiopian vs Gregorian Clock Display Switcher"
              >
                <div className="pill-icon-circle">
                  {timeConvention === 'ethiopian' ? (
                    <Clock className="w-4 h-4 text-emerald" />
                  ) : (
                    <Globe className="w-4 h-4 text-emerald" />
                  )}
                </div>
                <div className="pill-text-col">
                  <span className="pill-eyebrow">Display Clock</span>
                  <span className="pill-val">
                    {timeConvention === 'ethiopian' ? 'የኢትዮጵያ ሰዓት' : 'GMT+3 (Gregorian)'}
                  </span>
                </div>
                <span className="pill-change-cue">Change ▾</span>
              </button>

              <button
                type="button"
                className="nav-exit-sanctuary-btn"
                onClick={() => {
                  setStep(0);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Sanctuary</span>
              </button>
            </div>
          </header>

          {/* MAIN STEP BODY */}
          <main className="walkthrough-main-content">
            {/* STEP 1: TIME CONVENTION PICKER (PAGE NEXT TO BOOK NOW) */}
            {step === 1 && (
              <TimeConventionPicker
                currentPref={timeConvention}
                onSelect={handleSelectConvention}
                onBack={() => setStep(0)}
              />
            )}

            {/* STEP 2: CALENDAR & TIMELINE SLOTS */}
            {step === 2 && (
              <CalendarTimelinePicker
                timeConvention={timeConvention}
                shiftStart={config.shiftStart || '09:00'}
                shiftEnd={config.shiftEnd || '17:00'}
                selectedSlot={selectedSlot}
                onSelectSlot={(slot) => setSelectedSlot(slot)}
                onRemoveSlot={() => setSelectedSlot(null)}
                onContinue={() => setStep(3)}
                onBack={() => setStep(1)}
                onChangeConvention={() => setIsConventionModalOpen(true)}
              />
            )}

            {/* STEP 3: DETAILS & PAYMENT INSTRUCTIONS */}
            {step === 3 && selectedSlot && (
              <BookingPaymentForm
                slot={selectedSlot}
                timeConvention={timeConvention}
                feeEtb={config.feeEtb || 300}
                paymentAccounts={config.paymentAccounts || []}
                onSuccess={handleBookingSuccess}
                onBack={() => setStep(2)}
                onOpenConventionModal={() => setIsConventionModalOpen(true)}
              />
            )}

            {/* STEP 4: CONFIRMATION SCREEN */}
            {step === 4 && bookingResult && (
              <BookingConfirmation
                bookingResult={bookingResult}
                timeConvention={timeConvention}
                locationText={config.locationText || 'Bulgaria area, near African Union, Addis Ababa'}
                onDone={() => {
                  setSelectedSlot(null);
                  setBookingResult(null);
                  setStep(0);
                }}
                onOpenConventionModal={() => setIsConventionModalOpen(true)}
              />
            )}
          </main>
        </div>
      )}

      {/* 2. UNIVERSAL ETHIOPIAN & GREGORIAN POPUP MODAL (ACCESSIBLE FROM ANYWHERE) */}
      <TimeConventionModal
        isOpen={isConventionModalOpen}
        currentPref={timeConvention}
        onSelect={(pref) => {
          setTimeConvention(pref);
          setStoredTimeConvention(pref);
        }}
        onClose={() => setIsConventionModalOpen(false)}
      />
    </div>
  );
}
