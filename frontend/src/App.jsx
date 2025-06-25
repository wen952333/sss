import React, { useState } from "react";
import AuthPage from "./components/AuthPage";
import RoomList from "./components/RoomList";
import GameRoom from "./components/GameRoom";
import UserProfile from "./components/UserProfile";
import GiftPoints from "./components/GiftPoints";
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [room, setRoom] = useState(null);

  if (!user) return <AuthPage onLogin={setUser} />;

  if (room) return (
    <GameRoom user={user} room={room} leaveRoom={() => setRoom(null)} />
  );

  return (
    <div className="main-menu">
      <UserProfile user={user} setUser={setUser} />
      <RoomList user={user} joinRoom={setRoom} />
      <GiftPoints user={user} />
    </div>
  );
}

export default App;
