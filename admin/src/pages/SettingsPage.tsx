import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Clock, 
  CreditCard, 
  Image as ImageIcon, 
  Plus, 
  Trash2, 
  Check, 
  Upload, 
  AlertCircle,
  Calendar as CalendarIcon,
  Flag,
  Palette,
  GitCommit,
  Lock
} from 'lucide-react';
import VersionBadge from '../components/VersionBadge';
import { useTheme } from '../context/ThemeContext';

interface TrainingPoster {
  id: string;
  title: string;
  date: string;
  category: 'latest' | 'previous';
  imageUrl: string;
  description: string;
}

interface PaymentAccount {
  id: string;
  provider: string;
  accountNumber: string;
  holderName: string;
  instructions?: string;
  active: boolean;
}

interface HolidayItem {
  id: number;
  date: string;
  name: string;
  active: boolean;
}

function getLuminance(hex: string): number {
  const c = hex.replace('#', '');
  if (c.length !== 6) return 0.5;
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'shift' | 'policies' | 'posters' | 'payments' | 'holidays' | 'system'>('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { accentColor, setAccentColor, presets } = useTheme();

  // Profile & Landing Page Data
  const [practiceName, setPracticeName] = useState("Mentalweg Psychology Practice");
  const [iconUrl, setIconUrl] = useState("");
  const [quote, setQuote] = useState("Healing begins when we find a space to speak without fear of judgment.");
  const [quoteAuthor, setQuoteAuthor] = useState("Dr. Hana Almaz, Clinical Psychologist");
  const [bio, setBio] = useState("A dedicated, confidential therapeutic practice providing compassionate clinical care and psychoeducation in Addis Ababa.");
  const [locationText, setLocationText] = useState("Bulgaria area, near the African Union, Addis Ababa");

  // Shift & Hours Data
  const [shiftStart, setShiftStart] = useState("09:00");
  const [shiftEnd, setShiftEnd] = useState("16:00");
  const [hourlyRateEtb, setHourlyRateEtb] = useState(1200);
  const [schedulingFeePercent, setSchedulingFeePercent] = useState(25);
  const [bufferMin, setBufferMin] = useState(10);
  const [holdDurationMin, setHoldDurationMin] = useState(20);
  const [workingHours, setWorkingHours] = useState<Record<string, Array<{ start: string; end: string }>>>({
    '1': [{ start: '09:00', end: '16:00' }],
    '2': [{ start: '09:00', end: '16:00' }],
    '3': [{ start: '09:00', end: '16:00' }],
    '4': [{ start: '09:00', end: '16:00' }],
    '5': [{ start: '09:00', end: '16:00' }],
    '6': [{ start: '09:00', end: '13:00' }],
  });

  // Cancellation & Reschedule Policies
  const [rescheduleLeadTimeDays, setRescheduleLeadTimeDays] = useState(7);
  const [rescheduleWindowWeeks, setRescheduleWindowWeeks] = useState(4);
  const [allowClientCancellation, setAllowClientCancellation] = useState(false);
  const [cancellationPolicyText, setCancellationPolicyText] = useState("Appointments cannot be rescheduled or cancelled within 7 days of the scheduled time. For urgent adjustments, please contact the practice directly.");

  // Training Posters
  const [posters, setPosters] = useState<TrainingPoster[]>([]);
  const [newPosterModal, setNewPosterModal] = useState(false);
  const [posterForm, setPosterForm] = useState<TrainingPoster>({
    id: '',
    title: '',
    date: '',
    category: 'latest',
    imageUrl: '',
    description: '',
  });

  // Payment Accounts
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);

  // Holidays
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');
  const [holidaySaving, setHolidaySaving] = useState(false);

  // Load current settings & holidays from backend
  const loadHolidays = () => {
    fetch('/api/admin/holidays')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setHolidays(data);
      })
      .catch(console.error);
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/admin/settings').then(r => r.json()),
      fetch('/api/admin/holidays').then(r => r.json()).catch(() => [])
    ])
      .then(([data, holis]) => {
        if (data) {
          if (data.practiceName) setPracticeName(data.practiceName);
          if (data.iconUrl) setIconUrl(data.iconUrl);
          if (data.accentColor) setAccentColor(data.accentColor);
          if (data.quote) setQuote(data.quote);
          if (data.quoteAuthor) setQuoteAuthor(data.quoteAuthor);
          if (data.bio) setBio(data.bio);
          if (data.locationText) setLocationText(data.locationText);
          if (data.shiftStart) setShiftStart(data.shiftStart);
          if (data.shiftEnd) setShiftEnd(data.shiftEnd);
          if (data.hourlyRateEtb) setHourlyRateEtb(data.hourlyRateEtb);
          if (data.schedulingFeePercent) setSchedulingFeePercent(data.schedulingFeePercent);
          if (data.bufferMin) setBufferMin(data.bufferMin);
          if (data.holdDurationMin) setHoldDurationMin(data.holdDurationMin);
          if (data.rescheduleLeadTimeDays !== undefined) setRescheduleLeadTimeDays(data.rescheduleLeadTimeDays);
          if (data.rescheduleWindowWeeks !== undefined) setRescheduleWindowWeeks(data.rescheduleWindowWeeks);
          if (data.allowClientCancellation !== undefined) setAllowClientCancellation(data.allowClientCancellation);
          if (data.cancellationPolicyText) setCancellationPolicyText(data.cancellationPolicyText);
          if (data.workingHours) setWorkingHours(data.workingHours);
          if (data.trainingPosters) setPosters(data.trainingPosters);
          if (data.paymentAccounts) setAccounts(data.paymentAccounts);
        }
        if (Array.isArray(holis)) {
          setHolidays(holis);
        }
        setLoading(false);
      })
      .catch(err => {
        setErrorMessage('Failed to load settings: ' + err.message);
        setLoading(false);
      });
  }, []);

  // Save Settings
  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    setErrorMessage(null);

    try {
      const payload = {
        practiceName,
        iconUrl,
        accentColor,
        quote,
        quoteAuthor,
        bio,
        locationText,
        shiftStart,
        shiftEnd,
        hourlyRateEtb,
        schedulingFeePercent,
        bufferMin,
        holdDurationMin,
        rescheduleLeadTimeDays,
        rescheduleWindowWeeks,
        allowClientCancellation,
        cancellationPolicyText,
        workingHours,
        trainingPosters: posters,
        paymentAccounts: accounts,
      };

      let res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok && res.status === 404) {
        res = await fetch('/api/admin/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        setSaveMessage('All practice CMS settings saved and synchronized live.');
        setTimeout(() => setSaveMessage(null), 4000);
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMessage(err.error || `Failed to save settings (Status ${res.status}).`);
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'Network error while saving settings.');
    } finally {
      setSaving(false);
    }
  };

  // Preload Ethiopian Holidays
  const handlePreloadEthiopianHolidays = async () => {
    try {
      const res = await fetch('/api/admin/holidays/preload', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setHolidays(data.holidays || []);
        setSaveMessage('Standard Ethiopian public holidays preloaded successfully.');
        setTimeout(() => setSaveMessage(null), 4000);
      }
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  // Add Custom Holiday
  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolidayDate || !newHolidayName) return;

    setHolidaySaving(true);
    try {
      const res = await fetch('/api/admin/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: newHolidayDate, name: newHolidayName }),
      });
      if (res.ok) {
        setNewHolidayDate('');
        setNewHolidayName('');
        loadHolidays();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to add holiday');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setHolidaySaving(false);
    }
  };

  // Delete Holiday
  const handleDeleteHoliday = async (id: number) => {
    if (!confirm('Remove this holiday date?')) return;
    try {
      const res = await fetch(`/api/admin/holidays/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setHolidays(holidays.filter(h => h.id !== id));
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Upload image helper
  const handleFileUpload = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          const res = await fetch('/api/admin/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: base64, fileName: file.name }),
          });
          const data = await res.json();
          if (res.ok && data.url) {
            resolve(data.url);
          } else {
            reject(new Error(data.error || 'Upload failed'));
          }
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  // Add Poster
  const handleAddPoster = (e: React.FormEvent) => {
    e.preventDefault();
    if (!posterForm.title || !posterForm.imageUrl) {
      alert('Title and Image URL are required.');
      return;
    }
    const newPoster: TrainingPoster = {
      ...posterForm,
      id: `poster-${Date.now()}`,
    };
    setPosters([newPoster, ...posters]);
    setNewPosterModal(false);
    setPosterForm({ id: '', title: '', date: '', category: 'latest', imageUrl: '', description: '' });
  };

  const handleDeletePoster = (id: string) => {
    if (confirm('Delete this training poster?')) {
      setPosters(posters.filter(p => p.id !== id));
    }
  };

  const weekDayNames = [
    { key: '1', name: 'Monday' },
    { key: '2', name: 'Tuesday' },
    { key: '3', name: 'Wednesday' },
    { key: '4', name: 'Thursday' },
    { key: '5', name: 'Friday' },
    { key: '6', name: 'Saturday' },
    { key: '0', name: 'Sunday' },
  ];

  const isLowContrast = getLuminance(accentColor) > 0.65;

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--mut)' }}>
        <p>Loading CMS settings...</p>
      </div>
    );
  }

  return (
    <div className="admin-cms-page" style={{ padding: '1.5rem', maxWidth: '1000px', margin: '0 auto' }}>
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '24px', margin: '0 0 6px', color: 'var(--ink)' }}>Practice CMS & Settings</h1>
        <p style={{ margin: 0, color: 'var(--mut)', fontSize: '14px' }}>
          Control landing page branding, color palette, shift hours, training posters, receiving payment accounts, and holidays.
        </p>
      </header>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--line)', paddingBottom: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveTab('profile')}
          style={{
            background: activeTab === 'profile' ? 'var(--acc)' : 'var(--card)',
            color: activeTab === 'profile' ? '#fff' : 'var(--ink)',
            border: '1px solid var(--line)',
            padding: '8px 16px',
            borderRadius: '20px',
            cursor: 'pointer',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Sparkles className="w-4 h-4" /> Branding & Color Palette
        </button>

        <button
          onClick={() => setActiveTab('shift')}
          style={{
            background: activeTab === 'shift' ? 'var(--acc)' : 'var(--card)',
            color: activeTab === 'shift' ? '#fff' : 'var(--ink)',
            border: '1px solid var(--line)',
            padding: '8px 16px',
            borderRadius: '20px',
            cursor: 'pointer',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Clock className="w-4 h-4" /> Shift Times & Hours
        </button>

        <button
          onClick={() => setActiveTab('policies')}
          style={{
            background: activeTab === 'policies' ? 'var(--acc)' : 'var(--card)',
            color: activeTab === 'policies' ? '#fff' : 'var(--ink)',
            border: '1px solid var(--line)',
            padding: '8px 16px',
            borderRadius: '20px',
            cursor: 'pointer',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Lock className="w-4 h-4" /> Reschedule & Cancellation Rules
        </button>

        <button
          onClick={() => setActiveTab('posters')}
          style={{
            background: activeTab === 'posters' ? 'var(--acc)' : 'var(--card)',
            color: activeTab === 'posters' ? '#fff' : 'var(--ink)',
            border: '1px solid var(--line)',
            padding: '8px 16px',
            borderRadius: '20px',
            cursor: 'pointer',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <ImageIcon className="w-4 h-4" /> Training Posters ({posters.length})
        </button>

        <button
          onClick={() => setActiveTab('payments')}
          style={{
            background: activeTab === 'payments' ? 'var(--acc)' : 'var(--card)',
            color: activeTab === 'payments' ? '#fff' : 'var(--ink)',
            border: '1px solid var(--line)',
            padding: '8px 16px',
            borderRadius: '20px',
            cursor: 'pointer',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <CreditCard className="w-4 h-4" /> Payment Accounts ({accounts.length})
        </button>

        <button
          onClick={() => setActiveTab('holidays')}
          style={{
            background: activeTab === 'holidays' ? 'var(--acc)' : 'var(--card)',
            color: activeTab === 'holidays' ? '#fff' : 'var(--ink)',
            border: '1px solid var(--line)',
            padding: '8px 16px',
            borderRadius: '20px',
            cursor: 'pointer',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <CalendarIcon className="w-4 h-4" /> Holidays & Days Off ({holidays.length})
        </button>

        <button
          onClick={() => setActiveTab('system')}
          style={{
            background: activeTab === 'system' ? 'var(--acc)' : 'var(--card)',
            color: activeTab === 'system' ? '#fff' : 'var(--ink)',
            border: '1px solid var(--line)',
            padding: '8px 16px',
            borderRadius: '20px',
            cursor: 'pointer',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <GitCommit className="w-4 h-4" /> System & Git Version
        </button>
      </div>

      {saveMessage && (
        <div style={{ background: 'var(--accbg)', border: '1px solid var(--acc)', color: 'var(--acct)', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Check className="w-5 h-5" />
          <span>{saveMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle className="w-5 h-5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* TAB 1: LANDING PAGE & BRANDING */}
      {activeTab === 'profile' && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', padding: '1.75rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '18px', marginTop: 0, marginBottom: '1.25rem', color: 'var(--ink)' }}>Clinical Identity & Color Palette</h2>

          {/* COLOR PALETTE SELECTOR CARD */}
          <div style={{ background: 'var(--off)', border: '1px solid var(--line)', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Palette className="w-4 h-4" style={{ color: 'var(--acc)' }} />
              <label className="admin-label" style={{ margin: 0 }}>Practice Accent Palette</label>
            </div>
            <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--mut)' }}>
              Selecting an accent color immediately customizes the admin dashboard and public appointment portal.
            </p>

            {/* Curated Presets */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '1rem' }}>
              {presets.map(p => {
                const isSelected = accentColor.toLowerCase() === p.hex.toLowerCase();
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setAccentColor(p.hex)}
                    style={{
                      background: 'var(--card)',
                      border: `2px solid ${isSelected ? 'var(--acc)' : 'var(--line)'}`,
                      borderRadius: '8px',
                      padding: '8px 10px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: '6px',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 0 0 3px var(--acc-glow)' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
                      <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: p.hex, display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.name}
                      </span>
                    </div>
                    <span style={{ fontSize: '10px', color: 'var(--mut)', lineHeight: 1.2 }}>
                      {p.hex}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Custom Hex & Color Picker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="color"
                  value={accentColor}
                  onChange={e => setAccentColor(e.target.value)}
                  style={{ width: '42px', height: '38px', padding: '2px', border: '1px solid var(--input-border)', borderRadius: '8px', cursor: 'pointer', background: 'var(--card)' }}
                  title="Pick custom color"
                />
                <input
                  type="text"
                  value={accentColor}
                  onChange={e => setAccentColor(e.target.value)}
                  className="admin-input"
                  style={{ width: '110px', fontFamily: 'monospace', fontWeight: 600 }}
                  placeholder="#24574a"
                />
              </div>

              {/* Interactive Live Preview Box */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', color: 'var(--mut)', fontWeight: 600 }}>LIVE PREVIEW:</span>
                <button
                  type="button"
                  style={{ background: 'var(--acc)', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}
                >
                  Action
                </button>
                <span style={{ background: 'var(--accbg)', color: 'var(--acct)', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>
                  Confirmed
                </span>
                <span style={{ fontSize: '12px', color: 'var(--acc)', fontWeight: 700 }}>
                  ETB 1,200
                </span>
              </div>
            </div>

            {isLowContrast && (
              <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertCircle className="w-4 h-4" />
                <span>Notice: This shade has high brightness. In light mode, ensure adequate contrast for white button text.</span>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '1.5rem' }}>
            <div className="admin-form-group">
              <label className="admin-label">Practice Name</label>
              <input
                type="text"
                value={practiceName}
                onChange={e => setPracticeName(e.target.value)}
                className="admin-input"
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-label">Practice Icon / Logo URL</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="https://... or upload file"
                  value={iconUrl}
                  onChange={e => setIconUrl(e.target.value)}
                  className="admin-input"
                  style={{ flex: 1 }}
                />
                <label style={{ padding: '8px 14px', background: 'var(--off)', border: '1px solid var(--line)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
                  <Upload className="w-4 h-4 mr-1.5 inline" /> Upload
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          const url = await handleFileUpload(file);
                          setIconUrl(url);
                        } catch (err: any) {
                          alert('Upload error: ' + err.message);
                        }
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="admin-form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="admin-label">Practitioner Quotation (Featured on Landing Page)</label>
            <textarea
              rows={3}
              value={quote}
              onChange={e => setQuote(e.target.value)}
              className="admin-textarea"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '1.5rem' }}>
            <div className="admin-form-group">
              <label className="admin-label">Quote Author / Clinical Title</label>
              <input
                type="text"
                value={quoteAuthor}
                onChange={e => setQuoteAuthor(e.target.value)}
                className="admin-input"
              />
            </div>
            <div className="admin-form-group">
              <label className="admin-label">Location Directions</label>
              <input
                type="text"
                value={locationText}
                onChange={e => setLocationText(e.target.value)}
                className="admin-input"
              />
            </div>
          </div>

          <div className="admin-form-group" style={{ marginBottom: '1rem' }}>
            <label className="admin-label">Bio / Clinical Philosophy</label>
            <textarea
              rows={3}
              value={bio}
              onChange={e => setBio(e.target.value)}
              className="admin-textarea"
            />
          </div>
        </div>
      )}

      {/* TAB 2: SHIFT TIMES & WORKING HOURS */}
      {activeTab === 'shift' && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', padding: '1.75rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '18px', marginTop: 0, marginBottom: '1.25rem', color: 'var(--ink)' }}>Shift Times & Scheduling Rules</h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '1.75rem', background: 'var(--off)', padding: '1.25rem', borderRadius: '10px', border: '1px solid var(--line)' }}>
            <div>
              <label className="admin-label">Standard Shift Start</label>
              <input
                type="time"
                value={shiftStart}
                onChange={e => setShiftStart(e.target.value)}
                className="admin-input"
              />
              <span style={{ fontSize: '12px', color: 'var(--mut)', marginTop: '4px', display: 'block' }}>Default: 09:00 AM</span>
            </div>

            <div>
              <label className="admin-label">Standard Shift End</label>
              <input
                type="time"
                value={shiftEnd}
                onChange={e => setShiftEnd(e.target.value)}
                className="admin-input"
              />
              <span style={{ fontSize: '12px', color: 'var(--mut)', marginTop: '4px', display: 'block' }}>Default: 04:00 PM (16:00)</span>
            </div>

            <div>
              <label className="admin-label">Hourly Session Rate (ETB)</label>
              <input
                type="number"
                value={hourlyRateEtb}
                onChange={e => setHourlyRateEtb(Number(e.target.value))}
                className="admin-input"
              />
            </div>

            <div>
              <label className="admin-label">Scheduling Fee (%)</label>
              <input
                type="number"
                value={schedulingFeePercent}
                onChange={e => setSchedulingFeePercent(Number(e.target.value))}
                className="admin-input"
              />
              <span style={{ fontSize: '12px', color: 'var(--acc)', fontWeight: 600, marginTop: '4px', display: 'block' }}>
                Upfront Fee: ETB {Math.round(hourlyRateEtb * (schedulingFeePercent / 100))}
              </span>
            </div>
          </div>

          <h3 style={{ fontSize: '16px', marginBottom: '10px', color: 'var(--ink)' }}>Weekly Working Hours Schedule</h3>
          <div style={{ border: '1px solid var(--line)', borderRadius: '8px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--card)' }}>
              <thead>
                <tr style={{ background: 'var(--off)', borderBottom: '1px solid var(--line)', textAlign: 'left', color: 'var(--mut)', fontSize: '13px' }}>
                  <th style={{ padding: '10px 14px' }}>Day</th>
                  <th style={{ padding: '10px 14px' }}>Active?</th>
                  <th style={{ padding: '10px 14px' }}>Start</th>
                  <th style={{ padding: '10px 14px' }}>End</th>
                </tr>
              </thead>
              <tbody>
                {weekDayNames.map(wd => {
                  const daySlot = (workingHours[wd.key] && workingHours[wd.key][0]) || null;
                  const isActive = daySlot !== null;

                  return (
                    <tr key={wd.key} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>{wd.name}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <input
                          type="checkbox"
                          checked={isActive}
                          onChange={e => {
                            const updated = { ...workingHours };
                            if (e.target.checked) {
                              updated[wd.key] = [{ start: shiftStart, end: shiftEnd }];
                            } else {
                              delete updated[wd.key];
                            }
                            setWorkingHours(updated);
                          }}
                        />
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <input
                          type="time"
                          disabled={!isActive}
                          value={daySlot?.start || shiftStart}
                          onChange={e => {
                            const updated = { ...workingHours };
                            if (updated[wd.key] && updated[wd.key][0]) {
                              updated[wd.key][0].start = e.target.value;
                              setWorkingHours(updated);
                            }
                          }}
                          className="admin-input"
                          style={{ maxWidth: '140px', padding: '6px 10px', opacity: isActive ? 1 : 0.4 }}
                        />
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <input
                          type="time"
                          disabled={!isActive}
                          value={daySlot?.end || shiftEnd}
                          onChange={e => {
                            const updated = { ...workingHours };
                            if (updated[wd.key] && updated[wd.key][0]) {
                              updated[wd.key][0].end = e.target.value;
                              setWorkingHours(updated);
                            }
                          }}
                          className="admin-input"
                          style={{ maxWidth: '140px', padding: '6px 10px', opacity: isActive ? 1 : 0.4 }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: CANCELLATION & RESCHEDULE POLICIES */}
      {activeTab === 'policies' && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', padding: '1.75rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '18px', margin: '0 0 6px', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock className="w-5 h-5 text-acc" /> Cancellation & Rescheduling Governance
            </h2>
            <p style={{ margin: 0, color: 'var(--mut)', fontSize: '14px', lineHeight: 1.5 }}>
              Define when client self-service rescheduling and cancellations become inactive. As the therapist/admin, you can always manually move or cancel any appointment directly from your Calendar at any time.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '1.5rem' }}>
            {/* Cutoff Lead Time */}
            <div style={{ background: 'var(--off)', padding: '1.25rem', borderRadius: '10px', border: '1px solid var(--line)' }}>
              <label className="admin-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 700 }}>
                <Lock className="w-4 h-4 text-acc" /> Cutoff Lead Time (Lock Threshold)
              </label>
              <p style={{ fontSize: '12px', color: 'var(--mut)', margin: '4px 0 12px' }}>
                Appointments within this window cannot be rescheduled or cancelled online by clients. The action becomes inactive.
              </p>
              
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                {[
                  { days: 3, label: '3 Days (72h)' },
                  { days: 7, label: '7 Days (1 Wk)' },
                  { days: 14, label: '14 Days (2 Wks)' }
                ].map(preset => (
                  <button
                    key={preset.days}
                    type="button"
                    onClick={() => setRescheduleLeadTimeDays(preset.days)}
                    style={{
                      background: rescheduleLeadTimeDays === preset.days ? 'var(--acc)' : 'var(--card)',
                      color: rescheduleLeadTimeDays === preset.days ? '#fff' : 'var(--ink)',
                      border: '1px solid var(--line)',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={rescheduleLeadTimeDays}
                  onChange={e => setRescheduleLeadTimeDays(Math.max(0, parseInt(e.target.value) || 0))}
                  className="admin-input"
                  style={{ width: '90px', fontWeight: 700 }}
                />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>Days before appointment</span>
              </div>
            </div>

            {/* Reschedule Horizon Window */}
            <div style={{ background: 'var(--off)', padding: '1.25rem', borderRadius: '10px', border: '1px solid var(--line)' }}>
              <label className="admin-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 700 }}>
                <CalendarIcon className="w-4 h-4 text-acc" /> Maximum Reschedule Forward Window
              </label>
              <p style={{ fontSize: '12px', color: 'var(--mut)', margin: '4px 0 12px' }}>
                How far into the future a verified client can move their session.
              </p>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                {[
                  { weeks: 2, label: '2 Weeks' },
                  { weeks: 4, label: '4 Weeks' },
                  { weeks: 8, label: '8 Weeks' }
                ].map(preset => (
                  <button
                    key={preset.weeks}
                    type="button"
                    onClick={() => setRescheduleWindowWeeks(preset.weeks)}
                    style={{
                      background: rescheduleWindowWeeks === preset.weeks ? 'var(--acc)' : 'var(--card)',
                      color: rescheduleWindowWeeks === preset.weeks ? '#fff' : 'var(--ink)',
                      border: '1px solid var(--line)',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={rescheduleWindowWeeks}
                  onChange={e => setRescheduleWindowWeeks(Math.max(1, parseInt(e.target.value) || 1))}
                  className="admin-input"
                  style={{ width: '90px', fontWeight: 700 }}
                />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>Weeks into the future</span>
              </div>
            </div>
          </div>

          {/* Cancellation Permission Toggle */}
          <div style={{ background: 'var(--off)', padding: '1.25rem', borderRadius: '10px', border: '1px solid var(--line)', marginBottom: '1.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', margin: 0 }}>
              <input
                type="checkbox"
                checked={allowClientCancellation}
                onChange={e => setAllowClientCancellation(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--acc)' }}
              />
              <div>
                <strong style={{ fontSize: '14px', color: 'var(--ink)' }}>
                  Allow Verified Clients to Directly Cancel Online (Outside Cutoff)
                </strong>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--mut)' }}>
                  Default is disabled: clients can only reschedule or must contact you directly to cancel. This prevents sudden empty slots.
                </p>
              </div>
            </label>
          </div>

          {/* Policy Text & Client Banner Preview */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label className="admin-label">
              Policy Message Displayed to Clients (Shown when within cutoff or upon lock)
            </label>
            <textarea
              rows={2}
              value={cancellationPolicyText}
              onChange={e => setCancellationPolicyText(e.target.value)}
              className="admin-textarea"
              style={{ minHeight: '70px', marginBottom: '12px' }}
            />

            {/* Live Client Portal Preview */}
            <div style={{ border: '1px dashed var(--line)', borderRadius: '10px', padding: '14px', background: 'var(--card)' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>
                Client Portal Preview (When inside {rescheduleLeadTimeDays}-day lock threshold)
              </span>
              <div style={{ background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: '8px', padding: '12px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <Lock className="w-5 h-5" style={{ color: '#c53030', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ fontSize: '13px', color: '#9b2c2c', display: 'block' }}>
                    Rescheduling & Cancellation Inactive
                  </strong>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#742a2a', lineHeight: 1.4 }}>
                    {cancellationPolicyText || `Appointments cannot be rescheduled or cancelled within ${rescheduleLeadTimeDays} days of the scheduled time. Please contact the practice directly.`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TRAINING POSTERS */}
      {activeTab === 'posters' && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', padding: '1.75rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h2 style={{ fontSize: '18px', margin: 0, color: 'var(--ink)' }}>Training Posters & Workshops</h2>
              <p style={{ margin: '4px 0 0', color: 'var(--mut)', fontSize: '13px' }}>
                Manage latest training announcements and previous workshop posters shown on the landing page.
              </p>
            </div>
            <button
              onClick={() => setNewPosterModal(true)}
              style={{
                background: 'var(--acc)',
                color: '#fff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Plus className="w-4 h-4" /> Add New Poster
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
            {posters.map(p => (
              <div key={p.id} style={{ border: '1px solid var(--line)', borderRadius: '10px', overflow: 'hidden', background: 'var(--card)', display: 'flex', flexDirection: 'column' }}>
                <img src={p.imageUrl} alt={p.title} style={{ width: '100%', height: '160px', objectFit: 'cover' }} />
                <div style={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: p.category === 'latest' ? 'var(--acc)' : 'var(--mut)' }}>
                      {p.category.toUpperCase()} · {p.date}
                    </span>
                    <button
                      onClick={() => handleDeletePoster(p.id)}
                      style={{ background: 'transparent', border: 'none', color: '#c53030', cursor: 'pointer', padding: 0 }}
                      title="Delete poster"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <h4 style={{ margin: '0 0 6px', fontSize: '15px', color: 'var(--ink)' }}>{p.title}</h4>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--mut)', flex: 1 }}>{p.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* New Poster Modal */}
          {newPosterModal && (
            <div className="admin-modal-backdrop">
              <div className="admin-modal-card" style={{ padding: '2rem', maxWidth: '520px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
                <h3 style={{ margin: '0 0 1rem', color: 'var(--ink)' }}>Add New Training Poster</h3>
                <form onSubmit={handleAddPoster}>
                  <div className="admin-form-group">
                    <label className="admin-label">Title</label>
                    <input
                      type="text"
                      required
                      value={posterForm.title}
                      onChange={e => setPosterForm({ ...posterForm, title: e.target.value })}
                      className="admin-input"
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '1rem' }}>
                    <div>
                      <label className="admin-label">Date / Period</label>
                      <input
                        type="text"
                        placeholder="e.g. Nov 2026"
                        required
                        value={posterForm.date}
                        onChange={e => setPosterForm({ ...posterForm, date: e.target.value })}
                        className="admin-input"
                      />
                    </div>
                    <div>
                      <label className="admin-label">Category</label>
                      <select
                        value={posterForm.category}
                        onChange={e => setPosterForm({ ...posterForm, category: e.target.value as any })}
                        className="admin-select"
                      >
                        <option value="latest">Latest Poster</option>
                        <option value="previous">Previous Workshop</option>
                      </select>
                    </div>
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-label">Poster Image URL</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="https://... or upload image"
                        required
                        value={posterForm.imageUrl}
                        onChange={e => setPosterForm({ ...posterForm, imageUrl: e.target.value })}
                        className="admin-input"
                        style={{ flex: 1 }}
                      />
                      <label style={{ padding: '8px 12px', background: 'var(--off)', border: '1px solid var(--line)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '13px', fontWeight: 600 }}>
                        <Upload className="w-4 h-4 mr-1 inline" />
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                const url = await handleFileUpload(file);
                                setPosterForm({ ...posterForm, imageUrl: url });
                              } catch (err: any) {
                                alert('Upload error: ' + err.message);
                              }
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="admin-form-group" style={{ marginBottom: '1.5rem' }}>
                    <label className="admin-label">Workshop Description</label>
                    <textarea
                      rows={3}
                      value={posterForm.description}
                      onChange={e => setPosterForm({ ...posterForm, description: e.target.value })}
                      className="admin-textarea"
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button type="button" onClick={() => setNewPosterModal(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--ink)', cursor: 'pointer' }}>
                      Cancel
                    </button>
                    <button type="submit" style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--acc)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                      Add Poster
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PAYMENT ACCOUNTS */}
      {activeTab === 'payments' && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', padding: '1.75rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h2 style={{ fontSize: '18px', margin: 0, color: 'var(--ink)' }}>Receiving Payment Accounts</h2>
              <p style={{ color: 'var(--mut)', fontSize: '13px', margin: '4px 0 0' }}>
                Active accounts are shown to public clients on the payment step for transfer instructions.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => {
                  const newAcc: PaymentAccount = {
                    id: `acc-${Date.now()}`,
                    provider: 'telebirr',
                    accountNumber: '',
                    holderName: 'Dr. Hana Almaz',
                    instructions: '',
                    active: true,
                  };
                  setAccounts([...accounts, newAcc]);
                }}
                style={{ background: 'var(--off)', color: 'var(--ink)', border: '1px solid var(--line)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
              >
                + Add Account
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ background: 'var(--acc)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
              >
                {saving ? 'Saving...' : 'Confirm & Save Accounts'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {accounts.length === 0 && (
              <p style={{ color: 'var(--mut)', fontSize: '13px', fontStyle: 'italic', margin: '1rem 0' }}>
                No payment accounts configured yet. Click "+ Add Account" to configure receiving accounts.
              </p>
            )}
            {accounts.map((acc, idx) => (
              <div key={acc.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--off)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--line)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr auto', gap: '12px', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--mut)', cursor: 'pointer', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      checked={acc.active}
                      onChange={e => {
                        const copy = [...accounts];
                        copy[idx].active = e.target.checked;
                        setAccounts(copy);
                      }}
                      title="Active for public bookings"
                    />
                    Active
                  </label>
                  <select
                    value={acc.provider}
                    onChange={e => {
                      const copy = [...accounts];
                      copy[idx].provider = e.target.value;
                      setAccounts(copy);
                    }}
                    className="admin-select"
                  >
                    <option value="telebirr">Telebirr</option>
                    <option value="cbe">CBE Mobile</option>
                    <option value="cbebirr">CBE Birr</option>
                    <option value="dashen">Dashen Bank</option>
                    <option value="abyssinia">Bank of Abyssinia</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Holder Name (e.g. Dr. Hana Almaz)"
                    value={acc.holderName}
                    onChange={e => {
                      const copy = [...accounts];
                      copy[idx].holderName = e.target.value;
                      setAccounts(copy);
                    }}
                    className="admin-input"
                  />
                  <input
                    type="text"
                    placeholder="Account / Phone Number"
                    value={acc.accountNumber}
                    onChange={e => {
                      const copy = [...accounts];
                      copy[idx].accountNumber = e.target.value;
                      setAccounts(copy);
                    }}
                    className="admin-input"
                  />
                  <button
                    onClick={() => setAccounts(accounts.filter(a => a.id !== acc.id))}
                    style={{ background: 'transparent', border: 'none', color: '#c53030', cursor: 'pointer', padding: '4px' }}
                    title="Remove account"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Optional client instructions (e.g. Pay via Telebirr or CBE Birr and upload screenshot)"
                  value={acc.instructions || ''}
                  onChange={e => {
                    const copy = [...accounts];
                    copy[idx].instructions = e.target.value;
                    setAccounts(copy);
                  }}
                  className="admin-input"
                  style={{ fontSize: '12px', background: 'var(--card)' }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: HOLIDAYS & DAYS OFF */}
      {activeTab === 'holidays' && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', padding: '1.75rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h2 style={{ fontSize: '18px', margin: 0, color: 'var(--ink)' }}>Public Holidays & Days Off</h2>
              <p style={{ margin: '4px 0 0', color: 'var(--mut)', fontSize: '13px' }}>
                Blocked dates appear as "Off" to admin and "Unavailable" to public clients.
              </p>
            </div>
            <button
              onClick={handlePreloadEthiopianHolidays}
              style={{
                background: 'var(--off)',
                border: '1px solid var(--line)',
                padding: '7px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: 'var(--ink)'
              }}
            >
              <Flag className="w-3.5 h-3.5" /> Preload Ethiopian Holidays
            </button>
          </div>

          {/* Add Holiday Form */}
          <form onSubmit={handleAddHoliday} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '10px', alignItems: 'center', background: 'var(--off)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid var(--line)' }}>
            <input
              type="date"
              required
              value={newHolidayDate}
              onChange={e => setNewHolidayDate(e.target.value)}
              className="admin-input"
            />
            <input
              type="text"
              required
              placeholder="Holiday or Closure Name (e.g. Meskel, Annual Leave)"
              value={newHolidayName}
              onChange={e => setNewHolidayName(e.target.value)}
              className="admin-input"
            />
            <button
              type="submit"
              disabled={holidaySaving}
              style={{
                background: 'var(--acc)',
                color: '#fff',
                border: 'none',
                padding: '9px 18px',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {holidaySaving ? 'Adding...' : 'Add Date'}
            </button>
          </form>

          {/* Holidays List */}
          {holidays.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--mut)', padding: '1.5rem' }}>No holidays configured. Use "Preload" above to add standard Ethiopian public holidays.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {holidays.map(h => (
                <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <code style={{ background: 'var(--off)', padding: '3px 8px', borderRadius: '4px', fontSize: '13px', fontWeight: 600, color: 'var(--acc)' }}>
                      {h.date}
                    </code>
                    <strong style={{ fontSize: '14px', color: 'var(--ink)' }}>{h.name}</strong>
                  </div>
                  <button
                    onClick={() => handleDeleteHoliday(h.id)}
                    style={{ background: 'transparent', border: 'none', color: '#c53030', cursor: 'pointer', padding: '4px' }}
                    title="Remove date"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: SYSTEM & GIT VERSION INFO */}
      {activeTab === 'system' && (
        <div>
          <div style={{ marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '18px', margin: '0 0 4px', color: 'var(--ink)' }}>System Version & Git Information</h2>
            <p style={{ margin: 0, color: 'var(--mut)', fontSize: '13px' }}>
              Track the current build release, active Git commit ID, commit log message, branch, and runtime environment.
            </p>
          </div>
          <VersionBadge mode="detailed" />
        </div>
      )}

      {/* Primary Save Action */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            background: 'var(--acc)',
            color: '#fff',
            border: 'none',
            padding: '12px 26px',
            borderRadius: '8px',
            fontSize: '15px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
            transition: 'background 0.15s ease'
          }}
        >
          {saving ? 'Saving Changes...' : 'Save All Changes'}
        </button>
      </div>
    </div>
  );
}
