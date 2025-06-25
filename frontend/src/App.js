import React, { useState } from "react";
import Login from "./modules/auth/Login";
import Register from "./modules/auth/Register";
import Home from "./pages/Home";
import Score from "./modules/score/Score";
import Navbar from "./components/Navbar";
import "./style.css";

export default function App() {
  const [user, setUser] = useState(null);
  const [showRegister, setShowRegister] = useState(false);
  const [roomId, setRoomId] = useState(null);

  function handleLogout() {
    setUser(null);
    setRoomId(null);
  }

  if (!user) {
    return showRegister
      ? <Register onRegister={setUser} onShowLogin={() => setShowRegister(false)} />
      : <Login onLogin={setUser} onShowRegister={() => setShowRegister(true)} />;
  }

  // 这里只做演示，按你实际路由调整
  return (
    <div className="app-container">
      <Navbar onLogout={handleLogout} />
      <Home user={user} onEnterRoom={setRoomId} />
      <Score user={user} />
    </div>
  );
}
