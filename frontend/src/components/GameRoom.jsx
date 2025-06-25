import React, { useEffect, useState } from "react";
import { apiRequest } from "../api";
import "./GameRoom.css";

const emptyPlayer = { nickname: "等待加入…", status: "empty" };

export default function GameRoom({ user, room, leaveRoom }) {
  const [players, setPlayers] = useState([emptyPlayer, emptyPlayer, emptyPlayer, emptyPlayer]);
  const [myHand, setMyHand] = useState([]); // 13张手牌
  const [arranged, setArranged] = useState({ head: [], mid: [], tail: [] });
  const [myReady, setMyReady] = useState(false);
  const [allReady, setAllReady] = useState(false);
  const [status, setStatus] = useState(0); // 0等待准备 1发牌理牌 2比牌 3结算
  const [isHost, setIsHost] = useState(false);
  const [error, setError] = useState("");

  // 刷新房间和玩家状态
  useEffect(() => {
    let timer;
    const fetchRoom = async () => {
      const res = await apiRequest("get_room", { room_id: room.id });
      if (res.success) {
        setStatus(res.game.status);
        setIsHost(res.game.players[0]?.phone === user.phone);
        // player组装（补空位）
        const ps = [...res.game.players];
        for (let i = ps.length; i < 4; ++i) ps.push(emptyPlayer);
        // 标记就绪
        setPlayers(ps.map(p => {
          if (p.phone === user.phone) setMyReady(!!p.cards && p.cards.length === 13);
          if (p.cards && p.cards.length === 13) return { ...p, status: "ready" };
          if (p.status === "empty") return p;
          return { ...p, status: "wait" };
        }));
        // 卡牌
        if (res.game.cards && res.game.cards.length === 13) setMyHand(res.game.cards);
        // 全部玩家准备
        setAllReady(
          ps.slice(0, 4).filter(p => p.status !== "empty").every(p => p.cards && p.cards.length === 13)
        );
        // 自动分牌: 4人都准备且发牌
        if (
          res.game.status === 1 &&
          ps.slice(0, 4).filter(p => p.status !== "empty").every(p => p.cards && p.cards.length === 13) &&
          myHand.length === 13
        ) {
          autoArrange();
        }
      }
    };
    fetchRoom();
    timer = setInterval(fetchRoom, 2000);
    return () => clearInterval(timer);
    // eslint-disable-next-line
  }, [room.id, myReady]);

  // 自动分牌
  const autoArrange = () => {
    if (myHand.length !== 13) return;
    setArranged({
      head: myHand.slice(0, 3),
      mid: myHand.slice(3, 8),
      tail: myHand.slice(8, 13)
    });
  };

  // 玩家点击准备
  const handleReady = async () => {
    if (!myHand.length) {
      setError("等待发牌…");
      return;
    }
    // 提交自动分牌结果
    autoArrange();
    const all = [...myHand.slice(0, 3), ...myHand.slice(3, 8), ...myHand.slice(8, 13)];
    const res = await apiRequest("submit_hand", { room_id: room.id, cards: all });
    if (!res.success) setError(res.message);
    setMyReady(true);
  };

  // 主人开始比牌
  const handleStartCompare = async () => {
    const res = await apiRequest("settle_game", { room_id: room.id });
    if (!res.success) setError(res.message);
  };

  // 退出房间
  const handleLeave = async () => {
    await apiRequest("leave_room", { room_id: room.id });
    leaveRoom();
  };

  return (
    <div className="room-root">
      {/* 顶部横幅 */}
      <div className="room-bar">
        <span className="room-bar-back" onClick={handleLeave}>〈 退出房间</span>
        <span className="room-bar-title">十三水牌桌（{room.name}）</span>
        <span className="room-bar-user">
          欢迎, {user.nickname} (积分: {user.score})
        </span>
      </div>

      <div className="room-main">
        {/* 玩家状态横幅 */}
        <div className="room-players">
          {players.map((p, idx) => (
            <div
              key={idx}
              className={
                "room-player" +
                (p.phone === user.phone ? " me" : "") +
                (p.status === "ready" ? " ready" : p.status === "empty" ? " empty" : "")
              }
            >
              <div>{p.nickname}</div>
              <div>
                {p.status === "ready"
                  ? "已准备"
                  : p.status === "empty"
                  ? "等待加入…"
                  : "未准备"}
              </div>
            </div>
          ))}
        </div>

        {/* 理牌区，自动分牌 */}
        <div className="room-cardarea">
          <div className="room-section">
            <div>头道</div>
            <div className="room-cardbox">{arranged.head.map(card => <CardView key={card} card={card} />)}</div>
          </div>
          <div className="room-section">
            <div>中道</div>
            <div className="room-cardbox">{arranged.mid.map(card => <CardView key={card} card={card} />)}</div>
          </div>
          <div className="room-section">
            <div>尾道</div>
            <div className="room-cardbox">{arranged.tail.map(card => <CardView key={card} card={card} />)}</div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="room-actions">
          <button
            className={`room-btn ready${myReady ? " on" : ""}`}
            onClick={handleReady}
            disabled={myReady || myHand.length !== 13}
          >
            准备
          </button>
          <button className="room-btn" onClick={autoArrange}>自动分牌</button>
          {isHost && (
            <button className="room-btn" onClick={handleStartCompare} disabled={!allReady}>
              开始比牌
            </button>
          )}
        </div>
        <div className="room-tip">点击“准备”以开始</div>
        {error && <div className="room-error">{error}</div>}
      </div>
    </div>
  );
}

function CardView({ card }) {
  return <span className="card-view">{card}</span>;
}
