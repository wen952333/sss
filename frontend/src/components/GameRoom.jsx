import React, { useEffect, useState } from "react";
import { apiRequest } from "../api";
import { getCardImage } from "../utils/cardMapper";

export default function GameRoom({ user, room, leaveRoom }) {
  const [game, setGame] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let timer;
    const fetchGame = async () => {
      const res = await apiRequest("get_room", { room_id: room.id });
      if (res.success) setGame(res.game);
      else setError(res.message);
    };
    fetchGame();
    timer = setInterval(fetchGame, 2000); // 轮询房间状态
    return () => clearInterval(timer);
  }, [room.id]);

  if (!game) return <div>加载中...</div>;

  // 牌面展示假设game.cards为本玩家手牌，例如['10C','AS','KD'...]
  return (
    <div className="game-room">
      <h3>房间：{room.name} <button onClick={leaveRoom}>退出</button></h3>
      <div className="player-list">
        {game.players.map(p => (
          <span key={p.phone}>{p.nickname} ({p.score}分)</span>
        ))}
      </div>
      <div className="cards">
        {game.cards && game.cards.map(card => (
          <img key={card} src={getCardImage(card)} alt={card} className="card-img" />
        ))}
      </div>
      {/* 其他出牌、比牌逻辑省略 */}
    </div>
  );
}
