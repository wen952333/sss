import React, { useState, useEffect } from "react";
import AuthPage from "./components/AuthPage";
import RoomList from "./components/RoomList";
import GameRoom from "./components/GameRoom";
import TopBar from "./components/TopBar";
import { apiRequest } from "./api";
import './App.css';

const USER_KEY = "sss_user";
const ROOM_KEY = "sss_room";

function App() {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY)) || null;
    } catch {
      return null;
    }
  });
  const [room, setRoom] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(ROOM_KEY)) || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  }, [user]);
  useEffect(() => {
    if (room) localStorage.setItem(ROOM_KEY, JSON.stringify(room));
    else localStorage.removeItem(ROOM_KEY);
  }, [room]);

  const handleLogout = () => {
    setUser(null);
    setRoom(null);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ROOM_KEY);
  };

  // 自动生成房间名
  const handleCreateRoom = async () => {
    const autoName = "房间" + Math.floor(1000 + Math.random() * 9000);
    const res = await apiRequest("create_room", { name: autoName });
    if (res.success) setRoom(res.room);
  };

  if (!user) return <AuthPage onLogin={setUser} />;
  if (room) return (
    <GameRoom user={user} room={room} leaveRoom={() => setRoom(null)} />
  );

  return (
    <div className="main-menu">
      <TopBar user={user} setUser={handleLogout} onCreateRoom={handleCreateRoom} />
      <RoomList user={user} joinRoom={setRoom} />
    </div>
  );
}

export default App;
