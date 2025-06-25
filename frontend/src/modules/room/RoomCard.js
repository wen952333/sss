import React from "react";
import PlayerList from "../../components/PlayerList";

export default function RoomCard({ room, onJoin, userId }) {
  return (
    <div className="room-card">
      <div className="room-title">{room.name}</div>
      <div className="room-players">人数：{room.players.length}/4</div>
      <PlayerList players={room.players} userId={userId} />
      <button onClick={() => onJoin(room.id)}>加入房间</button>
    </div>
  );
}
