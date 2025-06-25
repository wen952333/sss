import React, { useState, useEffect } from "react";
import Register from "./components/Auth/Register";
import Login from "./components/Auth/Login";
import RoomList from "./components/Game/RoomList";
import CreateRoom from "./components/Game/CreateRoom";
import GameTable from "./components/Game/GameTable";
import Points from "./components/Points";
import { whoami } from "./api";

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("login");
  const [roomId, setRoomId] = useState(null);

  // 页面加载时：本地有user就用whoami校验
  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      setUser(JSON.parse(stored));
      setView("room");
      // 调用whoami接口校验cookie/session是否有效
      whoami().then(res => {
        if (res.success) {
          localStorage.setItem("user", JSON.stringify(res.user));
          setUser(res.user);
        } else {
          localStorage.removeItem("user");
          setUser(null);
          setView("login");
        }
      });
    }
  }, []);

  const handleLogin = (u) => {
    localStorage.setItem("user", JSON.stringify(u));
    setUser(u);
    setView("room");
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    setUser(null);
    setView("login");
  };

  if (!user) {
    if (view === "login")
      return (
        <Login
          onLogin={handleLogin}
          onSwitch={() => setView("register")}
        />
      );
    else
      return (
        <Register
          onRegister={handleLogin}
          onSwitch={() => setView("login")}
        />
      );
  }
  if (roomId)
    return (
      <GameTable roomId={roomId} user={user} onLeave={() => setRoomId(null)} />
    );
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-200 to-pink-100">
      <header className="p-4 flex justify-between items-center">
        <span className="font-bold text-2xl">十三水</span>
        <button className="btn" onClick={handleLogout}>退出登录</button>
      </header>
      <main className="p-4">
        <Points user={user} />
        <CreateRoom user={user} onCreated={(id) => setRoomId(id)} />
        <RoomList user={user} onJoinRoom={(id) => setRoomId(id)} />
      </main>
    </div>
  );
}
export default App;
