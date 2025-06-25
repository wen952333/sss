import React, { useState } from "react";
import PersonalModal from "./PersonalModal";
import "./TopBar.css";

export default function TopBar({ user, setUser, onCreateRoom }) {
  const [showModal, setShowModal] = useState(false);
  const [roomName, setRoomName] = useState("");
  return (
    <>
      <div className="topbar">
        <button className="topbar-personal" onClick={() => setShowModal(true)}>
          <span role="img" aria-label="user">👤</span>
        </button>
        <div className="topbar-userinfo">
          你好，{user.nickname}（{user.phone}） | 积分：{user.score}
        </div>
        <div className="topbar-roomcreate">
          <input
            value={roomName}
            onChange={e => setRoomName(e.target.value)}
            placeholder="新房间名称"
          />
          <button onClick={() => { 
            if(roomName.trim()) {onCreateRoom(roomName); setRoomName("");} 
          }}>创建房间</button>
        </div>
        <button className="topbar-logout" onClick={setUser}>
          退出登录
        </button>
      </div>
      {showModal && <PersonalModal user={user} onClose={() => setShowModal(false)} />}
    </>
  );
}
