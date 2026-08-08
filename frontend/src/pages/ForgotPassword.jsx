import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  forgotPasswordSendOTP,
  verifyForgotPasswordOTP,
  resetPasswordWithOTP,
} from '../services/authService';
import './AuthPages.css';

const STEPS = {
  EMAIL: 'email',
  OTP: 'otp',
  PASSWORD: 'password',
  DONE: 'done',
};

const ForgotPassword = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState(STEPS.EMAIL);
  const [email, setEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const [cooldown, setCooldown] = useState(0);
  const cooldownTimer = useRef(null);
  const otpInputRefs = useRef([]);

  useEffect(() => {
    return () => {
      if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    };
  }, []);

  const startCooldown = (seconds) => {
    setCooldown(seconds);
    if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    cooldownTimer.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownTimer.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const getOtpString = () => otpDigits.join('');

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const result = await forgotPasswordSendOTP(email.trim());
      setSuccess(result.message || 'If an account exists with this email, an OTP has been sent.');
      setInfo('Please check your inbox (and spam folder) for the 6-digit OTP.');
      startCooldown(result?.data?.resendCooldownSeconds || 60);
      setStep(STEPS.OTP);
      setTimeout(() => otpInputRefs.current[0]?.focus(), 50);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (cooldown > 0) return;
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const result = await forgotPasswordSendOTP(email.trim());
      setSuccess(result.message || 'A new OTP has been sent.');
      setInfo('Please check your inbox for the new OTP.');
      startCooldown(result?.data?.resendCooldownSeconds || 60);
      setOtpDigits(['', '', '', '', '', '']);
      setTimeout(() => otpInputRefs.current[0]?.focus(), 50);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    const otpStr = getOtpString();
    if (otpStr.length !== 6) {
      setError('Please enter the complete 6-digit OTP.');
      return;
    }
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await verifyForgotPasswordOTP(email.trim(), otpStr);
      setInfo('OTP verified. You can now set your new password.');
      setStep(STEPS.PASSWORD);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    const hasLetter = /[a-zA-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSymbol = /[^a-zA-Z0-9]/.test(newPassword);
    if (!hasLetter || !hasNumber || !hasSymbol) {
      setError('Password must include alphabets, numbers, and symbols.');
      return;
    }

    setLoading(true);

    try {
      const otpStr = getOtpString();
      const result = await resetPasswordWithOTP(email.trim(), otpStr, newPassword);
      setSuccess(result.message || 'Password reset successfully.');
      setStep(STEPS.DONE);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    setError('');
    const sanitized = value.replace(/\D/g, '').slice(0, 1);
    const nextDigits = [...otpDigits];
    nextDigits[index] = sanitized;
    setOtpDigits(nextDigits);

    if (sanitized && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      otpInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      e.preventDefault();
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const nextDigits = ['', '', '', '', '', ''];
    for (let i = 0; i < pasted.length; i++) nextDigits[i] = pasted[i];
    setOtpDigits(nextDigits);
    const focusIdx = Math.min(pasted.length, 5);
    setTimeout(() => otpInputRefs.current[focusIdx]?.focus(), 10);
  };

  const stepIndex = { [STEPS.EMAIL]: 0, [STEPS.OTP]: 1, [STEPS.PASSWORD]: 2, [STEPS.DONE]: 2 };
  const currentIdx = stepIndex[step];

  const renderStepper = () => {
    if (step === STEPS.DONE) return null;
    const steps = [
      { key: STEPS.EMAIL, label: 'Email' },
      { key: STEPS.OTP, label: 'OTP' },
      { key: STEPS.PASSWORD, label: 'Reset' },
    ];
    return (
      <div className="auth-stepper">
        {steps.map((s, i) => {
          const isDone = currentIdx > i;
          const isActive = currentIdx === i;
          return (
            <div key={s.key} style={{ display: 'contents' }}>
              <div className={`auth-step ${isActive ? 'active' : ''} ${isDone ? 'completed' : ''}`}>
                <div className="auth-step-dot">{isDone ? '✓' : i + 1}</div>
                <div className="auth-step-label">{s.label}</div>
              </div>
              {i < steps.length - 1 && (
                <div className={`auth-step-divider ${currentIdx > i ? 'completed' : ''}`} />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const confirmMatch = confirmPassword
    ? newPassword === confirmPassword
      ? { cls: 'ok', text: 'Passwords match' }
      : { cls: 'bad', text: 'Passwords do not match' }
    : null;

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-left">
          <img src="/logo.png" alt="Lost & Found Logo" className="auth-brand-logo" />
          <h1 className="auth-brand-title">Lost & Found</h1>
          <p className="auth-brand-desc">
            Securely reset your password. We will walk you through a quick verification process.
          </p>
        </div>
        <div className="auth-right">
          <div className="auth-card">
            {step !== STEPS.DONE ? (
              <>
                <h2 style={{ marginBottom: 6 }}>Reset Your Password</h2>
                <p className="auth-subtitle" style={{ marginBottom: 16 }}>
                  Regain access to your account in a few steps
                </p>
                {renderStepper()}
              </>
            ) : null}

            {error && <div className="auth-error">{error}</div>}
            {success && <div className="auth-success">{success}</div>}
            {info && !success && <div className="auth-info">{info}</div>}

            {step === STEPS.EMAIL && (
              <form onSubmit={handleSendOTP}>
                <label className="form-label">Registered Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError('');
                  }}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
                <span className="auth-password-hint">
                  We will send a 6-digit OTP to this email.
                </span>

                <button type="submit" className="btn btn--primary auth-submit" disabled={loading}>
                  {loading ? 'Sending OTP...' : 'Send OTP'}
                </button>

                <p className="auth-footer-text">
                  Remembered your password? <Link to="/login">Log in</Link>
                </p>
              </form>
            )}

            {step === STEPS.OTP && (
              <form onSubmit={handleVerifyOTP}>
                <div style={{ marginBottom: 8 }}>
                  <label className="form-label">Enter 6-digit OTP</label>
                  <span
                    style={{
                      fontSize: 12,
                      color: '#6b7280',
                      fontWeight: 500,
                      marginLeft: 8,
                    }}
                  >
                    Sent to <span style={{ color: '#111827', fontWeight: 600 }}>{email}</span>
                  </span>
                </div>

                <div
                  className="auth-otp-inputs"
                  onPaste={handleOtpPaste}
                  role="group"
                  aria-label="One time password input"
                >
                  {otpDigits.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => (otpInputRefs.current[i] = el)}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={1}
                      className={`${d ? 'filled' : ''} ${error ? 'error' : ''}`}
                      value={d}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      aria-label={`OTP digit ${i + 1}`}
                    />
                  ))}
                </div>

                <div className="auth-resend-row">
                  {cooldown > 0 ? (
                    <span className="auth-resend-cooldown">
                      Resend OTP available in {cooldown}s
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="auth-resend-btn"
                      onClick={handleResendOTP}
                      disabled={loading}
                    >
                      {loading ? 'Sending...' : 'Resend OTP'}
                    </button>
                  )}
                </div>

                <button type="submit" className="btn btn--primary auth-submit" disabled={loading}>
                  {loading ? 'Verifying...' : 'Verify OTP'}
                </button>

                <p className="auth-footer-text">
                  <Link to="/forgot-password">Change email</Link> · <Link to="/login">Back to Login</Link>
                </p>
              </form>
            )}

            {step === STEPS.PASSWORD && (
              <form onSubmit={handleResetPassword}>
                <label className="form-label">New Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="At least 8 chars (alphabets, numbers, symbols)"
                  autoComplete="new-password"
                  required
                />
                <span className="auth-password-hint">
                  Must include alphabets, numbers, and symbols (min 8 chars)
                </span>

                <label className="form-label">Confirm New Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="Re-enter your new password"
                  autoComplete="new-password"
                  required
                />
                {confirmMatch && (
                  <span className={`auth-password-match auth-password-hint ${confirmMatch.cls}`}>
                    {confirmMatch.text}
                  </span>
                )}

                <button type="submit" className="btn btn--primary auth-submit" disabled={loading}>
                  {loading ? 'Resetting password...' : 'Reset Password'}
                </button>

                <p className="auth-footer-text">
                  <Link to="/login">Back to Login</Link>
                </p>
              </form>
            )}

            {step === STEPS.DONE && (
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: '50%',
                    background: '#dcfce7',
                    color: '#16a34a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '8px auto 20px auto',
                    fontSize: 36,
                    fontWeight: 800,
                  }}
                >
                  ✓
                </div>
                <h2 style={{ marginBottom: 8 }}>Password Reset Complete</h2>
                <p className="auth-subtitle" style={{ marginBottom: 24 }}>
                  Your password has been updated. You can now log in with your new password.
                </p>
                <Link to="/login" className="btn btn--primary" style={{ width: '100%', display: 'inline-block', textAlign: 'center' }}>
                  Go to Login
                </Link>
                <p className="auth-footer-text" style={{ marginTop: 20 }}>
                  Didn't request this?{' '}
                  <Link to="/login" onClick={(e) => { e.preventDefault(); navigate('/login'); }}>
                    Contact support
                  </Link>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
