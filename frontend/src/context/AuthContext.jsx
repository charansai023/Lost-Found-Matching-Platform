import { createContext, useState, useEffect } from 'react';
import { loginUser, registerUser, updateMyProfile, completeProfile as completeProfileService } from '../services/authService';

// This context stores the logged-in user's info and auth-related actions
// so any component in the app can access them without prop drilling.
export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On first load, check if a user was already saved in localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');

    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
    }

    setLoading(false);
  }, []);

  // Logs the user in and stores their token + info in localStorage
  const login = async (email, password) => {
    const result = await loginUser(email, password);
    const { token, user: loggedInUser } = result.data;

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(loggedInUser));
    setUser(loggedInUser);

    return result;
  };

  // Registers a new user and logs them in immediately afterwards
  const register = async (name, email, password) => {
    const result = await registerUser(name, email, password);
    const { token, user: newUser } = result.data;

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(newUser));
    setUser(newUser);

    return result;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  // Updates the user's own name and keeps localStorage + state in sync
  const updateProfile = async (name) => {
    const result = await updateMyProfile(name);
    const updatedUser = { ...user, name: result.data.user.name };

    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);

    return result;
  };

  // Completes user profile for first-time sign-in
  const completeUserProfile = async (fullName, email, mobileNumber) => {
    const result = await completeProfileService(fullName, email, mobileNumber);
    const updatedUser = result.data.user;

    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);

    return result;
  };

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    updateProfile,
    completeUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
