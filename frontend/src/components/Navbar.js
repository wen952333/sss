import React from "react";
import { useNavigate } from "react-router-dom";

export default function Navbar({ onLogout }) {
  const navigate = useNavigate();

  // 退出登录处理
  const handleLogout = () => {
    if (onLogout) onLogout();
    // 跳转到登录页
    navigate("/login");
  };

  return (
    <nav style={{ padding: "16px", background: "#f5f5f5" }}>
      <span style={{ fontWeight: "bold", marginRight: "24px" }}>系统导航栏</span>
      <button onClick={handleLogout}>退出</button>
    </nav>
  );
}
