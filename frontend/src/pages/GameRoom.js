import React, { useEffect, useState } from "react";
import { apiGet, apiPost } from "../api";
import Card from "../components/Card";

export default function GameRoom({ user, roomId, onLeave }) {
  const [room, setRoom] = useState(null);
  const [msg, setMsg] = useState("");
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    const interval = setInterval(() => loadRoom(), 1500);
    loadRoom();
    return () => clearInterval(interval);
    // eslint-disable-next-line
  }, []);

  async function loadRoom() {
    const res = await apiGet("room.php", { action: "get", id: roomId, token: user.token });
    if (res.ok) setRoom(res.room);
    else setMsg(res.error || "加载失败");
  }

  function handleCardClick(idx) {
    setSelected(sel => {
      if (sel.includes(idx)) return sel.filter(i => i !== idx);
      else return [...sel, idx];
    });
  }

  async function handleReady() {
    const res = await apiPost("room.php", { action: "ready", id: roomId, token: user.token });
    if (!res.ok) setMsg(res.error || "准备失败");
  }

  async function handleSubmitCards() {
    // 这里应实现出牌逻辑（提交牌型给后端），略
    setMsg("出牌功能开发中");
  }

  return (
    <div className="game-room-container">
      <div className="game-room-header">
        <h2>房间：{room?.name}</h2>
        <button className="leave-btn" onClick={onLeave}>离开房间</button>
      </div>
      <div className="players-list">
        玩家：
        {room && room.players.map(p => (
          <span
            key={p.id}
            className={`player-item${p.ready ? " ready" : ""}${p.id === user.id ? " self" : ""}`}
          >
            {p.nickname}{p.ready ? "✅" : ""}{p.id === user.id ? "（我）" : ""}
          </span>
        ))}
      </div>
      {room && !room.started && (
        <div className="wait-ready">
          <button className="main-btn" onClick={handleReady}>准备</button>
          <div className="tip-text">请等待其他玩家准备</div>
        </div>
      )}
      {room && room.started && (
        <div className="cards-section">
          <div className="cards-row">
            {room.myCards && room.myCards.map((c, idx) => (
              <Card
                key={idx}
                value={c.value}
                suit={c.suit}
                selected={selected.includes(idx)}
                onClick={() => handleCardClick(idx)}
              />
            ))}
          </div>
          <button className="main-btn" style={{marginTop:18}} onClick={handleSubmitCards}>提交牌型</button>
        </div>
      )}
      <div className="msg-text">{msg}</div>
    </div>
  );
}
