
import React, { useState, useEffect } from 'react';
import { GamePhase, GameMode } from './types';
import { useTelegram } from './hooks/useTelegram';
import { useGameLogic } from './hooks/useGameLogic';
import { MainMenu } from './components/MainMenu';
import { GameBoard } from './components/GameBoard';
import { RoomLobby } from './components/RoomLobby';
import { AdminPanel } from './components/AdminPanel';
import { getMuteState, toggleMute } from './services/audioService';
import { BOT_USERNAME } from './constants';

const App: React.FC = () => {
  // 1. Hooks Initialization
  const { 
    currentUser, 
    setCurrentUser, 
    isPaying, 
    handleBuyStars, 
    tg, 
    adminUserList, 
    handleDeleteUser,
    startParam,
    isMockMode
  } = useTelegram();

  const {
    gameState,
    myPlayerId,
    startDealing,
    handleBid,
    playTurn,
    handleCreateRoom,
    handleJoinRoom,
    handleAutoMatch,
    resetGame,
    isMatching,
    setIsMatching
  } = useGameLogic(currentUser, setCurrentUser);

  const [isSoundOn, setIsSoundOn] = useState(!getMuteState());
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [hasCheckedInToday, setHasCheckedInToday] = useState(false);

  useEffect(() => {
    if (currentUser?.last_check_in_date) {
        const today = new Date().toISOString().split('T')[0];
        setHasCheckedInToday(currentUser.last_check_in_date === today);
    }
  }, [currentUser]);

  useEffect(() => {
    if (startParam && startParam.startsWith('room_') && currentUser) {
        handleJoinRoom(startParam);
    }
  }, [startParam, currentUser]);

  const handleToggleSound = () => {
    const isMuted = toggleMute();
    setIsSoundOn(!isMuted);
  };

  const handleDailyCheckIn = () => {
    if (!currentUser) return;
    const today = new Date().toISOString().split('T')[0];
    const updatedUser = { ...currentUser, points: currentUser.points + 1000, last_check_in_date: today };
    setCurrentUser(updatedUser);
    tg.showAlert("签到成功！获得 1000 积分！");
  };

  const handleGameStartRequest = (mode: 'pve' | 'friends' | 'match', isNoShuffle: boolean) => {
    if (!currentUser) return;
    if (currentUser.points < 100) {
        tg.showAlert("积分不足 (需100)，请签到或购买！");
        return;
    }
    
    // const myName = currentUser.username; // 不再需要手动传递名字，startDealing 内部处理

    if (mode === 'pve') {
        startDealing(isNoShuffle, GameMode.PvE);
    } else if (mode === 'friends') {
        if (isMockMode) {
             tg.showAlert("【模拟模式】自动创建本地多人局");
             startDealing(isNoShuffle, GameMode.Friends); // Mock mode fallback
        } else {
             handleCreateRoom();
        }
    } else if (mode === 'match') {
        handleAutoMatch();
    }
  };

  const handleShareRoom = () => {
     if (!gameState.roomId) return;
     
     const botName = BOT_USERNAME || "GeminiDouDizhuBot";
     const gameLink = `https://t.me/${botName}/app?startapp=${gameState.roomId}`;
     const shareText = `🃏 三缺一！${currentUser?.username || '我'} 邀请你来斗地主！\n房间号: ${gameState.roomId}\n点击链接直接加入 👇`;
     
     const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(gameLink)}&text=${encodeURIComponent(shareText)}`;
     
     tg.openTelegramLink(shareUrl);
  };

  const handleRestart = () => {
      if (gameState.mode === 'FRIENDS' && myPlayerId !== 0) {
          tg.showAlert("只有房主可以重新开始游戏。");
          return;
      }
      startDealing(false, gameState.mode);
  };

  const handleOpenGroup = () => {
      const groupLink = (import.meta as any).env?.VITE_TELEGRAM_GROUP_LINK || "https://t.me/GeminiDouDizhuGroup";
      tg.openTelegramLink(groupLink);
  };

  return (
    <>
      {showAdminPanel && currentUser?.is_admin && (
        <AdminPanel 
          userList={adminUserList} 
          onClose={() => setShowAdminPanel(false)} 
          onDeleteUser={handleDeleteUser} 
        />
      )}

      {gameState.phase === GamePhase.MainMenu && (
        <MainMenu
          user={currentUser}
          onCheckIn={handleDailyCheckIn}
          hasCheckedIn={hasCheckedInToday}
          onToggleSound={handleToggleSound}
          isSoundOn={isSoundOn}
          onBuyPoints={handleBuyStars}
          isPaying={isPaying}
          onOpenGroup={handleOpenGroup}
          onOpenAdmin={() => setShowAdminPanel(true)}
          onStartGame={handleGameStartRequest}
          isMatching={isMatching}
        />
      )}

      {gameState.phase === GamePhase.RoomLobby && (
        <RoomLobby 
           gameState={gameState} 
           onShare={handleShareRoom} 
           onExit={resetGame} 
        />
      )}

      {(gameState.phase === GamePhase.Dealing || 
        gameState.phase === GamePhase.Bidding || 
        gameState.phase === GamePhase.Playing || 
        gameState.phase === GamePhase.GameOver) && (
        <GameBoard
          gameState={gameState}
          myPlayerId={myPlayerId}
          onBid={handleBid}
          onPlayTurn={playTurn}
          onExit={resetGame}
          onRestart={handleRestart}
          onToggleSound={handleToggleSound}
          isSoundOn={isSoundOn}
        />
      )}
    </>
  );
};

export default App;
