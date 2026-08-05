import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

// A small convenience hook so components can just do:
// const { user, login, logout } = useAuth();
// instead of importing useContext + AuthContext every time.
const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};

export default useAuth;
