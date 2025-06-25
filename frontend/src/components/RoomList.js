import React from 'react';
import '../styles/RoomList.css';

const RoomList = ({ rooms, onJoinRoom }) => {
  if (!rooms || rooms.length === 0) {
    return <p className="no-rooms">暂无房间</p>;
  }

  return (
    <div className="room-list">
      {rooms.map(room => (
        <div key={room.id} className="room-item">
          <div className="room-info">
            <h4>{room.name}</h4>
            <p>状态: {room.status === 'waiting' ? '等待中' : '游戏中'}</p>
            <p>玩家: {room.players.length}/4</p>
            <p>房主: {room.owner.nickname}</p>
          </div>
          <button 
            className="btn join-room-btn"
            onClick={() => onJoinRoom(room.id)}
            disabled={room.status !== 'waiting'}
          >
            {room.status === 'waiting' ? '加入房间' : '游戏中'}
          </button>
        </div>
      ))}
    </div>
  );
};

export default RoomList;
