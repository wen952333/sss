import React, { useState } from "react";
import { apiRequest } from "../api";
export default function GiftPoints({ user }) {
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState("");
  const handleGift = async () => {
    if (!phone.match(/^[0-9]{11}$/) || !amount) return setMsg("请正确填写手机号和积分数");
    const res = await apiRequest("gift_points", { to_phone: phone, amount: parseInt(amount) });
    setMsg(res.success ? "赠送成功" : res.message);
  };
  return (
    <div className="gift-points">
      <h3>赠送积分</h3>
      <input placeholder="对方手机号" value={phone} onChange={e => setPhone(e.target.value)} />
      <input placeholder="赠送数量" type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} />
      <button onClick={handleGift}>赠送</button>
      {msg && <div>{msg}</div>}
    </div>
  );
}
