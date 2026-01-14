
import { useState } from 'react';
import { GameState, User } from '../types';

export const useAuth = (setGameState: React.Dispatch<React.SetStateAction<GameState>>) => {
    const [showAuthModal, setShowAuthModal] = useState<'login' | 'register' | null>(null);
    const [authForm, setAuthForm] = useState({ phone: '', nickname: '', password: '' });

    const handleRegister = async () => {
        if(authForm.password.length < 6) return alert("密码需至少6位");
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(authForm)
            });
            const data = await res.json() as any;
            if (data.error) throw new Error(data.error);
            alert("注册成功，请登录");
            setShowAuthModal('login');
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleLogin = async () => {
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ phone: authForm.phone, password: authForm.password })
            });
            const data = await res.json() as any;
            if (data.error) throw new Error(data.error);
            
            setGameState(prev => ({ ...prev, user: data.user }));
            localStorage.setItem('shisanshui_user', JSON.stringify(data.user));
            setShowAuthModal(null);
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleLogout = (leaveSeatCb?: () => Promise<void>) => {
        if (leaveSeatCb) leaveSeatCb();
        setGameState(prev => ({ ...prev, user: null }));
        localStorage.removeItem('shisanshui_user');
    };

    const syncUserData = async (currentUser: User | null) => {
        if (!currentUser) return null;
        try {
            const res = await fetch('/api/user/sync', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ userId: currentUser.id })
            });
            const data = await res.json() as any;
            if (data.success && data.user) {
                setGameState(prev => ({ ...prev, user: data.user }));
                localStorage.setItem('shisanshui_user', JSON.stringify(data.user));
                return data.user;
            }
        } catch (e) {
            console.error("Sync error", e);
        }
        return currentUser;
    };

    return {
        showAuthModal,
        setShowAuthModal,
        authForm,
        setAuthForm,
        handleLogin,
        handleRegister,
        handleLogout,
        syncUserData
    };
};
