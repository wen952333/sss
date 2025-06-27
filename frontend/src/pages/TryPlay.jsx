import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Play.css';

const allSuits = ['clubs', 'spades', 'diamonds', 'hearts'];
const allRanks = ['2','3','4','5','6','7','8','9','10','jack','queen','king','ace'];

function getShuffledDeck() {
  const deck = [];
  for (const suit of allSuits) {
    for (const rank of allRanks) {
      deck.push(`${rank}_of_${suit}`);
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// 模拟一个简单的比牌逻辑，实际可根据需求拓展
function mockCompare(head, middle, tail) {
  // 随机分数模拟
  return {
    headScore: Math.floor(Math.random() * 10),
    middleScore: Math.floor(Math.random() * 10),
    tailScore: Math.floor(Math.random() * 10),
    total: 0
  };
}

export default function TryPlay() {
  const navigate = useNavigate();
  // 13张手牌区
  const [myCards, setMyCards] = useState([]);
  // 三墩
  const [head, setHead] = useState([]);
  const [middle, setMiddle] = useState([]);
  const [tail, setTail] = useState([]);
  // 高亮选择
  const [selected, setSelected] = useState({ area: 'hand', cards: [] });
  // 状态
  const [msg, setMsg] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState(null);
  const [simuPoints, setSimuPoints] = useState(100); // 模拟积分

  // 发牌：13张随机
  function handleDeal() {
    const deck = getShuffledDeck();
    setMyCards(deck.slice(0, 13));
    setHead([]); setMiddle([]); setTail([]);
    setSelected({ area: 'hand', cards: [] });
    setMsg('');
    setShowResult(false);
  }

  // 自动分牌
  function handleAutoSplit() {
    const all = [...myCards, ...head, ...middle, ...tail];
    setHead(all.slice(0, 3));
    setMiddle(all.slice(3, 8));
    setTail(all.slice(8, 13));
    setMyCards([]);
    setSelected({ area: 'hand', cards: [] });
    setMsg('');
  }

  // 牌点击：高亮/取消高亮（手牌区或三墩都可）
  function handleCardClick(card, area) {
    setSelected(sel => {
      if (sel.area !== area) return { area, cards: [card] };
      return sel.cards.includes(card)
        ? { area, cards: sel.cards.filter(c => c !== card) }
        : { area, cards: [...sel.cards, card] };
    });
  }

  // 移动牌到指定区域
  function moveTo(dest) {
    if (!selected.cards.length) return;
    let newHand = [...myCards], newHead = [...head], newMiddle = [...middle], newTail = [...tail];
    const from = selected.area;
    if (from === 'hand') newHand = newHand.filter(c => !selected.cards.includes(c));
    if (from === 'head') newHead = newHead.filter(c => !selected.cards.includes(c));
    if (from === 'middle') newMiddle = newMiddle.filter(c => !selected.cards.includes(c));
    if (from === 'tail') newTail = newTail.filter(c => !selected.cards.includes(c));
    if (dest === 'hand') newHand = [...newHand, ...selected.cards];
    if (dest === 'head') newHead = [...newHead, ...selected.cards];
    if (dest === 'middle') newMiddle = [...newMiddle, ...selected.cards];
    if (dest === 'tail') newTail = [...newTail, ...selected.cards];
    setMyCards(newHand); setHead(newHead); setMiddle(newMiddle); setTail(newTail);
    setSelected({ area: dest, cards: [] });
    setMsg('');
  }

  // 开始比牌
  function handleStartCompare() {
    if (head.length !== 3 || middle.length !== 5 || tail.length !== 5) {
      setMsg('请按 3-5-5 张分配');
      return;
    }
    // 模拟比牌
    const r = mockCompare(head, middle, tail);
    r.total = r.headScore + r.middleScore + r.tailScore;
    setResult(r);
    setSimuPoints(points => points + r.total);
    setShowResult(true);
    setMsg('');
  }

  // 牌区渲染
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

  // 结果弹窗
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
          minWidth: 320,
          minHeight: 240,
          boxShadow: '0 8px 40px #0002',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          gap: 16,
          position: 'relative'
        }}>
          <div style={{ gridColumn: '1/2', gridRow: '1/2', textAlign: 'center' }}>
            <div style={{ fontWeight: 700, color: '#23e67a', marginBottom: 8 }}>头道（+{result.headScore}）</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
              {head.map(card => (
                <img key={card} src={`/cards/${card}.svg`} alt={card} className="card-img" style={{ width: 36, height: 52 }} />
              ))}
            </div>
          </div>
          <div style={{ gridColumn: '2/3', gridRow: '1/2', textAlign: 'center' }}>
            <div style={{ fontWeight: 700, color: '#4f8cff', marginBottom: 8 }}>中道（+{result.middleScore}）</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
              {middle.map(card => (
                <img key={card} src={`/cards/${card}.svg`} alt={card} className="card-img" style={{ width: 36, height: 52 }} />
              ))}
            </div>
          </div>
          <div style={{ gridColumn: '1/2', gridRow: '2/3', textAlign: 'center' }}>
            <div style={{ fontWeight: 700, color: '#ff974f', marginBottom: 8 }}>尾道（+{result.tailScore}）</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
              {tail.map(card => (
                <img key={card} src={`/cards/${card}.svg`} alt={card} className="card-img" style={{ width: 36, height: 52 }} />
              ))}
            </div>
          </div>
          <div style={{ gridColumn: '2/3', gridRow: '2/3', textAlign: 'center' }}>
            <div style={{ fontWeight: 700, color: '#ca1a4b', marginBottom: 8 }}>总分</div>
            <div style={{ fontSize: 27, color: '#ca1a4b', marginTop: 14 }}>{result.total}</div>
          </div>
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
        maxWidth: 420,
        margin: '30px auto',
        background: '#144126',
        borderRadius: 12,
        boxShadow: '0 4px 32px #0f2717bb',
        padding: 22,
        minHeight: 650,
        position: 'relative'
      }}>
        {/* 退出 */}
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
        {/* 模拟积分 */}
        <div style={{
          textAlign: 'center',
          color: '#fff',
          fontWeight: 900,
          fontSize: 21,
          letterSpacing: 2,
          marginBottom: 14
        }}>
          模拟积分：{simuPoints}
        </div>
        {/* 发牌按钮 */}
        <button
          style={{
            width: '100%',
            background: '#4f8cff',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            padding: '13px 0',
            fontWeight: 700,
            fontSize: 20,
            letterSpacing: 2,
            boxShadow: '0 2px 14px #a8b8e7aa',
            cursor: 'pointer',
            marginBottom: 12
          }}
          onClick={handleDeal}
        >发牌</button>
        {/* 手牌 */}
        <div style={{ margin: '15px 0 10px 0' }}>
          <div style={{ color: '#fff', fontWeight: 700, marginBottom: 6 }}>
            你的手牌（点击选中，点击下方牌墩移动）
          </div>
          <div className="cards-area">{renderCards(myCards, 'hand')}</div>
        </div>
        {/* 分牌区 */}
        <div
          style={{ background: '#1e663d', borderRadius: 10, padding: 14, marginBottom: 12, cursor: 'pointer', border: '2px dashed #23e67a' }}
          onClick={() => moveTo('head')}
        >
          <div style={{ marginBottom: 8, color: '#e0ffe3', fontSize: 16 }}>头道（{head.length}）</div>
          <div style={{
            background: '#164b2e', borderRadius: 7, minHeight: 36, marginBottom: 6, color: '#fff', display: 'flex', gap: 8
          }}>
            {head.length === 0 ? <span style={{ color: '#aaa' }}>请放置</span> : renderCards(head, 'head')}
          </div>
        </div>
        <div
          style={{ background: '#1e663d', borderRadius: 10, padding: 14, marginBottom: 12, cursor: 'pointer', border: '2px dashed #23e67a' }}
          onClick={() => moveTo('middle')}
        >
          <div style={{ marginBottom: 8, color: '#e0eaff', fontSize: 16 }}>中道（{middle.length}）</div>
          <div style={{
            background: '#164b2e', borderRadius: 7, minHeight: 36, marginBottom: 6, color: '#fff', display: 'flex', gap: 8
          }}>
            {middle.length === 0 ? <span style={{ color: '#aaa' }}>请放置</span> : renderCards(middle, 'middle')}
          </div>
        </div>
        <div
          style={{ background: '#1e663d', borderRadius: 10, padding: 14, marginBottom: 12, cursor: 'pointer', border: '2px dashed #23e67a' }}
          onClick={() => moveTo('tail')}
        >
          <div style={{ marginBottom: 8, color: '#ffe6e0', fontSize: 16 }}>尾道（{tail.length}）</div>
          <div style={{
            background: '#164b2e', borderRadius: 7, minHeight: 36, marginBottom: 6, color: '#fff', display: 'flex', gap: 8
          }}>
            {tail.length === 0 ? <span style={{ color: '#aaa' }}>请放置</span> : renderCards(tail, 'tail')}
          </div>
        </div>
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
              cursor: 'pointer'
            }}
            onClick={handleAutoSplit}
          >自动分牌</button>
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
              cursor: 'pointer'
            }}
            onClick={handleStartCompare}
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
