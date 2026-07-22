import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import './AuthPages.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(email, password);
      const role = result?.data?.user?.role;
      navigate(role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
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
            <h2>Welcome Back</h2>
            <p className="auth-subtitle">Log in to report and find items</p>

            {error && <div className="auth-error">{error}</div>}

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
              placeholder="Enter your password"
              required
            />

            <button type="submit" className="btn btn--primary auth-submit" disabled={loading}>
              {loading ? 'Logging in...' : 'Log In'}
            </button>

            <p className="auth-footer-text">
              Don't have an account? <Link to="/register">Register here</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
