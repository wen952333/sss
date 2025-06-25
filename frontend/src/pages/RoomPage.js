import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PlayerArea from '../components/PlayerArea';
import CardArea from '../components/CardArea';
import GameControls from '../components/GameControls';
import { joinRoom, getRoomDetails, leaveRoom, startGame, playCards } from '../services/gameService';
import '../styles/RoomPage.css';

const RoomPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [selectedCards, setSelectedCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const roomData = await getRoomDetails(id);
        setRoom(roomData);
        setLoading(false);
        
        // 如果用户不在房间中，尝试加入
        if (roomData && user && !roomData.players.some(p => p.id === user.id)) {
          await joinRoom(id);
          const updatedRoom = await getRoomDetails(id);
          setRoom(updatedRoom);
        }
      } catch (err) {
        setError('无法加载房间信息');
        setLoading(false);
      }
    };
    
    fetchRoom();
    const interval = setInterval(fetchRoom, 3000); // 每3秒轮询一次
    
    return () => clearInterval(interval);
  }, [id, user]);
  
  const handleLeaveRoom = async () => {
    try {
      await leaveRoom(id);
      navigate('/');
    } catch (err) {
      console.error('离开房间失败:', err);
    }
  };
  
  const handleStartGame = async () => {
    try {
      await startGame(id);
    } catch (err) {
      console.error('开始游戏失败:', err);
    }
  };
  
  const handlePlayCards = async () => {
    if (selectedCards.length === 0) return;
    
    try {
      await playCards(id, selectedCards);
      setSelectedCards([]);
    } catch (err) {
      console.error('出牌失败:', err);
    }
  };
  
  const toggleCardSelect = (cardIndex) => {
    setSelectedCards(prev => {
      if (prev.includes(cardIndex)) {
        return prev.filter(i => i !== cardIndex);
      } else {
        return [...prev, cardIndex];
      }
    });
  };
  
  if (loading) {
    return <div className="room-loading">加载房间信息中...</div>;
  }
  
  if (error) {
    return <div className="room-error">{error}</div>;
  }
  
  if (!room) {
    return <div className="room-not-found">房间不存在</div>;
  }
  
  const currentPlayer = room.players.find(p => p.id === user.id);
  const isOwner = room.owner.id === user.id;
  
  return (
    <div className="room-container">
      <div className="room-header">
        <h2>{room.name}</h2>
        <p>状态: {room.status === 'waiting' ? '等待中' : '游戏中'}</p>
        <button className="btn leave-btn" onClick={handleLeaveRoom}>离开房间</button>
      </div>
      
      <div className="players-container">
        {room.players.map(player => (
          <PlayerArea 
            key={player.id} 
            player={player} 
            isCurrent={player.id === user.id}
            points={player.points}
          />
        ))}
      </div>
      
      {room.status === 'playing' && currentPlayer && (
        <CardArea 
          cards={currentPlayer.cards} 
          selectedCards={selectedCards}
          onCardSelect={toggleCardSelect}
        />
      )}
      
      <div className="game-controls">
        {room.status === 'waiting' && isOwner && (
          <button className="btn start-btn" onClick={handleStartGame}>开始游戏</button>
        )}
        
        {room.status === 'playing' && selectedCards.length > 0 && (
          <button className="btn play-btn" onClick={handlePlayCards}>出牌</button>
        )}
      </div>
    </div>
  );
};

export default RoomPage;
