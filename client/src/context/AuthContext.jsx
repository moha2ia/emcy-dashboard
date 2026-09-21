import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getMe } from '../services/api';

const AuthContext = createContext(null);

const clearStoredAuth = () => {
  localStorage.removeItem('emcy_token');
  localStorage.removeItem('emcy_user');
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    clearStoredAuth();
    setUser(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Restore session from localStorage, then re-validate the token with the
    // server. Guarded JSON.parse so corrupted storage can't crash the app.
    const restoreSession = async () => {
      const token = localStorage.getItem('emcy_token');
      const savedUser = localStorage.getItem('emcy_user');

      if (!token || !savedUser) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const cached = JSON.parse(savedUser);
        if (!cancelled) setUser(cached);
      } catch {
        // Corrupted cache - start clean
        clearStoredAuth();
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const res = await getMe();
        if (!cancelled) {
          setUser(res.data.user);
          localStorage.setItem('emcy_user', JSON.stringify(res.data.user));
        }
      } catch (err) {
        // 401 is handled globally by the axios interceptor (redirect to /login).
        // For network failures, keep the cached session so offline dev still works.
        if (err?.response?.status !== 401 && !cancelled) {
          console.warn('Session re-validation failed, keeping cached session.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    restoreSession();
    return () => { cancelled = true; };
  }, []);

  const loginUser = (token, userData) => {
    localStorage.setItem('emcy_token', token);
    localStorage.setItem('emcy_user', JSON.stringify(userData));
    setUser(userData);
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
