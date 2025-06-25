import React from "react";

export default function PlayerList({ players, userId }) {
  return (
    <div className="players-list">
      {players.map(p => (
        <span
          key={p.id}
          className={`player-item${p.ready ? " ready" : ""}${p.id === userId ? " self" : ""}`}
        >
          {p.nickname}{p.ready ? "✅" : ""}{p.id === userId ? "（我）" : ""}
        </span>
      ))}
    </div>
  );
}
