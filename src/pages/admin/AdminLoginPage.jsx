import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Mail, ArrowRight, ShieldCheck, AlertCircle, Eye, EyeOff, MailCheck } from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { supabase } from '../../lib/supabaseClient';
import brandLogo from '../../assets/logo.png';
import loginIllustration from '../../assets/login_illustration.jpg';
import '../../styles/admin.css';

export const AdminLoginPage = () => {
  const { login, isAuthenticated, resetPassword, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailNotConfirmed, setEmailNotConfirmed] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setEmailNotConfirmed(false);
    setResendSent(false);
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    if (!password) { setError('Please enter your password.'); return; }

    setLoading(true);
    try {
      const res = await login(email, password);
      if (res.success) {
        navigate('/dashboard', { replace: true });
      } else if (res.code === 'EMAIL_NOT_CONFIRMED') {
        setEmailNotConfirmed(true);
        setError('');
      } else {
        setError(res.message || 'Authentication failed. Please verify your credentials.');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    setResendLoading(true);
    setResendSent(false);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
      });
      if (!error) {
        setResendSent(true);
      } else {
        setError('Failed to resend: ' + error.message);
      }
    } catch {
      setError('Failed to resend confirmation email.');
    } finally {
      setResendLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotMessage('');
    if (!forgotEmail || !forgotEmail.includes('@')) {
      setForgotError('Please enter a valid email address.');
      return;
    }
    setForgotLoading(true);
    try {
      const res = await resetPassword(forgotEmail);
      if (res.success) {
        setForgotMessage(res.message);
      } else {
        setForgotError(res.message || 'Failed to send reset email.');
      }
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="login-outer">
      {/* === LEFT BRANDING PANEL === */}
      <div className="login-brand-panel">
        <img
          src={loginIllustration}
          alt="BeautyOasisRx Clinical Portal"
          className="login-brand-image"
        />
        <div className="login-brand-overlay">
          <div className="login-brand-content">
            <img src={brandLogo} alt="BeautyOasisRx" className="login-brand-logo" />
            <h2 className="login-brand-title">
              Beauty<span>Oasis</span>Rx
            </h2>
            <p className="login-brand-subtitle">
              Clinical Aesthetics &amp; Bespoke Wellness Portal
            </p>
            <div className="login-brand-features">
              <div className="login-brand-feature">
                <ShieldCheck size={16} />
                <span>Secure Role-Based Access</span>
              </div>
              <div className="login-brand-feature">
                <ShieldCheck size={16} />
                <span>HIPAA-Compliant Patient Data</span>
              </div>
              <div className="login-brand-feature">
                <ShieldCheck size={16} />
                <span>End-to-End Encrypted Sessions</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* === RIGHT FORM PANEL === */}
      <div className="login-form-panel">
        <div className="login-form-container">
          {/* Mobile logo (only visible on small screens) */}
          <div className="login-mobile-logo">
            <img src={brandLogo} alt="BeautyOasisRx" />
            <h1>
              BeautyOasis<span>Rx</span>
            </h1>
          </div>

          <div className="login-form-header">
            <h1 className="login-form-title">Clinical Portal Sign In</h1>
            <p className="login-form-subtitle">
              Authorized personnel only. Access is monitored and logged.
            </p>
          </div>

          {error && (
            <div className="login-error-banner">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {emailNotConfirmed && (
            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '10px',
                padding: '14px 16px',
                marginBottom: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <AlertCircle size={18} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#92400e', marginBottom: '3px' }}>
                    Email Confirmation Required
                  </div>
                  <div style={{ fontSize: '0.80rem', color: '#78350f', lineHeight: 1.5 }}>
                    Account ban gaya hai, lekin Supabase me email verification pending hai. Apne inbox/spam folder me jakar verification link par click karein.
                  </div>
                </div>
              </div>

              {resendSent ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.78rem',
                    color: '#16a34a',
                    fontWeight: 600,
                    padding: '6px 10px',
                    background: '#f0fdf4',
                    borderRadius: '6px',
                    border: '1px solid #86efac',
                  }}
                >
                  <MailCheck size={14} /> Verification email bhej diya gaya hai! Inbox check karein.
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  disabled={resendLoading}
                  style={{
                    alignSelf: 'flex-start',
                    background: '#fef3c7',
                    border: '1px solid #f59e0b',
                    color: '#92400e',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    padding: '6px 14px',
                    borderRadius: '6px',
                    cursor: resendLoading ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Mail size={13} />
                  {resendLoading ? 'Bhej rahe hain…' : 'Resend Verification Email'}
                </button>
              )}

              <div
                style={{
                  fontSize: '0.72rem',
                  color: '#a16207',
                  borderTop: '1px dashed #fcd34d',
                  paddingTop: '8px',
                  lineHeight: 1.4,
                }}
              >
                ⚡ <strong>Instant Fix (Supabase):</strong> Supabase Dashboard me <strong>Authentication → Providers → Email</strong> par jakar <em>&quot;Confirm email&quot;</em> ko <strong>OFF</strong> kar dein, ya <code>fix_login_and_confirm_users.sql</code> run karein.
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form" noValidate>
            {/* Email */}
            <div className="login-field">
              <label className="login-label" htmlFor="login-email">
                Email Address
              </label>
              <div className="login-input-wrapper">
                <Mail size={16} className="login-input-icon" />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@beautyoasisrx.com"
                  className="login-input"
                />
              </div>
            </div>

            {/* Password */}
            <div className="login-field">
              <div className="login-label-row">
                <label className="login-label" htmlFor="login-password">
                  Password
                </label>
                <button
                  type="button"
                  className="login-forgot-btn"
                  onClick={() => { setForgotModalOpen(true); setForgotEmail(email); setForgotMessage(''); setForgotError(''); }}
                >
                  Forgot Password?
                </button>
              </div>
              <div className="login-input-wrapper">
                <Lock size={16} className="login-input-icon" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="login-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="login-toggle-pw"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              id="login-submit-btn"
              type="submit"
              disabled={loading || authLoading}
              className="login-submit-btn"
            >
              {loading ? (
                <>
                  <span className="login-spinner" />
                  Authenticating…
                </>
              ) : (
                <>
                  Login
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <p className="login-disclaimer">
            This system is for authorized BeautyOasisRx personnel only. Unauthorized access is
            prohibited and may be subject to legal action.
          </p>

          <p
            style={{
              textAlign: 'center',
              marginTop: '16px',
              fontSize: '0.84rem',
              color: '#64748b',
            }}
          >
            Don&apos;t have an account?{' '}
            <Link
              to="/signup"
              style={{ color: '#1e5aa8', fontWeight: 600, textDecoration: 'none' }}
            >
              Create one →
            </Link>
          </p>
        </div>
      </div>

      {/* === FORGOT PASSWORD MODAL === */}
      {forgotModalOpen && (
        <div className="admin-modal-overlay" onClick={() => setForgotModalOpen(false)}>
          <div
            className="admin-modal-content"
            style={{ maxWidth: '420px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-header">
              <h3>Reset Password</h3>
            </div>
            <form onSubmit={handleForgotSubmit}>
              <div className="admin-modal-body">
                {forgotMessage ? (
                  <div
                    style={{
                      padding: '16px',
                      background: '#dcfce7',
                      color: '#15803d',
                      borderRadius: '10px',
                      fontSize: '0.85rem',
                    }}
                  >
                    {forgotMessage}
                  </div>
                ) : (
                  <>
                    {forgotError && (
                      <div
                        style={{
                          padding: '10px 14px',
                          background: '#fee2e2',
                          color: '#b91c1c',
                          borderRadius: '8px',
                          fontSize: '0.83rem',
                          marginBottom: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <AlertCircle size={14} />
                        {forgotError}
                      </div>
                    )}
                    <p style={{ margin: '0 0 16px', fontSize: '0.88rem', color: '#475569' }}>
                      Enter your clinical email address and we will send a secure reset link.
                    </p>
                    <div className="admin-form-group">
                      <label className="admin-form-label">Email Address</label>
                      <input
                        type="email"
                        required
                        className="admin-form-input"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="you@beautyoasisrx.com"
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="admin-modal-footer">
                <button
                  type="button"
                  onClick={() => setForgotModalOpen(false)}
                  className="admin-page-btn"
                >
                  Close
                </button>
                {!forgotMessage && (
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    style={{
                      background: '#1e5aa8',
                      color: '#ffffff',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: forgotLoading ? 'not-allowed' : 'pointer',
                      opacity: forgotLoading ? 0.7 : 1,
                    }}
                  >
                    {forgotLoading ? 'Sending…' : 'Send Reset Link'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
