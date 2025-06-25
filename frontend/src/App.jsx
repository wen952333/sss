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
  // 本地恢复登录状态
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

  // 持久化
  useEffect(() => {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  }, [user]);
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

  // 创建房间，成功后直接进房间
  const handleCreateRoom = async (roomName) => {
    if (!roomName.trim()) return;
    const res = await apiRequest("create_room", { name: roomName });
    if (res.success) setRoom(res.room);
    // 可选：失败提示
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
