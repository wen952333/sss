import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './Room.css';

export default function Room() {
  const { roomId } = useParams();
  const [players, setPlayers] = useState([]);
  const [status, setStatus] = useState('waiting');
  const [me, setMe] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

  // 登录校验
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
    }
  }, [navigate]);

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
      alert('身份验证失败');
      navigate('/login');
    }
  }

  // 判断是否房主
  const isOwner = players[0]?.isOwner && players[0]?.name === me;
  // 是否全部准备好
  const allReady = players.length === 4 && players.every(p => p.submitted);

  async function handleStart() {
    setErrorMsg('');
    if (!allReady) {
      setErrorMsg('请等待所有玩家都准备好再开始游戏');
      return;
    }
    const token = localStorage.getItem('token');
    const res = await fetch('https://9526.ip-ddns.com/api/start.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, token }),
    });
    const data = await res.json();
    if (!data.success) {
      setErrorMsg(data.message || '无法开始游戏');
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
              {p.submitted ? <span style={{color:'#23e67a',marginLeft:8}}>已准备</span> : <span style={{color:'#888',marginLeft:8}}>未准备</span>}
            </li>
          ))}
        </ul>
      </div>
      {isOwner && (
        <button
          className="button"
          onClick={handleStart}
          disabled={!allReady}
          style={!allReady ? { background: '#ccc', cursor: 'not-allowed' } : {}}
        >
          开始游戏
        </button>
      )}
      {errorMsg && <div style={{ color: 'red', marginTop: 10 }}>{errorMsg}</div>}
      <div className="tip">{isOwner ? '全部玩家准备后可开始游戏' : '等待房主开始游戏...'}</div>
    </div>
  );
}
