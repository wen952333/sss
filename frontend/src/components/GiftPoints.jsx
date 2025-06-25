import React, { useState } from "react";
import { apiRequest } from "../api";
import "./GiftPoints.css";
export default function GiftPoints({ user }) {
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const handleGift = async () => {
    setMsg(""); setErr("");
    if (!phone.match(/^[0-9]{11}$/) || !amount) {
      setErr("请正确填写手机号和积分数");
      return;
    }
    const res = await apiRequest("gift_points", { to_phone: phone, amount: parseInt(amount) });
    if (res.success) setMsg("赠送成功");
    else setErr(res.message);
  };
  return (
    <div className="gift-points">
      <h3>赠送积分</h3>
      <div className="gift-points-row">
        <input placeholder="对方手机号" value={phone} onChange={e => setPhone(e.target.value)} />
        <input placeholder="赠送数量" type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} />
        <button onClick={handleGift}>赠送</button>
      </div>
      {msg && <div className="gift-msg">{msg}</div>}
      {err && <div className="gift-msg err">{err}</div>}
    </div>
  );
}
