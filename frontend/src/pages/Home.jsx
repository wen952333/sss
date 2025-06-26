import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

export default function Home() {
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState('');
  const navigate = useNavigate();

  // 登录校验：未登录强制跳转到登录页
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
    }
  }, [navigate]);

  async function handleCreateRoom() {
    if (!name) return alert('请输入昵称');
    const res = await fetch('https://9526.ip-ddns.com/api/create_room.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (data.success) {
      localStorage.setItem('token', data.token);
      navigate(`/room/${data.roomId}`);
    } else {
      alert(data.message || '创建失败');
    }
  }

  async function handleJoinRoom() {
    if (!name || !roomId) return alert('请填写昵称和房间ID');
    const res = await fetch('https://9526.ip-ddns.com/api/join_room.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, roomId }),
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
      <input
        className="input"
        placeholder="昵称"
        value={name}
        maxLength={10}
        onChange={e => setName(e.target.value)}
      />
      <button className="button" onClick={handleCreateRoom}>
        创建房间
      </button>
      <div className="join-area">
        <input
          className="input"
          placeholder="房间ID"
          value={roomId}
          maxLength={8}
          onChange={e => setRoomId(e.target.value)}
        />
        <button className="button" onClick={handleJoinRoom}>
          加入房间
        </button>
      </div>
      <div className="tips">
        输入昵称即可快速创建房间或加入好友房间
      </div>
    </div>
  );
}
