
import React, { useState } from 'react';
import { X, Search, Send, Loader2, Coins } from 'lucide-react';
import { User } from '../hooks/useAuth';

interface PointsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onUpdatePoints: (newPoints: number) => void;
}

export const PointsModal: React.FC<PointsModalProps> = ({ isOpen, onClose, currentUser, onUpdatePoints }) => {
  const [searchPhone, setSearchPhone] = useState('');
  const [foundUser, setFoundUser] = useState<{ nickname: string; phone: string } | null>(null);
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'error' | 'success', text: string } | null>(null);

  if (!isOpen) return null;

  const handleSearch = async () => {
    if (!searchPhone) return;
    setIsLoading(true);
    setMsg(null);
    setFoundUser(null);
    try {
      const res = await fetch('/api/user/actions', {
        method: 'POST',
        body: JSON.stringify({ action: 'search', phone: searchPhone })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFoundUser(data.user);
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!foundUser || !amount) return;
    setIsLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/user/actions', {
        method: 'POST',
        body: JSON.stringify({ 
          action: 'transfer', 
          fromPhone: currentUser.phone, 
          toPhone: foundUser.phone, 
          amount 
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      onUpdatePoints(data.newPoints);
      setMsg({ type: 'success', text: `成功转账 ${amount} 积分给 ${foundUser.nickname}!` });
      setAmount('');
      setFoundUser(null);
      setSearchPhone('');
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#1a1c23] border border-gray-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-500 hover:text-white">
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <Coins className="text-yellow-500" /> 积分管理
        </h2>

        <div className="bg-gray-900 rounded-xl p-4 mb-6 flex justify-between items-center border border-gray-800">
           <span className="text-gray-400 text-sm">当前积分</span>
           <span className="text-2xl font-bold text-yellow-500">{currentUser.points}</span>
        </div>

        {msg && (
          <div className={`mb-4 p-2 text-sm rounded text-center border ${msg.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-green-500/10 border-green-500/30 text-green-400'}`}>
            {msg.text}
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-1">
             <label className="text-xs text-gray-400">查找用户 (手机号)</label>
             <div className="flex gap-2">
               <input 
                  type="text" 
                  value={searchPhone}
                  onChange={e => setSearchPhone(e.target.value)}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-500"
                  placeholder="输入对方手机号"
               />
               <button 
                 onClick={handleSearch}
                 disabled={isLoading}
                 className="bg-blue-600 hover:bg-blue-500 px-4 rounded-lg text-white disabled:opacity-50"
               >
                 {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
               </button>
             </div>
          </div>

          {foundUser && (
            <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 animate-in zoom-in duration-200">
               <div className="flex justify-between text-sm mb-3">
                 <span className="text-gray-400">接收人:</span>
                 <span className="text-white font-bold">{foundUser.nickname} ({foundUser.phone})</span>
               </div>
               
               <div className="space-y-1">
                 <label className="text-xs text-gray-400">转账金额</label>
                 <div className="flex gap-2">
                   <input 
                      type="number" 
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-500"
                      placeholder="数量"
                   />
                   <button 
                     onClick={handleTransfer}
                     disabled={isLoading || !amount}
                     className="bg-yellow-600 hover:bg-yellow-500 px-6 rounded-lg text-white font-bold disabled:opacity-50 flex items-center gap-2"
                   >
                     {isLoading ? <Loader2 className="animate-spin" size={16} /> : <><Send size={16} /> 转账</>}
                   </button>
                 </div>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
