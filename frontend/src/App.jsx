import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import Navbar from './components/Navbar';
import CompleteProfile from './components/CompleteProfile';
import useAuth from './hooks/useAuth';

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ReportLostItem from './pages/ReportLostItem';
import ReportFoundItem from './pages/ReportFoundItem';
import LostItemsList from './pages/LostItemsList';
import FoundItemsList from './pages/FoundItemsList';
import LostItemDetail from './pages/LostItemDetail';
import FoundItemDetail from './pages/FoundItemDetail';
import MyReports from './pages/MyReports';
import Profile from './pages/Profile';
import AdminDashboard from './pages/AdminDashboard';

function AppContent() {
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();

  // Show the profile completion modal if the user hasn't completed their profile yet
  const showCompleteProfile = isAuthenticated && user && !user.profileCompleted;

  return (
    <>
      <Navbar />
      <main className="app-main">
        {showCompleteProfile ? (
          <CompleteProfile />
        ) : (
          <div key={location.pathname} className="page-transition">
            <Routes location={location}>
              {/* ── Public Routes ── */}
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* ── User Routes ── */}
              <Route
                path="/lost-items"
                element={
                  <PrivateRoute>
                    <LostItemsList />
                  </PrivateRoute>
                }
              />
              <Route
                path="/lost-items/new"
                element={
                  <PrivateRoute>
                    <ReportLostItem />
                  </PrivateRoute>
                }
              />
              <Route
                path="/lost-items/:id"
                element={
                  <PrivateRoute>
                    <LostItemDetail />
                  </PrivateRoute>
                }
              />
              <Route
                path="/found-items"
                element={
                  <PrivateRoute>
                    <FoundItemsList />
                  </PrivateRoute>
                }
              />
              <Route
                path="/found-items/new"
                element={
                  <PrivateRoute>
                    <ReportFoundItem />
                  </PrivateRoute>
                }
              />
              <Route
                path="/found-items/:id"
                element={
                  <PrivateRoute>
                    <FoundItemDetail />
                  </PrivateRoute>
                }
              />
              <Route
                path="/my-reports"
                element={
                  <PrivateRoute>
                    <MyReports />
                  </PrivateRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <PrivateRoute>
                    <Profile />
                  </PrivateRoute>
                }
              />

              {/* ── Admin Routes (all nested under /admin/*) ── */}
              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <AdminDashboard />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <AdminRoute>
                    <AdminDashboard />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/lost"
                element={
                  <AdminRoute>
                    <AdminDashboard />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/found"
                element={
                  <AdminRoute>
                    <AdminDashboard />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/matches"
                element={
                  <AdminRoute>
                    <AdminDashboard />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/profile"
                element={
                  <AdminRoute>
                    <AdminDashboard />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/claims"
                element={
                  <AdminRoute>
                    <AdminDashboard />
                  </AdminRoute>
                }
              />

              {/* ── Catch-all ── */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        )}
      </main>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
