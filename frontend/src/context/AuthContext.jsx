import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext(null);

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  // Fetch current user details if token exists
  useEffect(() => {
    async function fetchMe() {
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data);
        } else {
          // Token expired or invalid
          logout();
        }
      } catch (err) {
        console.error('Failed to fetch user data', err);
      } finally {
        setLoading(false);
      }
    }
    fetchMe();
  }, [token]);

  const login = async (email, password) => {
    setLoading(true);
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    });

    if (!res.ok) {
      const errData = await res.json();
      setLoading(false);
      throw new Error(errData.detail || 'Failed to login');
    }

    const { access_token } = await res.json();
    localStorage.setItem('token', access_token);
    setToken(access_token);
  };

  const register = async (email, password, fullName) => {
    setLoading(true);
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, full_name: fullName })
    });

    if (!res.ok) {
      const errData = await res.json();
      setLoading(false);
      throw new Error(errData.detail || 'Failed to register');
    }

    // Auto log in after registering
    await login(email, password);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setLoading(false);
  };

  const updateWeeklyReportSetting = async (enabled) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/me/settings?weekly_report_enabled=${enabled}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const updatedUser = await res.json();
        setUser(updatedUser);
        return updatedUser;
      }
    } catch (err) {
      console.error('Failed to update report settings', err);
    }
  };

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    updateWeeklyReportSetting
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
