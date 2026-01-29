
import React, { useState } from 'react';
import { X, Phone, Lock, User, Loader2 } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: any) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'login' ? { phone, password } : { phone, password, nickname };
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || '操作失败');
      
      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err.message);
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
        
        <h2 className="text-2xl font-bold text-white mb-6 text-center">
          {mode === 'login' ? '登录游戏' : '注册账号'}
        </h2>

        {error && <div className="mb-4 p-2 bg-red-500/20 border border-red-500/50 text-red-400 text-sm rounded text-center">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-gray-400 ml-1">手机号</label>
            <div className="relative">
              <Phone className="absolute left-3 top-3 text-gray-500" size={18} />
              <input 
                type="text" 
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl py-2.5 pl-10 pr-4 text-white focus:border-yellow-500 focus:outline-none transition-colors"
                placeholder="请输入手机号"
                required
              />
            </div>
          </div>

          {mode === 'register' && (
            <div className="space-y-1 animate-in slide-in-from-top-2">
              <label className="text-xs text-gray-400 ml-1">昵称</label>
              <div className="relative">
                <User className="absolute left-3 top-3 text-gray-500" size={18} />
                <input 
                  type="text" 
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl py-2.5 pl-10 pr-4 text-white focus:border-yellow-500 focus:outline-none"
                  placeholder="设置游戏昵称"
                  required
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs text-gray-400 ml-1">密码 (6位以上)</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-gray-500" size={18} />
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl py-2.5 pl-10 pr-4 text-white focus:border-yellow-500 focus:outline-none"
                placeholder="设置密码"
                required
                minLength={6}
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-yellow-900/30 flex items-center justify-center gap-2 mt-4"
          >
            {isLoading ? <Loader2 className="animate-spin" /> : (mode === 'login' ? '登 录' : '注 册')}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-400">
          {mode === 'login' ? '还没有账号? ' : '已有账号? '}
          <button 
            onClick={() => { setError(''); setMode(mode === 'login' ? 'register' : 'login'); }}
            className="text-yellow-500 hover:underline font-medium"
          >
            {mode === 'login' ? '立即注册' : '去登录'}
          </button>
        </div>
      </div>
    </div>
  );
};
