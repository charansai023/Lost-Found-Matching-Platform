import { useState, useEffect } from 'react';
import './Loader.css';

// Reusable loading spinner that delays logo fullscreen load by 1 second to avoid flicker
const Loader = () => {
  const [showLogoLoader, setShowLogoLoader] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowLogoLoader(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  if (!showLogoLoader) {
    // Return a minimal, invisible loader during the first 1 second to avoid screen flicker on fast loads
    return (
      <div className="loader-container loader-container--mini">
        <div className="loader-spinner-mini" />
      </div>
    );
  }

  return (
    <div className="loader-container loader-container--logo">
      <div className="loader-logo-wrapper">
        <img src="/logo.png" alt="Lost & Found" className="loader-logo" />
        <div className="loader-spinner-ring" />
      </div>
      <p className="loader-text">Loading</p>
    </div>
  );
};

export default Loader;
