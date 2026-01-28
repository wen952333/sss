
import React, { useState, useEffect } from 'react';
import { GamePhase, GameMode } from './types';
import { useTelegram } from './hooks/useTelegram';
import { useGameLogic } from './hooks/useGameLogic';
import { MainMenu } from './components/MainMenu';
import { GameBoard } from './components/GameBoard';
import { RoomLobby } from './components/RoomLobby';
import { AdminPanel } from './components/AdminPanel';
import { getMuteState, toggleMute } from './services/audioService';
import { BOT_CONFIG } from './constants';

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

  useEffect(() => {
    if (currentUser?.last_check_in_date) {
        const today = new Date().toISOString().split('T')[0];
        setHasCheckedInToday(currentUser.last_check_in_date === today);
    }
  }, [currentUser]);

  // 处理通过邀请链接进入的情况 (startapp=room_xxx)
  useEffect(() => {
    // 只有当参数是 room_ 开头，且用户已登录，且当前不在该房间时才执行加入
    if (startParam && startParam.startsWith('room_') && currentUser) {
        if (gameState.roomId !== startParam) {
            handleJoinRoom(startParam);
        }
    }
  }, [startParam, currentUser, gameState.roomId]);

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
   * 动态生成分享链接
   */
  const handleShareRoom = () => {
     if (!gameState.roomId) return;
     
     // 检查配置，如果为空则提示用户 (避免生成 username not found 链接)
     if (!BOT_CONFIG.username) {
         tg.showAlert("⚠️ 配置错误：未检测到 VITE_BOT_USERNAME。\n请在 Cloudflare Pages 设置环境变量。");
         return;
     }

     // 获取当前玩家姓名
     const currentPlayerName = tg.initDataUnsafe?.user?.first_name || 
                               tg.initDataUnsafe?.user?.username || 
                               "神秘牌友";
     
     // 构造标准的 Mini App 链接
     // 格式: https://t.me/<BOT_USERNAME>/<APP_NAME>?startapp=<ROOM_ID>
     const gameLink = `https://t.me/${BOT_CONFIG.username}/${BOT_CONFIG.appShortName}?startapp=${gameState.roomId}`;
     
     const shareText = `🃏 三缺一！[${currentPlayerName}] 喊你来斗地主！\n🚪 房间号: ${gameState.roomId}\n👇 点击下方按钮入座`;
     
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
