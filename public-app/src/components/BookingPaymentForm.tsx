import { useState } from 'react';
import { ShieldCheck, Upload, X, Copy, Check, AlertCircle, ArrowLeft, CreditCard } from 'lucide-react';
import { type TimeConvention, formatTimeSlot } from '../utils/ethiopianTime';

interface PaymentAccount {
  id: string;
  provider: string;
  accountNumber: string;
  holderName: string;
  instructions?: string;
}

interface Props {
  slot: { startUtc: string; durationMin: number };
  timeConvention: TimeConvention;
  feeEtb: number;
  paymentAccounts: PaymentAccount[];
  onSuccess: (bookingResult: any) => void;
  onBack: () => void;
  onOpenConventionModal?: () => void;
}

// Client-side sanitization helper
function clientSanitize(val: string): string {
  return val.replace(/<[^>]*>/g, '').replace(/[\0"']/g, '').trim();
}

export default function BookingPaymentForm({
  slot,
  timeConvention,
  feeEtb,
  paymentAccounts,
  onSuccess,
  onBack,
  onOpenConventionModal,
}: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  
  // Selected payment account provider
  const [provider, setProvider] = useState<string>(paymentAccounts[0]?.provider || 'telebirr');
  const [reference, setReference] = useState('');
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentAccount = paymentAccounts.find(a => a.provider === provider) || paymentAccounts[0];

  const handleCopyAccount = () => {
    if (currentAccount?.accountNumber) {
      navigator.clipboard.writeText(currentAccount.accountNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file (PNG, JPG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB.');
      return;
    }

    setPreviewName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setScreenshotBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Sanitize all inputs
    const cleanName = clientSanitize(name);
    const cleanPhone = clientSanitize(phone);
    const cleanEmail = email ? clientSanitize(email) : undefined;
    const cleanReference = clientSanitize(reference);

    if (!cleanName) {
      setError('Preferred Name is required.');
      return;
    }
    if (!cleanPhone) {
      setError('Phone number is required.');
      return;
    }
    if (!cleanReference) {
      setError('Transaction Reference number is required.');
      return;
    }

    // Phone format check
    const digitsOnly = cleanPhone.replace(/[\s\-\(\)\.]/g, '');
    if (!/^(\+251|00251|251|0)?[97]\d{8}$/.test(digitsOnly)) {
      setError('Please enter a valid Ethiopian mobile number (e.g. 0911234567 or 0712345678).');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/public/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: cleanName,
          clientPhone: cleanPhone,
          clientEmail: cleanEmail,
          startUtc: slot.startUtc,
          provider,
          reference: cleanReference,
          screenshotBase64: screenshotBase64 || undefined,
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Booking request failed');
      }

      onSuccess({
        ...data,
        clientName: cleanName,
        clientPhone: cleanPhone,
        slotStartUtc: slot.startUtc,
        feeEtb,
      });
    } catch (err: any) {
      setError(err.message || 'An error occurred while confirming your booking.');
    } finally {
      setSubmitting(false);
    }
  };

  const formattedTime = formatTimeSlot(slot.startUtc, timeConvention, 60);

  return (
    <div className="booking-step-container">
      <div className="step-header">
        <button type="button" className="text-back-button" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Slot Selector</span>
        </button>
        <span className="step-badge">Step 3 of 3</span>
        <h2>Booking & Payment Instructions</h2>
        <p className="step-subtitle">
          Please review your session schedule, transfer the specified scheduling fee to the practice account, and provide your details below.
        </p>
      </div>

      {/* Selected Session Summary Card */}
      <div className="session-summary-card">
        <div className="summary-left">
          <div className="summary-badge-row">
            <span className="summary-label">Selected Appointment</span>
            {onOpenConventionModal && (
              <button
                type="button"
                className="convention-inline-switch-btn"
                onClick={onOpenConventionModal}
              >
                <span>Clock: {timeConvention === 'ethiopian' ? 'የኢትዮጵያ ሰዓት' : 'GMT+3'}</span>
                <span className="switch-text">Switch ▾</span>
              </button>
            )}
          </div>
          <h4 className="summary-date">
            {new Date(slot.startUtc).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </h4>
          <p className="summary-time">{formattedTime.primary}</p>
          <span className="summary-secondary">{formattedTime.secondary} · 1 Hour In-Person</span>
        </div>
        <div className="summary-right">
          <span className="fee-label">Specified Scheduling Fee</span>
          <span className="fee-amount">ETB {feeEtb}</span>
          <span className="fee-note">Credited towards full session balance</span>
        </div>
      </div>

      {error && (
        <div className="form-alert-error">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Payment Instructions & Account Details */}
      <div className="payment-instructions-card">
        <div className="instruction-header">
          <CreditCard className="w-5 h-5 text-emerald" />
          <h3>Send Payment to Specified Account</h3>
        </div>
        <p className="instruction-text">
          Transfer exactly <strong>ETB {feeEtb}</strong> to Dr. Hana’s practice account using Telebirr or CBE Mobile Banking:
        </p>

        {paymentAccounts.length > 1 && (
          <div className="provider-select-row">
            {paymentAccounts.map(acc => (
              <button
                key={acc.id}
                type="button"
                className={`provider-tab-btn ${provider === acc.provider ? 'active' : ''}`}
                onClick={() => setProvider(acc.provider)}
              >
                {acc.provider.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {currentAccount && (
          <div className="account-details-box">
            <div className="account-field">
              <span className="acc-lbl">Provider:</span>
              <strong className="acc-val uppercase">{currentAccount.provider}</strong>
            </div>
            <div className="account-field">
              <span className="acc-lbl">Account Number:</span>
              <span className="acc-number-row">
                <strong className="acc-val font-mono">{currentAccount.accountNumber}</strong>
                <button
                  type="button"
                  className="btn-copy"
                  onClick={handleCopyAccount}
                  title="Copy account number"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </span>
            </div>
            <div className="account-field">
              <span className="acc-lbl">Account Holder:</span>
              <strong className="acc-val">{currentAccount.holderName}</strong>
            </div>
            {currentAccount.instructions && (
              <p className="acc-extra-info">{currentAccount.instructions}</p>
            )}
          </div>
        )}
      </div>

      {/* Intake & Payment Proof Form */}
      <form onSubmit={handleSubmit} className="booking-form-card">
        <h3>Client Intake & Payment Verification</h3>
        <p className="form-subtext">
          Please input your preferred display name and phone number so Dr. Hana's clinic can contact you.
        </p>

        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="pref-name">
              Preferred Name <span className="req">*</span>
            </label>
            <input
              id="pref-name"
              type="text"
              required
              placeholder="e.g. Selamawit or Dawit"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={80}
            />
            <span className="field-hint">The name you would like to be addressed by.</span>
          </div>

          <div className="form-group">
            <label htmlFor="phone-num">
              Phone Number <span className="req">*</span>
            </label>
            <input
              id="phone-num"
              type="tel"
              required
              placeholder="e.g. 0911234567 or +251911234567"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              maxLength={20}
            />
            <span className="field-hint">Ethiopian mobile number for session confirmation SMS.</span>
          </div>

          <div className="form-group full-width">
            <label htmlFor="email-addr">
              Email Address <span className="opt">(Optional)</span>
            </label>
            <input
              id="email-addr"
              type="email"
              placeholder="e.g. yourname@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              maxLength={120}
            />
            <span className="field-hint">For receiving calendar invite (.ics) and confirmation copy.</span>
          </div>

          <div className="form-group full-width">
            <label htmlFor="trans-ref">
              Transaction Reference / Number <span className="req">*</span>
            </label>
            <input
              id="trans-ref"
              type="text"
              required
              placeholder="e.g. FT262908... or Telebirr Trans ID"
              value={reference}
              onChange={e => setReference(e.target.value)}
              maxLength={100}
            />
            <span className="field-hint">The reference number received in your bank or Telebirr SMS.</span>
          </div>

          {/* QR / Receipt Screenshot Upload */}
          <div className="form-group full-width">
            <label>
              Upload Payment Screenshot or QR Slip <span className="opt">(Recommended for faster validation)</span>
            </label>

            {!screenshotBase64 ? (
              <label className="upload-dropzone" htmlFor="receipt-upload">
                <Upload className="w-8 h-8 text-emerald mb-2" />
                <span className="dropzone-text">Click or drag receipt image here to upload</span>
                <span className="dropzone-hint">PNG, JPG, or WebP up to 5MB</span>
                <input
                  id="receipt-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden-file-input"
                />
              </label>
            ) : (
              <div className="screenshot-preview-box">
                <img src={screenshotBase64} alt="Receipt preview" className="preview-img" />
                <div className="preview-meta">
                  <span className="preview-name">{previewName || 'Receipt image attached'}</span>
                  <button
                    type="button"
                    className="btn-remove-preview"
                    onClick={() => {
                      setScreenshotBase64(null);
                      setPreviewName(null);
                    }}
                  >
                    <X className="w-4 h-4" />
                    <span>Change / Remove Image</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="security-guarantee-note">
          <ShieldCheck className="w-5 h-5 text-emerald flex-shrink-0" />
          <span>
            Strict Confidentiality: All inputs are sanitized, encrypted, and accessible solely to Dr. Hana for scheduling purposes. No medical notes or diagnoses are recorded.
          </span>
        </div>

        <div className="form-actions-row">
          <button type="button" className="btn-secondary" onClick={onBack} disabled={submitting}>
            Back
          </button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Verifying & Reserving...' : 'Submit & Confirm Booking'}
          </button>
        </div>
      </form>
    </div>
  );
}
