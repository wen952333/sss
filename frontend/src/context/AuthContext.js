import React, { createContext, useContext, useState, useEffect } from 'react';
import { loginUser, registerUser } from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('thirteenWaterUser');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem('thirteenWaterUser');
      }
    }
    setLoading(false);
  }, []);

  const login = async (mobile, password) => {
    try {
      const userData = await loginUser(mobile, password);
      setUser(userData);
      localStorage.setItem('thirteenWaterUser', JSON.stringify(userData));
      return true;
    } catch (error) {
      console.error('登录失败:', error);
      return false;
    }
  };

  const register = async (mobile, nickname, password) => {
    try {
      const userData = await registerUser(mobile, nickname, password);
      setUser(userData);
      localStorage.setItem('thirteenWaterUser', JSON.stringify(userData));
      return true;
    } catch (error) {
      console.error('注册失败:', error);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('thirteenWaterUser');
  };

  const value = {
    user,
    isAuthenticated: !!user,
    loading,
    login,
    register,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
