import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './Play.css'; // 你可以新建 Play.css 按需求调整

export default function Play() {
  const { roomId } = useParams();
  const [players, setPlayers] = useState([]);
  const [myInfo, setMyInfo] = useState({ name: '', points: 0 });
  const [ready, setReady] = useState(false);
  const [head, setHead] = useState([]);
  const [middle, setMiddle] = useState([]);
  const [tail, setTail] = useState([]);
  const navigate = useNavigate();

  // 登录校验
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
    }
    // 这里补充拉个人信息的逻辑
    const nickname = localStorage.getItem('nickname');
    // 假设有接口拉分数
    setMyInfo({ name: nickname, points: 990 }); // TODO: 换成真实分数
  }, [navigate]);

  // 拉房间玩家
  useEffect(() => {
    fetchPlayers();
    const timer = setInterval(fetchPlayers, 3000);
    return () => clearInterval(timer);
  }, [roomId]);

  async function fetchPlayers() {
    const token = localStorage.getItem('token');
    const res = await fetch(`https://9526.ip-ddns.com/api/room_info.php?roomId=${roomId}&token=${token}`);
    const data = await res.json();
    if (data.success) {
      setPlayers(data.players);
      // 你可以根据自己需求处理更多房间信息
    }
  }

  function handleExitRoom() {
    localStorage.removeItem('token');
    navigate('/');
  }

  function handleReady() {
    setReady(true);
  }

  function handleAutoSplit() {
    // TODO: 自动分牌逻辑
  }

  function handleStart() {
    // TODO: 开始比牌逻辑（房主可操作）
  }

  // 渲染玩家座位
  function renderSeats() {
    let seats = [];
    for (let i = 0; i < 4; i++) {
      const player = players[i];
      if (player) {
        seats.push(
          <div
            key={i}
            className={`play-seat ${i === 0 ? 'active' : ''}`}
            style={{
              border: '2px solid #23e67a',
              borderRadius: 10,
              marginRight: 8,
              width: '25%',
              minWidth: 80,
              color: '#fff',
              background: '#115f37',
              textAlign: 'center',
              padding: '12px 0'
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 18 }}>{player.name}</div>
            <div style={{ marginTop: 4, fontSize: 14 }}>
              {ready ? '已准备' : '未准备'}
            </div>
          </div>
        );
      } else {
        seats.push(
          <div
            key={i}
            className="play-seat empty"
            style={{
              border: '2px dashed #3b7c5e',
              borderRadius: 10,
              marginRight: 8,
              width: '25%',
              minWidth: 80,
              color: '#7ecfab',
              background: '#194e3a',
              textAlign: 'center',
              padding: '12px 0'
            }}
          >
            等待加入...
          </div>
        );
      }
    }
    return <div style={{ display: 'flex', marginBottom: 18 }}>{seats}</div>;
  }

  return (
    <div style={{
      background: '#164b2e',
      minHeight: '100vh',
      fontFamily: 'inherit'
    }}>
      {/* 顶栏 */}
      <div style={{
        background: '#222',
        color: '#fff',
        padding: '10px 22px',
        fontSize: 17,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          欢迎, {myInfo.name} (积分: {myInfo.points})
        </div>
        <div style={{ cursor: 'pointer', color: '#fff', fontWeight: 700 }}>
          个人中心
        </div>
      </div>

      {/* 内容区 */}
      <div style={{
        maxWidth: 420,
        margin: '30px auto',
        background: '#144126',
        borderRadius: 12,
        boxShadow: '0 4px 32px #0f2717bb',
        padding: 22,
        minHeight: 650
      }}>
        {/* 顶部按钮和标题 */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <button
            style={{
              background: '#fff',
              color: '#234',
              fontWeight: 'bold',
              border: 'none',
              borderRadius: 7,
              padding: '5px 16px',
              marginRight: 16,
              cursor: 'pointer'
            }}
            onClick={handleExitRoom}
          >
            &lt; 退出房间
          </button>
          <div style={{
            flex: 1,
            textAlign: 'center',
            color: '#fff',
            fontWeight: 900,
            fontSize: 21,
            letterSpacing: 2
          }}>
            十三水牌桌 <span style={{ fontWeight: 600, fontSize: 16 }}>（房间）</span>
          </div>
        </div>

        {/* 座位 */}
        {renderSeats()}

        {/* 配牌区 */}
        <div style={{
          background: '#1e663d',
          borderRadius: 10,
          padding: 14,
          marginBottom: 14
        }}>
          <div style={{ marginBottom: 8, color: '#e0ffe3', fontSize: 16 }}>请放置3张牌</div>
          <div style={{
            background: '#164b2e',
            borderRadius: 7,
            minHeight: 36,
            marginBottom: 6,
            color: '#aaa'
          }}>
            {/* 这里是头道的牌 */}
            {head.length === 0 ? '头道' : head.join(', ')}
          </div>
        </div>
        <div style={{
          background: '#1e663d',
          borderRadius: 10,
          padding: 14,
          marginBottom: 14
        }}>
          <div style={{ marginBottom: 8, color: '#e0ffe3', fontSize: 16 }}>请放置5张牌</div>
          <div style={{
            background: '#164b2e',
            borderRadius: 7,
            minHeight: 36,
            marginBottom: 6,
            color: '#aaa'
          }}>
            {/* 这里是中道的牌 */}
            {middle.length === 0 ? '中道' : middle.join(', ')}
          </div>
        </div>
        <div style={{
          background: '#1e663d',
          borderRadius: 10,
          padding: 14,
          marginBottom: 18
        }}>
          <div style={{ marginBottom: 8, color: '#e0ffe3', fontSize: 16 }}>请放置5张牌</div>
          <div style={{
            background: '#164b2e',
            borderRadius: 7,
            minHeight: 36,
            marginBottom: 6,
            color: '#aaa'
          }}>
            {/* 这里是尾道的牌 */}
            {tail.length === 0 ? '尾道' : tail.join(', ')}
          </div>
        </div>

        {/* 按钮区 */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
          <button
            style={{
              flex: 1,
              background: ready ? '#1e663d' : '#23e67a',
              color: ready ? '#aaa' : '#fff',
              fontWeight: 700,
              border: 'none',
              borderRadius: 7,
              padding: '10px 0',
              fontSize: 18,
              cursor: ready ? 'not-allowed' : 'pointer'
            }}
            disabled={ready}
            onClick={handleReady}
          >
            准备
          </button>
          <button
            style={{
              flex: 1,
              background: '#144126',
              color: '#fff',
              border: '1.5px solid #23e67a',
              borderRadius: 7,
              padding: '10px 0',
              fontSize: 18,
              cursor: 'pointer'
            }}
            onClick={handleAutoSplit}
          >
            自动分牌
          </button>
          <button
            style={{
              flex: 1,
              background: '#144126',
              color: '#fff',
              border: '1.5px solid #fff',
              borderRadius: 7,
              padding: '10px 0',
              fontSize: 18,
              cursor: 'pointer'
            }}
            onClick={handleStart}
          >
            开始比牌
          </button>
        </div>
        <div style={{ color: '#c3e1d1', textAlign: 'center', fontSize: 16, marginTop: 6 }}>
          点击“准备” 以开始
        </div>
      </div>
    </div>
  );
}
