
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
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [totalRevenue, setTotalRevenue] = useState(0);

  // Fetch payments when tab switches
  useEffect(() => {
    if (activeTab === 'payments') {
      fetchPayments();
    }
  }, [activeTab]);

  const fetchPayments = async () => {
    setLoadingPayments(true);
    try {
      const res = await fetch('/api/admin/payments');
      const data = await res.json();
      if (data.success) {
        setPayments(data.payments);
        // Calculate total revenue from the fetched batch (or ideally from a separate stats API)
        const total = data.payments.reduce((sum: number, p: PaymentRecord) => sum + (p.amount || 0), 0);
        setTotalRevenue(total);
      }
    } catch (e) {
      console.error("Failed to fetch payments", e);
    } finally {
      setLoadingPayments(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-fade-in fixed">
      <div className="bg-gray-800 border-2 border-red-500 w-full max-w-3xl rounded-xl p-6 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
         
         {/* Header */}
         <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-red-400 flex items-center gap-2">
              🛡️ 管理员面板
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-xl p-2">✕</button>
         </div>

         {/* Tabs */}
         <div className="flex gap-2 mb-4 border-b border-gray-700 pb-2">
            <button 
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 rounded-t-lg font-bold transition-colors ${activeTab === 'users' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            >
              用户管理 ({userList.length})
            </button>
            <button 
              onClick={() => setActiveTab('payments')}
              className={`px-4 py-2 rounded-t-lg font-bold transition-colors ${activeTab === 'payments' ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            >
              收入流水
            </button>
         </div>

         {/* Content Area */}
         <div className="overflow-y-auto flex-1 pr-2 bg-black/20 rounded-lg p-2">
            
            {/* USERS TAB */}
            {activeTab === 'users' && (
              <table className="w-full text-left border-collapse">
                 <thead>
                   <tr className="border-b border-gray-700 text-gray-400 text-sm">
                     <th className="p-2">ID</th>
                     <th className="p-2">Name</th>
                     <th className="p-2">Points</th>
                     <th className="p-2">Check-in</th>
                     <th className="p-2">Action</th>
                   </tr>
                 </thead>
                 <tbody>
                    {userList.map(u => (
                       <tr key={u.telegram_id} className="border-b border-gray-700/50 hover:bg-white/5 text-sm">
                          <td className="p-2 font-mono text-gray-500">{u.telegram_id}</td>
                          <td className="p-2 text-yellow-200">
                            {u.username}
                            {u.is_admin && <span className="ml-1 text-red-500 text-xs border border-red-500 px-1 rounded">ADMIN</span>}
                          </td>
                          <td className="p-2">{u.points.toLocaleString()}</td>
                          <td className="p-2 text-xs text-gray-400">{u.last_check_in_date || '-'}</td>
                          <td className="p-2">
                            <button 
                              onClick={() => onDeleteUser(u.telegram_id)} 
                              className="bg-red-900/50 hover:bg-red-600 text-red-200 hover:text-white text-xs px-2 py-1 rounded transition-colors border border-red-800"
                            >
                              删除
                            </button>
                          </td>
                       </tr>
                    ))}
                 </tbody>
              </table>
            )}

            {/* PAYMENTS TAB */}
            {activeTab === 'payments' && (
              <div className="flex flex-col h-full">
                {/* Revenue Summary Card */}
                <div className="mb-4 bg-gradient-to-r from-yellow-900/50 to-yellow-600/20 border border-yellow-500/30 p-4 rounded-lg flex items-center justify-between">
                    <div>
                        <div className="text-yellow-400 text-sm uppercase tracking-wider font-bold">总收入 (Stars)</div>
                        <div className="text-3xl font-bold text-white mt-1">⭐ {totalRevenue.toLocaleString()}</div>
                    </div>
                    <div className="text-right text-xs text-gray-400">
                        <div>最近 50 笔交易</div>
                        <div>实时同步</div>
                    </div>
                </div>

                <div className="flex-1 overflow-auto">
                    {loadingPayments ? (
                    <div className="text-center py-8 text-gray-400">加载中...</div>
                    ) : payments.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">暂无支付记录 (去买点星星测试一下？)</div>
                    ) : (
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-gray-800 z-10">
                        <tr className="border-b border-gray-700 text-gray-400 text-sm">
                            <th className="p-2">Time</th>
                            <th className="p-2">User</th>
                            <th className="p-2">Product</th>
                            <th className="p-2 text-right">Amount</th>
                            <th className="p-2">Tx ID</th>
                        </tr>
                        </thead>
                        <tbody>
                        {payments.map(p => (
                            <tr key={p.id} className="border-b border-gray-700/50 hover:bg-white/5 text-sm">
                            <td className="p-2 text-gray-400 text-xs whitespace-nowrap">{new Date(p.created_at).toLocaleString()}</td>
                            <td className="p-2 text-yellow-200">
                                <div className="font-bold">{p.username}</div>
                                <div className="text-[10px] text-gray-500 font-mono">{p.telegram_id}</div>
                            </td>
                            <td className="p-2 text-blue-300">{p.product}</td>
                            <td className="p-2 text-yellow-400 font-bold text-right">⭐ {p.amount}</td>
                            <td className="p-2 font-mono text-[10px] text-gray-500 truncate max-w-[80px]" title={p.telegram_payment_charge_id}>
                                {p.telegram_payment_charge_id}
                            </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                    )}
                </div>
              </div>
            )}
         </div>
      </div>
    </div>
  );
};
