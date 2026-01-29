
import React from 'react';
import { OPPONENTS } from '../constants';

export const OpponentsBar: React.FC = () => {
  return (
    <div className="flex-none h-16 sm:h-20 flex justify-center items-center gap-8 border-b border-gray-800/50 bg-black/20 backdrop-blur-sm z-10">
        {OPPONENTS.map(opp => (
            <div key={opp.id} className="flex flex-col items-center gap-1 opacity-70">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center text-sm shadow-inner">
                    👤
                </div>
                <span className="text-[10px] sm:text-xs text-gray-400 font-medium">{opp.name}</span>
            </div>
        ))}
    </div>
  );
};
