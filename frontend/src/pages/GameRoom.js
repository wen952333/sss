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
    // 实现出牌逻辑
  }

  // 房间未开始，点准备，已开始显示手牌，选择出牌
  return (
    <div>
      <h2>房间：{room?.name}</h2>
      <button onClick={onLeave}>离开房间</button>
      <div>
        {room && room.players.map(p => (
          <span key={p.id} style={{ marginRight: 8 }}>
            {p.nickname} {p.ready ? "✅" : ""}
          </span>
        ))}
      </div>
      {room && !room.started && (
        <button onClick={handleReady}>准备</button>
      )}
      {room && room.started && (
        <div>
          <div>
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
          <button onClick={handleSubmitCards}>提交牌型</button>
        </div>
      )}
      <div style={{ color: "red" }}>{msg}</div>
    </div>
  );
}
