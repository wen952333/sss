
import React from 'react';
import { User } from '../types';

interface AdminPanelProps {
  userList: User[];
  onClose: () => void;
  onDeleteUser: (id: number) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ userList, onClose, onDeleteUser }) => {
  return (
    <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-fade-in fixed">
      <div className="bg-gray-800 border-2 border-red-500 w-full max-w-2xl rounded-xl p-6 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
         <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-red-400">🛡️ 管理员面板</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
         </div>
         <div className="overflow-y-auto flex-1 pr-2">
            <table className="w-full text-left border-collapse">
               <thead>
                 <tr className="border-b border-gray-700 text-gray-400">
                   <th className="p-2">ID</th>
                   <th className="p-2">Name</th>
                   <th className="p-2">Points</th>
                   <th className="p-2">Action</th>
                 </tr>
               </thead>
               <tbody>
                  {userList.map(u => (
                     <tr key={u.telegram_id} className="border-b border-gray-700/50 hover:bg-white/5">
                        <td className="p-2 font-mono text-sm text-gray-400">{u.telegram_id}</td>
                        <td className="p-2 text-yellow-200">{u.username}</td>
                        <td className="p-2">{u.points.toLocaleString()}</td>
                        <td className="p-2">
                          <button 
                            onClick={() => onDeleteUser(u.telegram_id)} 
                            className="bg-red-600 hover:bg-red-500 text-white text-xs px-3 py-1 rounded transition-colors"
                          >
                            Del
                          </button>
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};
