import React from "react";
import GameRoom from "../modules/game/GameRoom";

export default function Game({ user, roomId, onLeave }) {
  return (
    <GameRoom user={user} roomId={roomId} onLeave={onLeave} />
  );
}
