import React, { useEffect, useState } from "react";
import { apiRequest } from "../api";
import { getCardImage } from "../utils/cardMapper";
import "./GameRoom.css"; // 建议新建专用样式文件，见下方

export default function GameRoom({ user, room, leaveRoom }) {
  const [game, setGame] = useState(null);
  const [error, setError] = useState("");
  const [myCards, setMyCards] = useState([]);
  const [submitted, setSubmitted] = useState(false);

  // 轮询获取房间状态
  useEffect(() => {
    let timer;
    const fetchGame = async () => {
      const res = await apiRequest("get_room", { room_id: room.id });
      if (res.success) {
        setGame(res.game);
        setMyCards(res.game.cards || []);
        setSubmitted(!!res.game.cards && res.game.cards.length === 13);
      } else setError(res.message);
    };
    fetchGame();
    timer = setInterval(fetchGame, 2000);
    return () => clearInterval(timer);
  }, [room.id]);

  // 是否房主
  const isHost = game && game.players && game.players[0].phone === user.phone;

  // 发牌
  const handleStart = async () => {
    const res = await apiRequest("start_game", { room_id: room.id });
    if (!res.success) setError(res.message);
  };

  // 出牌（这里只是模拟直接提交手牌顺序，后续可支持拖拽排序等）
  const handleSubmit = async () => {
    if (!myCards || myCards.length !== 13) return setError("没有13张牌");
    const res = await apiRequest("submit_hand", { room_id: room.id, cards: myCards });
    if (!res.success) setError(res.message);
    else setSubmitted(true);
  };

  // 结算
  const handleSettle = async () => {
    const res = await apiRequest("settle_game", { room_id: room.id });
    if (!res.success) setError(res.message);
  };

  if (!game) return <div>加载中...</div>;

  return (
    <div className="game-room-table">
      <div className="gr-header">
        <span>房间：{room.name}</span>
        <button className="gr-leave-btn" onClick={leaveRoom}>退出</button>
      </div>

      {/* 牌桌布局 */}
      <div className="gr-table">
        {game.players.map((p, idx) => {
          const isMe = p.phone === user.phone;
          const isZhuang = idx === 0;
          return (
            <div
              key={p.phone}
              className={`gr-seat gr-seat-${idx + 1} ${isMe ? "gr-me" : ""}`}
            >
              <div className="gr-avatar">
                <span role="img" aria-label="avatar">🧑</span>
                {isZhuang && <span className="gr-zhuang">庄</span>}
              </div>
              <div className="gr-nickname">{p.nickname}</div>
              <div className="gr-sub">{p.phone.slice(-4)} | {p.score}分</div>
              <div className="gr-status">
                {game.status === 1
                  ? p.cards
                    ? <span className="gr-ready">已出牌</span>
                    : <span className="gr-wait">等待</span>
                  : (game.status === 2 && typeof p.round_score === "number")
                  ? <span className="gr-score">本局{p.round_score}分</span>
                  : null}
              </div>
              {/* 只展示自己的手牌 */}
              {isMe && myCards.length > 0 && (
                <div className="gr-cards">
                  {myCards.map(card => (
                    <img key={card} src={getCardImage(card)} alt={card} className="gr-card" />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 操作区 */}
      <div className="gr-actions">
        {game.status === 0 && isHost && (
          <button className="gr-btn" onClick={handleStart}>发牌开始游戏</button>
        )}
        {game.status === 1 && myCards.length === 13 && !submitted && (
          <button className="gr-btn" onClick={handleSubmit}>提交我的出牌</button>
        )}
        {game.status === 1 && isHost && (
          <button className="gr-btn" onClick={handleSettle}>结算本局</button>
        )}
        {game.status === 2 && (
          <div className="gr-info">本局已结束，积分已结算</div>
        )}
        {error && <div className="gr-error">{error}</div>}
      </div>
    </div>
  );
}
