import React from "react";
export default function UserProfile({ user, setUser }) {
  return (
    <div className="user-profile">
      <span>你好，{user.nickname}（{user.phone}） | 积分：{user.score}</span>
      <button onClick={() => setUser(null)}>退出登录</button>
    </div>
  );
}
