import React, { useState, useEffect } from "react";
import AuthPage from "./components/AuthPage";
import RoomList from "./components/RoomList";
import GameRoom from "./components/GameRoom";
import TopBar from "./components/TopBar";
import './App.css';

const USER_KEY = "sss_user";
const ROOM_KEY = "sss_room";

function App() {
  // 优先从本地恢复
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

  // 创建房间
  const handleCreateRoom = async (roomName) => {
    // 此处复用 RoomList 的API逻辑，或可直接调用
    // 你可以将创建房间API移到App，也可以传递给RoomList
    // RoomList已支持joinRoom回调
    // 实际上可以用ref转调RoomList的createRoom
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
