
import React from 'react';

interface LobbyProps {
  onJoin: (tableId: number, seatId: string) => void;
}

const SEATS = [
  { id: 'north', label: '北', position: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2' },
  { id: 'east', label: '东', position: 'top-1/2 right-0 translate-x-1/2 -translate-y-1/2' },
  { id: 'south', label: '南', position: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2' },
  { id: 'west', label: '西', position: 'top-1/2 left-0 -translate-x-1/2 -translate-y-1/2' },
];

export const Lobby: React.FC<LobbyProps> = ({ onJoin }) => {
  const tables = [1, 2];

  return (
    <div className="flex flex-col items-center justify-center w-full h-full">
      <div className="flex flex-wrap items-center justify-center gap-24 md:gap-48">
        {tables.map((tableId) => (
          <div key={tableId} className="relative w-[300px] h-[160px] md:w-[380px] md:h-[200px] group transition-transform hover:scale-105 duration-300">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95%] h-[90%] bg-black/70 blur-2xl rounded-[40px] translate-y-6"></div>
            <div className="absolute inset-0 bg-[#2d1b0e] rounded-[40px] translate-y-2 shadow-lg"></div>
            <div className="absolute inset-0 bg-gradient-to-b from-[#6b4423] via-[#543319] to-[#36200e] rounded-[40px] shadow-[inset_0_2px_4px_rgba(255,255,255,0.15),0_4px_8px_rgba(0,0,0,0.5)] border border-[#4a2c15]"></div>
            <div className="absolute top-3 left-3 right-3 bottom-3 bg-[#0f3d20] rounded-[28px] shadow-[inset_0_5px_15px_rgba(0,0,0,0.6)] overflow-hidden border border-[#092211]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.1)_0%,_transparent_70%)]"></div>
                <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/felt.png')] mix-blend-overlay"></div>
                <div className="absolute top-4 left-4 right-4 bottom-4 border border-yellow-500/10 rounded-[16px]"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                   <span className="text-4xl font-serif font-bold text-yellow-400/20 tracking-widest pointer-events-none select-none drop-shadow-md">
                      {tableId}
                   </span>
                </div>
            </div>

            {SEATS.map((seat) => (
              <button
                key={seat.id}
                onClick={() => onJoin(tableId, seat.id)}
                className={`
                  absolute ${seat.position}
                  w-12 h-12 md:w-14 md:h-14 rounded-full 
                  flex items-center justify-center
                  bg-[#1f2937] hover:bg-[#ca8a04] hover:text-white
                  border-2 border-[#4b5563] hover:border-[#fde047]
                  text-gray-400 font-serif font-bold text-lg md:text-xl
                  shadow-[0_4px_8px_rgba(0,0,0,0.6)]
                  transition-all duration-200 z-10
                `}
              >
                {seat.label}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
