
import React, { useState, useEffect } from 'react';
import { Card, GameState, Seat } from '../types';
import { CardComponent } from '../components/CardComponent';

interface SettlementViewProps {
    report: GameState['settlementReport'];
    currentUser: GameState['user'];
    onBack: () => void;
    onRefresh: () => Promise<void>;
}

export const SettlementView: React.FC<SettlementViewProps> = ({ report, currentUser, onBack, onRefresh }) => {
    const [tableIndex, setTableIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(!report);

    useEffect(() => {
        if(!report) {
            onRefresh().then(() => setIsLoading(false));
        } else {
            setIsLoading(false);
        }
    }, []);

    const handleRefreshClick = async () => {
        setIsLoading(true);
        await onRefresh();
        setIsLoading(false);
    };

    if (isLoading) return (
        <div className="h-full w-full flex items-center justify-center bg-green-950">
            <div className="text-yellow-400 animate-pulse">正在获取最新战绩...</div>
        </div>
    );

    if (!report || report.details.length === 0) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center bg-green-950 p-4">
                <div className="text-white/50 mb-4">暂无战绩数据</div>
                <button onClick={handleRefreshClick} className="px-6 py-2 bg-yellow-600 rounded text-white">刷新</button>
                <button onClick={onBack} className="mt-4 text-white/30">返回大厅</button>
            </div>
        );
    }

    const { details, totalScore } = report;
    const safeIndex = Math.min(tableIndex, details.length - 1);
    const currentTable = details[safeIndex];
    const { voided } = currentTable;

    const renderPlayerCell = (seat: Seat) => {
        const p = currentTable.details.find((d: any) => d.seat === seat);
        
        // --- VOIDED STATE ---
        // If voided, strictly do not show cards.
        if (voided) {
            if (!p) return <div className="w-full h-full bg-black/20 border border-white/5"></div>;
            return (
                <div className="w-full h-full flex flex-col items-center justify-center bg-black/40 border border-white/10 p-2">
                    <div className="text-white/40 font-bold mb-1 text-sm tracking-widest">无效局</div>
                    <div className="text-[10px] text-white/30">{p.name}</div>
                    <div className="text-[10px] text-white/20 mt-2">牌局人数不足</div>
                </div>
            );
        }

        if (!p) {
            return (
                <div className="w-full h-full flex flex-col items-center justify-center border border-white/5 bg-black/20 text-white/20">
                    <div className="text-sm">空座</div>
                </div>
            );
        }

        const isPending = !p.hand; 
        const isMe = currentUser && p.playerId === `u_${currentUser.id}`;
        
        return (
            <div className={`relative w-full h-full flex flex-col items-center justify-center p-1 border border-white/10 ${isMe ? 'bg-yellow-900/10' : 'bg-black/20'}`}>
                <div className="absolute top-1 left-1 right-1 flex justify-between items-center z-20">
                    <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isMe ? 'bg-yellow-600 text-white' : 'bg-black/50 text-white/70'}`}>
                        {p.name}
                    </div>
                    {!isPending && (
                        <div className={`text-sm font-black font-mono ${p.score >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                            {p.score > 0 ? '+' : ''}{p.score}
                        </div>
                    )}
                </div>

                <div className="w-full flex-1 flex items-center justify-center mt-4">
                    {isPending ? (
                        <div className="text-white/30 animate-pulse text-xs">Waiting...</div>
                    ) : p.specialType ? (
                        <div className="w-full h-full flex items-center justify-center">
                            <div className="bg-gradient-to-br from-yellow-600/40 to-black border border-yellow-500/50 px-4 py-2 rounded-lg">
                                <span className="text-yellow-400 font-black text-lg">{p.specialType}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-1.5 items-center w-full">
                            <div className="flex -space-x-8 justify-center w-full">
                                {p.hand.top.map((c:Card, i:number) => <CardComponent key={i} card={c} small className="!w-14 !h-20 sm:!w-20 sm:!h-28 shadow-md ring-1 ring-black/30" />)}
                            </div>
                            <div className="flex -space-x-8 justify-center w-full">
                                {p.hand.middle.map((c:Card, i:number) => <CardComponent key={i} card={c} small className="!w-14 !h-20 sm:!w-20 sm:!h-28 shadow-md ring-1 ring-black/30" />)}
                            </div>
                            <div className="flex -space-x-8 justify-center w-full">
                                {p.hand.bottom.map((c:Card, i:number) => <CardComponent key={i} card={c} small className="!w-14 !h-20 sm:!w-20 sm:!h-28 shadow-md ring-1 ring-black/30" />)}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="h-full w-full bg-green-950 flex flex-col overflow-hidden relative">
            <div className="shrink-0 h-14 bg-black/30 backdrop-blur flex justify-between items-center px-4 border-b border-white/5 z-20">
                 <button onClick={onBack} className="flex items-center text-white/70 hover:text-white">
                     <span className="text-lg mr-1">‹</span> 返回
                 </button>
                 <div className="flex flex-col items-center">
                      <div className="text-yellow-400 font-bold">局数 {currentTable.tableId + 1}</div>
                      <div className="text-[10px] text-white/40">总分: <span className={totalScore>=0?'text-red-400':'text-green-400'}>{totalScore}</span></div>
                 </div>
                 <button onClick={handleRefreshClick} className="text-sm bg-white/10 px-3 py-1 rounded text-white hover:bg-white/20">刷新</button>
            </div>

            <div className="flex-1 relative">
                <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 bg-[radial-gradient(circle_at_center,_#1e6f3e,_#0f3922)]">
                    <div className="border-r border-b border-white/10">{renderPlayerCell('North')}</div>
                    <div className="border-b border-white/10">{renderPlayerCell('East')}</div>
                    <div className="border-r border-white/10">{renderPlayerCell('West')}</div>
                    <div>{renderPlayerCell('South')}</div>
                </div>

                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none w-full flex justify-center">
                    {voided ? (
                        <div className="bg-black/90 px-6 py-3 rounded-2xl border border-red-500/50 backdrop-blur flex flex-col items-center shadow-2xl">
                            <div className="text-red-500 font-black text-2xl tracking-widest">无效局</div>
                            <div className="text-white/60 text-xs mt-1">人数不足 (Score: 0)</div>
                        </div>
                    ) : (
                        <div className="w-12 h-12 bg-black/50 rounded-full flex items-center justify-center border border-white/10 shadow-xl backdrop-blur">
                            <span className="text-yellow-500/50 font-black text-xl italic">VS</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="h-20 bg-black/40 backdrop-blur-md flex items-center justify-between px-6 pb-4 border-t border-white/10 z-20">
                <button 
                    onClick={() => setTableIndex(Math.max(0, safeIndex - 1))}
                    disabled={safeIndex === 0}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-30 rounded-lg text-white font-bold"
                >
                    &lt; 上一局
                </button>
                <span className="text-yellow-400 font-black text-xl font-mono">{safeIndex + 1} <span className="text-white/40 text-sm">/ {details.length}</span></span>
                <button 
                    onClick={() => setTableIndex(Math.min(details.length - 1, safeIndex + 1))}
                    disabled={safeIndex >= details.length - 1}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-30 rounded-lg text-white font-bold"
                >
                    下一局 &gt;
                </button>
            </div>
        </div>
    );
};
