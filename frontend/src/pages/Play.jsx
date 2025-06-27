import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './Play.css';

export default function Play() {
  const { roomId } = useParams();
  const [players, setPlayers] = useState([]);
  const [myPoints, setMyPoints] = useState(0);
  const [myName, setMyName] = useState('');
  const [myCards, setMyCards] = useState([]);
  const [selected, setSelected] = useState([]); // 当前高亮选中的手牌
  const [head, setHead] = useState([]);
  const [middle, setMiddle] = useState([]);
  const [tail, setTail] = useState([]);
  const [submitMsg, setSubmitMsg] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const navigate = useNavigate();

  // 登录校验和查分
  useEffect(() => {
    const token = localStorage.getItem('token');
    const nickname = localStorage.getItem('nickname');
    if (!token) {
      navigate('/login');
      return;
    }
    setMyName(nickname);
    fetchMyPoints();
  }, [navigate]);

  // 房间玩家定时刷新
  useEffect(() => {
    fetchPlayers();
    const timer = setInterval(fetchPlayers, 3000);
    return () => clearInterval(timer);
  }, [roomId]);

  // 手牌定时刷新
  useEffect(() => {
    fetchMyCards();
    const timer = setInterval(fetchMyCards, 1500); // 更快刷新，体验更好
    return () => clearInterval(timer);
  }, [roomId]);

  async function fetchPlayers() {
    const token = localStorage.getItem('token');
    const res = await fetch(`https://9526.ip-ddns.com/api/room_info.php?roomId=${roomId}&token=${token}`);
    const data = await res.json();
    if (data.success) setPlayers(data.players);
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
    if (data.success) setMyPoints(data.user.points || 0);
    else setMyPoints(0);
  }

  async function fetchMyCards() {
    const token = localStorage.getItem('token');
    const res = await fetch(`https://9526.ip-ddns.com/api/my_cards.php?roomId=${roomId}&token=${token}`);
    const data = await res.json();
    if (data.success) {
      // 1. 未提交时，cards 为 13 张手牌
      // 2. 提交后，cards 为 13 张已分配（顺序：头道3，中道5，尾道5）
      setSubmitted(!!data.submitted);

      // 若刚提交，显示自己分好的三墩
      if (data.submitted && Array.isArray(data.cards) && data.cards.length === 13) {
        setHead(data.cards.slice(0, 3));
        setMiddle(data.cards.slice(3, 8));
        setTail(data.cards.slice(8, 13));
        setMyCards([]); // 已交牌，手牌区清空
      } else if (!data.submitted && Array.isArray(data.cards)) {
        // 未提交时，cards 就是13张手牌
        setMyCards(data.cards);
      }
      // 如果玩家本地分堆已分好，不自动重置（避免定时器覆盖手动分牌进度）
      // 若手牌数和三墩都为0，说明牌已经交过
      if (!data.submitted && Array.isArray(data.cards)) {
        if (myCards.length === 0 && head.length === 0 && middle.length === 0 && tail.length === 0) {
          setMyCards(data.cards);
        }
      }
    }
  }

  // 退出房间
  async function handleExitRoom() {
    const token = localStorage.getItem('token');
    await fetch('https://9526.ip-ddns.com/api/leave_room.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, token }),
    });
    navigate('/');
  }

  // 牌点击：高亮/取消高亮
  function handleCardClick(card) {
    if (submitted) return;
    setSelected(sel => sel.includes(card) ? sel.filter(c => c !== card) : [...sel, card]);
  }

  // 点击头/中/尾道，把选中的牌移过去
  function moveTo(dest) {
    if (submitted) return;
    let destArr, setDest, maxLen;
    if (dest === 'head') {
      destArr = head; setDest = setHead; maxLen = 3;
    } else if (dest === 'middle') {
      destArr = middle; setDest = setMiddle; maxLen = 5;
    } else if (dest === 'tail') {
      destArr = tail; setDest = setTail; maxLen = 5;
    }
    // 过滤掉已经在目标墩的牌
    const newCards = selected.filter(c => !destArr.includes(c));
    if (destArr.length + newCards.length > maxLen) {
      setSubmitMsg(`该道最多放${maxLen}张牌`);
      return;
    }
    // 从手牌移除，加入目标
    setDest([...destArr, ...newCards]);
    setMyCards(cards => cards.filter(c => !newCards.includes(c)));
    setSelected([]);
    setSubmitMsg('');
  }

  // 点击“撤回”按钮，把所有墩的牌退回到手牌
  function handleReset() {
    if (submitted) return;
    setMyCards([...myCards, ...head, ...middle, ...tail]);
    setHead([]);
    setMiddle([]);
    setTail([]);
    setSelected([]);
    setSubmitMsg('');
  }

  // 提交分牌
  async function handleSubmit() {
    if (submitted) return;
    if (head.length !== 3 || middle.length !== 5 || tail.length !== 5) {
      setSubmitMsg('请按 3-5-5 张牌分配');
      return;
    }
    const cards = [...head, ...middle, ...tail];
    const token = localStorage.getItem('token');
    const res = await fetch('https://9526.ip-ddns.com/api/play.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, token, cards }),
    });
    const data = await res.json();
    if (data.success) {
      setSubmitted(true);
      setSubmitMsg('提交成功，等待其他玩家...');
    } else {
      setSubmitMsg('提交失败，请重试');
    }
  }

  // 渲染玩家座位，显示每个玩家自己的准备状态
  function renderSeats() {
    let seats = [];
    for (let i = 0; i < 4; i++) {
      const player = players[i];
      if (player) {
        seats.push(
          <div
            key={i}
            className={`play-seat`}
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
              {player.submitted ? '已提交' : '未提交'}
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

  // 渲染13张手牌，点击可高亮
  function renderMyCards() {
    return <div className="cards-area">
      {myCards.map(card =>
        <img
          key={card}
          src={`/cards/${card}.svg`}
          alt={card}
          className="card-img"
          style={{
            border: selected.includes(card) ? '2.5px solid #23e67a' : '2.5px solid transparent',
            boxShadow: selected.includes(card) ? '0 0 12px #23e67a88' : ''
          }}
          onClick={() => handleCardClick(card)}
        />
      )}
    </div>;
  }

  // 渲染分好的三道
  function renderPaiDun(arr, label, color, maxLen, onClick) {
    return (
      <div
        style={{
          background: '#1e663d',
          borderRadius: 10,
          padding: 14,
          marginBottom: 12,
          cursor: submitted ? 'default' : 'pointer',
          border: submitted ? 'none' : '2px dashed #23e67a'
        }}
        onClick={onClick}
      >
        <div style={{ marginBottom: 8, color, fontSize: 16 }}>{label}（{arr.length}/{maxLen}）</div>
        <div style={{
          background: '#164b2e',
          borderRadius: 7,
          minHeight: 36,
          marginBottom: 6,
          color: '#fff',
          display: 'flex',
          gap: 8,
        }}>
          {arr.length === 0 ? <span style={{ color: '#aaa' }}>请放置</span> :
            arr.map(card =>
              <img
                key={card}
                src={`/cards/${card}.svg`}
                alt={card}
                className="card-img"
                style={{ opacity: submitted ? 0.75 : 1 }}
              />
            )
          }
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: '#164b2e',
      minHeight: '100vh',
      fontFamily: 'inherit'
    }}>
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
        {/* 顶部按钮和积分 */}
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
            积分：{myPoints}
          </div>
        </div>

        {/* 座位 */}
        {renderSeats()}

        {/* 手牌 */}
        <div style={{ margin: '15px 0 10px 0' }}>
          <div style={{ color: '#fff', fontWeight: 700, marginBottom: 6 }}>
            你的手牌（点击选中，点击下方牌墩移动）
          </div>
          {renderMyCards()}
        </div>
        {/* 分牌区 */}
        {renderPaiDun(head, '头道', '#e0ffe3', 3, () => moveTo('head'))}
        {renderPaiDun(middle, '中道', '#e0eaff', 5, () => moveTo('middle'))}
        {renderPaiDun(tail, '尾道', '#ffe6e0', 5, () => moveTo('tail'))}

        {/* 按钮区 */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <button
            style={{
              flex: 1,
              background: '#23e67a',
              color: '#fff',
              fontWeight: 700,
              border: 'none',
              borderRadius: 7,
              padding: '10px 0',
              fontSize: 18,
              cursor: submitted ? 'not-allowed' : 'pointer'
            }}
            disabled={submitted}
            onClick={handleSubmit}
          >
            提交分牌
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
              cursor: submitted ? 'not-allowed' : 'pointer'
            }}
            disabled={submitted}
            onClick={handleReset}
          >
            撤回
          </button>
        </div>
        <div style={{ color: '#c3e1d1', textAlign: 'center', fontSize: 16, marginTop: 6, minHeight: 24 }}>
          {submitMsg}
        </div>
      </div>
    </div>
  );
}
