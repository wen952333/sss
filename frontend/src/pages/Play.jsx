import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './Play.css';

export default function Play() {
  const { roomId } = useParams();
  const [players, setPlayers] = useState([]);
  const [myPoints, setMyPoints] = useState(0);
  const [myName, setMyName] = useState('');
  const [myCards, setMyCards] = useState([]);
  const [selected, setSelected] = useState({ area: 'hand', cards: [] }); // {area, cards}
  const [head, setHead] = useState([]);
  const [middle, setMiddle] = useState([]);
  const [tail, setTail] = useState([]);
  const [submitMsg, setSubmitMsg] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [roomStatus, setRoomStatus] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [myResult, setMyResult] = useState(null);
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
    const timer = setInterval(fetchPlayers, 2000);
    return () => clearInterval(timer);
  }, [roomId]);

  // 手牌定时刷新
  useEffect(() => {
    fetchMyCards();
    const timer = setInterval(fetchMyCards, 1500);
    return () => clearInterval(timer);
  }, [roomId]);

  async function fetchPlayers() {
    const token = localStorage.getItem('token');
    const res = await fetch(`https://9526.ip-ddns.com/api/room_info.php?roomId=${roomId}&token=${token}`);
    const data = await res.json();
    if (data.success) {
      setPlayers(data.players);
      setRoomStatus(data.status);
      const me = data.players.find(p => p.name === localStorage.getItem('nickname'));
      setIsReady(me && me.submitted);
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
    if (data.success) setMyPoints(data.user.points || 0);
    else setMyPoints(0);
  }

  async function fetchMyCards() {
    const token = localStorage.getItem('token');
    const res = await fetch(`https://9526.ip-ddns.com/api/my_cards.php?roomId=${roomId}&token=${token}`);
    const data = await res.json();
    if (data.success) {
      setSubmitted(!!data.submitted);
      setMyResult(data.result || null);
      if (data.submitted && Array.isArray(data.cards) && data.cards.length === 13) {
        setHead(data.cards.slice(0, 3));
        setMiddle(data.cards.slice(3, 8));
        setTail(data.cards.slice(8, 13));
        setMyCards([]);
      } else if (!data.submitted && Array.isArray(data.cards)) {
        // 自动分牌仅在三墩都为空时做一次
        if (head.length === 0 && middle.length === 0 && tail.length === 0) {
          setHead(data.cards.slice(0, 3));
          setMiddle(data.cards.slice(3, 8));
          setTail(data.cards.slice(8, 13));
          setMyCards([]); // 全部分过去
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

  // 准备
  async function handleReady() {
    const token = localStorage.getItem('token');
    await fetch('https://9526.ip-ddns.com/api/ready.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, token }),
    });
    setIsReady(true);
  }

  // 自动分牌
  function handleAutoSplit() {
    // 合并所有未分配的牌
    const all = [...myCards, ...head, ...middle, ...tail];
    setHead(all.slice(0, 3));
    setMiddle(all.slice(3, 8));
    setTail(all.slice(8, 13));
    setMyCards([]);
    setSelected({ area: 'hand', cards: [] });
    setSubmitMsg('');
  }

  // 牌点击：高亮/取消高亮（在手牌或三墩中都可选）
  function handleCardClick(card, area) {
    if (submitted) return;
    setSelected(sel => {
      if (sel.area !== area) return { area, cards: [card] };
      return sel.cards.includes(card)
        ? { area, cards: sel.cards.filter(c => c !== card) }
        : { area, cards: [...sel.cards, card] };
    });
  }

  // 点击任意墩，将高亮选中的牌移入该墩（无数量限制）
  function moveTo(dest) {
    if (submitted) return;
    if (!selected.cards.length) return;
    // 先从原区移除
    let newHand = [...myCards];
    let newHead = [...head];
    let newMiddle = [...middle];
    let newTail = [...tail];
    const from = selected.area;
    if (from === 'hand') {
      newHand = newHand.filter(c => !selected.cards.includes(c));
    } else if (from === 'head') {
      newHead = newHead.filter(c => !selected.cards.includes(c));
    } else if (from === 'middle') {
      newMiddle = newMiddle.filter(c => !selected.cards.includes(c));
    } else if (from === 'tail') {
      newTail = newTail.filter(c => !selected.cards.includes(c));
    }
    // 放到目标区
    if (dest === 'hand') newHand = [...newHand, ...selected.cards];
    if (dest === 'head') newHead = [...newHead, ...selected.cards];
    if (dest === 'middle') newMiddle = [...newMiddle, ...selected.cards];
    if (dest === 'tail') newTail = [...newTail, ...selected.cards];
    setMyCards(newHand);
    setHead(newHead);
    setMiddle(newMiddle);
    setTail(newTail);
    setSelected({ area: dest, cards: [] });
    setSubmitMsg('');
  }

  // 开始比牌（提交分牌）
  async function handleStartCompare() {
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
      setShowResult(true);
      setSubmitMsg('比牌结果如下');
    } else {
      setSubmitMsg('提交失败，请重试');
    }
  }

  // 比牌弹窗（2x2田字格，3墩堆叠显示）
  function renderResultModal() {
    if (!showResult) return null;
    // 假数据演示结构，实际可用myResult
    const fields = [
      { label: '头道', cards: head },
      { label: '中道', cards: middle },
      { label: '尾道', cards: tail },
      { label: '得分', score: myResult?.[0]?.score || 1 }
    ];
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
        background: 'rgba(0,0,0,0.37)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <div style={{
          background: '#fff',
          borderRadius: 15,
          padding: 24,
          minWidth: 320,
          minHeight: 240,
          boxShadow: '0 8px 40px #0002',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          gap: 16,
        }}>
          <div style={{ gridColumn: '1/2', gridRow: '1/2', textAlign: 'center' }}>
            <div style={{ fontWeight: 700, color: '#23e67a', marginBottom: 8 }}>{fields[0].label}</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
              {fields[0].cards.map(card => (
                <img key={card} src={`/cards/${card}.svg`} alt={card} className="card-img" style={{ width: 36, height: 52 }} />
              ))}
            </div>
          </div>
          <div style={{ gridColumn: '2/3', gridRow: '1/2', textAlign: 'center' }}>
            <div style={{ fontWeight: 700, color: '#4f8cff', marginBottom: 8 }}>{fields[1].label}</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
              {fields[1].cards.map(card => (
                <img key={card} src={`/cards/${card}.svg`} alt={card} className="card-img" style={{ width: 36, height: 52 }} />
              ))}
            </div>
          </div>
          <div style={{ gridColumn: '1/2', gridRow: '2/3', textAlign: 'center' }}>
            <div style={{ fontWeight: 700, color: '#ff974f', marginBottom: 8 }}>{fields[2].label}</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
              {fields[2].cards.map(card => (
                <img key={card} src={`/cards/${card}.svg`} alt={card} className="card-img" style={{ width: 36, height: 52 }} />
              ))}
            </div>
          </div>
          <div style={{ gridColumn: '2/3', gridRow: '2/3', textAlign: 'center' }}>
            <div style={{ fontWeight: 700, color: '#ca1a4b', marginBottom: 8 }}>得分</div>
            <div style={{ fontSize: 27, color: '#ca1a4b', marginTop: 14 }}>{fields[3].score}</div>
          </div>
          <button style={{
            position: 'absolute', right: 18, top: 12, background: 'transparent', border: 'none', fontSize: 22, color: '#888', cursor: 'pointer'
          }} onClick={() => setShowResult(false)}>×</button>
        </div>
      </div>
    );
  }

  // 按钮样式
  const buttonStyle = {
    flex: 1,
    background: '#23e67a',
    color: '#fff',
    fontWeight: 700,
    border: 'none',
    borderRadius: 7,
    padding: '10px 0',
    fontSize: 18,
    cursor: 'pointer'
  };

  // 渲染玩家座位
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
              boxShadow: '0 4px 22px #23e67a44, 0 1.5px 5px #1a462a6a',
              border: 'none',
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
              boxShadow: '0 4px 22px #23e67a44, 0 1.5px 5px #1a462a6a',
              border: 'none',
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

  // 渲染13张手牌
  function renderMyCards() {
    return <div className="cards-area">
      {myCards.map(card =>
        <img
          key={card}
          src={`/cards/${card}.svg`}
          alt={card}
          className="card-img"
          style={{
            border: selected.area === 'hand' && selected.cards.includes(card) ? '2.5px solid #23e67a' : '2.5px solid transparent',
            boxShadow: selected.area === 'hand' && selected.cards.includes(card) ? '0 0 12px #23e67a88' : ''
          }}
          onClick={() => handleCardClick(card, 'hand')}
        />
      )}
    </div>;
  }

  // 渲染分好的三道（牌也可高亮多选）
  function renderPaiDun(arr, label, color, area, onClick) {
    return (
      <div
        style={{
          background: '#1e663d',
          boxShadow: '0 4px 22px #23e67a44, 0 1.5px 5px #1a462a6a',
          border: 'none',
          borderRadius: 10,
          padding: 14,
          marginBottom: 12,
          cursor: submitted ? 'default' : 'pointer',
        }}
        onClick={() => moveTo(area)}
      >
        <div style={{ marginBottom: 8, color, fontSize: 16 }}>{label}（{arr.length}）</div>
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
                style={{
                  opacity: submitted ? 0.75 : 1,
                  border: selected.area === area && selected.cards.includes(card) ? '2.5px solid #23e67a' : '2.5px solid transparent',
                  boxShadow: selected.area === area && selected.cards.includes(card) ? '0 0 12px #23e67a88' : ''
                }}
                onClick={e => { e.stopPropagation(); handleCardClick(card, area); }}
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

        {renderSeats()}

        <div style={{ margin: '15px 0 10px 0' }}>
          <div style={{ color: '#fff', fontWeight: 700, marginBottom: 6 }}>
            你的手牌（点击选中，点击下方牌墩移动）
          </div>
          {renderMyCards()}
        </div>
        {renderPaiDun(head, '头道', '#e0ffe3', 'head', () => moveTo('head'))}
        {renderPaiDun(middle, '中道', '#e0eaff', 'middle', () => moveTo('middle'))}
        {renderPaiDun(tail, '尾道', '#ffe6e0', 'tail', () => moveTo('tail'))}

        {/* 三个固定按钮 */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <button
            style={buttonStyle}
            disabled={isReady || submitted}
            onClick={handleReady}
          >准备</button>
          <button
            style={buttonStyle}
            onClick={handleAutoSplit}
            disabled={submitted}
          >自动分牌</button>
          <button
            style={buttonStyle}
            disabled={submitted}
            onClick={handleStartCompare}
          >开始比牌</button>
        </div>
        <div style={{ color: '#c3e1d1', textAlign: 'center', fontSize: 16, marginTop: 6, minHeight: 24 }}>
          {submitMsg}
        </div>
      </div>
      {renderResultModal()}
    </div>
  );
}
