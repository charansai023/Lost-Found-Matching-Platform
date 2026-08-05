import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import './AuthPages.css';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSymbol = /[^a-zA-Z0-9]/.test(password);

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (!hasLetter || !hasNumber || !hasSymbol) {
      setError('Password must include alphabets, numbers, and symbols');
      return;
    }

    setLoading(true);

    try {
      await register(name, email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-left">
          <img src="/logo.png" alt="Lost & Found Logo" className="auth-brand-logo" />
          <h1 className="auth-brand-title">Lost & Found</h1>
          <p className="auth-brand-desc">
            Reconnecting you with what matters. Report items, search details, and find smart matches instantly.
          </p>
        </div>
        <div className="auth-right">
          <form className="auth-card" onSubmit={handleSubmit}>
            <h2>Create Account</h2>
            <p className="auth-subtitle">Join the Lost & Found community</p>

            {error && <div className="auth-error">{error}</div>}

            <label className="form-label">Full Name</label>
            <input
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              required
            />

            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />

            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 chars (alphabets, numbers, symbols)"
              required
            />
            <span className="form-helper">Password must include alphabets, numbers, and symbols (min 8 chars)</span>

            <label className="form-label">Confirm Password</label>
            <input
              type="password"
              className="form-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              required
            />

            <button type="submit" className="btn btn--primary auth-submit" disabled={loading}>
              {loading ? 'Creating account...' : 'Register'}
            </button>

            <p className="auth-footer-text">
              Already have an account? <Link to="/login">Log in here</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Register;
