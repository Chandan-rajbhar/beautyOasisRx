import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  User,
  Mail,
  Lock,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  KeyRound,
} from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { supabase } from '../../lib/supabaseClient';
import brandLogo from '../../assets/logo.png';
import loginIllustration from '../../assets/login_illustration.jpg';
import '../../styles/admin.css';

/* ─────────────────────────────────────────────
   Password-strength helper
───────────────────────────────────────────── */
function getStrength(pw) {
  if (!pw) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const map = [
    { label: '', color: '' },
    { label: 'Weak', color: '#dc2626' },
    { label: 'Fair', color: '#ea580c' },
    { label: 'Good', color: '#ca8a04' },
    { label: 'Strong', color: '#16a34a' },
  ];
  return { score, ...map[score] };
}

/* ─────────────────────────────────────────────
   Friendly error normaliser
───────────────────────────────────────────── */
function friendlyError(msg = '') {
  const m = msg.toLowerCase();
  if (m.includes('already registered') || m.includes('user already exists') || m.includes('email address is already'))
    return 'An account with this email already exists. Please sign in instead.';
  if (m.includes('invalid email'))
    return 'Please enter a valid email address.';
  if (m.includes('password'))
    return 'Password is too weak or invalid. Use at least 8 characters.';
  if (m.includes('network') || m.includes('fetch'))
    return 'Network error. Please check your connection and try again.';
  return msg || 'Registration failed. Please try again.';
}

/* ══════════════════════════════════════════════════════════
   SIGN-UP PAGE — Admin / Super Admin Registration
   All accounts created here receive role = "super_admin"
   The role is also locked server-side via the DB trigger.
══════════════════════════════════════════════════════════ */
export const SignUpPage = () => {
  const { isAuthenticated, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();

  // Form state
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [showCf, setShowCf]     = useState(false);

  // UI state
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  const strength = getStrength(password);

  /* ── Client-side validation ── */
  const validate = () => {
    if (!name.trim() || name.trim().length < 2) {
      setError('Please enter your full name (at least 2 characters).'); return false;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.'); return false;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.'); return false;
    }
    if (strength.score < 2) {
      setError('Password is too weak. Add uppercase letters, numbers, or symbols.'); return false;
    }
    if (password !== confirm) {
      setError('Passwords do not match. Please check and try again.'); return false;
    }
    return true;
  };

  /* ── Submit handler ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!validate()) return;

    setLoading(true);
    try {
      // ── Step 1: Create Supabase Auth user ──
      // role = 'super_admin' is embedded in raw_user_meta_data.
      // The DB trigger reads this and inserts the public.users row.
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            name: name.trim(),
            role: 'super_admin',   // ← locked: server trigger enforces this
          },
        },
      });

      if (signUpError) {
        setError(friendlyError(signUpError.message));
        return;
      }

      // ── Step 2: Upsert public.users profile ──
      // Belt-and-suspenders: ensures the row exists with the correct role
      // even when email-confirm is disabled (trigger fires before this, but we
      // explicitly guarantee role = 'super_admin' cannot be overridden to patient).
      if (data?.user?.id) {
        const { error: profileError } = await supabase
          .from('users')
          .upsert(
            {
              id:     data.user.id,
              name:   name.trim(),
              email:  email.trim().toLowerCase(),
              role:   'super_admin',   // hardcoded — never changes here
              status: 'active',
            },
            { onConflict: 'id' }
          );

        if (profileError) {
          // Non-fatal if trigger already inserted the row correctly.
          console.warn('[SignUp] Profile upsert note:', profileError.message);
        }
      }

      if (data?.session) {
        navigate('/dashboard', { replace: true });
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError(friendlyError(err?.message));
    } finally {
      setLoading(false);
    }
  };

  /* ══════════════════════════════════════════
     SUCCESS SCREEN
  ══════════════════════════════════════════ */
  if (success) {
    return (
      <div className="login-outer">
        {/* Left brand panel */}
        <div className="login-brand-panel">
          <img src={loginIllustration} alt="BeautyOasisRx" className="login-brand-image" />
          <div className="login-brand-overlay">
            <div className="login-brand-content">
              <img src={brandLogo} alt="BeautyOasisRx" className="login-brand-logo" />
              <h2 className="login-brand-title">Beauty<span>Oasis</span>Rx</h2>
              <p className="login-brand-subtitle">Clinical Aesthetics &amp; Bespoke Wellness Portal</p>
              <div className="login-brand-features">
                <div className="login-brand-feature"><ShieldCheck size={16} /><span>Secure Role-Based Access</span></div>
                <div className="login-brand-feature"><ShieldCheck size={16} /><span>HIPAA-Compliant Patient Data</span></div>
                <div className="login-brand-feature"><ShieldCheck size={16} /><span>End-to-End Encrypted Sessions</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Right panel – success */}
        <div className="login-form-panel">
          <div className="login-form-container" style={{ textAlign: 'center' }}>
            {/* Success icon */}
            <div
              style={{
                width: '80px', height: '80px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 24px',
                boxShadow: '0 8px 24px rgba(22,163,74,0.2)',
              }}
            >
              <CheckCircle2 size={40} color="#16a34a" />
            </div>

            <h1
              style={{
                fontFamily: 'var(--font-serif-display)', fontSize: '1.75rem',
                fontWeight: 700, color: '#0f2942', margin: '0 0 10px',
              }}
            >
              Admin Account Created
            </h1>

            {/* Role badge */}
            <div
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '4px 12px', borderRadius: '20px',
                background: '#f0fdf4', border: '1px solid #86efac',
                color: '#15803d', fontSize: '0.78rem', fontWeight: 700,
                marginBottom: '20px', letterSpacing: '0.02em',
              }}
            >
              <KeyRound size={12} />
              SUPER ADMIN
            </div>

            <p style={{ fontSize: '0.88rem', color: '#475569', marginBottom: '6px', lineHeight: 1.6 }}>
              A confirmation email has been sent to{' '}
              <strong style={{ color: '#0f2942' }}>{email}</strong>.
            </p>
            <p style={{ fontSize: '0.84rem', color: '#64748b', marginBottom: '32px', lineHeight: 1.6 }}>
              Click the verification link in your inbox to activate your Super Admin account,
              then sign in to access the Clinical Portal.
            </p>

            <Link
              to="/login"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '13px 32px', borderRadius: '12px',
                background: 'linear-gradient(135deg, #1e5aa8 0%, #16a34a 100%)',
                color: '#ffffff', fontSize: '0.92rem', fontWeight: 700,
                textDecoration: 'none', boxShadow: '0 4px 18px rgba(30,90,168,0.35)',
              }}
            >
              Go to Sign In
              <ArrowRight size={16} />
            </Link>

            <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '20px' }}>
              Didn&apos;t receive the email? Check spam or{' '}
              <button
                onClick={() => { setSuccess(false); setError(''); }}
                style={{
                  background: 'none', border: 'none', color: '#1e5aa8',
                  fontWeight: 600, cursor: 'pointer', fontSize: '0.75rem', padding: 0,
                }}
              >
                try again
              </button>
              .
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════
     MAIN SIGN-UP FORM
  ══════════════════════════════════════════ */
  return (
    <div className="login-outer">
      {/* ══ LEFT BRAND PANEL ══ */}
      <div className="login-brand-panel">
        <img
          src={loginIllustration}
          alt="BeautyOasisRx Clinical Portal"
          className="login-brand-image"
        />
        <div className="login-brand-overlay">
          <div className="login-brand-content">
            <img src={brandLogo} alt="BeautyOasisRx" className="login-brand-logo" />
            <h2 className="login-brand-title">Beauty<span>Oasis</span>Rx</h2>
            <p className="login-brand-subtitle">
              Clinical Aesthetics &amp; Bespoke Wellness Portal
            </p>
            <div className="login-brand-features">
              <div className="login-brand-feature">
                <ShieldCheck size={16} /><span>Secure Role-Based Access</span>
              </div>
              <div className="login-brand-feature">
                <ShieldCheck size={16} /><span>HIPAA-Compliant Patient Data</span>
              </div>
              <div className="login-brand-feature">
                <ShieldCheck size={16} /><span>End-to-End Encrypted Sessions</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ RIGHT FORM PANEL ══ */}
      <div className="login-form-panel">
        <div className="login-form-container">

          {/* Mobile logo */}
          <div className="login-mobile-logo">
            <img src={brandLogo} alt="BeautyOasisRx" />
            <h1>BeautyOasis<span>Rx</span></h1>
          </div>

          {/* Header */}
          <div className="login-form-header">
            <h1 className="login-form-title">Create Admin Account</h1>
            <p className="login-form-subtitle">
              Register a new Super Admin account for the Clinical Portal.
            </p>
          </div>

          {/* Role indicator — informational, not selectable */}
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '9px 14px', borderRadius: '8px',
              background: 'linear-gradient(90deg, #f0f9ff 0%, #f0fdf4 100%)',
              border: '1px solid #bae6fd', marginBottom: '4px',
            }}
          >
            <KeyRound size={14} color="#1e5aa8" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.78rem', color: '#1e5aa8', fontWeight: 600 }}>
              Role assigned:&nbsp;
            </span>
            <span
              style={{
                fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px',
                borderRadius: '10px', background: '#dcfce7',
                color: '#15803d', border: '1px solid #86efac',
                letterSpacing: '0.04em',
              }}
            >
              SUPER ADMIN
            </span>
            <span style={{ fontSize: '0.72rem', color: '#64748b', marginLeft: 'auto' }}>
              (enforced server-side)
            </span>
          </div>

          {/* Error banner */}
          {error && (
            <div className="login-error-banner" role="alert" style={{ marginTop: '12px' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form" noValidate style={{ marginTop: '16px' }}>

            {/* Full Name */}
            <div className="login-field">
              <label className="login-label" htmlFor="signup-name">Full Name</label>
              <div className="login-input-wrapper">
                <User size={16} className="login-input-icon" />
                <input
                  id="signup-name"
                  type="text"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError(''); }}
                  placeholder="Dr. Jane Smith"
                  className="login-input"
                />
              </div>
            </div>

            {/* Email */}
            <div className="login-field">
              <label className="login-label" htmlFor="signup-email">Email Address</label>
              <div className="login-input-wrapper">
                <Mail size={16} className="login-input-icon" />
                <input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  placeholder="you@beautyoasisrx.com"
                  className="login-input"
                />
              </div>
            </div>

            {/* Password */}
            <div className="login-field">
              <label className="login-label" htmlFor="signup-password">Password</label>
              <div className="login-input-wrapper">
                <Lock size={16} className="login-input-icon" />
                <input
                  id="signup-password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  placeholder="Min. 8 characters"
                  className="login-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="login-toggle-pw"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Password strength bar */}
              {password && (
                <div style={{ marginTop: '7px' }}>
                  <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        style={{
                          flex: 1, height: '3px', borderRadius: '2px',
                          background: i <= strength.score ? strength.color : '#e2e8f0',
                          transition: 'background 0.25s ease',
                        }}
                      />
                    ))}
                  </div>
                  {strength.label && (
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: strength.color }}>
                      {strength.label} password
                      {strength.score < 2 && (
                        <span style={{ color: '#94a3b8', fontWeight: 400 }}>
                          {' '}— add uppercase, numbers, or symbols
                        </span>
                      )}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="login-field">
              <label className="login-label" htmlFor="signup-confirm">Confirm Password</label>
              <div
                className="login-input-wrapper"
                style={
                  confirm && password !== confirm
                    ? { borderColor: '#fca5a5' }
                    : confirm && password === confirm
                    ? { borderColor: '#86efac' }
                    : {}
                }
              >
                <Lock size={16} className="login-input-icon" />
                <input
                  id="signup-confirm"
                  type={showCf ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); setError(''); }}
                  placeholder="Re-enter your password"
                  className="login-input"
                />
                <button
                  type="button"
                  onClick={() => setShowCf((v) => !v)}
                  className="login-toggle-pw"
                  aria-label={showCf ? 'Hide password' : 'Show password'}
                >
                  {showCf ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {confirm && password !== confirm && (
                <span style={{ fontSize: '0.72rem', color: '#dc2626', marginTop: '4px', display: 'block' }}>
                  Passwords do not match
                </span>
              )}
              {confirm && password === confirm && (
                <span
                  style={{
                    fontSize: '0.72rem', color: '#16a34a', marginTop: '4px',
                    display: 'flex', alignItems: 'center', gap: '4px',
                  }}
                >
                  <CheckCircle2 size={12} /> Passwords match
                </span>
              )}
            </div>

            {/* Submit */}
            <button
              id="signup-submit-btn"
              type="submit"
              disabled={loading}
              className="login-submit-btn"
            >
              {loading ? (
                <>
                  <span className="login-spinner" />
                  Creating Admin Account…
                </>
              ) : (
                <>
                  Create Admin Account
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Sign-in link */}
          <p style={{ textAlign: 'center', marginTop: '22px', fontSize: '0.84rem', color: '#64748b' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#1e5aa8', fontWeight: 600, textDecoration: 'none' }}>
              Sign In →
            </Link>
          </p>

          <p className="login-disclaimer">
            Access to this portal is restricted to authorised BeautyOasisRx administrators.
            Unauthorised access is prohibited.
          </p>
        </div>
      </div>
    </div>
  );
};
