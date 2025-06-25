import React, { useState, useEffect } from "react";
import AuthPage from "./components/AuthPage";
import RoomList from "./components/RoomList";
import GameRoom from "./components/GameRoom";
import UserProfile from "./components/UserProfile";
import GiftPoints from "./components/GiftPoints";
import './App.css';

// 封装本地存取
const USER_KEY = "sss_user";
const ROOM_KEY = "sss_room";

function App() {
  // 初始从本地恢复
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

  // 同步user到localStorage
  useEffect(() => {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  }, [user]);

  // 同步room到localStorage
  useEffect(() => {
    if (room) localStorage.setItem(ROOM_KEY, JSON.stringify(room));
    else localStorage.removeItem(ROOM_KEY);
  }, [room]);

  // 退出登录
  const handleLogout = () => {
    setUser(null);
    setRoom(null);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ROOM_KEY);
  };

  if (!user) return <AuthPage onLogin={setUser} />;

  if (room) return (
    <GameRoom user={user} room={room} leaveRoom={() => setRoom(null)} />
  );

  return (
    <div className="main-menu">
      <UserProfile user={user} setUser={handleLogout} />
      <RoomList user={user} joinRoom={setRoom} />
      <GiftPoints user={user} />
    </div>
  );
}

export default App;
