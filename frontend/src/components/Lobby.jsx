// frontend/src/components/Lobby.jsx
import React, { useState } from 'react';
import { createGame, joinGame } from '../utils/api';

const Lobby = ({ onGameJoinedOrCreated }) => {
  const [playerName, setPlayerName] = useState(localStorage.getItem('十三水_playerName') || '');
  const [gameIdToJoin, setGameIdToJoin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreateGame = async () => {
    if (!playerName.trim()) {
      setError('请输入你的昵称');
      return;
    }
    localStorage.setItem('十三水_playerName', playerName);
    setIsLoading(true);
    setError('');
    try {
      const data = await createGame(playerName);
      if (data.success) {
        onGameJoinedOrCreated(data.gameId, data.playerId, data.gameState);
      } else {
        setError(data.message || '创建房间失败');
      }
    } catch (err) {
      setError('创建房间时发生网络错误: ' + err.message);
    }
    setIsLoading(false);
  };

  const handleJoinGame = async () => {
    if (!playerName.trim()) {
      setError('请输入你的昵称');
      return;
    }
    if (!gameIdToJoin.trim()) {
      setError('请输入房间号');
      return;
    }
    localStorage.setItem('十三水_playerName', playerName);
    setIsLoading(true);
    setError('');
    try {
      const data = await joinGame(gameIdToJoin, playerName);
      if (data.success) {
        onGameJoinedOrCreated(data.gameState.id, data.playerId, data.gameState);
      } else {
        setError(data.message || '加入房间失败');
      }
    } catch (err) {
      setError('加入房间时发生网络错误: ' + err.message);
    }
    setIsLoading(false);
  };

  return (
    <div className="lobby">
      <h2>十三水 多人游戏</h2>
      {error && <p className="error-message">{error}</p>}
      <div>
        <input
          type="text"
          placeholder="你的昵称"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          disabled={isLoading}
        />
      </div>
      <div>
        <button onClick={handleCreateGame} disabled={isLoading}>
          {isLoading ? '创建中...' : '创建新房间'}
        </button>
      </div>
      <hr style={{width: '80%', margin: '20px 0'}} />
      <div>
        <input
          type="text"
          placeholder="输入房间号加入"
          value={gameIdToJoin}
          onChange={(e) => setGameIdToJoin(e.target.value)}
          disabled={isLoading}
        />
        <button onClick={handleJoinGame} disabled={isLoading}>
          {isLoading ? '加入中...' : '加入房间'}
        </button>
      </div>
    </div>
  );
};

export default Lobby;
