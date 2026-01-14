
import { useState } from 'react';
import { GameState } from '../types';

export const useWallet = (
    gameState: GameState, 
    setGameState: React.Dispatch<React.SetStateAction<GameState>>
) => {
    const [showWalletModal, setShowWalletModal] = useState(false);
    const [walletForm, setWalletForm] = useState({ 
        searchPhone: '', 
        targetUser: null as { id: number, nickname: string } | null, 
        amount: '' 
    });
    const [walletMsg, setWalletMsg] = useState('');

    const handleSearchUser = async () => {
        if (!walletForm.searchPhone) return;
        setWalletMsg('Searching...');
        try {
            const res = await fetch('/api/user/search', {
                method: 'POST',
                body: JSON.stringify({ query: walletForm.searchPhone })
            });
            const data = await res.json() as any;
            if (data.found) {
                setWalletForm(prev => ({ ...prev, targetUser: data.user }));
                setWalletMsg('');
            } else {
                setWalletForm(prev => ({ ...prev, targetUser: null }));
                setWalletMsg('未找到该用户');
            }
        } catch (e) {
            setWalletMsg('搜索出错');
        }
    };

    const handleTransfer = async () => {
        if (!gameState.user || !walletForm.targetUser || !walletForm.amount) return;
        try {
            const res = await fetch('/api/user/transfer', {
                method: 'POST',
                body: JSON.stringify({ 
                    fromId: gameState.user.id, 
                    toId: walletForm.targetUser.id, 
                    amount: walletForm.amount 
                })
            });
            const data = await res.json() as any;
            if (data.error) throw new Error(data.error);
            
            const newUser = { ...gameState.user, points: data.newPoints };
            setGameState(prev => ({ ...prev, user: newUser }));
            localStorage.setItem('shisanshui_user', JSON.stringify(newUser));
            
            alert("转账成功！");
            setWalletForm({ searchPhone: '', targetUser: null, amount: '' });
            setShowWalletModal(false);
        } catch (e: any) {
            alert(e.message);
        }
    };

    return {
        showWalletModal,
        setShowWalletModal,
        walletForm,
        setWalletForm,
        walletMsg,
        handleSearchUser,
        handleTransfer
    };
};
