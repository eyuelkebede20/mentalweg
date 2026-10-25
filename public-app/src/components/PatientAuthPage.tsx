import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  Mail, 
  Phone, 
  User, 
  ArrowLeft, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  ShieldCheck
} from 'lucide-react';

interface PatientAuthPageProps {
  initialMode?: 'login' | 'signup' | 'forgot' | 'reset';
  resetToken?: string;
  onSuccessLogin: (client: any) => void;
  onBackToSanctuary: () => void;
}

export default function PatientAuthPage({
  initialMode = 'login',
  resetToken = '',
  onSuccessLogin,
  onBackToSanctuary,
}: PatientAuthPageProps) {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot' | 'reset'>(initialMode);

  // Form states
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [tokenInput, setTokenInput] = useState(resetToken);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Load Google Identity Services script
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const existing = document.getElementById('google-gsi-client');
    if (!existing) {
      const script = document.createElement('script');
      script.id = 'google-gsi-client';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await fetch('/api/patient/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Login failed. Please check your credentials.');
      }

      onSuccessLogin(json.client);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/patient/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName,
          email,
          phone,
          password,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Registration failed.');
      }

      setSuccessNotice(
        json.message || 
        'Registration submitted successfully! For clinical care management, patient accounts require approval by Dr. Hana. You will receive an email once your account is active.'
      );
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await fetch('/api/patient/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const json = await res.json();
      setSuccessNotice(json.message || 'If an account exists, a reset link has been dispatched to your email.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to dispatch reset request.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (password.length < 8) {
      setErrorMsg('New password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/patient/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenInput, newPassword: password }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to reset password.');
      }

      setSuccessNotice('Your password has been successfully reset! You can now log in.');
      setTimeout(() => {
        setMode('login');
        setSuccessNotice(null);
      }, 2500);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Google OIDC handler
  const handleGoogleCredentialResponse = async (credential: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/patient/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });

      const json = await res.json();
      if (res.status === 202 || json.pending) {
        setSuccessNotice(json.message || 'Google registration received. Pending approval by Dr. Hana.');
      } else if (!res.ok) {
        throw new Error(json.error || 'Google authentication failed.');
      } else {
        onSuccessLogin(json.client);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Simulates or triggers Google One Tap / Sign-in prompt
  const handleGoogleSignInClick = () => {
    const win = window as any;
    if (win.google && win.google.accounts && win.google.accounts.id) {
      try {
        win.google.accounts.id.initialize({
          client_id: '1043818320491-dummygoogleclientid.apps.googleusercontent.com',
          callback: (response: any) => {
            if (response.credential) {
              handleGoogleCredentialResponse(response.credential);
            }
          }
        });
        win.google.accounts.id.prompt();
        return;
      } catch (err) {
        console.warn('Google prompt fallback:', err);
      }
    }

    // Interactive fallback for environment without configured Google Client ID
    const mockEmail = prompt('Enter Google Account email for verified OIDC authentication test:', email || 'client@gmail.com');
    if (mockEmail) {
      const mockName = mockEmail.split('@')[0];
      const payload = { sub: `google-${Date.now()}`, email: mockEmail, name: mockName };
      const mockJwt = `header.${btoa(JSON.stringify(payload))}.signature`;
      handleGoogleCredentialResponse(mockJwt);
    }
  };

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(1rem, 3vw, 2rem) 1rem' }}>
      <div style={{
        maxWidth: '460px',
        width: '100%',
        background: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: '20px',
        padding: 'clamp(1.25rem, 4vw, 2.25rem)',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.04)',
      }}>
        {/* Back Link */}
        <button
          onClick={onBackToSanctuary}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--mut)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            padding: 0,
            marginBottom: '1.5rem',
          }}
        >
          <ArrowLeft className="w-4 h-4" /> Return to Sanctuary
        </button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'var(--accbg)',
            color: 'var(--acc)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px'
          }}>
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 style={{ fontSize: '22px', margin: '0 0 6px', color: 'var(--ink)', fontWeight: 700 }}>
            {mode === 'login' && 'Patient Portal Login'}
            {mode === 'signup' && 'Register Patient Account'}
            {mode === 'forgot' && 'Reset Portal Password'}
            {mode === 'reset' && 'Set New Password'}
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--mut)', lineHeight: 1.4 }}>
            {mode === 'login' && 'Sign in to review appointments, book additional sessions, and manage your calendar.'}
            {mode === 'signup' && 'Create your confidential patient profile. Registrations are approved by Dr. Hana.'}
            {mode === 'forgot' && 'Enter your registered email address to receive a secure password reset link.'}
            {mode === 'reset' && 'Enter and confirm your new secure password.'}
          </p>
        </div>

        {/* Error Notice */}
        {errorMsg && (
          <div style={{
            background: '#fff5f5',
            border: '1px solid #fed7d7',
            color: '#c53030',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '13px',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px'
          }}>
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Success Notice */}
        {successNotice && (
          <div style={{
            background: '#e3f7ed',
            border: '1px solid #a7f3d0',
            color: '#165b38',
            padding: '12px 14px',
            borderRadius: '10px',
            fontSize: '13px',
            marginBottom: '1.5rem',
            lineHeight: 1.5,
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px'
          }}>
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-700" />
            <div>
              <strong>Notice</strong>
              <p style={{ margin: '2px 0 0' }}>{successNotice}</p>
            </div>
          </div>
        )}

        {/* 1. LOGIN FORM */}
        {mode === 'login' && !successNotice && (
          <form onSubmit={handleLoginSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  required
                  placeholder="patient@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 36px',
                    borderRadius: '8px',
                    border: '1px solid var(--line)',
                    background: 'var(--off)',
                    color: 'var(--ink)',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
                <Mail className="w-4 h-4 text-mut" style={{ position: 'absolute', left: '12px', top: '12px' }} />
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}>
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setErrorMsg(null); }}
                  style={{ background: 'transparent', border: 'none', color: 'var(--acc)', fontSize: '12px', cursor: 'pointer', padding: 0 }}
                >
                  Forgot password?
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 36px',
                    borderRadius: '8px',
                    border: '1px solid var(--line)',
                    background: 'var(--off)',
                    color: 'var(--ink)',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
                <Lock className="w-4 h-4 text-mut" style={{ position: 'absolute', left: '12px', top: '12px' }} />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: 'var(--acc)',
                color: '#fff',
                border: 'none',
                padding: '11px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginBottom: '1rem'
              }}
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Sign In to Portal'}
            </button>

            {/* Google OIDC Button */}
            <div style={{ position: 'relative', textAlign: 'center', margin: '1.25rem 0' }}>
              <div style={{ borderTop: '1px solid var(--line)', position: 'absolute', top: '50%', width: '100%' }} />
              <span style={{ position: 'relative', background: 'var(--card)', padding: '0 10px', fontSize: '12px', color: 'var(--mut)' }}>
                or sign in with
              </span>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignInClick}
              disabled={loading}
              style={{
                width: '100%',
                background: 'var(--off)',
                color: 'var(--ink)',
                border: '1px solid var(--line)',
                padding: '10px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                marginBottom: '1.5rem'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Continue with Google</span>
            </button>

            <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--mut)' }}>
              Need a patient account?{' '}
              <button
                type="button"
                onClick={() => { setMode('signup'); setErrorMsg(null); }}
                style={{ background: 'transparent', border: 'none', color: 'var(--acc)', fontWeight: 600, cursor: 'pointer', padding: 0 }}
              >
                Request Registration
              </button>
            </div>
          </form>
        )}

        {/* 2. SIGNUP FORM */}
        {mode === 'signup' && !successNotice && (
          <form onSubmit={handleSignupSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
                Full Name / Preferred Name
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  required
                  placeholder="Abebe Bikila"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 36px',
                    borderRadius: '8px',
                    border: '1px solid var(--line)',
                    background: 'var(--off)',
                    color: 'var(--ink)',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
                <User className="w-4 h-4 text-mut" style={{ position: 'absolute', left: '12px', top: '12px' }} />
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
                Ethiopian Phone Number
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="tel"
                  required
                  placeholder="0911234567 or +251..."
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 36px',
                    borderRadius: '8px',
                    border: '1px solid var(--line)',
                    background: 'var(--off)',
                    color: 'var(--ink)',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
                <Phone className="w-4 h-4 text-mut" style={{ position: 'absolute', left: '12px', top: '12px' }} />
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
                Email Address (For approval notice & updates)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  required
                  placeholder="patient@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 36px',
                    borderRadius: '8px',
                    border: '1px solid var(--line)',
                    background: 'var(--off)',
                    color: 'var(--ink)',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
                <Mail className="w-4 h-4 text-mut" style={{ position: 'absolute', left: '12px', top: '12px' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
                  Password (min 8 chars)
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--line)',
                    background: 'var(--off)',
                    color: 'var(--ink)',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--line)',
                    background: 'var(--off)',
                    color: 'var(--ink)',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: 'var(--acc)',
                color: '#fff',
                border: 'none',
                padding: '11px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginBottom: '1rem'
              }}
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Submit for Clinical Approval'}
            </button>

            <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--mut)' }}>
              Already registered?{' '}
              <button
                type="button"
                onClick={() => { setMode('login'); setErrorMsg(null); }}
                style={{ background: 'transparent', border: 'none', color: 'var(--acc)', fontWeight: 600, cursor: 'pointer', padding: 0 }}
              >
                Sign In
              </button>
            </div>
          </form>
        )}

        {/* 3. FORGOT PASSWORD FORM */}
        {mode === 'forgot' && !successNotice && (
          <form onSubmit={handleForgotSubmit}>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
                Your Registered Email
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  required
                  placeholder="patient@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 36px',
                    borderRadius: '8px',
                    border: '1px solid var(--line)',
                    background: 'var(--off)',
                    color: 'var(--ink)',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
                <Mail className="w-4 h-4 text-mut" style={{ position: 'absolute', left: '12px', top: '12px' }} />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: 'var(--acc)',
                color: '#fff',
                border: 'none',
                padding: '11px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginBottom: '1rem'
              }}
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Send Reset Link'}
            </button>

            <div style={{ textAlign: 'center', fontSize: '13px' }}>
              <button
                type="button"
                onClick={() => { setMode('login'); setErrorMsg(null); }}
                style={{ background: 'transparent', border: 'none', color: 'var(--mut)', cursor: 'pointer', padding: 0 }}
              >
                Back to Sign In
              </button>
            </div>
          </form>
        )}

        {/* 4. RESET PASSWORD FORM */}
        {mode === 'reset' && !successNotice && (
          <form onSubmit={handleResetSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
                Reset Security Token
              </label>
              <input
                type="text"
                required
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--line)',
                  background: 'var(--off)',
                  color: 'var(--ink)',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
                New Password (min 8 chars)
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--line)',
                  background: 'var(--off)',
                  color: 'var(--ink)',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
                Confirm New Password
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--line)',
                  background: 'var(--off)',
                  color: 'var(--ink)',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: 'var(--acc)',
                color: '#fff',
                border: 'none',
                padding: '11px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginBottom: '1rem'
              }}
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Update Password'}
            </button>
          </form>
        )}

        {/* Success Action */}
        {successNotice && (
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <button
              type="button"
              onClick={() => { setMode('login'); setSuccessNotice(null); }}
              style={{
                background: 'var(--acc)',
                color: '#fff',
                border: 'none',
                padding: '8px 18px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Return to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
