import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Play.css';

const AI_NAMES = ['小明', '小红', '小刚'];

const OUTER_MAX_WIDTH = 420;
const PAI_DUN_HEIGHT = 133;
const CARD_HEIGHT = Math.round(PAI_DUN_HEIGHT * 0.94);
const CARD_WIDTH = Math.round(CARD_HEIGHT * 46 / 66);

export default function TryPlay() {
  const navigate = useNavigate();
  const [head, setHead] = useState([]);
  const [middle, setMiddle] = useState([]);
  const [tail, setTail] = useState([]);
  const [selected, setSelected] = useState({ area: '', cards: [] });
  const [msg, setMsg] = useState('');
  const [aiPlayers, setAiPlayers] = useState([
    { name: AI_NAMES[0], head: [], middle: [], tail: [] },
    { name: AI_NAMES[1], head: [], middle: [], tail: [] },
    { name: AI_NAMES[2], head: [], middle: [], tail: [] },
  ]);
  const [showResult, setShowResult] = useState(false);
  const [scores, setScores] = useState([0,0,0,0]);
  const [myVs, setMyVs] = useState([0,0,0]);
  const [isReady, setIsReady] = useState(false);
  const [hasCompared, setHasCompared] = useState(false);

  // 绿色暗影主色
  const greenShadow = "0 4px 22px #23e67a44, 0 1.5px 5px #1a462a6a";

  // ---------- 1. 改造发牌为后端API ----------
  async function handleReady() {
    if (!isReady) {
      setMsg('智能发牌中...');
      try {
        const res = await fetch('https://9525.ip-ddns.com/api/sss_tryplay_deal.php');
        const data = await res.json();
        if (!data.success || !data.players || data.players.length !== 4) {
          setMsg('发牌失败');
          return;
        }
        const me = data.players[0];
        setHead(me.head);
        setMiddle(me.middle);
        setTail(me.tail);
        setAiPlayers([data.players[1], data.players[2], data.players[3]]);
        setIsReady(true);
        setHasCompared(false);
        setMsg('');
        setShowResult(false);
        setScores([0,0,0,0]);
        setMyVs([0,0,0]);
        setSelected({ area: '', cards: [] });
      } catch (e) {
        setMsg('发牌接口异常');
      }
    } else {
      // 取消准备，清空手牌和AI
      setHead([]); setMiddle([]); setTail([]);
      setAiPlayers([
        { name: AI_NAMES[0], head: [], middle: [], tail: [] },
        { name: AI_NAMES[1], head: [], middle: [], tail: [] },
        { name: AI_NAMES[2], head: [], middle: [], tail: [] },
      ]);
      setIsReady(false);
      setHasCompared(false);
      setMsg('');
      setShowResult(false);
      setScores([0,0,0,0]);
      setMyVs([0,0,0]);
      setSelected({ area: '', cards: [] });
    }
  }

  // ---------- 2. 改造比牌为后端API ----------
  async function handleStartCompare() {
    if (head.length !== 3 || middle.length !== 5 || tail.length !== 5) {
      setMsg('请按 3-5-5 张分配');
      return;
    }
    const allPlayers = [
      { name: '你', head, middle, tail },
      ...aiPlayers.map(ai => ({ name: ai.name, head: ai.head, middle: ai.middle, tail: ai.tail }))
    ];
    setMsg('正在比牌...');
    try {
      const res = await fetch('https://9525.ip-ddns.com/api/sss_tryplay_score.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ players: allPlayers }),
      });
      const data = await res.json();
      if (!data.success || !Array.isArray(data.scores)) {
        setMsg('比牌失败');
        return;
      }
      setScores(data.scores);
      // 计算你vs每个AI的分数（即你和Ta的单挑分）
      const myVsArr = [];
      for (let i = 1; i <= 3; ++i) {
        // 用后端接口只传2家来算“你vs Ta”
        const resVs = await fetch('https://9525.ip-ddns.com/api/sss_tryplay_score.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ players: [allPlayers[0], allPlayers[i]] }),
        });
        const dataVs = await resVs.json();
        myVsArr.push(dataVs.scores ? dataVs.scores[0] : 0);
      }
      setMyVs(myVsArr);
      setShowResult(true);
      setHasCompared(true);
      setMsg('');
      setIsReady(false);
    } catch (e) {
      setMsg('比牌接口异常');
    }
  }

  function handleCardClick(card, area, e) {
    e.stopPropagation();
    setSelected(prev => {
      if (prev.area !== area) return { area, cards: [card] };
      const isSelected = prev.cards.includes(card);
      let nextCards;
      if (isSelected) {
        nextCards = prev.cards.filter(c => c !== card);
      } else {
        nextCards = [...prev.cards, card];
      }
      return { area, cards: nextCards };
    });
  }

  function moveTo(dest) {
    if (!selected.cards.length) return;
    let newHead = [...head], newMiddle = [...middle], newTail = [...tail];
    const from = selected.area;
    if (from === 'head') newHead = newHead.filter(c => !selected.cards.includes(c));
    if (from === 'middle') newMiddle = newMiddle.filter(c => !selected.cards.includes(c));
    if (from === 'tail') newTail = newTail.filter(c => !selected.cards.includes(c));
    if (dest === 'head') newHead = [...newHead, ...selected.cards];
    if (dest === 'middle') newMiddle = [...newMiddle, ...selected.cards];
    if (dest === 'tail') newTail = [...newTail, ...selected.cards];
    setHead(newHead); setMiddle(newMiddle); setTail(newTail);
    setSelected({ area: dest, cards: [] });
    setMsg('');
  }

  function renderPlayerSeat(name, idx, isMe) {
    return (
      <div
        key={name}
        className="play-seat"
        style={{
          border: 'none',
          borderRadius: 10,
          marginRight: 8,
          width: '22%',
          minWidth: 70,
          color: isMe ? '#23e67a' : '#fff',
          background: isMe ? '#1c6e41' : '#2a556e',
          textAlign: 'center',
          padding: '12px 0',
          fontWeight: 700,
          fontSize: 17,
          boxShadow: greenShadow,
          boxSizing: 'border-box'
        }}
      >
        <div>{name}</div>
        <div style={{ marginTop: 4, fontSize: 13, fontWeight: 400 }}>
          {isMe ? '你' : 'AI'}
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
                border: isSelected ? '2.5px solid #ff4444' : 'none',
                boxShadow: isSelected
                  ? '0 0 16px 2px #ff4444cc'
                  : 'none',
                cursor: isReady ? 'pointer' : 'not-allowed',
                background: '#fff',
                transition: 'border .13s, box-shadow .13s'
              }}
              onClick={e => { if (isReady) handleCardClick(card, area, e); }}
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
        onClick={() => { if (isReady) moveTo(area); }}
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

  function renderResultModal() {
    if (!showResult) return null;
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
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ textAlign: 'center', borderBottom: '1px solid #eee' }}>
              <div style={{ fontWeight: 700, color: i === 0 ? '#23e67a' : '#4f8cff', marginBottom: 8 }}>
                {i === 0
                  ? `你（总分：${scores[0]}）`
                  : `${aiPlayers[i-1].name}（vs你：${myVs[i-1] > 0 ? '+' : ''}${myVs[i-1]}）`
                }
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 3 }}>
                {i === 0
                  ? renderPaiDunCards(head, 'none', { width: cardW, height: cardH })
                  : renderPaiDunCards(aiPlayers[i - 1].head, 'none', { width: cardW, height: cardH })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 3 }}>
                {i === 0
                  ? renderPaiDunCards(middle, 'none', { width: cardW, height: cardH })
                  : renderPaiDunCards(aiPlayers[i - 1].middle, 'none', { width: cardW, height: cardH })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                {i === 0
                  ? renderPaiDunCards(tail, 'none', { width: cardW, height: cardH })
                  : renderPaiDunCards(aiPlayers[i - 1].tail, 'none', { width: cardW, height: cardH })}
              </div>
            </div>
          ))}
          <button style={{
            position: 'absolute', right: 18, top: 12, background: 'transparent', border: 'none', fontSize: 22, color: '#888', cursor: 'pointer'
          }} onClick={() => setShowResult(false)}>×</button>
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
            onClick={() => navigate('/')}
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
            积分：100
          </div>
        </div>
        {/* 玩家区 */}
        <div style={{ display: 'flex', marginBottom: 18, gap: 8 }}>
          {renderPlayerSeat('你', 0, true)}
          {aiPlayers.map((ai, idx) => renderPlayerSeat(ai.name, idx + 1, false))}
        </div>
        {/* 牌墩区域 */}
        {renderPaiDun(head, '头道', 'head', '#23e67a')}
        {renderPaiDun(middle, '中道', 'middle', '#23e67a')}
        {renderPaiDun(tail, '尾道', 'tail', '#23e67a')}
        {/* 按钮区 */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 0, marginTop: 14 }}>
          <button
            style={{
              flex: 1,
              background: !isReady
                ? 'linear-gradient(90deg,#23e67a 80%,#43ffb8 100%)'
                : '#b0b0b0',
              color: '#fff',
              fontWeight: 700,
              border: 'none',
              borderRadius: 10,
              padding: '13px 0',
              fontSize: 18,
              cursor: !isReady || hasCompared ? 'pointer' : 'pointer',
              boxShadow: !isReady
                ? '0 2px 9px #23e67a22'
                : 'none',
              transition: 'background 0.16s'
            }}
            onClick={handleReady}
          >{isReady ? '取消准备' : '准备'}</button>
          <button
            style={{
              flex: 1,
              background: isReady
                ? '#ffb14d'
                : '#ddd',
              color: isReady ? '#222' : '#fff',
              fontWeight: 700,
              border: 'none',
              borderRadius: 10,
              padding: '13px 0',
              fontSize: 18,
              cursor: isReady ? 'pointer' : 'not-allowed',
              boxShadow: isReady ? '0 2px 9px #ffb14d55' : 'none',
              transition: 'background 0.16s'
            }}
            onClick={isReady ? handleStartCompare : undefined}
            disabled={!isReady}
          >开始比牌</button>
        </div>
        <div style={{ color: '#c3e1d1', textAlign: 'center', fontSize: 16, marginTop: 8, minHeight: 24 }}>
          {msg}
        </div>
        {renderResultModal()}
      </div>
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
