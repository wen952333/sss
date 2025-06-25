import React, { useState } from "react";
import { apiRequest } from "../api";

export default function Points({ user }) {
  const [searchPhone, setSearchPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState("");

  const handleGift = async () => {
    const res = await apiRequest("gift_points", {
      to_phone: searchPhone,
      amount,
    });
    setMsg(res.message);
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold">赠送积分</h2>
      <input
        className="input"
        placeholder="对方手机号"
        value={searchPhone}
        onChange={(e) => setSearchPhone(e.target.value)}
      />
      <input
        className="input"
        type="number"
        placeholder="积分数量"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <button className="btn mt-2" onClick={handleGift}>
        赠送
      </button>
      {msg && <div className="mt-2">{msg}</div>}
    </div>
  );
}
