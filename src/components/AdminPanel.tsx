
import React, { useState, useEffect } from 'react';
import { User, PaymentRecord } from '../types';

interface AdminPanelProps {
  userList: User[];
  onClose: () => void;
  onDeleteUser: (id: number) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ userList, onClose, onDeleteUser }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'payments'>('users');
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'payments') fetchPayments();
  }, [activeTab]);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/payments');
      const data = await res.json();
      if (data.success) setPayments(data.payments);
    } catch (e) {} finally { setLoading(false); }
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4 fixed">
      <div className="bg-gray-800 border-2 border-red-500 w-full max-w-3xl rounded-xl p-6 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
         <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-red-400">🛡️ 管理面板</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-xl p-2">✕</button>
         </div>

         <div className="flex gap-2 mb-4 border-b border-gray-700 pb-2">
            <button 
                onClick={() => setActiveTab('users')}
                className={`px-4 py-2 rounded-t-lg font-bold transition-colors ${activeTab === 'users' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300'}`}
            >
                用户列表
            </button>
            <button 
                onClick={() => setActiveTab('payments')}
                className={`px-4 py-2 rounded-t-lg font-bold transition-colors ${activeTab === 'payments' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300'}`}
            >
                充值流水
            </button>
         </div>

         <div className="overflow-y-auto flex-1 bg-black/20 rounded-lg p-4">
            {activeTab === 'users' && (
              <table className="w-full text-left text-sm">
                 <thead><tr className="border-b border-gray-700 text-gray-400"><th className="p-2">Username</th><th className="p-2">Points</th><th className="p-2">Action</th></tr></thead>
                 <tbody>
                    {userList.map(u => (
                       <tr key={u.telegram_id} className="border-b border-gray-700/50">
                          <td className="p-2 text-yellow-200">{u.username}</td>
                          <td className="p-2 font-mono">{u.points}</td>
                          <td className="p-2"><button onClick={() => onDeleteUser(u.telegram_id)} className="text-red-500 underline text-xs">删除</button></td>
                       </tr>
                    ))}
                 </tbody>
              </table>
            )}

            {activeTab === 'payments' && (
              <div className="space-y-2">
                {loading ? <div className="text-center p-10">加载中...</div> : (
                  payments.length === 0 ? <div className="text-center p-10 text-gray-500">暂无数据</div> : (
                    payments.map(p => (
                      <div key={p.id} className="text-xs border-b border-gray-700 pb-2 mb-2 flex justify-between items-center">
                        <div>
                          <span className="text-yellow-400 font-bold">{p.username}</span>
                          <span className="text-gray-500 ml-2">{p.created_at}</span>
                        </div>
                        <div className="text-green-400">+{p.amount} Stars</div>
                      </div>
                    ))
                  )
                )}
              </div>
            )}
         </div>
      </div>
    </div>
  );
};
