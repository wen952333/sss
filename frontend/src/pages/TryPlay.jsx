import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { aiSmartSplit, fillAiPlayers } from './SmartSplit';
import { calcSSSAllScores } from './sssScore';
import { getShuffledDeck, dealHands } from './DealCards';
import './Play.css';

// 加载倒水判定方法
import { isFoul } from './sssScore';

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
    { name: AI_NAMES[0], isAI: true, cards13: [], head: [], middle: [], tail: [] },
    { name: AI_NAMES[1], isAI: true, cards13: [], head: [], middle: [], tail: [] },
    { name: AI_NAMES[2], isAI: true, cards13: [], head: [], middle: [], tail: [] },
  ]);
  const [showResult, setShowResult] = useState(false);
  const [scores, setScores] = useState([0,0,0,0]);
  const [isReady, setIsReady] = useState(false);
  const [hasCompared, setHasCompared] = useState(false);
  const [foulStates, setFoulStates] = useState([false, false, false, false]); // <--- 新增

  // 绿色暗影主色
  const greenShadow = "0 4px 22px #23e67a44, 0 1.5px 5px #1a462a6a";

  function handleReady() {
    if (!isReady) {
      // 发牌并进入准备状态
      const deck = getShuffledDeck();
      const [myHand, ...aiHands] = dealHands(deck);
      const mySplit = aiSmartSplit(myHand);
      setHead(mySplit.head);
      setMiddle(mySplit.middle);
      setTail(mySplit.tail);
      setAiPlayers(fillAiPlayers([
        { name: AI_NAMES[0], isAI: true, cards13: aiHands[0] },
        { name: AI_NAMES[1], isAI: true, cards13: aiHands[1] },
        { name: AI_NAMES[2], isAI: true, cards13: aiHands[2] },
      ]));
      setIsReady(true);
      setHasCompared(false);
      setMsg('');
      setShowResult(false);
      setScores([0,0,0,0]);
      setSelected({ area: '', cards: [] });
      setFoulStates([false, false, false, false]);
    } else {
      // 取消准备，清空手牌和AI
      setHead([]); setMiddle([]); setTail([]);
      setAiPlayers([
        { name: AI_NAMES[0], isAI: true, cards13: [], head: [], middle: [], tail: [] },
        { name: AI_NAMES[1], isAI: true, cards13: [], head: [], middle: [], tail: [] },
        { name: AI_NAMES[2], isAI: true, cards13: [], head: [], middle: [], tail: [] },
      ]);
      setIsReady(false);
      setHasCompared(false);
      setMsg('');
      setShowResult(false);
      setScores([0,0,0,0]);
      setSelected({ area: '', cards: [] });
      setFoulStates([false, false, false, false]);
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

  function handleStartCompare() {
    if (head.length !== 3 || middle.length !== 5 || tail.length !== 5) {
      setMsg('请按 3-5-5 张分配');
      return;
    }
    const allPlayers = [
      { name: '你', head, middle, tail },
      ...aiPlayers.map(ai => ({ name: ai.name, head: ai.head, middle: ai.middle, tail: ai.tail }))
    ];
    // 比牌+倒水判定
    const resScores = calcSSSAllScores(allPlayers);
    // 计算倒水状态
    const fouls = allPlayers.map(p => isFoul(p.head, p.middle, p.tail));
    setScores(resScores);
    setFoulStates(fouls);
    setShowResult(true);
    setHasCompared(true);
    setMsg('');
    setIsReady(false);
  }

  // 新增：智能分牌按钮功能
  function handleSmartSplit() {
    if (!isReady) return;
    // 合并三墩
    const all = [...head, ...middle, ...tail];
    if (all.length !== 13) {
      setMsg('请先准备并确保已发牌');
      return;
    }
    // 重新智能分牌
    const split = aiSmartSplit(all);
    setHead(split.head);
    setMiddle(split.middle);
    setTail(split.tail);
    setMsg('已智能分牌');
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
          background: '#185a30',
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
                {i === 0 ? '你' : aiPlayers[i - 1].name}
                {foulStates[i] && (
                  <span style={{ color: 'red', fontWeight: 800, marginLeft: 6 }}>（倒水）</span>
                )}
                （{scores[i]}分）
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
            onClick={handleSmartSplit}
            disabled={!isReady}
          >智能分牌</button>
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

// 导出isFoul供外部引用（如有TreeShaking可忽略）
export { isFoul } from './sssScore';
