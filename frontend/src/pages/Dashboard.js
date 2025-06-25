import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import RoomList from '../components/RoomList';
import CreateRoom from '../components/CreateRoom';
import UserStats from '../components/UserStats';
import { getRooms, createRoom } from '../services/gameService';
import '../styles/Dashboard.css';

const Dashboard = () => {
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const data = await getRooms();
        setRooms(data);
        setLoading(false);
      } catch (error) {
        console.error('获取房间列表失败:', error);
        setLoading(false);
      }
    };

    fetchRooms();
    const interval = setInterval(fetchRooms, 5000); // 每5秒轮询一次
    
    return () => clearInterval(interval);
  }, []);

  const handleCreateRoom = async (roomName) => {
    try {
      const newRoom = await createRoom(roomName);
      navigate(`/room/${newRoom.id}`);
    } catch (error) {
      console.error('创建房间失败:', error);
    }
  };

  const handleJoinRoom = (roomId) => {
    navigate(`/room/${roomId}`);
  };

  if (!user) return null;

  return (
    <div className="dashboard">
      <div className="user-header">
        <div className="user-info">
          <h2>欢迎, {user.nickname}</h2>
          <p>积分: {user.points}</p>
        </div>
      </div>
      
      <div className="dashboard-content">
        <div className="actions">
          <button 
            className="btn create-room-btn"
            onClick={() => setShowCreateRoom(true)}
          >
            创建房间
          </button>
        </div>
        
        <div className="rooms-section">
          <h3>游戏房间</h3>
          {loading ? (
            <p>加载中...</p>
          ) : rooms.length > 0 ? (
            <RoomList rooms={rooms} onJoinRoom={handleJoinRoom} />
          ) : (
            <p>暂无房间，请创建一个新房间</p>
          )}
        </div>
      </div>
      
      {showCreateRoom && (
        <CreateRoom 
          onCreate={handleCreateRoom} 
          onCancel={() => setShowCreateRoom(false)} 
        />
      )}
    </div>
  );
};

export default Dashboard;
