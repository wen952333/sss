
import React from 'react';
import { useGameLogic } from './hooks/useGameLogic';
import { useAuth } from './hooks/useAuth';
import { ArrangementBoard } from './components/ArrangementBoard';
import { Lobby } from './components/Lobby';
import { Header } from './components/Header';
import { OpponentsBar } from './components/OpponentsBar';
import { Showdown } from './components/Showdown';
import { AuthModal } from './components/AuthModal';
import { PointsModal } from './components/PointsModal';
import { AlertCircle } from 'lucide-react';

function App() {
  const {
    gameState,
    arrangedHand,
    selectedCards,
    showResult,
    currentTable,
    currentSeat,
    errorMsg,
    isAiThinking,
    handleJoinGame,
    exitGame,
    handleCardInteraction,
    handleRowClick,
    handleSmartArrange,
    handleSubmit,
    startGame
  } = useGameLogic();

  const { 
    user, login, logout, updatePoints, 
    isAuthModalOpen, setIsAuthModalOpen, 
    isPointsModalOpen, setIsPointsModalOpen 
  } = useAuth();

  const handleOpenRecords = () => {
    alert("战绩记录功能开发中...\n这里将显示您的历史对局和胜率。");
  };

  const onJoinWithAuth = (tableId: number, seatId: string) => {
    if (!user) {
        setIsAuthModalOpen(true);
        return;
    }
    handleJoinGame(tableId, seatId);
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#121418] text-gray-100 flex flex-col font-sans selection:bg-yellow-500 selection:text-black">
      
      <Header 
        currentTable={currentTable} 
        currentSeat={currentSeat} 
        isInGame={gameState !== 'lobby'} 
        onExit={exitGame} 
        onOpenRecords={handleOpenRecords}
        user={user}
        onLoginClick={() => setIsAuthModalOpen(true)}
        onLogoutClick={logout}
        onPointsClick={() => setIsPointsModalOpen(true)}
      />

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        onLoginSuccess={login} 
      />

      {user && (
        <PointsModal
          isOpen={isPointsModalOpen}
          onClose={() => setIsPointsModalOpen(false)}
          currentUser={user}
          onUpdatePoints={updatePoints}
        />
      )}

      <main className="flex-1 relative w-full h-full flex flex-col overflow-hidden bg-[radial-gradient(circle_at_center,_#1f2937_0%,_#0f1115_100%)]">
        
        {/* Lobby Phase */}
        {gameState === 'lobby' && (
            <div className="w-full h-full flex items-center justify-center animate-in fade-in zoom-in duration-500">
               <Lobby onJoin={onJoinWithAuth} />
            </div>
        )}

        {/* Arranging Phase */}
        {gameState === 'arranging' && (
            <div className="w-full h-full flex flex-col animate-in slide-in-from-bottom-10 duration-500">
                <OpponentsBar />

                {errorMsg && (
                    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-blue-600/90 text-white px-6 py-2 rounded-full shadow-lg flex items-center gap-2 animate-in slide-in-from-top-2">
                        <AlertCircle size={18} />
                        <span className="text-sm font-bold">{errorMsg}</span>
                    </div>
                )}

                <div className="flex-1 w-full overflow-hidden p-2 sm:p-4">
                    <ArrangementBoard 
                        arrangedHand={arrangedHand}
                        selectedCards={selectedCards}
                        onCardClick={handleCardInteraction}
                        onRowClick={handleRowClick}
                        onSubmit={handleSubmit}
                        onSmartArrange={handleSmartArrange}
                        isAiLoading={isAiThinking}
                    />
                </div>
            </div>
        )}

        {/* Showdown Phase */}
        {gameState === 'showdown' && (
            <Showdown 
                isVisible={showResult} 
                playerHand={arrangedHand} 
                onNextRound={startGame} 
            />
        )}

      </main>
    </div>
  );
}

export default App;
