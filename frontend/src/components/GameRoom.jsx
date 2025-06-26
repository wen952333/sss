import React, { useEffect, useState } from "react";
import { apiRequest } from "../api";
import "./GameRoom.css";

const emptyPlayer = { nickname: "等待加入…", status: "empty", seat: null };

export default function GameRoom({ user, room, leaveRoom }) {
  const [players, setPlayers] = useState([emptyPlayer, emptyPlayer, emptyPlayer, emptyPlayer]);
  const [myHand, setMyHand] = useState([]); // 13张手牌
  const [status, setStatus] = useState(0); // 0等待开始 1理牌 2结算
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

        setPlayers(ps);

        // 卡牌
        if (res.game.cards && res.game.cards.length === 13) setMyHand(res.game.cards);
        else setMyHand([]);
      }
    };
    fetchRoom();
    timer = setInterval(fetchRoom, 2000);
    return () => clearInterval(timer);
    // eslint-disable-next-line
  }, [room.id]);

  // 发牌（房主）
  const handleStartGame = async () => {
    setError("");
    const res = await apiRequest("start_game", { room_id: room.id });
    if (!res.success) setError(res.message);
  };

  // 理牌时提交
  const handleSubmitHand = async () => {
    setError("");
    const all = myHand;
    const res = await apiRequest("submit_hand", { room_id: room.id, cards: all });
    if (!res.success) setError(res.message);
  };

  // 房主结算
  const handleSettle = async () => {
    setError("");
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
                (p.seat == null ? " empty" : "")
              }
            >
              <div>{p.nickname}</div>
              <div>
                {p.seat == null
                  ? "等待加入…"
                  : `座位${p.seat}`}
              </div>
            </div>
          ))}
        </div>

        {/* 理牌区（如果已发牌） */}
        {myHand.length === 13 && (
          <div className="room-cardarea">
            <div className="room-section">
              <div>你的牌：</div>
              <div className="room-cardbox">
                {myHand.map((card) => (
                  <CardView key={card} card={card} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="room-actions">
          {status === 0 && isHost && (
            <button className="room-btn ready" onClick={handleStartGame}>
              开始游戏（发牌）
            </button>
          )}
          {status === 1 && myHand.length === 13 && (
            <button className="room-btn ready" onClick={handleSubmitHand}>
              提交理牌
            </button>
          )}
          {status === 2 && isHost && (
            <button className="room-btn" onClick={handleSettle}>
              结算
            </button>
          )}
        </div>
        <div className="room-tip">
          {status === 0
            ? (isHost ? "点击“开始游戏”后发牌，所有人可理牌" : "等待房主开始游戏")
            : status === 1
            ? "理牌后点击“提交理牌”"
            : status === 2
            ? "等待房主结算"
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
