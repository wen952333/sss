import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Play.css';

const allSuits = ['clubs', 'spades', 'diamonds', 'hearts'];
const allRanks = ['2','3','4','5','6','7','8','9','10','jack','queen','king','ace'];
const AI_NAMES = ['小明', '小红', '小刚'];

// 本地洗牌
function getShuffledDeck() {
  const deck = [];
  for (const suit of allSuits) for (const rank of allRanks) deck.push(`${rank}_of_${suit}`);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// 简单AI分牌
function aiSplit(cards) {
  return {
    head: cards.slice(0, 3),
    middle: cards.slice(3, 8),
    tail: cards.slice(8, 13)
  }
}

// 比牌逻辑（简单：每墩随机分1~3分）
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
  const [selected, setSelected] = useState({ area: '', cards: [] }); // 只支持三墩内操作
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

  // 只要玩家点准备，就洗牌&发牌&分牌到三墩，AI自动准备
  function handleReady() {
    // 洗牌并分四手
    const deck = getShuffledDeck();
    const myHand = deck.slice(0, 13);
    const aiHands = [
      deck.slice(13, 26),
      deck.slice(26, 39),
      deck.slice(39, 52)
    ];
    // 玩家手牌智能分配到三墩
    const mySplit = aiSplit(myHand);
    setHead(mySplit.head);
    setMiddle(mySplit.middle);
    setTail(mySplit.tail);
    // AI自动智能分配
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

  // 智能分牌：重新分配三墩（只影响自己）
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

  // 牌点击高亮
  function handleCardClick(card, area) {
    setSelected(sel => {
      if (sel.area !== area) return { area, cards: [card] };
      return sel.cards.includes(card)
        ? { area, cards: sel.cards.filter(c => c !== card) }
        : { area, cards: [...sel.cards, card] };
    });
  }

  // 墩之间移动牌（允许多选，直接移过去）
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

  // 开始比牌
  function handleStartCompare() {
    if (head.length !== 3 || middle.length !== 5 || tail.length !== 5) {
      setMsg('请按 3-5-5 张分配');
      return;
    }
    // AI已自动分好牌
    const allPlayers = [
      { head, middle, tail },
      ...aiPlayers
    ];
    const resScores = calcScores(allPlayers);
    setScores(resScores);
    setShowResult(true);
    setMsg('');
  }

  // UI渲染
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

  function renderCards(arr, area) {
    return arr.map(card =>
      <img
        key={card}
        src={`/cards/${card}.svg`}
        alt={card}
        className="card-img"
        style={{
          border: selected.area === area && selected.cards.includes(card) ? '2.5px solid #23e67a' : '2.5px solid transparent',
          boxShadow: selected.area === area && selected.cards.includes(card) ? '0 0 12px #23e67a88' : ''
        }}
        onClick={() => handleCardClick(card, area)}
      />
    );
  }

  // 比牌弹窗
  function renderResultModal() {
    if (!showResult) return null;
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
          minHeight: 300,
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
                {i === 0 ? '你' : aiPlayers[i - 1].name}（{scores[i]}分）
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 3 }}>
                {i === 0 ? renderCards(head, 'none') : renderCards(aiPlayers[i - 1].head, 'none')}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 3 }}>
                {i === 0 ? renderCards(middle, 'none') : renderCards(aiPlayers[i - 1].middle, 'none')}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                {i === 0 ? renderCards(tail, 'none') : renderCards(aiPlayers[i - 1].tail, 'none')}
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

  // 三墩渲染
  function renderPaiDun(arr, label, color, area) {
    return (
      <div
        style={{
          background: '#1e663d',
          borderRadius: 10,
          padding: 14,
          marginBottom: 12,
          cursor: isReady ? 'pointer' : 'not-allowed',
          border: '2px dashed #23e67a'
        }}
        onClick={() => { if (isReady) moveTo(area); }}
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
            renderCards(arr, area)
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

        {/* 三墩 */}
        {renderPaiDun(head, '头道', '#e0ffe3', 'head')}
        {renderPaiDun(middle, '中道', '#e0eaff', 'middle')}
        {renderPaiDun(tail, '尾道', '#ffe6e0', 'tail')}

        {/* 按钮区 */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 10, marginTop: 10 }}>
          <button
            style={{
              flex: 1,
              background: isReady ? '#9e9e9e' : '#23e67a',
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
