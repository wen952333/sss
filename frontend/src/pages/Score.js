import React, { useState } from "react";
import { apiPost } from "../api";

export default function Score({ user }) {
  const [toPhone, setToPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState("");

  async function handleSend() {
    if (!toPhone.match(/^1\d{10}$/)) return setMsg("请输入正确的手机号");
    if (!amount || isNaN(amount) || amount <= 0) return setMsg("请输入正确的积分数");
    const res = await apiPost("score.php", { action: "send", to: toPhone, amount, token: user.token });
    setMsg(res.ok ? "赠送成功" : res.error || "失败");
  }

  return (
    <div>
      <h2>我的积分：{user.score}</h2>
      <input placeholder="对方手机号" value={toPhone} onChange={e => setToPhone(e.target.value)} maxLength={11} />
      <input placeholder="赠送积分" value={amount} onChange={e => setAmount(e.target.value)} type="number" />
      <button onClick={handleSend}>赠送</button>
      <div style={{ color: "red" }}>{msg}</div>
    </div>
  );
}
