import React, { useState } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import Login from "../modules/auth/Login";
import Register from "../modules/auth/Register";
import Home from "../pages/Home";
import Game from "../pages/Game";
import NotFound from "../pages/NotFound";
import Score from "../modules/score/Score";
import Navbar from "../components/Navbar";

// 顶层用户状态管理
function AppRoutes() {
  const [user, setUser] = useState(null);
  const [roomId, setRoomId] = useState(null);

  function handleLogout() {
    setUser(null);
    setRoomId(null);
  }

  if (!user) {
    // 登录注册切换
    const [register, setRegister] = useState(false);
    return register
      ? <Register onRegister={u => { setUser(u); setRegister(false); }} />
      : <Login onLogin={setUser} />;
  }

  if (roomId) {
    return <Game user={user} roomId={roomId} onLeave={() => setRoomId(null)} />;
  }

  return (
    <BrowserRouter>
      <Navbar onLogout={handleLogout} />
      <Routes>
        <Route path="/" element={<Home user={user} onEnterRoom={setRoomId} />} />
        <Route path="/score" element={<Score user={user} />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;
