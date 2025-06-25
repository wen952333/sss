import React, { useEffect, useState } from "react";
import { apiRequest } from "../../api";
import { getCardImage } from "../../utils/cards";

export default function GameTable({ roomId, user, onLeave }) {
  const [room, setRoom] = useState(null);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    const fetchRoom = async () => {
      const res = await apiRequest("room_state", { room_id: roomId });
      if (res.success) setRoom(res.room);
    };
    fetchRoom();
    const interval = setInterval(fetchRoom, 1500);
    return () => clearInterval(interval);
  }, [roomId]);
  if (!room) return <div>加载中...</div>;
  return (
    <div className="p-4">
      <div className="mb-2 flex justify-between">
        <span className="font-bold">{room.name}</span>
        <button className="btn" onClick={onLeave}>
          退出房间
        </button>
      </div>
      <div>
        <h3 className="font-bold mb-2">玩家列表</h3>
        <ul>
          {room.players.map((id, idx) => (
            <li key={id}>玩家{id === user.id ? "（你）" : ""}</li>
          ))}
        </ul>
      </div>
      <div className="mt-4">
        <button
          className="btn"
          onClick={async () => {
            const res = await apiRequest("start_game", { room_id: roomId });
            setMsg(res.message || (res.success ? "已开始" : "失败"));
          }}
        >
          开始游戏
        </button>
        {msg && <div className="mt-2">{msg}</div>}
      </div>
      {/* 这里可以扩展牌面展示 */}
      {room.state && room.state.cards && (
        <div className="mt-4">
          <h4>你的手牌</h4>
          <div className="flex flex-wrap">
            {room.state.cards[user.id]?.map((card, idx) => (
              <img
                key={idx}
                src={getCardImage(card.value, card.suit)}
                alt={card.value + card.suit}
                className="w-12 h-16 mr-1 mb-1"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
