import React, { useState } from "react";
import PersonalModal from "./PersonalModal";
import "./TopBar.css";

export default function TopBar({ user, setUser, onCreateRoom }) {
  const [showModal, setShowModal] = useState(false);
  return (
    <>
      <div className="topbar">
        <button className="topbar-btn" onClick={() => setShowModal(true)}>
          个人中心
        </button>
        <button className="topbar-btn green" onClick={onCreateRoom}>
          创建房间
        </button>
        <button className="topbar-btn red" onClick={setUser}>
          退出登录
        </button>
      </div>
      {showModal && <PersonalModal user={user} onClose={() => setShowModal(false)} />}
    </>
  );
}
