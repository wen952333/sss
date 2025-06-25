import React from "react";
import GiftPoints from "./GiftPoints";
import "./PersonalModal.css";

export default function PersonalModal({ user, onClose }) {
  return (
    <div className="modal-bg">
      <div className="modal-card">
        <div className="modal-header">
          <span>个人中心</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-info">
          <div>昵称：{user.nickname}</div>
          <div>手机号：{user.phone}</div>
          <div>积分：{user.score}</div>
        </div>
        <GiftPoints user={user} />
      </div>
    </div>
  );
}
