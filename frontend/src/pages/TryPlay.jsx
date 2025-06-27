import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Play.css';

const allSuits = ['clubs', 'spades', 'diamonds', 'hearts'];
const allRanks = ['2','3','4','5','6','7','8','9','10','jack','queen','king','ace'];
const AI_NAMES = ['小明', '小红', '小刚'];

// 牌墩高度基础值
const BASE_PAI_DUN_HEIGHT = 102; // 上一版基础
const PAI_DUN_HEIGHT = Math.round(BASE_PAI_DUN_HEIGHT * 1.3); // 增加30%
const CARD_WIDTH = 46;
const CARD_HEIGHT = 66;
const CARD_GAP = 8;
const PAI_DUN_WIDTH = 340;

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
  const [isReady, setIsReady] = useState(false);
  const [dealed, setDealed] = useState(false);

  function handleReady() {
    const deck = getShuffledDeck();
    const myHand = deck.slice(0, 13);
    const aiHands = [
      deck.slice(13, 26),
      deck.slice(26, 39),
      deck.slice(39, 52)
    ];
    const mySplit = aiSplit(myHand);
    setHead(mySplit.head);
    setMiddle(mySplit.middle);
    setTail(mySplit.tail);
    setAiPlayers(aiPlayers.map((ai, idx) => {
      const sp = aiSplit(aiHands[idx]);
      return { ...ai, ...sp };
    }));
    setIsReady(true);
    setDealed(true);
    setMsg('');
    setShowResult(false);
    setScores([0,0,0,0]);
    setSelected({ area: '', cards: [] });
  }

  function handleAutoSplit() {
    if (!dealed) return;
    const all = [...head, ...middle, ...tail];
    const split = aiSplit(all);
    setHead(split.head);
    setMiddle(split.middle);
    setTail(split.tail);
    setMsg('');
    setSelected({ area: '', cards: [] });
  }

  function handleCardClick(card, area) {
    setSelected(sel => {
      if (sel.area !== area) return { area, cards: [card] };
      return sel.cards.includes(card)
        ? { area, cards: sel.cards.filter(c => c !== card) }
        : { area, cards: [...sel.cards, card] };
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

  function handleStartCompare() {
    if (head.length !== 3 || middle.length !== 5 || tail.length !== 5) {
      setMsg('请按 3-5-5 张分配');
      return;
    }
    const allPlayers = [
      { head, middle, tail },
      ...aiPlayers
    ];
    const resScores = calcScores(allPlayers);
    setScores(resScores);
    setShowResult(true);
    setMsg('');
  }

  function renderPlayerSeat(name, idx, isMe) {
    const color = isMe ? '#23e67a' : '#fff';
    return (
      <div
        key={name}
        className="play-seat"
        style={{
          border: `2px solid ${isMe ? '#ffe08b' : '#ffe08b'}`,
          borderRadius: 14,
          marginRight: 10,
          width: '22%',
          minWidth: 70,
          color,
          background: isMe ? '#1c6e41' : '#2a556e',
          textAlign: 'center',
          padding: '12px 0 10px 0',
          boxShadow: '0 2px 9px #0001',
          fontWeight: 700,
          fontSize: 17,
          transition: 'background 0.2s'
        }}
      >
        <div>{name}</div>
        <div style={{ marginTop: 4, fontSize: 13, fontWeight: 400 }}>
          {isMe ? '你' : 'AI'}
        </div>
      </div>
    );
  }

  // 堆叠显示卡片
  function renderPaiDunCards(arr, area) {
    const fullWidth = PAI_DUN_WIDTH - 16;
    const cardFull = CARD_WIDTH + CARD_GAP;
    let overlap = CARD_GAP;
    let lefts = [];
    let startX = 8;
    if (arr.length * cardFull > fullWidth) {
      overlap = (fullWidth - CARD_WIDTH) / (arr.length - 1);
      if (overlap < 18) overlap = 18;
    }
    for (let i = 0; i < arr.length; ++i) {
      lefts.push(startX + i * overlap);
    }
    return (
      <div style={{ position: 'relative', height: PAI_DUN_HEIGHT, minWidth: PAI_DUN_WIDTH }}>
        {arr.map((card, idx) => (
          <img
            key={card}
            src={`/cards/${card}.svg`}
            alt={card}
            className="card-img"
            style={{
              position: 'absolute',
              left: lefts[idx],
              top: (PAI_DUN_HEIGHT - CARD_HEIGHT) / 2,
              zIndex: idx,
              background: selected.area === area && selected.cards.includes(card) ? '#fffbe1' : '#fff',
              boxShadow: selected.area === area && selected.cards.includes(card)
                ? '0 0 16px #23e67a88'
                : '0 2px 8px #0002',
              cursor: isReady ? 'pointer' : 'not-allowed',
              width: CARD_WIDTH,
              height: CARD_HEIGHT,
              border: 'none',
              outline: 'none',
              borderRadius: 8,
              transition: 'background 0.12s',
              userSelect: 'none'
            }}
            onClick={() => { if (isReady) handleCardClick(card, area); }}
            draggable={false}
          />
        ))}
      </div>
    );
  }

  // 牌墩整体金色边框，内部无虚线，和整体外框连成一体
  function renderPaiDun(arr, label, area, color) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: 20,
          width: '100%',
          border: '2.5px solid #ffb14d',
          borderRadius: 17,
          background: '#176b3c',
          boxSizing: 'border-box',
          minHeight: PAI_DUN_HEIGHT,
          height: PAI_DUN_HEIGHT,
          position: 'relative',
          transition: 'background 0.2s, border-color 0.2s'
        }}
        onClick={() => { if (isReady) moveTo(area); }}
      >
        <div style={{ flex: 1, height: '100%', position: 'relative', display: 'flex', alignItems: 'center' }}>
          {arr.length === 0 &&
            <div style={{
              width: '100%',
              height: PAI_DUN_HEIGHT,
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 18,
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
            color,
            fontSize: 18,
            minWidth: 60,
            height: PAI_DUN_HEIGHT,
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            fontWeight: 600,
            pointerEvents: 'none',
            background: 'transparent',
            justifyContent: 'flex-end',
            paddingRight: 18
          }}
        >
          {label}（{arr.length}）
        </div>
      </div>
    );
  }

  // 比牌弹窗（略）
  function renderResultModal() {
    if (!showResult) return null;
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
        background: 'rgba(0,0,0,0.37)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <div style={{
          background: '#fff',
          borderRadius: 18,
          padding: 26,
          minWidth: 400,
          minHeight: 300,
          boxShadow: '0 8px 40px #0002',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          gap: 16,
          position: 'relative'
        }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ textAlign: 'center', borderBottom: '1px solid #eee', paddingBottom: 8 }}>
              <div style={{ fontWeight: 700, color: i === 0 ? '#23e67a' : '#4f8cff', marginBottom: 7, fontSize: 18 }}>
                {i === 0 ? '你' : aiPlayers[i - 1].name}（{scores[i]}分）
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 3 }}>
                {i === 0 ? renderPaiDunCards(head, 'none') : renderPaiDunCards(aiPlayers[i - 1].head, 'none')}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 3 }}>
                {i === 0 ? renderPaiDunCards(middle, 'none') : renderPaiDunCards(aiPlayers[i - 1].middle, 'none')}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                {i === 0 ? renderPaiDunCards(tail, 'none') : renderPaiDunCards(aiPlayers[i - 1].tail, 'none')}
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

  // 主体
  return (
    <div style={{
      background: '#164b2e',
      minHeight: '100vh',
      fontFamily: 'inherit'
    }}>
      <div style={{
        maxWidth: 440,
        margin: '30px auto',
        background: '#185a30',
        borderRadius: 22,
        boxShadow: '0 8px 44px #0f2717bb, 0 0 0 4px #ffb14d88',
        padding: 26,
        minHeight: 920,
        border: '2.5px solid #ffb14d',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        transition: 'box-shadow 0.2s, border-color 0.2s'
      }}>
        {/* 头部：退出房间+积分 */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <button
            style={{
              background: 'linear-gradient(90deg,#fff 60%,#ffe6ca 100%)',
              color: '#234',
              fontWeight: 'bold',
              border: 'none',
              borderRadius: 9,
              padding: '7px 22px',
              cursor: 'pointer',
              marginRight: 18,
              fontSize: 17,
              boxShadow: '0 1.5px 6px #ffb14d30'
            }}
            onClick={() => navigate('/')}
          >
            &lt; 退出房间
          </button>
          <div style={{
            flex: 1,
            textAlign: 'right',
            color: '#ffb14d',
            fontWeight: 900,
            fontSize: 21,
            letterSpacing: 2,
            marginRight: 8,
            textShadow: '0 2px 7px #ffb14d55'
          }}>
            <span role="img" aria-label="coin" style={{ fontSize: 18, marginRight: 4 }}>🪙</span>
            积分：100
          </div>
        </div>
        {/* 玩家区 */}
        <div style={{ display: 'flex', marginBottom: 22, gap: 8 }}>
          {renderPlayerSeat('你', 0, true)}
          {aiPlayers.map((ai, idx) => renderPlayerSeat(ai.name, idx + 1, false))}
        </div>
        {/* 牌墩区域 - 连接整体边框 */}
        {renderPaiDun(head, '头道', 'head', '#ffe08b')}
        {renderPaiDun(middle, '中道', 'middle', '#ffe08b')}
        {renderPaiDun(tail, '尾道', 'tail', '#ffe08b')}
        {/* 按钮区 */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 12, marginTop: 14 }}>
          <button
            style={{
              flex: 1,
              background: isReady ? '#b0b0b0' : '#dddddd',
              color: '#fff',
              fontWeight: 700,
              border: 'none',
              borderRadius: 10,
              padding: '13px 0',
              fontSize: 18,
              cursor: isReady ? 'not-allowed' : 'pointer',
              boxShadow: isReady ? 'none' : '0 2px 9px #aaa2',
              transition: 'background 0.16s'
            }}
            onClick={handleReady}
            disabled={isReady}
          >准备</button>
          <button
            style={{
              flex: 1,
              background: '#23e67a',
              color: '#fff',
              fontWeight: 700,
              border: 'none',
              borderRadius: 10,
              padding: '13px 0',
              fontSize: 18,
              cursor: isReady ? 'pointer' : 'not-allowed',
              boxShadow: '0 2px 9px #23e67a44',
              transition: 'background 0.16s'
            }}
            onClick={handleAutoSplit}
            disabled={!isReady}
          >智能分牌</button>
          <button
            style={{
              flex: 1,
              background: '#ffb14d',
              color: '#222',
              fontWeight: 700,
              border: 'none',
              borderRadius: 10,
              padding: '13px 0',
              fontSize: 18,
              cursor: isReady ? 'pointer' : 'not-allowed',
              boxShadow: '0 2px 9px #ffb14d44',
              transition: 'background 0.16s'
            }}
            onClick={handleStartCompare}
            disabled={!isReady}
          >开始比牌</button>
        </div>
        <div style={{ color: '#c3e1d1', textAlign: 'center', fontSize: 16, marginTop: 8, minHeight: 24 }}>
          {msg}
        </div>
        {renderResultModal()}
      </div>
    </div>
  );
}

// 工具函数
function getShuffledDeck() {
  const deck = [];
  for (const suit of allSuits) for (const rank of allRanks) deck.push(`${rank}_of_${suit}`);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
function aiSplit(cards) {
  return {
    head: cards.slice(0, 3),
    middle: cards.slice(3, 8),
    tail: cards.slice(8, 13)
  }
}
function calcScores(allPlayers) {
  const scores = allPlayers.map(() => 0);
  ['head', 'middle', 'tail'].forEach(area => {
    const ranks = [3,2,1,0].sort(() => Math.random()-0.5);
    for (let i=0; i<4; ++i) scores[i] += ranks[i];
  });
  return scores;
}
