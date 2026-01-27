
import React from 'react';
import { GameState } from '../types';

interface RoomLobbyProps {
  gameState: GameState;
  onShare: () => void;
  onExit: () => void;
}

export const RoomLobby: React.FC<RoomLobbyProps> = ({ gameState, onShare, onExit }) => {
  return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-gray-900 to-gray-800 text-white fixed inset-0 z-50">
          <h2 className="text-3xl font-bold text-yellow-400 mb-4 tracking-wider">房间大厅</h2>
          
          <div className="bg-black/40 px-6 py-3 rounded-full font-mono mb-10 text-xl border border-white/10 select-text">
            房间号: <span className="text-green-400 font-bold">{gameState.roomId}</span>
          </div>

          <div className="flex gap-4 mb-12">
             {gameState.players.map((p, idx) => (
                 <div key={idx} className={`w-28 h-36 border-2 rounded-xl flex flex-col items-center justify-center transition-all ${p.isReady ? 'border-green-500 bg-green-900/30' : 'border-gray-600 border-dashed opacity-50'}`}>
                     <div className="text-4xl mb-3">{p.isReady ? '👤' : '?'}</div>
                     <div className="text-sm text-center px-1 truncate w-full font-bold">{p.name}</div>
                     <div className={`text-xs mt-2 ${p.isReady ? 'text-green-400' : 'text-gray-400'}`}>
                       {p.isReady ? '已准备' : '等待邀请'}
                     </div>
                 </div>
             ))}
          </div>

          <div className="space-y-4 w-full max-w-xs">
              <button 
                onClick={onShare} 
                className="bg-blue-600 hover:bg-blue-500 w-full py-3 rounded-full font-bold shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95"
              >
                  <span>📤</span> 发送邀请链接
              </button>
              
              <div className="text-center text-sm text-gray-400 py-2">
                当前人数: <span className="text-white">{gameState.players.filter(p=>p.isReady).length}</span>/3
                <br/>
                <span className="text-xs opacity-70">(人满后房主自动开始)</span>
              </div>
              
              <button 
                onClick={onExit} 
                className="text-gray-400 hover:text-white underline text-sm w-full text-center p-2"
              >
                退出房间
              </button>
          </div>
      </div>
  );
};
