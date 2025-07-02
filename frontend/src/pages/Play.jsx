import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { aiSmartSplit, getPlayerSmartSplits } from './SmartSplit';
import CountdownKick from './CountdownKick';
import './Play.css';

// ========== 常量 ==========
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
  const [submitted, setSubmitted] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [roomStatus, setRoomStatus] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [resultModalData, setResultModalData] = useState(null);
  const [splitIndex, setSplitIndex] = useState(0);
  const [mySplits, setMySplits] = useState([]);
  const [allPlayed, setAllPlayed] = useState(false);
  const [prepCountdown, setPrepCountdown] = useState(null);
  const [dealCountdown, setDealCountdown] = useState(null);
  const [hasShownResult, setHasShownResult] = useState(false);
  const [readyResetTime, setReadyResetTime] = useState(null);

  // 比牌弹窗5秒后才可准备
  const [canReady, setCanReady] = useState(false);

  const navigate = useNavigate();
  // 退出按钮仅准备/比牌弹窗可用
  const canExit = roomStatus === 'waiting' || showResult;

  async function apiFetch(url, opts) {
    try {
      const res = await fetch(url, opts);
      const data = await res.json();
      if (!data.success) throw new Error(data.message || '操作失败');
      return data;
    } catch (e) {
      throw e;
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('token');
    const nickname = localStorage.getItem('nickname');
    if (!token) {
      navigate('/login');
      return;
    }
    setMyName(nickname);
    fetchMyPoints();
    // eslint-disable-next-line
  }, []);

  // 房间信息定时刷新
  useEffect(() => {
    fetchPlayers();
    const timer = setInterval(fetchPlayers, 2000);
    return () => clearInterval(timer);
  }, [roomId, showResult]);

  // 我的牌定时刷新
  useEffect(() => {
    fetchMyCards();
    const timer = setInterval(fetchMyCards, 1500);
    return () => clearInterval(timer);
  }, [roomId]);

  // 比牌弹窗出现时，5秒后才能准备
  useEffect(() => {
    if (showResult) {
      setCanReady(false);
      const timer = setTimeout(() => setCanReady(true), 5000);
      return () => clearTimeout(timer);
    } else {
      setCanReady(false);
    }
  }, [showResult]);

  // 只要所有玩家都已关闭弹窗（即后端变waiting），立即关闭弹窗并恢复准备
  useEffect(() => {
    if (roomStatus === 'waiting' && showResult) {
      setShowResult(false);
      setIsReady(true);
      setCanReady(false);
    }
  }, [roomStatus, showResult]);

  // 发牌后自动智能分牌（缓存多分法）
  useEffect(() => {
    if (myCards.length === 13 && !submitted) {
      const splits = getPlayerSmartSplits(myCards);
      setMySplits(splits);
      setSplitIndex(0);
      if (splits.length > 0) {
        setHead(splits[0].head);
        setMiddle(splits[0].middle);
        setTail(splits[0].tail);
        setSubmitMsg('已分好牌，可手动调整后提交');
      } else {
        setHead(myCards.slice(0, 3));
        setMiddle(myCards.slice(3, 8));
        setTail(myCards.slice(8, 13));
        setSubmitMsg('已分好牌，可手动调整后提交');
      }
      setHasShownResult(false);
    }
  }, [myCards, submitted]);

  useEffect(() => {
    if (!submitted) return;
    if (allPlayed && players.length === 4 && !hasShownResult) {
      fetchAllResults();
      setHasShownResult(true);
    }
  }, [submitted, allPlayed, players, hasShownResult]);

  // ========== 倒计时管理 ==========
  // 只有房间状态变化时设置倒计时，倒计时组件内部自减，不会跳回
  useEffect(() => {
    const token = localStorage.getItem('token');
    async function getRoomInfoForCountdown() {
      const res = await fetch(`https://9526.ip-ddns.com/api/room_info.php?roomId=${roomId}&token=${token}`);
      const data = await res.json();
      if (!data.success) return;
      setRoomStatus(data.status);
      setPlayers(data.players);
      setReadyResetTime(data.ready_reset_time ? new Date(data.ready_reset_time.replace(/-/g, '/')).getTime() : null);
      const me = data.players.find(p => p.name === localStorage.getItem('nickname'));
      if (data.status === 'waiting' && me && !me.submitted) {
        let remain = 45;
        if (data.ready_reset_time) {
          let now = Date.now();
          const readyResetTime = new Date(data.ready_reset_time.replace(/-/g, '/')).getTime();
          remain = 45 - Math.floor((now - readyResetTime) / 1000);
          if (remain < 0) remain = 0;
        }
        setPrepCountdown(remain);
        setDealCountdown(null);
      } else {
        setPrepCountdown(null);
      }
      if (data.status === 'started' && me && !me.submitted && myCards.length === 13) {
        setDealCountdown(120);
        setPrepCountdown(null);
      } else if (!(data.status === 'started' && me && !me.submitted)) {
        setDealCountdown(null);
      }
      if (showResult) {
        setIsReady(canReady);
      } else if (data.status === 'waiting' && me && !me.submitted) {
        setIsReady(true);
      } else {
        setIsReady(false);
      }
    }
    getRoomInfoForCountdown();
    // eslint-disable-next-line
  }, [roomId, showResult, myCards.length]);

  // ========== 业务数据拉取 ==========
  async function fetchPlayers() {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`https://9526.ip-ddns.com/api/room_info.php?roomId=${roomId}&token=${token}`);
      const data = await res.json();
      if (!data.success) {
        alert(data.message || '房间已被删除或不存在');
        navigate('/');
        return;
      }
      setPlayers(data.players);
      setRoomStatus(data.status);
      setReadyResetTime(data.ready_reset_time ? new Date(data.ready_reset_time.replace(/-/g, '/')).getTime() : null);
      const me = data.players.find(p => p.name === localStorage.getItem('nickname'));
      if (showResult) {
        setIsReady(canReady);
      } else if (data.status === 'waiting' && me && !me.submitted) {
        setIsReady(true);
      } else {
        setIsReady(false);
      }
    } catch (e) {
      alert('网络错误或房间已删除');
      navigate('/');
    }
  }

  async function fetchMyPoints() {
    const phone = localStorage.getItem('phone');
    if (!phone) return;
    const data = await apiFetch('https://9526.ip-ddns.com/api/find_user.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    setMyPoints(data.user.points || 0);
  }

  async function fetchMyCards() {
    const token = localStorage.getItem('token');
    const data = await apiFetch(`https://9526.ip-ddns.com/api/my_cards.php?roomId=${roomId}&token=${token}`);
    setSubmitted(!!data.submitted);
    setAllPlayed(!!data.allPlayed);
    if (Array.isArray(data.cards) && data.cards.length === 13) {
      setMyCards(data.cards);
    } else {
      setMyCards([]);
      setHead([]);
      setMiddle([]);
      setTail([]);
    }
  }

  async function fetchAllResults() {
    const token = localStorage.getItem('token');
    const data = await apiFetch(`https://9526.ip-ddns.com/api/room_results.php?roomId=${roomId}&token=${token}`);
    if (Array.isArray(data.players)) {
      const resultPlayers = data.players.map(p => {
        let head = Array.isArray(p.head) ? p.head.slice(0, 3) : [];
        let middle = Array.isArray(p.middle) ? p.middle.slice(0, 5) : [];
        let tail = Array.isArray(p.tail) ? p.tail.slice(0, 5) : [];
        let score = typeof p.score === "number" ? p.score :
          (p.result && typeof p.result.score === "number" ? p.result.score : 0);
        let isFoul = typeof p.isFoul === "boolean" ? p.isFoul :
          (p.result && typeof p.result.isFoul === "boolean" ? p.result.isFoul : false);
        return { name: p.name, head, middle, tail, score, isFoul };
      });
      setResultModalData(resultPlayers);
      setShowResult(true);
    }
  }

  async function handleExitRoom() {
    if (!canExit) return;
    const token = localStorage.getItem('token');
    await apiFetch('https://9526.ip-ddns.com/api/leave_room.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, token }),
    });
    navigate('/');
  }

  async function handleReady() {
    if (!isReady) return;
    const token = localStorage.getItem('token');
    await apiFetch('https://9526.ip-ddns.com/api/ready.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, token }),
    });
    setIsReady(false);
    setPrepCountdown(null);
  }

  function handleSmartSplit() {
    if (!mySplits.length) {
      setSubmitMsg('智能分牌计算中，请稍候…');
      return;
    }
    const nextIdx = (splitIndex + 1) % mySplits.length;
    setSplitIndex(nextIdx);
    const split = mySplits[nextIdx];
    setHead(split.head);
    setMiddle(split.middle);
    setTail(split.tail);
    setSubmitMsg(`已切换智能分牌方案 ${nextIdx + 1}/${mySplits.length}，可手动调整后提交`);
  }

  async function autoSmartSplitAndSubmit() {
    if (submitted) return;
    if (myCards.length === 13) {
      const split = aiSmartSplit(myCards);
      setHead(split.head);
      setMiddle(split.middle);
      setTail(split.tail);
      setSubmitMsg('已超时，已为你自动智能分牌并自动比牌');
      setTimeout(() => {
        handleStartCompare();
      }, 300);
    }
  }

  function handleCardClick(card, area, e) {
    if (submitted) return;
    if (e) e.stopPropagation();
    setSelected(sel => {
      if (sel.area !== area) return { area, cards: [card] };
      return sel.cards.includes(card)
        ? { area, cards: sel.cards.filter(c => c !== card) }
        : { area, cards: [...sel.cards, card] };
    });
  }

  function moveTo(dest) {
    if (submitted) return;
    if (!selected.cards.length) return;
    let inPaiDun = [...head, ...middle, ...tail];
    let rest = myCards.filter(c => !inPaiDun.includes(c));
    let newHead = [...head];
    let newMiddle = [...middle];
    let newTail = [...tail];
    const from = selected.area;
    if (from === 'hand') rest = rest.filter(c => !selected.cards.includes(c));
    if (from === 'head') newHead = newHead.filter(c => !selected.cards.includes(c));
    if (from === 'middle') newMiddle = newMiddle.filter(c => !selected.cards.includes(c));
    if (from === 'tail') newTail = newTail.filter(c => !selected.cards.includes(c));
    if (dest === 'head') newHead = [...newHead, ...selected.cards];
    if (dest === 'middle') newMiddle = [...newMiddle, ...selected.cards];
    if (dest === 'tail') newTail = [...newTail, ...selected.cards];
    setHead(newHead);
    setMiddle(newMiddle);
    setTail(newTail);
    setSelected({ area: dest, cards: [] });
    setSubmitMsg('');
  }

  async function handleStartCompare() {
    if (submitted) return;
    if (head.length !== 3 || middle.length !== 5 || tail.length !== 5) {
      setSubmitMsg('请按 3-5-5 张牌分配');
      return;
    }
    const cards = [...head, ...middle, ...tail];
    const token = localStorage.getItem('token');
    const data = await apiFetch('https://9526.ip-ddns.com/api/play.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, token, cards }),
    });
    if (data.success) {
      setSubmitted(true);
      setSubmitMsg('已提交，等待其他玩家...');
      setDealCountdown(null);
    } else {
      setSubmitMsg('提交失败，请重试');
    }
  }

  async function handleKickSelf() {
    alert('您45秒未准备，已被踢出房间');
    const token = localStorage.getItem('token');
    await fetch('https://9526.ip-ddns.com/api/leave_room.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, token }),
    });
    navigate('/');
  }

  // ========== UI渲染部分 ==========

  function renderCountdown() {
    return (
      <>
        {prepCountdown !== null && prepCountdown > 0 && (
          <CountdownKick
            enabled={prepCountdown > 0}
            remain={prepCountdown}
            onKick={handleKickSelf}
          />
        )}
        {dealCountdown !== null && dealCountdown > 0 && (
          <CountdownKick
            enabled={dealCountdown > 0}
            remain={dealCountdown}
            onKick={autoSmartSplitAndSubmit}
          />
        )}
      </>
    );
  }

  function renderPlayerSeat(name, idx, isMe, submitted) {
    let statusText = submitted ? '已准备' : '未准备';
    let statusColor = submitted ? '#23e67a' : '#fff';
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
          boxShadow: "0 4px 22px #23e67a44, 0 1.5px 5px #1a462a6a",
          boxSizing: 'border-box'
        }}
      >
        <div>{name}</div>
        <div style={{
          marginTop: 4,
          fontSize: 13,
          fontWeight: 600,
          color: isMe ? (submitted ? '#23e67a' : '#fff') : statusColor,
          letterSpacing: '1px'
        }}>
          {isMe ? '你' : statusText}
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
                  : "0 4px 22px #23e67a44, 0 1.5px 5px #1a462a6a",
                cursor: submitted ? 'not-allowed' : 'pointer',
                background: '#185a30',
                transition: 'border .13s, box-shadow .13s'
              }}
              onClick={e => { if (!submitted) handleCardClick(card, area, e); }}
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
          boxShadow: "0 4px 22px #23e67a44, 0 1.5px 5px #1a462a6a",
          display: 'flex',
          alignItems: 'center',
          boxSizing: 'border-box',
          paddingLeft: 16,
          paddingRight: 70,
        }}
        onClick={() => { if (!submitted) moveTo(area); }}
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
    const inPaiDun = new Set([...head, ...middle, ...tail]);
    const rest = myCards.filter(c => !inPaiDun.has(c));
    return <div className="cards-area">
      {rest.map(card =>
        <img
          key={card}
          src={`/cards/${card}.svg`}
          alt={card}
          className="card-img"
          style={{
            border: selected.area === 'hand' && selected.cards.includes(card) ? '2.5px solid #23e67a' : 'none',
            boxShadow: selected.area === 'hand' && selected.cards.includes(card) ? '0 0 12px #23e67a88' : ''
          }}
          onClick={e => handleCardClick(card, 'hand', e)}
        />
      )}
    </div>;
  }

  function renderResultModal() {
    if (!showResult) return null;
    const scale = 0.9;
    const cardW = CARD_WIDTH * scale;
    const cardH = CARD_HEIGHT * scale;
    const data = resultModalData || [];
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
          {data.map((p, idx) => (
            <div key={p.name} style={{ textAlign: 'center', borderBottom: '1px solid #eee' }}>
              <div style={{ fontWeight: 700, color: p.name === myName ? '#23e67a' : '#4f8cff', marginBottom: 8 }}>
                {p.name}
                {p.isFoul && (
                  <span style={{ color: 'red', fontWeight: 800, marginLeft: 6 }}>（倒水）</span>
                )}
                （{p.score || 0}分）
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 3 }}>
                {renderPaiDunCards(p.head || [], 'none', { width: cardW, height: cardH })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 3 }}>
                {renderPaiDunCards(p.middle || [], 'none', { width: cardW, height: cardH })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                {renderPaiDunCards(p.tail || [], 'none', { width: cardW, height: cardH })}
              </div>
            </div>
          ))}
          <button style={{
            position: 'absolute', right: 18, top: 12, background: 'transparent', border: 'none', fontSize: 22, color: '#888', cursor: 'pointer'
          }} onClick={async () => {
            setShowResult(false);
            await fetch('https://9526.ip-ddns.com/api/reset_after_result.php', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ roomId, token: localStorage.getItem('token') }),
            });
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
        boxShadow: "0 4px 22px #23e67a44, 0 1.5px 5px #1a462a6a",
        padding: 16,
        border: 'none',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 650,
        boxSizing: 'border-box'
      }}>
        {/* 头部：退出房间+积分+倒计时UI */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14, position: 'relative', minHeight: 42 }}>
          <button
            disabled={!canExit}
            style={{
              background: canExit
                ? 'linear-gradient(90deg,#fff 60%,#e0fff1 100%)'
                : '#b0b0b0',
              color: canExit ? '#234' : '#888',
              fontWeight: 'bold',
              border: 'none',
              borderRadius: 9,
              padding: '7px 22px',
              cursor: canExit ? 'pointer' : 'not-allowed',
              marginRight: 18,
              fontSize: 17,
              boxShadow: canExit ? '0 1.5px 6px #23e67a30' : 'none',
              opacity: canExit ? 1 : 0.55,
              transition: 'background .18s, color .18s, opacity .18s'
            }}
            onClick={canExit ? handleExitRoom : undefined}
          >
            &lt; 退出房间
          </button>
          {/* 倒计时UI：绝对居中 */}
          <div style={{ flex: 1, position: 'relative' }}>
            {renderCountdown()}
          </div>
          <div style={{
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
            renderPlayerSeat(p.name, idx, p.name === myName, p.submitted)
          )}
        </div>
        {/* 牌墩区域 */}
        {renderPaiDun(head, '头道', 'head', '#23e67a')}
        {renderPaiDun(middle, '中道', 'middle', '#23e67a')}
        {renderPaiDun(tail, '尾道', 'tail', '#23e67a')}
        {/* 按钮区 */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 0, marginTop: 0 }}>
          <button
            style={{
              flex: 1,
              background: isReady ? '#23e67a' : '#b0b0b0',
              color: '#fff',
              fontWeight: 700,
              border: 'none',
              borderRadius: 10,
              padding: '13px 0',
              fontSize: 18,
              cursor: isReady ? 'pointer' : 'not-allowed',
              boxShadow: isReady ? '0 2px 9px #23e67a22' : 'none',
              transition: 'background 0.16s'
            }}
            onClick={handleReady}
            disabled={!isReady}
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
              cursor: submitted ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 9px #23e67a44',
              transition: 'background 0.16s'
            }}
            onClick={handleSmartSplit}
            disabled={submitted}
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
              cursor: submitted ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 9px #ffb14d55',
              transition: 'background 0.16s'
            }}
            disabled={submitted}
            onClick={handleStartCompare}
          >开始比牌</button>
        </div>
        {/* 手牌区 */}
        <div style={{ margin: '12px 0 8px 0' }}>
          {renderMyCards()}
        </div>
        <div style={{ color: '#c3e1d1', textAlign: 'center', fontSize: 16, marginTop: 8, minHeight: 24 }}>
          {submitMsg}
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
        .card-img {
          border: none !important;
        }
      `}</style>
    </div>
  );
}
