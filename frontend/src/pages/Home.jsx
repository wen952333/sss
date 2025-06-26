import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

export default function Home() {
  const [rooms, setRooms] = useState([]);
  const navigate = useNavigate();

  // 登录校验：未登录强制跳转到登录页
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
    }
  }, [navigate]);

  // 拉取房间列表
  useEffect(() => {
    fetchRooms();
    const timer = setInterval(fetchRooms, 3000);
    return () => clearInterval(timer);
  }, []);

  async function fetchRooms() {
    // 需要后端支持 /api/rooms.php，返回所有可加入的房间
    const res = await fetch('https://9526.ip-ddns.com/api/rooms.php');
    const data = await res.json();
    if (data.success) {
      setRooms(data.rooms);
    }
  }

  // 创建房间并直接进入
  async function handleCreateRoom() {
    const nickname = localStorage.getItem('nickname') || '游客';
    const res = await fetch('https://9526.ip-ddns.com/api/create_room.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nickname }),
    });
    const data = await res.json();
    if (data.success) {
      localStorage.setItem('token', data.token);
      navigate(`/room/${data.roomId}`);
    } else {
      alert(data.message || '创建失败');
    }
  }

  // 点击房间号加入房间
  async function handleJoinRoom(roomId) {
    const nickname = localStorage.getItem('nickname') || '游客';
    const res = await fetch('https://9526.ip-ddns.com/api/join_room.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nickname, roomId }),
    });
    const data = await res.json();
    if (data.success) {
      localStorage.setItem('token', data.token);
      navigate(`/room/${roomId}`);
    } else {
      alert(data.message || '加入失败');
    }
  }

  const demoCards = [
    'ace_of_spades', '10_of_clubs', 'queen_of_hearts', 'king_of_diamonds', 'jack_of_spades'
  ];

  return (
    <div className="home-container">
      <div className="poker-decor">
        {demoCards.map(card => (
          <img
            key={card}
            src={`/cards/${card}.svg`}
            className="poker-card-mini"
            alt={card}
          />
        ))}
      </div>
      <div className="home-title">十三水</div>
      <div className="home-subtitle">在线实时对战 · 多人房间</div>

      <div style={{margin: '18px 0 20px 0', textAlign: 'left'}}>
        <div style={{fontWeight: 700, marginBottom: 8, color: '#454c5a'}}>房间列表</div>
        {rooms.length === 0 && <div style={{color: '#a8b1c7'}}>暂无房间</div>}
        <ul style={{padding: 0, margin: 0}}>
          {rooms.map(room => (
            <li
              key={room.room_id}
              style={{listStyle: 'none', marginBottom: 8, cursor: 'pointer', background: '#f6f7fb', borderRadius: 7, padding: '8px 14px'}}
              onClick={() => handleJoinRoom(room.room_id)}
            >
              房间 {room.room_id} &nbsp;
              <span style={{color: '#7c8ba0', fontSize: '0.96em'}}>({room.player_count || 1}人)</span>
            </li>
          ))}
        </ul>
      </div>

      <button className="button" onClick={handleCreateRoom}>
        创建房间
      </button>
    </div>
  );
}
