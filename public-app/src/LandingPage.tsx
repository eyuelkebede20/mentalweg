import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Calendar,
  Quote,
  BookOpen,
  MapPin,
  Shield,
  Clock,
  ChevronDown,
  Sparkles,
  Eye,
  X,
  ArrowUp,
  PhoneCall,
  CheckCircle2,
  Moon,
  Sun
} from 'lucide-react';
import './LandingPage.css';
import { useAppVersion } from './utils/useAppVersion';

interface Poster {
  id: string;
  title: string;
  date: string;
  category: 'latest' | 'previous';
  imageUrl: string;
  description: string;
}

interface PracticeConfig {
  practiceName: string;
  iconUrl: string;
  quote: string;
  quoteAuthor: string;
  bio: string;
  locationText: string;
  hourlyRateEtb: number;
  schedulingFeePercent: number;
  feeEtb: number;
  trainingPosters: Poster[];
}

interface Props {
  config: PracticeConfig;
  onBook: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

interface StageInfo {
  id: string;
  label: string;
  short: string;
  eyebrow: string;
}

const STAGES: StageInfo[] = [
  { id: 'sanctuary', label: 'Sanctuary', short: '01', eyebrow: 'In-Person Therapy & Counseling' },
  { id: 'ethos', label: 'Clinical Ethos', short: '02', eyebrow: 'Practitioner Voice & Philosophy' },
  { id: 'workshops', label: 'Workshops', short: '03', eyebrow: 'Psychoeducation & Masterclasses' },
  { id: 'care', label: 'In-Person Care', short: '04', eyebrow: 'Sanctuary & Practice Standards' },
  { id: 'support', label: 'Care & Support', short: '05', eyebrow: 'Appointments & Emergency Support' },
];

const CURRENT_YEAR = new Date().getFullYear();

export default function LandingPage({ config, onBook, theme = 'light', onToggleTheme }: Props) {
  const [activeStep, setActiveStep] = useState<number>(0);
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [scrollDirection, setScrollDirection] = useState<'down' | 'up'>('down');
  const [activePosterTab, setActivePosterTab] = useState<'latest' | 'previous'>('latest');
  const [selectedPoster, setSelectedPoster] = useState<Poster | null>(null);
  const appVersion = useAppVersion();

  const activeStepRef = useRef<number>(0);
  const selectedPosterRef = useRef<Poster | null>(null);

  // Keep refs in sync for event listeners
  useEffect(() => {
    activeStepRef.current = activeStep;
    selectedPosterRef.current = selectedPoster;
  }, [activeStep, selectedPoster]);

  // Enable CSS scroll snapping on HTML when landing page is active
  useEffect(() => {
    document.documentElement.classList.add('landing-snap-active');
    return () => {
      document.documentElement.classList.remove('landing-snap-active');
    };
  }, []);

  // Helper to determine spatial status: 'is-active' | 'is-prev' (above) | 'is-next' (below)
  const getStageClass = (stepIndex: number) => {
    if (stepIndex === activeStep) return 'is-active';
    if (stepIndex < activeStep) return 'is-prev';
    return 'is-next';
  };

  // Filter posters
  const filteredPosters = (config.trainingPosters || []).filter(
    p => p.category === activePosterTab
  );

  // Smooth jump to specific stage using native smooth scroll
  const goToStep = useCallback((stepIndex: number) => {
    const targetStep = Math.max(0, Math.min(STAGES.length - 1, stepIndex));
    if (targetStep !== activeStepRef.current) {
      setScrollDirection(targetStep > activeStepRef.current ? 'down' : 'up');
    }
    setActiveStep(targetStep);

    const stageEl = document.getElementById(`stage-pane-${targetStep}`);
    if (stageEl) {
      stageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      const viewportHeight = window.innerHeight || 800;
      window.scrollTo({
        top: targetStep * viewportHeight,
        behavior: 'smooth'
      });
    }
  }, []);

  // IntersectionObserver: tracks active stage with 100% native physics
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idxStr = entry.target.getAttribute('data-stage-index');
            if (idxStr !== null) {
              const idx = parseInt(idxStr, 10);
              if (!isNaN(idx) && idx !== activeStepRef.current) {
                setScrollDirection(idx > activeStepRef.current ? 'down' : 'up');
                setActiveStep(idx);
              }
            }
          }
        }
      },
      {
        threshold: 0.5,
        rootMargin: '-10% 0px -10% 0px'
      }
    );

    const stages = document.querySelectorAll('.stage-pane');
    stages.forEach(stage => observer.observe(stage));

    return () => observer.disconnect();
  }, []);

  // Passive scroll progress listener (updates top progress bar & direction)
  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const scrollY = window.scrollY;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (maxScroll > 0) {
        setScrollProgress(Math.min(1, Math.max(0, scrollY / maxScroll)));
      }

      if (Math.abs(scrollY - lastScrollY) > 8) {
        setScrollDirection(scrollY > lastScrollY ? 'down' : 'up');
        lastScrollY = scrollY;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Keyboard navigation (Arrow keys, PageUp/Down, Home, End)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedPosterRef.current) {
        if (e.key === 'Escape') {
          setSelectedPoster(null);
        }
        return;
      }

      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
        if (activeStepRef.current < STAGES.length - 1) {
          e.preventDefault();
          goToStep(activeStepRef.current + 1);
        }
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        if (activeStepRef.current > 0) {
          e.preventDefault();
          goToStep(activeStepRef.current - 1);
        }
      } else if (e.key === 'Home') {
        e.preventDefault();
        goToStep(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        goToStep(STAGES.length - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToStep]);

  return (
    <div className="landing-viewport-wrap" data-theme={theme}>
      {/* 1. ROCK-SOLID AMBIENT BACKDROP (NEVER MOVES OR SCROLLS AWAY) */}
      <div className={`static-ambient-backdrop step-${activeStep}`} aria-hidden="true">
        <div className="ambient-radial-glow ambient-glow-1" />
        <div className="ambient-radial-glow ambient-glow-2" />
        <div className="ambient-radial-glow ambient-glow-3" />
        <div className="ambient-texture-overlay" />
      </div>

      {/* TOP SCROLL PROGRESS BAR */}
      <div
        className="scroll-progress-line"
        style={{ width: `${Math.round(scrollProgress * 100)}%` }}
        aria-hidden="true"
      />

      {/* 2. FIXED TOP NAVIGATION BAR */}
      <header className="landing-navbar">
        <div className="nav-brand" onClick={() => goToStep(0)} role="button" tabIndex={0}>
          <div className="brand-emblem">MW</div>
          <div className="brand-text">
            <span className="brand-name">{config.practiceName || 'Mentalweg'}</span>
            <span className="brand-sub">Psychology Practice · Addis Ababa</span>
          </div>
        </div>

        <div className="nav-right-cluster">
          {/* PERSISTENT 24/7 CRISIS LIFELINE */}
          <a
            href="tel:907"
            className="nav-crisis-pill"
            aria-label="Call 907 national mental health crisis hotline, free 24/7"
            title="Immediate free crisis support · Call 907"
          >
            <span className="crisis-pulse-dot" aria-hidden="true" />
            <PhoneCall className="w-3.5 h-3.5 text-terra" />
            <span className="crisis-pill-text">
              <span className="crisis-pill-label">Crisis Support</span>
              <strong className="crisis-pill-number">907</strong>
            </span>
          </a>

          {onToggleTheme && (
            <button
              type="button"
              className="theme-toggle-btn"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          )}

          <button type="button" className="nav-cta-btn" onClick={onBook}>
            Book an Appointment
          </button>
        </div>
      </header>

      {/* 3. PINNED STAGE VIEWPORT: ONLY THE DATA THAT POPULATES CHANGES */}
      <main className={`landing-stage-viewport scroll-dir-${scrollDirection}`}>

        {/* ================= STAGE 0: HERO & SANCTUARY ================= */}
        <article
          id="stage-pane-0"
          data-stage-index="0"
          className={`stage-pane stage-hero ${getStageClass(0)}`}
          aria-hidden={activeStep !== 0}
        >
          <div className="stage-content-box allow-internal-scroll">
            <div className="stage-eyebrow-pill">
              <Sparkles className="w-4 h-4 text-emerald" />
              <span>In-Person Therapy & Counseling · Addis Ababa</span>
            </div>

            <h1 className="hero-headline">
              A quiet sanctuary for mindful reflection and emotional renewal.
            </h1>

            <p className="hero-bio">
              {config.bio ||
                'Dr. Hana’s private practice offers dedicated, compassionate psychological care and psychoeducation in Addis Ababa. Safe, confidential, and completely free of judgment.'}
            </p>

            <div className="hero-feature-ribbon">
              <div className="ribbon-item">
                <Clock className="w-4 h-4 text-emerald" />
                <span>Dedicated 60-Min Sessions</span>
              </div>
              <div className="ribbon-item">
                <MapPin className="w-4 h-4 text-emerald" />
                <span>Tranquil Bulgaria Corridor</span>
              </div>
              <div className="ribbon-item">
                <Shield className="w-4 h-4 text-emerald" />
                <span>Zero Stigma & Clinical Privacy</span>
              </div>
            </div>

            <div className="hero-action-cluster">
              <button type="button" className="btn-primary-action" onClick={onBook}>
                <Calendar className="w-5 h-5" />
                <span>Book Now (1-Hour Session)</span>
              </button>
              <button
                type="button"
                className="btn-secondary-action"
                onClick={() => goToStep(1)}
              >
                <span>Explore Clinical Ethos</span>
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        </article>

        {/* ================= STAGE 1: CLINICAL ETHOS & PRACTITIONER VOICE ================= */}
        <article
          id="stage-pane-1"
          data-stage-index="1"
          className={`stage-pane stage-quote ${getStageClass(1)}`}
          aria-hidden={activeStep !== 1}
        >
          <div className="stage-content-box allow-internal-scroll">
            <div className="quote-mark-icon" aria-hidden="true">
              <Quote className="w-10 h-10 text-emerald" />
            </div>

            <blockquote className="practitioner-quote">
              “{config.quote || 'Healing begins when we find a space to speak without fear of judgment.'}”
            </blockquote>

            <div className="practitioner-author-box">
              <strong className="practitioner-name">{config.quoteAuthor || 'Dr. Hana Almaz'}</strong>
              <span className="practitioner-title">Licensed Clinical Psychologist</span>

              <div className="practitioner-philosophy-card">
                <p>
                  “Every journey is singular. Whether you are navigating workplace burnout, anxiety, grief,
                  or personal transition, our 1-on-1 sessions are structured to ground you in self-compassion,
                  scientific understanding, and sustainable peace of mind.”
                </p>
              </div>

              <div className="ethos-pillars-grid">
                <div className="ethos-pill">
                  <CheckCircle2 className="w-4 h-4 text-emerald" />
                  <span>Confidential Reflection</span>
                </div>
                <div className="ethos-pill">
                  <CheckCircle2 className="w-4 h-4 text-emerald" />
                  <span>Integrative CBT & Mindfulness</span>
                </div>
                <div className="ethos-pill">
                  <CheckCircle2 className="w-4 h-4 text-emerald" />
                  <span>Unhurried In-Person Care</span>
                </div>
              </div>

              <div className="stage-step-actions">
                <button type="button" className="btn-primary-action" onClick={onBook}>
                  Reserve with Dr. Hana
                </button>
                <button
                  type="button"
                  className="btn-secondary-action"
                  onClick={() => goToStep(2)}
                >
                  <span>View Workshops Archive</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </article>

        {/* ================= STAGE 2: WORKSHOPS & PSYCHOEDUCATION ================= */}
        <article
          id="stage-pane-2"
          data-stage-index="2"
          className={`stage-pane stage-posters ${getStageClass(2)}`}
          aria-hidden={activeStep !== 2}
        >
          <div className="stage-content-box allow-internal-scroll posters-content-box">
            <div className="stage-header-centered">
              <span className="stage-eyebrow-text">Psychoeducation & Community</span>
              <h2 className="stage-heading">Workshops & Training Announcements</h2>
              <p className="stage-subheading">
                Interactive clinical masterclasses and community seminars designed to strengthen emotional
                resilience and relational communication.
              </p>
            </div>

            {/* Poster Category Switcher */}
            <div className="poster-tabs-row">
              <button
                type="button"
                className={`poster-tab-btn ${activePosterTab === 'latest' ? 'active' : ''}`}
                onClick={() => setActivePosterTab('latest')}
              >
                Latest Announcements (
                {config.trainingPosters?.filter(p => p.category === 'latest').length || 0})
              </button>
              <button
                type="button"
                className={`poster-tab-btn ${activePosterTab === 'previous' ? 'active' : ''}`}
                onClick={() => setActivePosterTab('previous')}
              >
                Previous Workshops (
                {config.trainingPosters?.filter(p => p.category === 'previous').length || 0})
              </button>
            </div>

            {/* Posters Grid / Slider */}
            <div className="posters-deck">
              {filteredPosters.length === 0 ? (
                <div className="posters-empty-card">
                  <BookOpen className="w-8 h-8 text-muted mb-2" />
                  <p>No {activePosterTab} training posters currently published.</p>
                  <span className="empty-subtext">Individual clinical sessions remain open for booking.</span>
                </div>
              ) : (
                filteredPosters.map((poster) => (
                  <article
                    key={poster.id}
                    className="poster-card-compact"
                    onClick={() => setSelectedPoster(poster)}
                  >
                    <div className="poster-thumb-wrap">
                      <img src={poster.imageUrl} alt={poster.title} loading="lazy" />
                      <span className={`poster-status-chip ${poster.category}`}>
                        {poster.category === 'latest' ? 'Upcoming' : 'Archive'}
                      </span>
                    </div>
                    <div className="poster-details">
                      <span className="poster-date-text">{poster.date}</span>
                      <h3 className="poster-title-text">{poster.title}</h3>
                      <p className="poster-excerpt-text">{poster.description}</p>
                      <button type="button" className="poster-view-link">
                        <Eye className="w-4 h-4" />
                        <span>View Details</span>
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>

            <div className="stage-step-actions text-center mt-4">
              <button
                type="button"
                className="btn-secondary-action"
                onClick={() => goToStep(3)}
              >
                <span>Next: In-Person Sanctuary Details</span>
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        </article>

        {/* ================= STAGE 3: IN-PERSON SANCTUARY & PRACTICE STANDARDS ================= */}
        <article
          id="stage-pane-3"
          data-stage-index="3"
          className={`stage-pane stage-sanctuary ${getStageClass(3)}`}
          aria-hidden={activeStep !== 3}
        >
          <div className="stage-content-box allow-internal-scroll">
            <div className="stage-header-centered">
              <span className="stage-eyebrow-text">Sanctuary & Practice Standards</span>
              <h2 className="stage-heading">Dedicated In-Person Practice in Addis Ababa</h2>
              <p className="stage-subheading">
                Thoughtfully structured consultations in a peaceful, discreet clinical environment.
              </p>
            </div>

            <div className="sanctuary-trio-grid">
              <div className="sanctuary-feature-card">
                <div className="feature-icon-circle">
                  <Clock className="w-5 h-5 text-emerald" />
                </div>
                <h3>Strict 1-Hour Focus</h3>
                <p>
                  Every consultation is a dedicated 60-minute in-person session, allowing unhurried conversation
                  and thorough therapeutic attention.
                </p>
              </div>

              <div className="sanctuary-feature-card">
                <div className="feature-icon-circle">
                  <MapPin className="w-5 h-5 text-emerald" />
                </div>
                <h3>Bulgaria Corridor Sanctuary</h3>
                <p>
                  {config.locationText ||
                    'Conveniently situated in the Bulgaria area near the African Union, Addis Ababa, in a tranquil and discreet setting.'}
                </p>
              </div>

              <div className="sanctuary-feature-card">
                <div className="feature-icon-circle">
                  <Shield className="w-5 h-5 text-emerald" />
                </div>
                <h3>Clinical Privacy Safeguard</h3>
                <p>
                  Our booking system never records reasons for visits or clinical notes. Your time with Dr.
                  Hana is protected by strict ethical confidentiality.
                </p>
              </div>
            </div>

            <div className="cta-banner-strip">
              <div className="banner-content">
                <div className="fee-badge">Transparent Practice Fee</div>
                <h3>Ready to reserve your time?</h3>
                <p>
                  Scheduling deposit is ETB {config.feeEtb || 300}, credited towards your 1-hour session. (Remaining balance settled at session).
                </p>
              </div>
              <button type="button" className="btn-banner-action" onClick={onBook}>
                Select Consultation Time
              </button>
            </div>

            <div className="stage-step-actions text-center mt-3">
              <button
                type="button"
                className="btn-secondary-action"
                onClick={() => goToStep(4)}
              >
                <span>Next: Care Support & Booking</span>
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        </article>

        {/* ================= STAGE 4: CARE NETWORK & EMERGENCY SUPPORT ================= */}
        <article
          id="stage-pane-4"
          data-stage-index="4"
          className={`stage-pane stage-support ${getStageClass(4)}`}
          aria-hidden={activeStep !== 4}
        >
          <div className="stage-content-box allow-internal-scroll">
            <div className="stage-header-centered">
              <span className="stage-eyebrow-text">Taking The First Step</span>
              <h2 className="stage-heading">Reserve Your Space for Renewal</h2>
              <p className="stage-subheading">
                Whether for individual therapeutic consultation or psychoeducational guidance, booking is
                seamless and confidential.
              </p>
            </div>

            {/* Emergency Hotline Notice */}
            <div className="crisis-banner-card">
              <div className="crisis-icon-circle">
                <PhoneCall className="w-5 h-5 text-terra" />
              </div>
              <div className="crisis-details">
                <strong className="crisis-title">Immediate Emergency Psychological Support</strong>
                <p>
                  If you or someone you know is in acute distress, please call the national mental health line at{' '}
                  <strong className="hotline-number">907</strong> or contact your nearest medical emergency facility.
                </p>
              </div>
            </div>

            {/* Booking Steps Summary */}
            <div className="booking-summary-row">
              <div className="step-mini-card">
                <span className="step-mini-num">1</span>
                <strong>Choose Time Convention</strong>
                <p>Ethiopian (12h Day/Night) or International (24h Standard).</p>
              </div>
              <div className="step-mini-card">
                <span className="step-mini-num">2</span>
                <strong>Select Available Slot</strong>
                <p>Real-time calendar with Dr. Hana’s open 60-min appointments.</p>
              </div>
              <div className="step-mini-card">
                <span className="step-mini-num">3</span>
                <strong>Confirm with Deposit</strong>
                <p>Secure 25% scheduling fee via Telebirr or CBE Birr.</p>
              </div>
            </div>

            <div className="final-cta-container">
              <button type="button" className="btn-primary-action large" onClick={onBook}>
                <Calendar className="w-5 h-5" />
                <span>Begin Your Appointment Booking</span>
              </button>
              <button
                type="button"
                className="btn-secondary-action"
                onClick={() => goToStep(0)}
              >
                <ArrowUp className="w-4 h-4" />
                <span>Return to Beginning</span>
              </button>
            </div>

            <footer className="stage-footer-compact">
              <p>
                &copy; {CURRENT_YEAR} {config.practiceName || 'Mentalweg'}. Licensed Clinical Psychologist · Addis Ababa, Ethiopia.
              </p>
              <div className="footer-practitioner-row">
                <a href="/admin/" className="footer-practitioner-link">
                  Practitioner Portal
                </a>
              </div>
              <p style={{ marginTop: '4px', fontSize: '11px', opacity: 0.65, fontFamily: 'monospace' }}>
                v{appVersion.version} · Git #{appVersion.gitCommit}
              </p>
            </footer>
          </div>
        </article>

      </main>

      {/* 5. FLOATING RIGHT-SIDE STAGE NAVIGATION RAIL */}
      <nav className="stage-nav-rail" aria-label="Landing page sections">
        <div className="rail-vertical-track" aria-hidden="true">
          <div
            className="rail-progress-fill"
            style={{ height: `${(activeStep / (STAGES.length - 1)) * 100}%` }}
          />
        </div>
        {STAGES.map((stage, idx) => {
          const isActive = idx === activeStep;
          const isPassed = idx < activeStep;
          const isUpcoming = idx > activeStep;
          return (
            <button
              key={stage.id}
              type="button"
              className={`stage-rail-node ${isActive ? 'active' : isPassed ? 'passed' : 'upcoming'}`}
              onClick={() => goToStep(idx)}
              aria-label={`Jump to stage ${stage.short}: ${stage.label} (${isPassed ? 'Above' : isUpcoming ? 'Below' : 'Current'})`}
              aria-current={isActive ? 'step' : undefined}
            >
              <span className="rail-node-dot" />
              <span className="rail-node-label">
                <span className="rail-num">{stage.short}</span>
                <span className="rail-text">{stage.label}</span>
                <span className="rail-rel-pos">
                  {isPassed ? 'Above ↑' : isUpcoming ? 'Below ↓' : 'Current'}
                </span>
              </span>
            </button>
          );
        })}
      </nav>

      {/* 6. BOTTOM STAGE NAVIGATION & DIRECTIONAL CUES */}
      <div className="stage-bottom-hint">
        {activeStep > 0 && (
          <button
            type="button"
            className="bottom-hint-btn hint-prev-btn"
            onClick={() => goToStep(activeStep - 1)}
            aria-label={`Scroll up to ${STAGES[activeStep - 1].label}`}
            title={`Above: ${STAGES[activeStep - 1].label}`}
          >
            <ArrowUp className="w-3.5 h-3.5" />
            <span>Above: {STAGES[activeStep - 1].label}</span>
          </button>
        )}

        {activeStep < STAGES.length - 1 ? (
          <button
            type="button"
            className="bottom-hint-btn hint-next-btn"
            onClick={() => goToStep(activeStep + 1)}
            aria-label={`Scroll down to ${STAGES[activeStep + 1].label}`}
            title={`Below: ${STAGES[activeStep + 1].label}`}
          >
            <span>
              {activeStep === 0
                ? 'Scroll down to explore'
                : `Below: ${STAGES[activeStep + 1].label}`}
            </span>
            <ChevronDown className="w-4 h-4 hint-chevron-down" />
          </button>
        ) : (
          <button
            type="button"
            className="bottom-hint-btn hint-top-btn"
            onClick={() => goToStep(0)}
            aria-label="Scroll back up to beginning"
          >
            <ArrowUp className="w-4 h-4" />
            <span>Return to Sanctuary Top</span>
          </button>
        )}
      </div>

      {/* 7. POSTER DETAIL MODAL OVERLAY */}
      {selectedPoster && (
        <div
          className="poster-modal-overlay"
          onClick={() => setSelectedPoster(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="poster-modal-title"
        >
          <div className="poster-modal-card" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              className="modal-close-btn"
              onClick={() => setSelectedPoster(null)}
              aria-label="Close poster"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="modal-img-wrap">
              <img src={selectedPoster.imageUrl} alt={selectedPoster.title} />
            </div>
            <div className="modal-content">
              <span className="modal-badge">{selectedPoster.category.toUpperCase()} · {selectedPoster.date}</span>
              <h2 id="poster-modal-title">{selectedPoster.title}</h2>
              <p className="modal-desc">{selectedPoster.description}</p>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-primary-action"
                  onClick={() => {
                    setSelectedPoster(null);
                    onBook();
                  }}
                >
                  Book a Session with Dr. Hana
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
