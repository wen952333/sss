import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSmartSplits } from './SmartSplit';
import CompareResultModal from '../pages/CompareResultModal';
import './Play.css';

const allSuits = ['clubs', 'spades', 'diamonds', 'hearts'];
const allRanks = ['2','3','4','5','6','7','8','9','10','jack','queen','king','ace'];
const AI_NAMES = ['小明', '小红', '小刚'];

const OUTER_MAX_WIDTH = 420;
const PAI_DUN_HEIGHT = 133;
const CARD_HEIGHT = Math.round(PAI_DUN_HEIGHT * 0.94);
const CARD_WIDTH = Math.round(CARD_HEIGHT * 46 / 66);

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

  // 绿色发光
  const greenShadow = '0 0 0 2.5px #23e67a,0 0 16px #23e67a66';

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
    return (
      <div
        key={name}
        className="play-seat"
        style={{
          border: '2.5px solid transparent',
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

  // 堆叠显示卡片
  function renderPaiDunCards(arr, area) {
    const paddingX = 16;
    const maxWidth = OUTER_MAX_WIDTH - 2 * paddingX - 70; // 70留给说明文字
    let overlap = Math.floor(CARD_WIDTH / 3);
    if (arr.length > 1) {
      const totalWidth = CARD_WIDTH + (arr.length - 1) * overlap;
      if (totalWidth > maxWidth) {
        overlap = Math.floor((maxWidth - CARD_WIDTH) / (arr.length - 1));
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
        height: PAI_DUN_HEIGHT,
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
                top: (PAI_DUN_HEIGHT - CARD_HEIGHT) / 2,
                zIndex: idx,
                width: CARD_WIDTH,
                height: CARD_HEIGHT,
                borderRadius: 5,
                border: isSelected
                  ? '2.5px solid #ff4444'
                  : '2.5px solid #eaeaea',
                boxShadow: isSelected
                  ? '0 0 16px 2px #ff4444cc'
                  : '0 0 14px #23e67a33',
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

  // 绿色光影牌墩，左右边距与外框统一，内部说明文字绝对定位右侧，移动端不溢出
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
          paddingRight: 70, // 留出空间给右侧说明
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
        border: '2.5px solid transparent',
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
              background: isReady ? '#b0b0b0' : '#dddddd',
              color: '#fff',
              fontWeight: 700,
              border: 'none',
              borderRadius: 10,
              padding: '13px 0',
              fontSize: 18,
              cursor: isReady ? 'not-allowed' : 'pointer',
              boxShadow: isReady ? 'none' : '0 2px 9px #23e67a22',
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
              boxShadow: '0 2px 9px #ffb14d55',
              transition: 'background 0.16s'
            }}
            onClick={handleStartCompare}
            disabled={!isReady}
          >开始比牌</button>
        </div>
        <div style={{ color: '#c3e1d1', textAlign: 'center', fontSize: 16, marginTop: 8, minHeight: 24 }}>
          {msg}
        </div>
        <CompareResultModal
          open={showResult}
          onClose={() => setShowResult(false)}
          myName="你"
          aiPlayers={aiPlayers}
          head={head}
          middle={middle}
          tail={tail}
          scores={scores}
          renderPaiDunCards={renderPaiDunCards}
        />
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
