import React, { useState } from "react";
import { apiPost } from "../../api";

export default function Login({ onLogin, onShowRegister }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!phone.match(/^1\d{10}$/)) {
      setMsg("请输入11位手机号");
      return;
    }
    const res = await apiPost("login.php", { phone, password });
    if (res.ok) onLogin(res.user);
    else setMsg(res.error || "出错了");
  }

  return (
    <form onSubmit={handleSubmit} className="login-form">
      <h2>用户登录</h2>
      <input type="tel" placeholder="手机号" value={phone} onChange={e => setPhone(e.target.value)} maxLength={11} />
      <input type="password" placeholder="密码" value={password} onChange={e => setPassword(e.target.value)} />
      <button type="submit">登录</button>
      <div style={{display: "flex", justifyContent: "space-between", fontSize: 14, marginTop: 8}}>
        <div />
        <span
          className="toggle-link"
          onClick={onShowRegister}
          style={{ cursor: "pointer", color:"#6366f1" }}
        >
          没有账号？注册
        </span>
      </div>
      <div style={{ color: "crimson", minHeight: 18, textAlign:"center" }}>{msg}</div>
    </form>
  );
}
