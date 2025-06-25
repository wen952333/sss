import React, { useState } from "react";
import Login from "./pages/Login";
import RoomList from "./pages/RoomList";
import GameRoom from "./pages/GameRoom";
import Score from "./pages/Score";

function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("room");
  const [roomId, setRoomId] = useState(null);

  if (!user) return <Login onLogin={setUser} />;
  if (roomId) return <GameRoom user={user} roomId={roomId} onLeave={() => setRoomId(null)} />;

  return (
    <div className="app-container">
      <nav>
        <button onClick={() => setPage("room")}>房间</button>
        <button onClick={() => setPage("score")}>积分</button>
        <button onClick={() => setUser(null)}>退出</button>
      </nav>
      {page === "room" && <RoomList user={user} onEnterRoom={setRoomId} />}
      {page === "score" && <Score user={user} />}
    </div>
  );
}

export default App;
