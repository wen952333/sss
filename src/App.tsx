
import React, { useState, useEffect } from 'react';
import { GamePhase, GameMode } from './types';
import { useTelegram } from './hooks/useTelegram';
import { useGameLogic } from './hooks/useGameLogic';
import { MainMenu } from './components/MainMenu';
import { GameBoard } from './components/GameBoard';
import { RoomLobby } from './components/RoomLobby';
import { AdminPanel } from './components/AdminPanel';
import { getMuteState, toggleMute } from './services/audioService';
import { BOT_CONFIG, updateBotConfig } from './constants';

const App: React.FC = () => {
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
    resetGame,
    isMatching
  } = useGameLogic(currentUser, setCurrentUser);

  const [isSoundOn, setIsSoundOn] = useState(!getMuteState());
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [hasCheckedInToday, setHasCheckedInToday] = useState(false);

  // 初始化拉取后端动态配置 (仅拉取 Bot 用户名，用于构造 t.me 链接)
  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        if (data.botUsername) {
          updateBotConfig(data);
        }
      })
      .catch(err => console.error("Config fetch failed", err));
  }, []);

  useEffect(() => {
    if (currentUser?.last_check_in_date) {
        const today = new Date().toISOString().split('T')[0];
        setHasCheckedInToday(currentUser.last_check_in_date === today);
    }
  }, [currentUser]);

  // 处理通过邀请链接进入的情况
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

  const handleGameStartRequest = (mode: 'pve' | 'friends', isNoShuffle: boolean) => {
    if (!currentUser) return;
    if (currentUser.points < 100) {
        tg.showAlert("积分不足 (需100)，请签到或购买！");
        return;
    }
    if (mode === 'pve') {
        startDealing(isNoShuffle, GameMode.PvE);
    } else if (mode === 'friends') {
        if (isMockMode) {
             tg.showAlert("【模拟模式】自动创建本地局");
             startDealing(isNoShuffle, GameMode.Friends); 
        } else {
             handleCreateRoom();
        }
    }
  };

  /**
   * 彻底修复邀请逻辑：
   * 1. 动态抓取：直接从 tg.initDataUnsafe.user 获取当前操作者的姓名。
   * 2. 无需变量：不需要在环境变量里配置任何玩家名字，系统会自动识别。
   */
  const handleShareRoom = () => {
     if (!gameState.roomId) return;
     
     // 直接从 Telegram SDK 获取当前点击分享按钮的玩家姓名
     const currentPlayerName = tg.initDataUnsafe?.user?.first_name || 
                               tg.initDataUnsafe?.user?.username || 
                               "您的好友";
     
     // 构造指向当前 Bot 的 Mini App 链接
     const gameLink = `https://t.me/${BOT_CONFIG.username}/${BOT_CONFIG.appShortName}?startapp=${gameState.roomId}`;
     
     // 动态生成的邀请文案
     const shareText = `🃏 三缺一！[${currentPlayerName}] 喊你来开局！\n房间号: ${gameState.roomId}\n点击下方按钮立即入座 👇`;
     
     const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(gameLink)}&text=${encodeURIComponent(shareText)}`;
     
     try {
       tg.openTelegramLink(shareUrl);
     } catch (e) {
       window.open(shareUrl, '_blank');
     }
  };

  const handleRestart = () => {
      if (gameState.mode === GameMode.Friends && myPlayerId !== 0) {
          tg.showAlert("只有房主可以重新开始。");
          return;
      }
      startDealing(false, gameState.mode);
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
          onOpenGroup={() => tg.openTelegramLink("https://t.me/GeminiDouDizhuGroup")}
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
