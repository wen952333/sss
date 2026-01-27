
import { useState, useEffect } from 'react';
import { User } from '../types';

// Mock Telegram WebApp for development or browser testing
const mockTelegramWebApp = {
  initDataUnsafe: {
    user: {
      id: 123456789,
      first_name: "Test User",
      username: "test_user"
    }
  },
  openInvoice: (url: string, callback: (status: string) => void) => {
    console.log("Mock Payment for URL:", url);
    const confirmed = window.confirm("【模拟模式】这是本地模拟支付，点击确定模拟支付成功（不扣费），点击取消模拟失败。");
    if (confirmed) {
       setTimeout(() => callback("paid"), 1000);
    } else {
       callback("cancelled");
    }
  },
  openTelegramLink: (url: string) => {
    window.open(url, '_blank');
  },
  showAlert: (message: string) => alert(message),
  ready: () => {},
  expand: () => {},
  HapticFeedback: {
    impactOccurred: (style: string) => console.log(`Haptic: ${style}`)
  }
};

const getTelegramWebApp = () => {
  if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
    return (window as any).Telegram.WebApp;
  }
  return mockTelegramWebApp;
};

export const tg = getTelegramWebApp();

const MOCK_DB_USERS: User[] = [
  { telegram_id: 123456789, username: "test_user", points: 10000, last_check_in_date: null, is_admin: true },
  { telegram_id: 987654321, username: "player_two", points: 500, last_check_in_date: "2023-10-01", is_admin: false },
  { telegram_id: 112233445, username: "bot_hater", points: 0, last_check_in_date: null, is_admin: false },
];

export const useTelegram = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [isMockMode, setIsMockMode] = useState(false);
  const [adminUserList, setAdminUserList] = useState<User[]>(MOCK_DB_USERS);
  const [startParam, setStartParam] = useState<string | null>(null);

  useEffect(() => {
    tg.ready();
    if (tg.expand) tg.expand();

    if (!(window as any).Telegram?.WebApp) {
        setIsMockMode(true);
    }

    const tgUser = tg.initDataUnsafe?.user;
    const param = tg.initDataUnsafe?.start_param;
    if (param) setStartParam(param);

    if (tgUser) {
      // In a real app, fetch user from DB here
      const existingUser = adminUserList.find(u => u.telegram_id === tgUser.id);
      if (existingUser) {
        setCurrentUser(existingUser);
      } else {
        const newUser: User = {
          telegram_id: tgUser.id,
          username: tgUser.username || tgUser.first_name || `User${tgUser.id}`,
          points: 1000, 
          last_check_in_date: null,
          is_admin: false 
        };
        // Auto-admin for specific ID for testing
        if (MOCK_DB_USERS.find(u => u.telegram_id === tgUser.id)?.is_admin) {
            newUser.is_admin = true;
        }
        setAdminUserList(prev => [...prev, newUser]);
        setCurrentUser(newUser);
      }
    } else {
        // Fallback for browser testing
        setCurrentUser(MOCK_DB_USERS[0]);
    }
  }, []);

  const handleBuyStars = async () => {
    if (isPaying) return;
    setIsPaying(true);
    
    if (isMockMode) {
        const confirmed = window.confirm("【模拟模式】当前不在 Telegram 环境，将进行模拟支付。是否继续？");
        if (!confirmed) {
            setIsPaying(false);
            return;
        }
    }

    try {
      const response = await fetch('/api/create-invoice', { method: 'POST' });
      const data = await response.json();
      
      if (!response.ok || !data.invoiceLink) {
          throw new Error(data.error || "Failed to create invoice");
      }

      tg.openInvoice(data.invoiceLink, (status: string) => {
         setIsPaying(false);
         if (status === "paid") {
            const pointsAmount = 2000;
            if (currentUser) {
                const updatedUser = { ...currentUser, points: currentUser.points + pointsAmount };
                setCurrentUser(updatedUser);
                setAdminUserList(prev => prev.map(u => u.telegram_id === currentUser.telegram_id ? updatedUser : u));
                tg.showAlert(`支付成功！获得 ${pointsAmount} 积分。`);
            }
         } else if (status === "cancelled") {
            // Cancelled
         } else {
            tg.showAlert("Payment Status: " + status);
         }
      });
    } catch (e: any) {
      setIsPaying(false);
      tg.showAlert("Error creating invoice: " + e.message);
    }
  };

  const updateUser = (user: User) => {
      setCurrentUser(user);
      setAdminUserList(prev => prev.map(u => u.telegram_id === user.telegram_id ? user : u));
  };

  const handleDeleteUser = (targetId: number) => {
    if (!currentUser?.is_admin) return;
    if (window.confirm(`Delete user ID: ${targetId}?`)) {
      setAdminUserList(prev => prev.filter(u => u.telegram_id !== targetId));
      if (targetId === currentUser.telegram_id) {
         setCurrentUser(null);
         window.location.reload();
      }
    }
  };

  return {
    tg,
    currentUser,
    setCurrentUser: updateUser,
    isPaying,
    handleBuyStars,
    adminUserList,
    handleDeleteUser,
    startParam,
    setStartParam,
    isMockMode
  };
};
