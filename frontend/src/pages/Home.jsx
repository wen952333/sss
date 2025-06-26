import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

export default function Home() {
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState('');
  const navigate = useNavigate();

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

  return (
    <div className="home-container">
      <h1>十三水</h1>
      <input
        className="input"
        placeholder="昵称"
        value={name}
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
          onChange={e => setRoomId(e.target.value)}
        />
        <button className="button" onClick={handleJoinRoom}>
          加入房间
        </button>
      </div>
    </div>
  );
}
