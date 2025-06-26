import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

export default function Home() {
  const [rooms, setRooms] = useState([]);
  const [showProfile, setShowProfile] = useState(false);
  const [myPoints, setMyPoints] = useState(0);
  const [searchPhone, setSearchPhone] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [givePhone, setGivePhone] = useState('');
  const [giveAmount, setGiveAmount] = useState('');
  const [giveMsg, setGiveMsg] = useState('');
  const [searchMsg, setSearchMsg] = useState('');
  const [announcements, setAnnouncements] = useState([]);
  const navigate = useNavigate();

  // 登录校验
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
    }
    fetchMyPoints();
  }, [navigate]);

  // 拉取房间列表
  useEffect(() => {
    fetchRooms();
    const timer = setInterval(fetchRooms, 3000);
    return () => clearInterval(timer);
  }, []);

  // 拉取公告
  useEffect(() => {
    fetchAnnouncements();
    const timer = setInterval(fetchAnnouncements, 10000);
    return () => clearInterval(timer);
  }, []);

  async function fetchRooms() {
    const res = await fetch('https://9526.ip-ddns.com/api/rooms.php');
    const data = await res.json();
    if (data.success) {
      setRooms(data.rooms);
    }
  }

  async function fetchMyPoints() {
    const phone = localStorage.getItem('phone');
    if (!phone) return;
    const res = await fetch('https://9526.ip-ddns.com/api/find_user.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();
    if (data.success) {
      setMyPoints(data.user.points || 0);
    }
  }

  async function fetchAnnouncements() {
    const res = await fetch('https://9526.ip-ddns.com/api/get_announcements.php');
    const data = await res.json();
    if (data.success) {
      setAnnouncements(data.announcements);
    }
  }

  // 退出登录
  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('nickname');
    localStorage.removeItem('phone');
    navigate('/login');
  }

  // 加入房间
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
      navigate(`/play/${roomId}`);
    } else {
      alert(data.message || '加入失败');
    }
  }

  // 查找玩家
  async function handleSearchUser() {
    setSearchMsg('');
    setSearchResult(null);
    if (!searchPhone) {
      setSearchMsg('请输入手机号');
      return;
    }
    const res = await fetch('https://9526.ip-ddns.com/api/find_user.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: searchPhone }),
    });
    const data = await res.json();
    if (data.success) {
      setSearchResult(data.user);
    } else {
      setSearchMsg(data.message || '查找失败');
    }
  }

  // 赠送积分
  async function handleGivePoints() {
    setGiveMsg('');
    if (!givePhone || !giveAmount) {
      setGiveMsg('请输入手机号和赠送积分');
      return;
    }
    const from_phone = localStorage.getItem('phone');
    const res = await fetch('https://9526.ip-ddns.com/api/give_points.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from_phone, to_phone: givePhone, amount: giveAmount }),
    });
    const data = await res.json();
    setGiveMsg(data.message || (data.success ? '赠送成功' : '赠送失败'));
    if (data.success) {
      fetchMyPoints();
      setGivePhone('');
      setGiveAmount('');
    }
  }

  return (
    <div className="home-container home-doubleheight">
      {/* 顶部操作区 */}
      <div style={{
        position: 'absolute',
        left: 16,
        top: 14,
        zIndex: 100,
      }}>
        <button
          className="top-action-btn"
          onClick={handleLogout}
          style={{ background: '#f44', color: '#fff' }}
        >退出登录</button>
      </div>
      <div style={{
        position: 'absolute',
        right: 16,
        top: 14,
        zIndex: 100,
      }}>
        <button
          className="top-action-btn"
          onClick={() => {
            setShowProfile(true);
            fetchMyPoints();
          }}
        >个人中心</button>
      </div>

      {/* 个人中心弹窗 */}
      {showProfile && (
        <div className="profile-modal-bg">
          <div className="profile-modal">
            <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 14, textAlign: 'center' }}>个人中心</div>
            <div style={{ marginBottom: 10, fontSize: 16 }}>
              昵称：{localStorage.getItem('nickname')}<br />
              手机号：{localStorage.getItem('phone')}
            </div>
            <div style={{ fontSize: 17, color: '#2e87f9', fontWeight: 600, marginBottom: 10 }}>
              当前积分：{myPoints}
            </div>
            <div style={{ borderTop: '1px solid #eee', margin: '14px 0', paddingTop: 10 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>查找玩家</div>
              <input
                className="input"
                placeholder="输入手机号"
                value={searchPhone}
                onChange={e => setSearchPhone(e.target.value)}
              />
              <button className="button" onClick={handleSearchUser}>查找</button>
              {searchMsg && <div style={{ color: 'red', fontSize: 13 }}>{searchMsg}</div>}
              {searchResult && (
                <div style={{ marginTop: 7, color: '#1da343' }}>
                  昵称：{searchResult.nickname}，积分：{searchResult.points}
                </div>
              )}
            </div>
            <div style={{ borderTop: '1px solid #eee', margin: '14px 0', paddingTop: 10 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>赠送积分</div>
              <input
                className="input"
                placeholder="对方手机号"
                value={givePhone}
                onChange={e => setGivePhone(e.target.value)}
              />
              <input
                className="input"
                placeholder="赠送积分数量"
                type="number"
                value={giveAmount}
                onChange={e => setGiveAmount(e.target.value)}
              />
              <button className="button" onClick={handleGivePoints}>赠送</button>
              {giveMsg && <div style={{ color: giveMsg === '赠送成功' ? 'green' : 'red', fontSize: 13 }}>{giveMsg}</div>}
            </div>
            <button className="button" onClick={() => setShowProfile(false)} style={{ background: '#aaa', marginTop: 10 }}>关闭</button>
          </div>
        </div>
      )}

      {/* 主标题 */}
      <div className="home-title">十三水</div>

      {/* 公告区 */}
      <div className="home-announcement-area">
        <div className="home-announcement-title">最新公告</div>
        {announcements.length === 0
          ? <div style={{ color: '#a8b1c7', fontSize: 15 }}>暂无公告</div>
          : (
            <ul style={{ padding: 0, margin: 0 }}>
              {announcements.map(a => (
                <li key={a.id} style={{ color: '#47506a', fontSize: 15, marginBottom: 6 }}>
                  <span style={{color:'#999', fontSize:12, marginRight:8}}>{a.created_at?.slice(5, 16) || ''}</span>
                  {a.content}
                </li>
              ))}
            </ul>
          )
        }
      </div>

      {/* 房间列表 */}
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
              <span style={{color: '#3886ff', marginLeft: 8, fontSize: '0.98em'}}>点击进入</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
