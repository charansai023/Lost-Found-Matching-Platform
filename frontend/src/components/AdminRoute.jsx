import { Navigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import Loader from './Loader';

// Wraps a page component and only renders it if the user is logged in
// AND has the "admin" role. Non-admins are redirected to the dashboard
// rather than the login page, since they are authenticated, just not
// authorized for this specific page.
const AdminRoute = ({ children }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return <Loader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== 'admin') {
    // Non-admins are sent to their reports hub (/dashboard has no route).
    return <Navigate to="/my-reports" replace />;
  }

  return children;
};

export default AdminRoute;
