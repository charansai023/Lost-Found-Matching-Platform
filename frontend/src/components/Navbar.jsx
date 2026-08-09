import { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import NotificationBell from './NotificationBell';
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
    <>
      {isOpen && <div className="navbar__overlay" onClick={closeMenu} />}
      <aside className={`navbar ${isOpen ? 'navbar--open' : ''}`}>
        <div className="navbar__header">
          <NavLink to="/" className="navbar__brand" onClick={closeMenu}>
            <img src="/logo.png" alt="Lost & Found Logo" className="navbar__logo" />
            <span>Lost & Found</span>
          </NavLink>

          <button
            className={`navbar__toggle ${isOpen ? 'active' : ''}`}
            onClick={toggleMenu}
            aria-label="Toggle navigation"
          >
            <span className="bar"></span>
            <span className="bar"></span>
            <span className="bar"></span>
          </button>
        </div>

        <div className={`navbar__content ${isOpen ? 'navbar__content--open' : ''}`}>
          <div className="navbar__links">
            {!isAuthenticated && (
              <>
                <NavLink to="/" end onClick={closeMenu}>Home</NavLink>
                <NavLink to="/login" onClick={closeMenu}>Login</NavLink>
                <NavLink to="/register" onClick={closeMenu}>Register</NavLink>
              </>
            )}

            {isAuthenticated && isAdmin && (
              /* ── Admin Navigation ── */
              <>
                <NavLink to="/admin" end onClick={closeMenu}>Dashboard</NavLink>
                <NavLink to="/admin/lost" onClick={closeMenu}>Lost Items</NavLink>
                <NavLink to="/admin/found" onClick={closeMenu}>Found Items</NavLink>
                <NavLink to="/admin/claims" onClick={closeMenu}>Claims</NavLink>
                <NavLink to="/admin/users" onClick={closeMenu}>Users</NavLink>
                <NavLink to="/admin/matches" onClick={closeMenu}>AI Matches</NavLink>
                <NavLink to="/admin/notifications" onClick={closeMenu}>Notifications</NavLink>
                <NavLink to="/admin/rewards/requests" onClick={closeMenu}>Reward Requests</NavLink>
                <NavLink to="/admin/rewards/settings" onClick={closeMenu}>Reward Settings</NavLink>
              </>
            )}

            {isAuthenticated && !isAdmin && (
              /* ── User Navigation ── */
              <>
                <NavLink to="/" end onClick={closeMenu}>Home</NavLink>
                <NavLink to="/lost-items" end onClick={closeMenu}>Lost Items</NavLink>
                <NavLink to="/found-items" end onClick={closeMenu}>Found Items</NavLink>
                <NavLink to="/lost-items/new" onClick={closeMenu}>Report Lost</NavLink>
                <NavLink to="/found-items/new" onClick={closeMenu}>Report Found</NavLink>
                <NavLink to="/my-reports" onClick={closeMenu}>My Reports</NavLink>
                <NavLink to="/student/rewards" onClick={closeMenu}>Rewards</NavLink>
                <NavLink to="/profile" onClick={closeMenu}>Profile</NavLink>
              </>
            )}
          </div>

          {isAuthenticated && (
            <div className="navbar__footer">
              <div className="navbar__user-info">
                <span className="navbar__user">Hi, {user?.name}</span>
                <NotificationBell />
              </div>
              <button className="btn btn--secondary navbar__logout-btn" onClick={handleLogout}>
                Logout
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default Navbar;
