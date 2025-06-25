import React, { useState } from "react";
import { apiRequest } from "../../api";

export default function Register({ onRegister, onSwitch }) {
  const [phone, setPhone] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await apiRequest("register", { phone, nickname, password });
    if (res.success) onRegister(res.user);
    else setMsg(res.message);
  };

  return (
    <form className="p-4 max-w-xs mx-auto" onSubmit={handleSubmit}>
      <h2 className="mb-2 text-xl font-bold text-center">注册</h2>
      <input
        className="input"
        type="tel"
        placeholder="手机号"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        required
      />
      <input
        className="input"
        placeholder="昵称"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        required
      />
      <input
        className="input"
        type="password"
        placeholder="密码"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button className="btn w-full mt-3" type="submit">
        注册
      </button>
      <button
        className="w-full mt-2 text-sm text-indigo-500"
        type="button"
        onClick={onSwitch}
      >
        已有账号？去登录
      </button>
      {msg && <div className="text-red-500 text-center mt-2">{msg}</div>}
    </form>
  );
}
