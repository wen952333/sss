import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './Room.css';

export default function Room() {
  const { roomId } = useParams();
  const [players, setPlayers] = useState([]);
  const [status, setStatus] = useState('waiting');
  const [me, setMe] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchRoomInfo();
    const interval = setInterval(fetchRoomInfo, 3000);
    return () => clearInterval(interval);
  }, []);

  async function fetchRoomInfo() {
    const token = localStorage.getItem('token');
    const res = await fetch(`https://9526.ip-ddns.com/api/room_info.php?roomId=${roomId}&token=${token}`);
    const data = await res.json();
    if (data.success) {
      setPlayers(data.players);
      setStatus(data.status);
      setMe(data.me);
      if (data.status === 'started') {
        navigate(`/play/${roomId}`);
      }
    } else if (data.code === 401) {
      // 未授权
      alert('身份验证失败');
      navigate('/');
    }
  }

  async function handleStart() {
    const token = localStorage.getItem('token');
    const res = await fetch('https://9526.ip-ddns.com/api/start.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, token }),
    });
    const data = await res.json();
    if (!data.success) {
      alert(data.message || '无法开始游戏');
    }
  }

  return (
    <div className="room-container">
      <h2>房间ID: {roomId}</h2>
      <div className="players-list">
        <h3>玩家列表</h3>
        <ul>
          {players.map(p => (
            <li key={p.name} className={p.name === me ? 'me' : ''}>
              {p.name}
              {p.isOwner && <span className="owner-tag">房主</span>}
            </li>
          ))}
        </ul>
      </div>
      {players[0]?.isOwner && (
        <button className="button" onClick={handleStart}>
          开始游戏
        </button>
      )}
      <div className="tip">等待房主开始游戏...</div>
    </div>
  );
}
