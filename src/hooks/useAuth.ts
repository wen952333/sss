
import { useState, useEffect } from 'react';

export interface User {
  id: string;
  phone: string;
  nickname: string;
  points: number;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isPointsModalOpen, setIsPointsModalOpen] = useState(false);

  useEffect(() => {
    // Restore session
    const storedUser = localStorage.getItem('shisanshui_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem('shisanshui_user', JSON.stringify(userData));
    setIsAuthModalOpen(false);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('shisanshui_user');
  };

  const updatePoints = (newPoints: number) => {
    if (user) {
      const updated = { ...user, points: newPoints };
      setUser(updated);
      localStorage.setItem('shisanshui_user', JSON.stringify(updated));
    }
  };

  return {
    user,
    login,
    logout,
    updatePoints,
    isAuthModalOpen,
    setIsAuthModalOpen,
    isPointsModalOpen,
    setIsPointsModalOpen
  };
};
