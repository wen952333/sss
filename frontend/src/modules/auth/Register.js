import React, { useState } from "react";
import { apiPost } from "../../api";

export default function Register({ onRegister }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [msg, setMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!phone.match(/^1\d{10}$/)) {
      setMsg("请输入11位手机号");
      return;
    }
    if (!nickname) { setMsg("请输入昵称"); return; }
    const res = await apiPost("register.php", { phone, password, nickname });
    if (res.ok) onRegister(res.user);
    else setMsg(res.error || "出错了");
  }

  return (
    <form onSubmit={handleSubmit} className="login-form">
      <h2>注册账号</h2>
      <input type="tel" placeholder="手机号" value={phone} onChange={e => setPhone(e.target.value)} maxLength={11} />
      <input type="text" placeholder="昵称" value={nickname} onChange={e => setNickname(e.target.value)} maxLength={10} />
      <input type="password" placeholder="密码" value={password} onChange={e => setPassword(e.target.value)} />
      <button type="submit">注册</button>
      <div style={{ color: "crimson", minHeight: 18, textAlign:"center" }}>{msg}</div>
    </form>
  );
}
