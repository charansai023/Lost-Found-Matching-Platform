import { Link } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import './Home.css';

const Home = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="home-page">
      <div className="home-hero">
        <div className="home-hero__logo-container">
          <img src="/logo.png" alt="Lost & Found Logo" className="home-hero__logo" />
        </div>
        <h1>Lost something? Found something?</h1>
        <p>
          Report lost and found items and let our matching system connect you with the right people, no
          scrolling through endless posts required.
        </p>
        <div className="home-hero__actions">
          {isAuthenticated ? (
            <>
              <Link to="/lost-items/new" className="btn btn--primary">
                + Report Lost Item
              </Link>
              <Link to="/found-items/new" className="btn btn--primary">
                + Report Found Item
              </Link>
              <Link to="/my-reports" className="btn btn--secondary">
                View My Reports
              </Link>
            </>
          ) : (
            <>
              <Link to="/register" className="btn btn--primary">
                Get Started
              </Link>
              <Link to="/login" className="btn btn--secondary">
                Log In
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="home-section">
        <h2 className="section-title">Core Features</h2>
        <div className="home-features">
          <div className="home-feature-card">
            <div className="feature-icon">📝</div>
            <h3>Report Instantly</h3>
            <p>Log a lost or found item in seconds with photos, locations, and descriptive details.</p>
          </div>
          <div className="home-feature-card">
            <div className="feature-icon">🧠</div>
            <h3>Smart Matching</h3>
            <p>Our weighted scoring algorithm compares category, location, color, brand, and name keywords.</p>
          </div>
          <div className="home-feature-card">
            <div className="feature-icon">🎯</div>
            <h3>Stay Organized</h3>
            <p>Track matching notifications and review reports from open validation states to resolved.</p>
          </div>
        </div>
      </div>

      <div className="home-section">
        <h2 className="section-title">How It Works</h2>
        <p className="section-subtitle">A simple, 3-step automated pipeline to recover your items</p>
        <div className="how-it-works">
          <div className="step-card">
            <div className="step-number">1</div>
            <h3>Report Details</h3>
            <p>Fill out description details, location tags, colors, brand, and upload clear item photos.</p>
          </div>
          <div className="step-card">
            <div className="step-number">2</div>
            <h3>Smart Compare</h3>
            <p>The backend comparisons engine computes weighted scores dynamically for new items.</p>
          </div>
          <div className="step-card">
            <div className="step-number">3</div>
            <h3>Reclaim Items</h3>
            <p>View verified match highlights, chat with verified owners, and successfully reclaim your item.</p>
          </div>
        </div>
      </div>

      <div className="home-section">
        <h2 className="section-title">Platform Highlights</h2>
        <p className="section-subtitle">Built with reliable matching logic and secure credentials</p>
        <div className="highlights-grid">
          <div className="highlight-item">
            <span className="highlight-icon">⚡</span>
            <div>
              <h4>Real-time Matching</h4>
              <p>Comparison scores run immediately when a lost/found report is uploaded.</p>
            </div>
          </div>
          <div className="highlight-item">
            <span className="highlight-icon">⚖️</span>
            <div>
              <h4>Weighted Comparison</h4>
              <p>Prioritizes category matches, coordinates, brands, and color overlaps.</p>
            </div>
          </div>
          <div className="highlight-item">
            <span className="highlight-icon">🛡️</span>
            <div>
              <h4>Moderation Checks</h4>
              <p>Moderators review highly rated match pairs to prevent false matches.</p>
            </div>
          </div>
          <div className="highlight-item">
            <span className="highlight-icon">🔒</span>
            <div>
              <h4>Credential Integrity</h4>
              <p>Enforces alphanumeric symbol security validations on user passkeys.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
