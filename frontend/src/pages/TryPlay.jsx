import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Play.css';

const allSuits = ['clubs', 'spades', 'diamonds', 'hearts'];
const allRanks = ['2','3','4','5','6','7','8','9','10','jack','queen','king','ace'];
const AI_NAMES = ['小明', '小红', '小刚'];

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

// 牌墩宽度和卡片宽度
const PAI_DUN_WIDTH = 340;
const CARD_WIDTH = 46; // Play.css .card-img
const CARD_GAP = 8;

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
        className={`play-seat`}
        style={{
          border: `2px solid ${isMe ? '#23e67a' : '#3ba0e7'}`,
          borderRadius: 10,
          marginRight: 8,
          width: '25%',
          minWidth: 80,
          color,
          background: isMe ? '#115f37' : '#194e3a',
          textAlign: 'center',
          padding: '12px 0'
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 18 }}>{name}</div>
        <div style={{ marginTop: 4, fontSize: 14 }}>
          {isMe ? '你' : 'AI'}
        </div>
      </div>
    );
  }

  // 堆叠显示卡片
  function renderPaiDunCards(arr, area, cardWidth = CARD_WIDTH, cardHeight = 66) {
    const fullWidth = PAI_DUN_WIDTH - 16;
    const cardFull = cardWidth + CARD_GAP;
    let overlap = CARD_GAP;
    let lefts = [];
    let startX = 8;
    if (arr.length * cardFull > fullWidth) {
      overlap = (fullWidth - cardWidth) / (arr.length - 1);
      if (overlap < 18) overlap = 18;
    }
    for (let i = 0; i < arr.length; ++i) {
      lefts.push(startX + i * overlap);
    }
    return (
      <div style={{ position: 'relative', height: cardHeight + 2, minWidth: PAI_DUN_WIDTH }}>
        {arr.map((card, idx) => (
          <img
            key={card}
            src={`/cards/${card}.svg`}
            alt={card}
            className="card-img"
            style={{
              position: 'absolute',
              left: lefts[idx],
              top: 0,
              zIndex: idx,
              width: cardWidth,
              height: cardHeight,
              border: selected.area === area && selected.cards.includes(card) ? '2.5px solid #23e67a' : '2.5px solid transparent',
              boxShadow: selected.area === area && selected.cards.includes(card) ? '0 0 12px #23e67a88' : '',
              cursor: isReady ? 'pointer' : 'not-allowed'
            }}
            onClick={() => { if (isReady) handleCardClick(card, area); }}
            draggable={false}
          />
        ))}
      </div>
    );
  }

  // 牌墩
  function renderPaiDun(arr, label, area, color) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          marginBottom: 16,
          position: 'relative'
        }}
      >
        <div
          style={{
            background: '#1e663d',
            borderRadius: 10,
            padding: '0 0',
            border: '2px dashed #23e67a',
            minWidth: PAI_DUN_WIDTH,
            maxWidth: PAI_DUN_WIDTH,
            minHeight: 68,
            position: 'relative',
            cursor: isReady ? 'pointer' : 'not-allowed',
            boxSizing: 'border-box'
          }}
          onClick={() => { if (isReady) moveTo(area); }}
        >
          {arr.length === 0 &&
            <span style={{
              display: 'block',
              color: '#aaa',
              fontSize: 15,
              padding: '18px 0 0 16px'
            }}>请放置</span>
          }
          {renderPaiDunCards(arr, area)}
        </div>
        <div
          style={{
            marginLeft: 18,
            color,
            fontSize: 16,
            minWidth: 60,
            marginTop: 6,
            height: 34,
            whiteSpace: 'nowrap',
            lineHeight: '34px',
            zIndex: 1,
            position: 'relative'
          }}
        >
          {label}（{arr.length}）
        </div>
      </div>
    );
  }

  // 比牌弹窗（与牌桌同宽高，缩小牌面90%，红色十字线分4区块）
  function renderResultModal() {
    if (!showResult) return null;

    // 牌桌宽高
    const outerWidth = 420;
    const outerHeight = 650;
    // 缩小10%牌面
    const resultCardWidth = Math.round(CARD_WIDTH * 0.9);
    const resultCardHeight = Math.round(66 * 0.9);

    // 4宫格布局
    const gridStyle = {
      background: '#fff',
      borderRadius: 12,
      padding: 0,
      width: outerWidth,
      height: outerHeight,
      boxShadow: '0 8px 40px #0002',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gridTemplateRows: '1fr 1fr',
      position: 'relative',
      overflow: 'hidden'
    };

    // 红色十字线样式
    const crossLineStyleV = {
      position: 'absolute',
      top: 0,
      left: '50%',
      width: '2px',
      height: '100%',
      background: 'red',
      zIndex: 10,
      transform: 'translateX(-1px)'
    };
    const crossLineStyleH = {
      position: 'absolute',
      left: 0,
      top: '50%',
      width: '100%',
      height: '2px',
      background: 'red',
      zIndex: 10,
      transform: 'translateY(-1px)'
    };

    function renderPlayerBlock(player, score, headArr, middleArr, tailArr, color) {
      return (
        <div style={{ textAlign: 'center', padding: '22px 0 0 0', boxSizing: 'border-box', height: '100%' }}>
          <div style={{ fontWeight: 700, color, marginBottom: 6 }}>{player}（{score}分）</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 2, marginBottom: 2 }}>
            {renderPaiDunCards(headArr, 'none', resultCardWidth, resultCardHeight)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 2, marginBottom: 2 }}>
            {renderPaiDunCards(middleArr, 'none', resultCardWidth, resultCardHeight)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
            {renderPaiDunCards(tailArr, 'none', resultCardWidth, resultCardHeight)}
          </div>
        </div>
      );
    }

    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
        background: 'rgba(0,0,0,0.37)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <div style={gridStyle}>
          {/* 红色十字分割线 */}
          <div style={crossLineStyleV} />
          <div style={crossLineStyleH} />
          {/* 四宫格玩家 */}
          {renderPlayerBlock('你', scores[0], head, middle, tail, '#23e67a')}
          {renderPlayerBlock(aiPlayers[0].name, scores[1], aiPlayers[0].head, aiPlayers[0].middle, aiPlayers[0].tail, '#4f8cff')}
          {renderPlayerBlock(aiPlayers[1].name, scores[2], aiPlayers[1].head, aiPlayers[1].middle, aiPlayers[1].tail, '#4f8cff')}
          {renderPlayerBlock(aiPlayers[2].name, scores[3], aiPlayers[2].head, aiPlayers[2].middle, aiPlayers[2].tail, '#4f8cff')}
          {/* 关闭按钮 */}
          <button style={{
            position: 'absolute', right: 18, top: 12, background: 'transparent', border: 'none', fontSize: 22, color: '#888', cursor: 'pointer', zIndex: 20
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
        maxWidth: 420,
        margin: '30px auto',
        background: '#144126',
        borderRadius: 12,
        boxShadow: '0 4px 32px #0f2717bb',
        padding: 22,
        minHeight: 650,
        position: 'relative'
      }}>
        <button
          style={{
            background: '#fff',
            color: '#234',
            fontWeight: 'bold',
            border: 'none',
            borderRadius: 7,
            padding: '5px 16px',
            cursor: 'pointer',
            marginBottom: 14
          }}
          onClick={() => navigate('/')}
        >
          &lt; 返回大厅
        </button>
        {/* 玩家区 */}
        <div style={{ display: 'flex', marginBottom: 18 }}>
          {renderPlayerSeat('你', 0, true)}
          {aiPlayers.map((ai, idx) => renderPlayerSeat(ai.name, idx + 1, false))}
        </div>
        {/* 牌墩区域 */}
        {renderPaiDun(head, '头道', 'head', '#e0ffe3')}
        {renderPaiDun(middle, '中道', 'middle', '#e0eaff')}
        {renderPaiDun(tail, '尾道', 'tail', '#ffe6e0')}
        {/* 按钮区 */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 10, marginTop: 10 }}>
          <button
            style={{
              flex: 1,
              background: isReady ? '#9e9e9e' : '#bbbbbb',
              color: '#fff',
              fontWeight: 700,
              border: 'none',
              borderRadius: 7,
              padding: '10px 0',
              fontSize: 18,
              cursor: isReady ? 'not-allowed' : 'pointer'
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
              borderRadius: 7,
              padding: '10px 0',
              fontSize: 18,
              cursor: isReady ? 'pointer' : 'not-allowed'
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
              borderRadius: 7,
              padding: '10px 0',
              fontSize: 18,
              cursor: isReady ? 'pointer' : 'not-allowed'
            }}
            onClick={handleStartCompare}
            disabled={!isReady}
          >开始比牌</button>
        </div>
        <div style={{ color: '#c3e1d1', textAlign: 'center', fontSize: 16, marginTop: 6, minHeight: 24 }}>
          {msg}
        </div>
      </div>
      {renderResultModal()}
    </div>
  );
}
