import React, { useState } from "react";
import { apiPost } from "../../api";

export default function Register({ onRegister, onShowLogin }) {
  const [phone, setPhone] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!phone.match(/^1\d{10}$/)) {
      setMsg("请输入11位手机号");
      return;
    }
    if (!nickname) { setMsg("请输入昵称"); return; }
    if (!password) { setMsg("请输入密码"); return; }
    const res = await apiPost("register.php", { phone, password, nickname });
    if (res.ok) onRegister(res.user);
    else setMsg(res.error || "出错了");
  }

  return (
    <form onSubmit={handleSubmit} className="login-form">
      <h2>注册账号</h2>
      <input
        type="tel"
        placeholder="手机号"
        value={phone}
        onChange={e => setPhone(e.target.value)}
        maxLength={11}
        autoComplete="username"
      />
      <input
        type="text"
        placeholder="昵称"
        value={nickname}
        onChange={e => setNickname(e.target.value)}
        maxLength={10}
        autoComplete="nickname"
      />
      <input
        type="password"
        placeholder="密码"
        value={password}
        onChange={e => setPassword(e.target.value)}
        autoComplete="new-password"
      />
      <button type="submit">注册</button>
      <div style={{display: "flex", justifyContent: "space-between", fontSize: 14, marginTop: 8}}>
        <div />
        <span
          className="toggle-link"
          onClick={onShowLogin}
          style={{ cursor: "pointer", color:"#6366f1" }}
        >
          已有账号？登录
        </span>
      </div>
      <div style={{ color: "crimson", minHeight: 18, textAlign:"center" }}>{msg}</div>
    </form>
  );
}
