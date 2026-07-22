import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import './Navbar.css';

const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const isAdmin = user?.role === 'admin';

  const handleLogout = () => {
    logout();
    setIsOpen(false);
    navigate('/login');
  };

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);

  return (
    <nav className="navbar">
      <Link to="/" className="navbar__brand" onClick={closeMenu}>
        <img src="/logo.png" alt="Lost & Found Logo" className="navbar__logo" />
        <span>Lost & Found</span>
      </Link>

      <button
        className={`navbar__toggle ${isOpen ? 'active' : ''}`}
        onClick={toggleMenu}
        aria-label="Toggle navigation"
      >
        <span className="bar"></span>
        <span className="bar"></span>
        <span className="bar"></span>
      </button>

      <div className={`navbar__links ${isOpen ? 'navbar__links--open' : ''}`}>
        {!isAuthenticated && (
          <>
            <Link to="/" onClick={closeMenu}>Home</Link>
            <Link to="/login" onClick={closeMenu}>Login</Link>
            <Link to="/register" onClick={closeMenu}>Register</Link>
          </>
        )}

        {isAuthenticated && isAdmin && (
          /* ── Admin Navigation ── */
          <>
            <Link to="/admin" onClick={closeMenu}>Dashboard</Link>
            <Link to="/admin/users" onClick={closeMenu}>Users</Link>
            <Link to="/admin/lost" onClick={closeMenu}>Lost Reports</Link>
            <Link to="/admin/found" onClick={closeMenu}>Found Reports</Link>
            <Link to="/admin/matches" onClick={closeMenu}>Matches</Link>
            <Link to="/admin/profile" onClick={closeMenu}>Profile</Link>
            <span className="navbar__user">Hi, {user?.name}</span>
            <button className="btn btn--secondary" onClick={handleLogout}>
              Logout
            </button>
          </>
        )}

        {isAuthenticated && !isAdmin && (
          /* ── User Navigation ── */
          <>
            <Link to="/" onClick={closeMenu}>Home</Link>
            <Link to="/lost-items" onClick={closeMenu}>Lost Items</Link>
            <Link to="/found-items" onClick={closeMenu}>Found Items</Link>
            <Link to="/lost-items/new" onClick={closeMenu}>Report Lost</Link>
            <Link to="/found-items/new" onClick={closeMenu}>Report Found</Link>
            <Link to="/my-reports" onClick={closeMenu}>My Reports</Link>
            <Link to="/profile" onClick={closeMenu}>Profile</Link>
            <span className="navbar__user">Hi, {user?.name}</span>
            <button className="btn btn--secondary" onClick={handleLogout}>
              Logout
            </button>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
