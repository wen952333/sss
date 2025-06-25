import React, { useEffect, useState } from "react";
import { apiRequest } from "../api";
import { getCardImage } from "../utils/cardMapper";

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
      }
      else setError(res.message);
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
    <div className="game-room">
      <h3>房间：{room.name} <button onClick={leaveRoom}>退出</button></h3>
      <div className="player-list">
        {game.players.map((p, idx) => (
          <div key={p.phone} style={{margin: 2, fontWeight: p.phone===user.phone?'bold':'normal'}}>
            {p.nickname}（{p.phone.slice(-4)}） {p.round_score ? `[本轮${p.round_score}分]` : ""}
            {idx === 0 ? " [房主]" : ""}
          </div>
        ))}
      </div>
      <div>
        {game.status === 0 && isHost && (
          <button onClick={handleStart}>发牌开始游戏</button>
        )}
        {game.status === 1 && myCards.length === 13 && !submitted && (
          <button onClick={handleSubmit}>提交我的出牌</button>
        )}
        {game.status === 1 && isHost && (
          <button onClick={handleSettle}>结算本局</button>
        )}
        {game.status === 2 && (
          <div style={{color:"green"}}>本局已结束，积分已结算</div>
        )}
      </div>
      <div className="cards">
        {myCards.map(card => (
          <img key={card} src={getCardImage(card)} alt={card} className="card-img" />
        ))}
      </div>
      {error && <div className="error">{error}</div>}
    </div>
  );
}
