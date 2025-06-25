import React, { useState } from "react";
import Register from "./components/Auth/Register";
import Login from "./components/Auth/Login";
import RoomList from "./components/Game/RoomList";
import CreateRoom from "./components/Game/CreateRoom";
import GameTable from "./components/Game/GameTable";
import Points from "./components/Points";

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("login");
  const [roomId, setRoomId] = useState(null);

  if (!user) {
    if (view === "login")
      return (
        <Login
          onLogin={(u) => {
            setUser(u);
            setView("room");
          }}
          onSwitch={() => setView("register")}
        />
      );
    else
      return (
        <Register
          onRegister={(u) => {
            setUser(u);
            setView("room");
          }}
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
        <button
          className="btn"
          onClick={() => {
            setUser(null);
            setView("login");
          }}
        >
          退出登录
        </button>
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
