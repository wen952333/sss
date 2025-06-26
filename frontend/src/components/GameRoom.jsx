import React, { useEffect, useState } from "react";
import { apiRequest } from "../api";
import "./GameRoom.css";

const emptyPlayer = { nickname: "等待加入…", status: "empty" };

export default function GameRoom({ user, room, leaveRoom }) {
  const [players, setPlayers] = useState([emptyPlayer, emptyPlayer, emptyPlayer, emptyPlayer]);
  const [myHand, setMyHand] = useState([]); // 13张手牌
  // arranged区只显示，不做拖拽/手动分墩（如需拖拽请用ArrangePanel）
  const [myReady, setMyReady] = useState(false);
  const [allReady, setAllReady] = useState(false);
  const [status, setStatus] = useState(0); // 0等待准备 1理牌 2比牌/结算
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

        setPlayers(
          ps.map((p) => {
            if (p.phone === user.phone) setMyReady(!!p.ready);
            if (p.ready) return { ...p, status: "ready" };
            if (p.status === "empty") return p;
            return { ...p, status: "wait" };
          })
        );

        // 卡牌
        if (res.game.cards && res.game.cards.length === 13) setMyHand(res.game.cards);
        else setMyHand([]);

        // 全部玩家已理牌（有13张牌）
        setAllReady(
          ps.slice(0, 4)
            .filter((p) => p.status !== "empty")
            .every((p) => p.cards && p.cards.length === 13)
        );
      }
    };
    fetchRoom();
    timer = setInterval(fetchRoom, 2000);
    return () => clearInterval(timer);
    // eslint-disable-next-line
  }, [room.id]);

  // 玩家点击准备
  const handleReady = async () => {
    setError("");
    const res = await apiRequest("player_ready", { room_id: room.id, ready: 1 });
    if (!res.success) setError(res.message);
  };

  // 玩家点击取消准备
  const handleCancelReady = async () => {
    setError("");
    const res = await apiRequest("player_ready", { room_id: room.id, ready: 0 });
    if (!res.success) setError(res.message);
  };

  // 主人开始比牌（自动用当前cards作为理牌结果）
  const handleStartCompare = async () => {
    const res = await apiRequest("settle_game", { room_id: room.id });
    if (!res.success) setError(res.message);
  };

  // 退出房间
  const handleLeave = async () => {
    await apiRequest("leave_room", { room_id: room.id });
    leaveRoom();
  };

  // 按钮状态
  let canReady = false;
  let canCancelReady = false;
  if (status === 0) {
    canReady = !myReady;
    canCancelReady = myReady;
  }

  return (
    <div className="room-root">
      {/* 顶部横幅 */}
      <div className="room-bar">
        <span className="room-bar-back" onClick={handleLeave}>
          〈 退出房间
        </span>
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
                (p.status === "ready"
                  ? " ready"
                  : p.status === "empty"
                  ? " empty"
                  : "")
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

        {/* 理牌区 */}
        {myHand.length === 13 && (
          <div className="room-cardarea">
            <div className="room-section">
              <div>头道</div>
              <div className="room-cardbox">
                {myHand.slice(0, 3).map((card) => (
                  <CardView key={card} card={card} />
                ))}
              </div>
            </div>
            <div className="room-section">
              <div>中道</div>
              <div className="room-cardbox">
                {myHand.slice(3, 8).map((card) => (
                  <CardView key={card} card={card} />
                ))}
              </div>
            </div>
            <div className="room-section">
              <div>尾道</div>
              <div className="room-cardbox">
                {myHand.slice(8, 13).map((card) => (
                  <CardView key={card} card={card} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="room-actions">
          {status === 0 && canReady && (
            <button className="room-btn ready" onClick={handleReady}>
              准备
            </button>
          )}
          {status === 0 && canCancelReady && (
            <button className="room-btn" onClick={handleCancelReady}>
              取消准备
            </button>
          )}
          {myHand.length === 13 && isHost && (
            <button className="room-btn" onClick={handleStartCompare} disabled={!allReady}>
              开始比牌
            </button>
          )}
        </div>
        <div className="room-tip">
          {status === 0
            ? "点击“准备”后等待其他玩家，4人都准备自动发牌"
            : status === 1
            ? "请根据三墩分好牌（头道/中道/尾道），房主可直接开始比牌"
            : ""}
        </div>
        {error && <div className="room-error">{error}</div>}
      </div>
    </div>
  );
}

function CardView({ card }) {
  return <span className="card-view">{card}</span>;
}
