import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './Room.css';

export default function Room() {
  const { roomId } = useParams();
  const [players, setPlayers] = useState([]);
  const [status, setStatus] = useState('waiting');
  const [me, setMe] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();
  const kickTimerRef = useRef(null);
  const deadlineRef = useRef(null);

  // 登录校验
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
    }
  }, [navigate]);

  // 定时拉取房间信息
  useEffect(() => {
    fetchRoomInfo();
    const interval = setInterval(fetchRoomInfo, 2000);
    return () => clearInterval(interval);
  }, []);

  // 10分钟未满4人自动踢出所有人
  useEffect(() => {
    // 只要房间里有玩家且未满4人就开始计时
    if (status === 'waiting' && players.length > 0 && players.length < 4) {
      // 只启动一次
      if (!kickTimerRef.current) {
        deadlineRef.current = Date.now() + 10 * 60 * 1000; // 10分钟后
        kickTimerRef.current = setInterval(() => {
          if (players.length >= 4 || status !== 'waiting') {
            clearInterval(kickTimerRef.current);
            kickTimerRef.current = null;
            deadlineRef.current = null;
            return;
          }
          // 到点未满4人则踢出
          if (Date.now() > deadlineRef.current) {
            clearInterval(kickTimerRef.current);
            kickTimerRef.current = null;
            deadlineRef.current = null;
            kickAllAndLeave();
          }
        }, 5000); // 5秒检查一次
      }
    } else {
      // 满4人或没人时清除定时器
      if (kickTimerRef.current) {
        clearInterval(kickTimerRef.current);
        kickTimerRef.current = null;
        deadlineRef.current = null;
      }
    }
    // eslint-disable-next-line
  }, [players, status]);

  async function kickAllAndLeave() {
    alert('房间10分钟未满4人，已踢出所有人');
    // 只需踢自己即可（每个前端都自动调用）
    const token = localStorage.getItem('token');
    await fetch('https://9526.ip-ddns.com/api/leave_room.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, token })
    });
    navigate('/');
  }

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
      {errorMsg && <div style={{ color: 'red', marginTop: 10 }}>{errorMsg}</div>}
      <div className="tip">全部玩家准备后会自动发牌，无需房主操作</div>
    </div>
  );
}
