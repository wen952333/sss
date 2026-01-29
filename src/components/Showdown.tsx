
import React from 'react';
import { PlayerHand } from '../types';
import { Card } from './Card';
import { User } from 'lucide-react';

interface ShowdownProps {
  isVisible: boolean;
  playerHand: PlayerHand;
  onNextRound: () => void;
}

export const Showdown: React.FC<ShowdownProps> = ({ isVisible, playerHand, onNextRound }) => {
  return (
    <div className="w-full h-full flex items-center justify-center p-4">
        <div className="w-full max-w-4xl mx-auto text-center">
            {!isVisible ? (
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full"></div>
                    <p className="text-xl text-gray-300">正在比牌中...</p>
                </div>
            ) : (
                <div className="bg-gray-800/90 backdrop-blur-md p-8 rounded-2xl shadow-2xl border border-gray-700 animate-in zoom-in duration-300">
                    <h2 className="text-3xl font-bold text-white mb-6">本局结算</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                        {/* Player Hand Display */}
                        <div className="bg-black/30 p-4 rounded-xl border border-green-500/30">
                            <h3 className="text-green-400 font-bold mb-4 uppercase tracking-wider">我的手牌</h3>
                            <div className="space-y-4">
                                <div className="flex justify-center gap-1 scale-75 origin-center">
                                    {playerHand.front.map(c => <Card key={c.id} card={c} />)}
                                </div>
                                <div className="w-full h-px bg-white/10"></div>
                                <div className="flex justify-center gap-1 scale-75 origin-center">
                                    {playerHand.middle.map(c => <Card key={c.id} card={c} />)}
                                </div>
                                <div className="w-full h-px bg-white/10"></div>
                                <div className="flex justify-center gap-1 scale-75 origin-center">
                                    {playerHand.back.map(c => <Card key={c.id} card={c} />)}
                                </div>
                            </div>
                        </div>

                        {/* Summary */}
                        <div className="flex flex-col justify-center items-center gap-4 text-gray-400">
                            <User size={48} />
                            <p>其他三家 (阿龙, 小虎, 老凤) 已完成比牌。</p>
                            <div className="text-yellow-500 font-bold text-2xl mt-4">
                                +3 水 (模拟结果)
                            </div>
                        </div>
                    </div>

                    <button 
                        onClick={onNextRound}
                        className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-3 px-8 rounded-full transition-all shadow-lg shadow-yellow-900/50"
                    >
                        下一局
                    </button>
                </div>
            )}
        </div>
    </div>
  );
};
