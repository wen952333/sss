import React, { useState } from "react";
import { apiPost } from "../api";

export default function Login({ onLogin }) {
  const [phone, setPhone] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!phone.match(/^1\d{10}$/)) {
      setMsg("请输入11位手机号");
      return;
    }
    const data = { phone, password, nickname };
    let res = isRegister
      ? await apiPost("register.php", data)
      : await apiPost("login.php", data);
    if (res.ok) onLogin(res.user);
    else setMsg(res.error || "出错了");
  }

  return (
    <form onSubmit={handleSubmit} className="login-form">
      <h2>{isRegister ? "注册账号" : "用户登录"}</h2>
      <input type="tel" placeholder="手机号（11位）" value={phone} onChange={e => setPhone(e.target.value)} maxLength={11} />
      {isRegister && (
        <input type="text" placeholder="昵称" value={nickname} onChange={e => setNickname(e.target.value)} maxLength={10} />
      )}
      <input type="password" placeholder="密码（6-18位）" value={password} onChange={e => setPassword(e.target.value)} />
      <button type="submit">{isRegister ? "注册" : "登录"}</button>
      <div onClick={() => setIsRegister(!isRegister)} className="toggle-link">
        {isRegister ? "已有账号？登录" : "没有账号？注册"}
      </div>
      <div style={{ color: "crimson", minHeight: 18, textAlign:"center" }}>{msg}</div>
    </form>
  );
}
