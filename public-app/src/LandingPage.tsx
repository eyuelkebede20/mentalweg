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
  Sun,
  FileText,
  Download,
  FileDown
} from 'lucide-react';
import './LandingPage.css';
import { useAppVersion } from './utils/useAppVersion';

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  authorName: string;
  coverImageUrl?: string;
  readTimeMin: number;
  publishedAt: string;
  tags?: string;
}

export interface MaterialItem {
  id: string;
  title: string;
  description: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  category: string;
  downloadCount: number;
}

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
  { id: 'insights', label: 'Articles & Blog', short: '04', eyebrow: 'Reflections & Clinical Guidance' },
  { id: 'materials', label: 'Clinical Tools', short: '05', eyebrow: 'Worksheets, Guides & Protocols' },
  { id: 'care', label: 'In-Person Care', short: '06', eyebrow: 'Sanctuary & Practice Standards' },
  { id: 'support', label: 'Care & Support', short: '07', eyebrow: 'Appointments & Emergency Support' },
];

function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return 'PDF Document';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const CURRENT_YEAR = new Date().getFullYear();

export default function LandingPage({ config, onBook, theme = 'light', onToggleTheme }: Props) {
  const [activeStep, setActiveStep] = useState<number>(0);
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [scrollDirection, setScrollDirection] = useState<'down' | 'up'>('down');
  const [activePosterTab, setActivePosterTab] = useState<'latest' | 'previous'>('latest');
  const [selectedPoster, setSelectedPoster] = useState<Poster | null>(null);

  // Blog and clinical materials states
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [activePostCategory, setActivePostCategory] = useState<string>('All');
  const [activeMaterialCategory, setActiveMaterialCategory] = useState<string>('All');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const appVersion = useAppVersion();

  const activeStepRef = useRef<number>(0);
  const selectedPosterRef = useRef<Poster | null>(null);
  const selectedPostRef = useRef<BlogPost | null>(null);
  const isTransitioningRef = useRef<boolean>(false);
  const touchStartY = useRef<number>(0);

  // Keep refs in sync for event listeners
  useEffect(() => {
    activeStepRef.current = activeStep;
    selectedPosterRef.current = selectedPoster;
    selectedPostRef.current = selectedPost;
  }, [activeStep, selectedPoster, selectedPost]);

  // Fetch published blog posts and patient materials
  useEffect(() => {
    fetch('/api/public/posts')
      .then(r => r.ok ? r.json() : [])
      .then(data => setPosts(Array.isArray(data) ? data : []))
      .catch(err => console.error('Error fetching public posts:', err));

    fetch('/api/public/materials')
      .then(r => r.ok ? r.json() : [])
      .then(data => setMaterials(Array.isArray(data) ? data : []))
      .catch(err => console.error('Error fetching public materials:', err));
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

  // Filter posts
  const postCategories = ['All', ...Array.from(new Set(posts.map(p => p.category).filter(Boolean)))];
  const filteredPosts = activePostCategory === 'All'
    ? posts
    : posts.filter(p => p.category === activePostCategory);

  // Filter materials
  const materialCategories = ['All', ...Array.from(new Set(materials.map(m => m.category).filter(Boolean)))];
  const filteredMaterials = activeMaterialCategory === 'All'
    ? materials
    : materials.filter(m => m.category === activeMaterialCategory);

  const handleDownloadMaterial = async (mat: MaterialItem) => {
    setDownloadingId(mat.id);
    try {
      const res = await fetch(`/api/public/materials/${mat.id}/download`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setMaterials(prev => prev.map(m => m.id === mat.id ? { ...m, downloadCount: data.downloadCount } : m));
      }
    } catch (err) {
      console.error('Download tracking failed:', err);
    } finally {
      setDownloadingId(null);
      const link = document.createElement('a');
      link.href = mat.fileUrl;
      link.download = mat.fileName || `${mat.title.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const renderArticleContent = (text: string) => {
    if (!text) return null;
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let listItems: string[] = [];

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`ul-${elements.length}`} className="article-reader-list">
            {listItems.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        );
        listItems = [];
      }
    };

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) {
        flushList();
        return;
      }
      if (trimmed.startsWith('## ')) {
        flushList();
        elements.push(<h3 key={`h3-${idx}`} className="article-reader-subheading">{trimmed.replace(/^##\s+/, '')}</h3>);
      } else if (trimmed.startsWith('### ')) {
        flushList();
        elements.push(<h4 key={`h4-${idx}`} className="article-reader-subheading-sm">{trimmed.replace(/^###\s+/, '')}</h4>);
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        listItems.push(trimmed.replace(/^[-*]\s+/, ''));
      } else if (trimmed.startsWith('> ')) {
        flushList();
        elements.push(
          <blockquote key={`bq-${idx}`} className="article-reader-quote">
            {trimmed.replace(/^>\s+/, '')}
          </blockquote>
        );
      } else {
        flushList();
        elements.push(<p key={`p-${idx}`} className="article-reader-para">{trimmed}</p>);
      }
    });
    flushList();
    return elements;
  };

  // Smooth jump to specific stage
  const goToStep = useCallback((stepIndex: number) => {
    const targetStep = Math.max(0, Math.min(STAGES.length - 1, stepIndex));
    if (targetStep !== activeStepRef.current) {
      setScrollDirection(targetStep > activeStepRef.current ? 'down' : 'up');
    }
    setActiveStep(targetStep);
    isTransitioningRef.current = true;

    const viewportHeight = window.innerHeight || 800;
    const maxScroll = (STAGES.length - 1) * viewportHeight;
    const targetY = targetStep * viewportHeight;

    window.scrollTo({
      top: targetY,
      behavior: 'smooth'
    });

    const progress = maxScroll > 0 ? targetY / maxScroll : 0;
    setScrollProgress(progress);

    setTimeout(() => {
      isTransitioningRef.current = false;
    }, 650);
  }, []);

  // Window scroll listener: calculates active step when user scrolls or drags scrollbar
  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      if (isTransitioningRef.current) return;

      const scrollY = window.scrollY;
      const viewportHeight = window.innerHeight || 800;
      const maxScroll = (STAGES.length - 1) * viewportHeight;

      if (maxScroll <= 0) return;

      const progress = Math.min(1, Math.max(0, scrollY / maxScroll));
      setScrollProgress(progress);

      if (Math.abs(scrollY - lastScrollY) > 8) {
        setScrollDirection(scrollY > lastScrollY ? 'down' : 'up');
        lastScrollY = scrollY;
      }

      const calculatedStep = Math.min(
        STAGES.length - 1,
        Math.max(0, Math.round(progress * (STAGES.length - 1)))
      );

      if (calculatedStep !== activeStepRef.current) {
        setActiveStep(calculatedStep);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Wheel listener: intercepts wheel deltas to smoothly transition data cards
  useEffect(() => {
    let lastWheelTime = 0;

    const handleWheel = (e: WheelEvent) => {
      // If modal is active, allow normal scrolling inside modal
      if (selectedPosterRef.current || selectedPostRef.current) return;

      // Check if user is scrolling inside an internal scrollable element (e.g. posters grid)
      const target = e.target as HTMLElement | null;
      const scrollable = target?.closest('.allow-internal-scroll') as HTMLElement | null;
      if (scrollable && scrollable.scrollHeight > scrollable.clientHeight) {
        const atTop = scrollable.scrollTop <= 2 && e.deltaY < 0;
        const atBottom = scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight - 4 && e.deltaY > 0;
        if (!atTop && !atBottom) {
          return; // Let internal element scroll freely
        }
      }

      if (Math.abs(e.deltaY) < 18) return;

      const now = Date.now();
      if (now - lastWheelTime < 650) {
        e.preventDefault();
        return;
      }

      if (e.deltaY > 0) {
        // Scrolling down
        if (activeStepRef.current < STAGES.length - 1) {
          e.preventDefault();
          lastWheelTime = now;
          goToStep(activeStepRef.current + 1);
        }
      } else if (e.deltaY < 0) {
        // Scrolling up
        if (activeStepRef.current > 0) {
          e.preventDefault();
          lastWheelTime = now;
          goToStep(activeStepRef.current - 1);
        }
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [goToStep]);

  // Touch gesture listener for mobile swipe transitions
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (selectedPosterRef.current || selectedPostRef.current) return;
      touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (selectedPosterRef.current || selectedPostRef.current) return;
      const touchEndY = e.changedTouches[0].clientY;
      const deltaY = touchStartY.current - touchEndY;

      // Minimum swipe threshold
      if (Math.abs(deltaY) > 50) {
        if (deltaY > 0 && activeStepRef.current < STAGES.length - 1) {
          goToStep(activeStepRef.current + 1);
        } else if (deltaY < 0 && activeStepRef.current > 0) {
          goToStep(activeStepRef.current - 1);
        }
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [goToStep]);

  // Keyboard navigation (Arrow keys, PageUp/Down, Home, End, Space)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedPosterRef.current) {
        if (e.key === 'Escape') {
          setSelectedPoster(null);
        }
        return;
      }

      if (selectedPostRef.current) {
        if (e.key === 'Escape') {
          setSelectedPost(null);
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

      {/* 3. VIRTUAL SCROLL TRACK: ENABLES NATIVE SCROLLBAR & WHEEL DYNAMICS WHILE KEEPING BACKDROP STATIC */}
      <div className="landing-scroll-track" aria-hidden="true">
        {STAGES.map((s, idx) => (
          <div key={s.id} className="scroll-track-step" id={`scroll-anchor-${idx}`} />
        ))}
      </div>

      {/* 4. PINNED STAGE VIEWPORT: ONLY THE DATA THAT POPULATES CHANGES */}
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
                <span>Next: Articles & Insights</span>
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        </article>

        {/* ================= STAGE 3: CLINICAL ESSAYS & ARTICLES ================= */}
        <article
          id="stage-pane-3"
          data-stage-index="3"
          className={`stage-pane stage-articles ${getStageClass(3)}`}
          aria-hidden={activeStep !== 3}
        >
          <div className="stage-content-box allow-internal-scroll articles-content-box">
            <div className="stage-header-centered">
              <span className="stage-eyebrow-text">Psychoeducation & Clinical Guidance</span>
              <h2 className="stage-heading">Articles, Reflections & Mental Health Insights</h2>
              <p className="stage-subheading">
                Compassionate, evidence-informed guidance on anxiety, somatic regulation, emotional balance,
                and personal boundaries authored by Dr. Hana Almaz.
              </p>
            </div>

            {/* Category Filter Tabs */}
            {postCategories.length > 1 && (
              <div className="category-pills-row">
                {postCategories.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    className={`cat-pill-btn ${activePostCategory === cat ? 'active' : ''}`}
                    onClick={() => setActivePostCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {/* Articles Deck / Cards Grid */}
            <div className="articles-deck">
              {filteredPosts.length === 0 ? (
                <div className="articles-empty-card">
                  <BookOpen className="w-8 h-8 text-muted mb-2" />
                  <p>No articles found under "{activePostCategory}".</p>
                  <span className="empty-subtext">Check back soon as Dr. Hana frequently shares clinical notes and reflections.</span>
                </div>
              ) : (
                filteredPosts.map(post => (
                  <article
                    key={post.id}
                    className="article-card-interactive"
                    onClick={() => setSelectedPost(post)}
                  >
                    <div className="article-card-header">
                      <span className="article-card-category">{post.category}</span>
                      <span className="article-card-readtime">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{post.readTimeMin || 5} min read</span>
                      </span>
                    </div>

                    <h3 className="article-card-title">{post.title}</h3>
                    <p className="article-card-excerpt">{post.excerpt}</p>

                    <div className="article-card-footer">
                      <div className="article-author-info">
                        <span className="author-avatar-dot" />
                        <span className="author-name-text">{post.authorName || 'Dr. Hana Almaz'}</span>
                      </div>
                      <button type="button" className="article-read-btn">
                        <span>Read Article</span>
                        <ChevronDown className="w-3.5 h-3.5 -rotate-90" />
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
                onClick={() => goToStep(4)}
              >
                <span>Next: Clinical Tools & Downloads</span>
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        </article>

        {/* ================= STAGE 4: CLINICAL MATERIALS & DOWNLOADS ================= */}
        <article
          id="stage-pane-4"
          data-stage-index="4"
          className={`stage-pane stage-materials ${getStageClass(4)}`}
          aria-hidden={activeStep !== 4}
        >
          <div className="stage-content-box allow-internal-scroll materials-content-box">
            <div className="stage-header-centered">
              <span className="stage-eyebrow-text">Evidence-Based Self-Reflection</span>
              <h2 className="stage-heading">Clinical Worksheets, Guides & Protocols</h2>
              <p className="stage-subheading">
                Complimentary psychoeducational exercises, somatic grounding protocols, and CBT thought records
                freely downloadable to reinforce therapeutic progress.
              </p>
            </div>

            {/* Category Filter Tabs */}
            {materialCategories.length > 1 && (
              <div className="category-pills-row">
                {materialCategories.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    className={`cat-pill-btn ${activeMaterialCategory === cat ? 'active' : ''}`}
                    onClick={() => setActiveMaterialCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {/* Materials Grid */}
            <div className="materials-deck">
              {filteredMaterials.length === 0 ? (
                <div className="materials-empty-card">
                  <FileText className="w-8 h-8 text-muted mb-2" />
                  <p>No materials currently available under "{activeMaterialCategory}".</p>
                  <span className="empty-subtext">Clinical resources are updated alongside workshop modules.</span>
                </div>
              ) : (
                filteredMaterials.map(mat => (
                  <div key={mat.id} className="material-card-interactive">
                    <div className="material-card-top">
                      <div className="material-type-icon">
                        <FileDown className="w-5 h-5 text-emerald" />
                      </div>
                      <div className="material-meta-tag">
                        <span className="material-category-badge">{mat.category}</span>
                        <span className="material-size-badge">{formatFileSize(mat.fileSize)}</span>
                      </div>
                    </div>

                    <h3 className="material-card-title">{mat.title}</h3>
                    <p className="material-card-desc">{mat.description}</p>

                    <div className="material-card-actions">
                      <div className="material-stats">
                        <Download className="w-3.5 h-3.5 text-muted" />
                        <span>{mat.downloadCount || 0} downloads</span>
                      </div>
                      <button
                        type="button"
                        className="btn-material-download"
                        onClick={() => handleDownloadMaterial(mat)}
                        disabled={downloadingId === mat.id}
                      >
                        <Download className="w-4 h-4" />
                        <span>{downloadingId === mat.id ? 'Downloading...' : 'Download PDF'}</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="stage-step-actions text-center mt-4">
              <button
                type="button"
                className="btn-secondary-action"
                onClick={() => goToStep(5)}
              >
                <span>Next: In-Person Sanctuary Details</span>
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        </article>

        {/* ================= STAGE 5: IN-PERSON SANCTUARY & PRACTICE STANDARDS ================= */}
        <article
          id="stage-pane-5"
          data-stage-index="5"
          className={`stage-pane stage-sanctuary ${getStageClass(5)}`}
          aria-hidden={activeStep !== 5}
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
                onClick={() => goToStep(6)}
              >
                <span>Next: Care Support & Booking</span>
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        </article>

        {/* ================= STAGE 6: CARE NETWORK & EMERGENCY SUPPORT ================= */}
        <article
          id="stage-pane-6"
          data-stage-index="6"
          className={`stage-pane stage-support ${getStageClass(6)}`}
          aria-hidden={activeStep !== 6}
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

      {/* 8. ARTICLE READER MODAL OVERLAY */}
      {selectedPost && (
        <div
          className="article-modal-overlay"
          onClick={() => setSelectedPost(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="article-modal-title"
        >
          <div className="article-modal-card allow-internal-scroll" onClick={e => e.stopPropagation()}>
            <header className="article-modal-header">
              <div className="article-modal-meta">
                <span className="modal-category-chip">{selectedPost.category}</span>
                <span className="modal-readtime-chip">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{selectedPost.readTimeMin || 5} min read</span>
                </span>
                {selectedPost.publishedAt && (
                  <span className="modal-date-chip">
                    {new Date(selectedPost.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                )}
              </div>

              <button
                type="button"
                className="article-modal-close-btn"
                onClick={() => setSelectedPost(null)}
                aria-label="Close article"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            <h1 id="article-modal-title" className="article-modal-headline">{selectedPost.title}</h1>

            <div className="article-modal-byline">
              <div className="byline-avatar">HA</div>
              <div>
                <strong className="byline-author">{selectedPost.authorName || 'Dr. Hana Almaz'}</strong>
                <span className="byline-title">Licensed Clinical Psychologist · Addis Ababa</span>
              </div>
            </div>

            {selectedPost.excerpt && (
              <div className="article-modal-lead">
                <Quote className="w-5 h-5 text-emerald inline-block mr-2" />
                {selectedPost.excerpt}
              </div>
            )}

            <div className="article-modal-body">
              {renderArticleContent(selectedPost.content)}
            </div>

            <footer className="article-modal-footer">
              <div className="modal-footer-callout">
                <h4>In-Person Guidance in Addis Ababa</h4>
                <p>If you find resonance in this reflection, Dr. Hana offers dedicated 60-minute therapeutic consultations in Bulgaria Corridor.</p>
              </div>
              <div className="modal-footer-btns">
                <button
                  type="button"
                  className="btn-primary-action"
                  onClick={() => {
                    setSelectedPost(null);
                    onBook();
                  }}
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  <span>Book Consultation with Dr. Hana</span>
                </button>
                <button
                  type="button"
                  className="btn-secondary-action"
                  onClick={() => setSelectedPost(null)}
                >
                  <span>Done Reading</span>
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
