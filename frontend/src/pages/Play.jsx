import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './Play.css';
import { getSmartSplits } from './SmartSplit';
import { calcSSSAllScores, isFoul } from './sssScore';

const OUTER_MAX_WIDTH = 420;
const PAI_DUN_HEIGHT = 133;
const CARD_HEIGHT = Math.round(PAI_DUN_HEIGHT * 0.94);
const CARD_WIDTH = Math.round(CARD_HEIGHT * 46 / 66);

export default function Play() {
  const { roomId } = useParams();
  const [players, setPlayers] = useState([]);
  const [myPoints, setMyPoints] = useState(0);
  const [myName, setMyName] = useState('');
  const [myCards, setMyCards] = useState([]);
  const [selected, setSelected] = useState({ area: '', cards: [] });
  const [head, setHead] = useState([]);
  const [middle, setMiddle] = useState([]);
  const [tail, setTail] = useState([]);
  const [submitMsg, setSubmitMsg] = useState('');
  const [isReady, setIsReady] = useState(false);       // 准备按钮状态
  const [isFinished, setIsFinished] = useState(false); // 完成理牌状态
  const [showResult, setShowResult] = useState(false);
  const [allResults, setAllResults] = useState([]);    // 全部玩家比牌数据
  const [foulStates, setFoulStates] = useState([]);    // 全部玩家倒水状态
  const [scores, setScores] = useState([]);
  const [myIndex, setMyIndex] = useState(0);

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
    // eslint-disable-next-line
  }, [roomId]);

  async function fetchPlayers() {
    const token = localStorage.getItem('token');
    const res = await fetch(`https://9526.ip-ddns.com/api/room_info.php?roomId=${roomId}&token=${token}`);
    const data = await res.json();
    if (data.success) {
      setPlayers(data.players);
      // 计算我的index
      const idx = data.players.findIndex(p => p.name === localStorage.getItem('nickname'));
      setMyIndex(idx >= 0 ? idx : 0);
      setIsReady(data.players[idx] && data.players[idx].submitted === true && !isFinished);
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
      // 如果有牌且未完成理牌，自动分到三墩
      if (Array.isArray(data.cards) && data.cards.length === 13 && !isFinished) {
        setHead(data.cards.slice(0, 3));
        setMiddle(data.cards.slice(3, 8));
        setTail(data.cards.slice(8, 13));
        setMyCards([]);
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
    setIsFinished(false);
    setSubmitMsg('');
    setHead([]);
    setMiddle([]);
    setTail([]);
    setMyCards([]);
  }

  // 牌点击：高亮/取消高亮（在手牌或三墩中都可选）
  function handleCardClick(card, area, e) {
    if (isFinished) return;
    if (e) e.stopPropagation();
    setSelected(sel => {
      if (sel.area !== area) return { area, cards: [card] };
      return sel.cards.includes(card)
        ? { area, cards: sel.cards.filter(c => c !== card) }
        : { area, cards: [...sel.cards, card] };
    });
  }

  // 点击任意墩，将高亮选中的牌移入该墩（无数量限制）
  function moveTo(dest) {
    if (isFinished) return;
    if (!selected.cards.length) return;
    let newHand = [...myCards];
    let newHead = [...head];
    let newMiddle = [...middle];
    let newTail = [...tail];
    const from = selected.area;
    if (from === 'hand') newHand = newHand.filter(c => !selected.cards.includes(c));
    if (from === 'head') newHead = newHead.filter(c => !selected.cards.includes(c));
    if (from === 'middle') newMiddle = newMiddle.filter(c => !selected.cards.includes(c));
    if (from === 'tail') newTail = newTail.filter(c => !selected.cards.includes(c));
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
    if (isFinished) return;
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
      setIsFinished(true); // 标记完成理牌
      setSubmitMsg('等待其他玩家完成理牌');
    } else {
      setSubmitMsg('提交失败，请重试');
    }
  }

  // 轮询所有玩家的完成理牌状态，全部完成后弹比牌界面
  useEffect(() => {
    if (!isFinished) return;
    const timer = setInterval(async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`https://9526.ip-ddns.com/api/room_info.php?roomId=${roomId}&token=${token}`);
      const data = await res.json();
      if (data.success) {
        // 你需要后端把比牌结果写入players.result字段，并且allSubmitted=true才行
        // 这里用my_cards.php接口allPlayed判断更好
        const cardRes = await fetch(`https://9526.ip-ddns.com/api/my_cards.php?roomId=${roomId}&token=${token}`);
        const cardData = await cardRes.json();
        if (cardData.allPlayed) {
          // 拉所有玩家的分牌与结果
          // 你可以用room_info.php返回players的result字段，或调用一次api专用接口
          // 这里只模拟客户端本地比牌（生产应由后端返回比牌结果）
          const allPlayers = data.players.map((p, idx) => ({
            name: p.name,
            head: head, middle: middle, tail: tail // 这里只是示例，实际应从后端取
          }));
          // 用后端返回的result字段渲染比牌界面
          // 这里只能显示本地数据，真实场景应解析result字段
          setShowResult(true);
          setIsReady(false);
          setIsFinished(false);
          setSubmitMsg('');
          setHead([]);
          setMiddle([]);
          setTail([]);
          setMyCards([]);
          clearInterval(timer);
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isFinished, roomId, head, middle, tail]);

  // 绿色暗影主色
  const greenShadow = "0 4px 22px #23e67a44, 0 1.5px 5px #1a462a6a";

  // 渲染玩家座位
  function renderPlayerSeat(name, idx, ready, finished) {
    let bg = '#2a556e', color = '#fff', border = 'none', statusText = '未准备';
    if (finished) {
      bg = '#23e67a'; color = '#fff'; border = '2.5px solid #23e67a'; statusText = (name === myName ? '你（完成理牌）' : '完成理牌');
    } else if (ready) {
      bg = '#23e67a'; color = '#fff'; border = '2.5px solid #23e67a'; statusText = (name === myName ? '你（已准备）' : '已准备');
    } else if (name === myName) {
      bg = '#1c6e41'; color = '#23e67a'; border = 'none'; statusText = '你';
    }
    return (
      <div
        key={name}
        className="play-seat"
        style={{
          border, borderRadius: 10, marginRight: 8, width: '22%', minWidth: 70,
          color, background: bg, textAlign: 'center', padding: '12px 0',
          fontWeight: 700, fontSize: 17, boxShadow: greenShadow, boxSizing: 'border-box'
        }}
      >
        <div>{name}</div>
        <div style={{ marginTop: 4, fontSize: 13, fontWeight: 400 }}>
          {statusText}
        </div>
      </div>
    );
  }

  function renderPaiDunCards(arr, area, cardSize) {
    const paddingX = 16;
    const maxWidth = OUTER_MAX_WIDTH - 2 * paddingX - 70;
    let overlap = Math.floor((cardSize?.width ?? CARD_WIDTH) / 3);
    if (arr.length > 1) {
      const totalWidth = (cardSize?.width ?? CARD_WIDTH) + (arr.length - 1) * overlap;
      if (totalWidth > maxWidth) {
        overlap = Math.floor((maxWidth - (cardSize?.width ?? CARD_WIDTH)) / (arr.length - 1));
      }
    }
    let lefts = [];
    let startX = 0;
    for (let i = 0; i < arr.length; ++i) {
      lefts.push(startX + i * overlap);
    }
    return (
      <div style={{
        position: 'relative',
        height: cardSize?.height ?? PAI_DUN_HEIGHT,
        width: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        overflow: 'visible'
      }}>
        {arr.map((card, idx) => {
          const isSelected = selected.area === area && selected.cards.includes(card);
          return (
            <img
              key={card}
              src={`/cards/${card}.svg`}
              alt={card}
              className="card-img"
              style={{
                position: 'absolute',
                left: lefts[idx],
                top: ((cardSize?.height ?? PAI_DUN_HEIGHT) - (cardSize?.height ?? CARD_HEIGHT)) / 2,
                zIndex: idx,
                width: cardSize?.width ?? CARD_WIDTH,
                height: cardSize?.height ?? CARD_HEIGHT,
                borderRadius: 5,
                border: isSelected
                  ? '2.5px solid #ff4444'
                  : '2.5px solid #eaeaea',
                boxShadow: isSelected
                  ? '0 0 16px 2px #ff4444cc'
                  : greenShadow,
                cursor: isFinished ? 'not-allowed' : 'pointer',
                background: '#fff',
                transition: 'border .13s, box-shadow .13s'
              }}
              onClick={e => { if (!isFinished) handleCardClick(card, area, e); }}
              draggable={false}
            />
          );
        })}
      </div>
    );
  }

  function renderPaiDun(arr, label, area, color) {
    return (
      <div
        style={{
          width: '100%',
          borderRadius: 14,
          background: '#176b3c',
          minHeight: PAI_DUN_HEIGHT,
          height: PAI_DUN_HEIGHT,
          marginBottom: 20,
          position: 'relative',
          boxShadow: greenShadow,
          display: 'flex',
          alignItems: 'center',
          boxSizing: 'border-box',
          paddingLeft: 16,
          paddingRight: 70,
        }}
        onClick={() => { if (!isFinished) moveTo(area); }}
      >
        <div style={{
          flex: 1,
          height: '100%',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          minWidth: 0,
        }}>
          {arr.length === 0 &&
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              color: '#c3d6c6',
              fontSize: 18,
              fontWeight: 500,
              userSelect: 'none'
            }}>
              请放置
            </div>
          }
          {renderPaiDunCards(arr, area)}
        </div>
        <div
          style={{
            position: 'absolute',
            right: 16,
            top: 0,
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            color,
            fontSize: 18,
            fontWeight: 600,
            pointerEvents: 'none',
            background: 'transparent',
            whiteSpace: 'nowrap'
          }}
        >
          {label}（{arr.length}）
        </div>
      </div>
    );
  }

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
          onClick={e => handleCardClick(card, 'hand', e)}
        />
      )}
    </div>;
  }

  // 比牌弹窗（与TryPlay一致，支持所有玩家展示，倒水高亮，分数等）
  function renderResultModal() {
    if (!showResult) return null;
    // TODO: 实际应展示后端返回的各玩家分牌和分数，以下演示只渲染自己的三道
    const scale = 0.9;
    const cardW = CARD_WIDTH * scale;
    const cardH = CARD_HEIGHT * scale;
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
        background: 'rgba(0,0,0,0.37)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <div style={{
          background: '#fff',
          borderRadius: 15,
          padding: 24,
          minWidth: 400,
          minHeight: 270,
          boxShadow: '0 8px 40px #0002',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          gap: 16,
          position: 'relative'
        }}>
          {/* 这里只做自己的分牌展示，生产可用后端返回的数据渲染全部玩家 */}
          <div style={{ textAlign: 'center', borderBottom: '1px solid #eee', gridColumn: '1/3' }}>
            <div style={{ fontWeight: 700, color: '#23e67a', marginBottom: 8 }}>
              {myName}（你的结果）
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 3 }}>
              {renderPaiDunCards(head, 'none', { width: cardW, height: cardH })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 3 }}>
              {renderPaiDunCards(middle, 'none', { width: cardW, height: cardH })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
              {renderPaiDunCards(tail, 'none', { width: cardW, height: cardH })}
            </div>
          </div>
          <button style={{
            position: 'absolute', right: 18, top: 12, background: 'transparent', border: 'none', fontSize: 22, color: '#888', cursor: 'pointer'
          }} onClick={() => {
            setShowResult(false);
            setIsReady(false);
            setIsFinished(false);
            setSubmitMsg('');
          }}>×</button>
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
        maxWidth: OUTER_MAX_WIDTH,
        width: '100%',
        margin: '30px auto',
        background: '#185a30',
        borderRadius: 22,
        boxShadow: greenShadow,
        padding: 16,
        border: 'none',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 650,
        boxSizing: 'border-box'
      }}>
        {/* 头部：退出房间+积分 */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <button
            style={{
              background: 'linear-gradient(90deg,#fff 60%,#e0fff1 100%)',
              color: '#234',
              fontWeight: 'bold',
              border: 'none',
              borderRadius: 9,
              padding: '7px 22px',
              cursor: 'pointer',
              marginRight: 18,
              fontSize: 17,
              boxShadow: '0 1.5px 6px #23e67a30'
            }}
            onClick={handleExitRoom}
          >
            &lt; 退出房间
          </button>
          <div style={{
            flex: 1,
            textAlign: 'right',
            color: '#23e67a',
            fontWeight: 900,
            fontSize: 21,
            letterSpacing: 2,
            marginRight: 8,
            textShadow: '0 2px 7px #23e67a44'
          }}>
            <span role="img" aria-label="coin" style={{ fontSize: 18, marginRight: 4 }}>🪙</span>
            积分：{myPoints}
          </div>
        </div>
        {/* 玩家区 */}
        <div style={{ display: 'flex', marginBottom: 18, gap: 8 }}>
          {players.map((p, idx) =>
            renderPlayerSeat(p.name, idx, p.submitted && !isFinished, isFinished)
          )}
        </div>
        {/* 牌墩区域 */}
        {renderPaiDun(head, '头道', 'head', '#23e67a')}
        {renderPaiDun(middle, '中道', 'middle', '#23e67a')}
        {renderPaiDun(tail, '尾道', 'tail', '#23e67a')}
        {/* 我的手牌 */}
        {renderMyCards()}
        {/* 按钮区 */}
        <div style={{ display: 'flex', gap: 12, margin: 0, marginTop: 10 }}>
          <button
            style={{
              flex: 1,
              background: !isReady && !isFinished
                ? 'linear-gradient(90deg,#23e67a 80%,#43ffb8 100%)'
                : '#b0b0b0',
              color: '#fff',
              fontWeight: 700,
              border: 'none',
              borderRadius: 10,
              padding: '13px 0',
              fontSize: 18,
              cursor: !isReady && !isFinished ? 'pointer' : 'not-allowed',
              boxShadow: !isReady && !isFinished
                ? '0 2px 9px #23e67a22'
                : 'none',
              transition: 'background 0.16s'
            }}
            onClick={!isReady && !isFinished ? handleReady : undefined}
            disabled={isReady || isFinished}
          >准备</button>
          <button
            style={{
              flex: 1,
              background: isFinished
                ? '#b0b0b0'
                : '#ffb14d',
              color: isFinished ? '#fff' : '#222',
              fontWeight: 700,
              border: 'none',
              borderRadius: 10,
              padding: '13px 0',
              fontSize: 18,
              cursor: isFinished ? 'not-allowed' : 'pointer',
              boxShadow: isFinished ? 'none' : '0 2px 9px #ffb14d55',
              transition: 'background 0.16s'
            }}
            onClick={!isFinished ? handleStartCompare : undefined}
            disabled={isFinished}
          >开始比牌</button>
        </div>
        <div style={{ color: '#c3e1d1', textAlign: 'center', fontSize: 16, marginTop: 8, minHeight: 24 }}>
          {submitMsg}
        </div>
        {renderResultModal()}
      </div>
      {/* 移动端自适应，防止溢出 */}
      <style>{`
        @media (max-width: 480px) {
          .play-seat {
            margin-right: 4px !important;
            width: 24% !important;
            min-width: 0 !important;
          }
          .card-img {
            width: ${Math.floor(CARD_WIDTH*0.92)}px !important;
            height: ${Math.floor(CARD_HEIGHT*0.92)}px !important;
          }
        }
      `}</style>
    </div>
  );
}
