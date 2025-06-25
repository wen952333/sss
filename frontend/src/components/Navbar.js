import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function Navbar({ onLogout }) {
  const loc = useLocation();
  return (
    <nav>
      <Link to="/" className={loc.pathname === "/" ? "active" : ""}>大厅</Link>
      <Link to="/score" className={loc.pathname === "/score" ? "active" : ""}>积分</Link>
      <button onClick={onLogout}>退出</button>
    </nav>
  );
}
