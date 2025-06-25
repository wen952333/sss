import React, { useState } from "react";
import { apiRequest } from "../api";

export default function AuthPage({ onLogin }) {
  const [mode, setMode] = useState("login"); // "login" or "register"
  const [form, setForm] = useState({ phone: "", nickname: "", password: "" });
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const action = mode === "login" ? "login" : "register";
    try {
      const res = await apiRequest(action, form);
      if (res.success) {
        onLogin(res.user);
      } else {
        setError(res.message);
      }
    } catch {
      setError("网络错误");
    }
  };

  return (
    <div className="auth-page">
      <h2>{mode === "login" ? "登录" : "注册"}</h2>
      <form onSubmit={handleSubmit} autoComplete="on">
        <input
          name="phone"
          placeholder="手机号"
          maxLength={11}
          value={form.phone}
          onChange={handleChange}
          required
          pattern="[0-9]{11}"
          autoComplete="tel"
        />
        {mode === "register" && (
          <input
            name="nickname"
            placeholder="昵称"
            value={form.nickname}
            onChange={handleChange}
            required
            autoComplete="nickname"
          />
        )}
        <input
          name="password"
          type="password"
          placeholder="密码"
          value={form.password}
          onChange={handleChange}
          required
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
        <button type="submit">{mode === "login" ? "登录" : "注册"}</button>
      </form>
      <div style={{ marginTop: 8 }}>
        {mode === "login" ? (
          <span>
            没有账号？
            <button type="button" onClick={() => setMode("register")}>
              注册
            </button>
          </span>
        ) : (
          <span>
            已有账号？
            <button type="button" onClick={() => setMode("login")}>
              登录
            </button>
          </span>
        )}
      </div>
      {error && <div className="error">{error}</div>}
    </div>
  );
}
