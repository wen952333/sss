
import React, { useState, useEffect } from 'react';
import { GamePhase } from './types';
import { useTelegram } from './hooks/useTelegram';
import { useGameLogic } from './hooks/useGameLogic';
import { MainMenu } from './components/MainMenu';
import { GameBoard } from './components/GameBoard';
import { RoomLobby } from './components/RoomLobby';
import { AdminPanel } from './components/AdminPanel';
import { getMuteState, toggleMute } from './services/audioService';
import { BOT_USERNAME } from './constants'; // 导入 Bot 用户名配置

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

  // 2. Local UI State
  const [isSoundOn, setIsSoundOn] = useState(!getMuteState());
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [hasCheckedInToday, setHasCheckedInToday] = useState(false);

  // 3. Effects
  useEffect(() => {
    // Sync check-in status
    if (currentUser?.last_check_in_date) {
        const today = new Date().toISOString().split('T')[0];
        setHasCheckedInToday(currentUser.last_check_in_date === today);
    }
  }, [currentUser]);

  // Handle auto-join from Telegram deep links
  useEffect(() => {
    if (startParam && startParam.startsWith('room_') && currentUser) {
        handleJoinRoom(startParam);
    }
  }, [startParam, currentUser]);

  // 4. Action Handlers
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
    
    // Deduct points locally (in a real app, verify on server)
    // setCurrentUser({ ...currentUser, points: currentUser.points - 100 });

    const myName = currentUser.username;

    if (mode === 'pve') {
        startDealing([myName, "电脑 (左)", "电脑 (右)"], isNoShuffle);
    } else if (mode === 'friends') {
        if (isMockMode) {
             tg.showAlert("【模拟模式】自动创建本地多人局");
             startDealing([myName, "牌友 A", "牌友 B"], isNoShuffle);
        } else {
             handleCreateRoom();
        }
    } else if (mode === 'match') {
        // 调用真实的匹配逻辑（尝试加入公共房间）
        handleAutoMatch();
    }
  };

  const handleShareRoom = () => {
     if (!gameState.roomId) return;
     
     // 构建正确的 Telegram Share Link
     // 格式: https://t.me/share/url?url={link}&text={text}
     // Link 格式: https://t.me/{BOT_USERNAME}/app?startapp={roomId}
     
     const botName = BOT_USERNAME || "GeminiDouDizhuBot";
     const gameLink = `https://t.me/${botName}/app?startapp=${gameState.roomId}`;
     const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(gameLink)}&text=${encodeURIComponent("三缺一，速来斗地主！")}`;
     
     tg.openTelegramLink(shareUrl);
  };

  const handleRestart = () => {
      // In multiplayer friends mode, usually only the host can restart.
      if (gameState.mode === 'FRIENDS' && myPlayerId !== 0) {
          tg.showAlert("只有房主可以重新开始游戏。");
          return;
      }
      startDealing(gameState.players.map(p => p.name), false, gameState.mode);
  };

  const handleOpenGroup = () => {
      // 优先使用环境变量中的链接
      const groupLink = (import.meta as any).env?.VITE_TELEGRAM_GROUP_LINK || "https://t.me/GeminiDouDizhuGroup";
      tg.openTelegramLink(groupLink);
  };

  // 5. Render Router
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
