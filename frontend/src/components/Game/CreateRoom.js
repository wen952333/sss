import React, { useState } from "react";
import { apiRequest } from "../../api";

export default function CreateRoom({ onCreated }) {
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const handleCreate = async () => {
    const res = await apiRequest("create_room", { name });
    if (res.success) {
      setMsg("创建成功");
      onCreated(res.room_id);
    } else setMsg(res.message || "创建失败");
  };
  return (
    <div className="mb-4">
      <input
        className="input"
        placeholder="房间名（可空）"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button className="btn w-full" onClick={handleCreate}>
        创建房间
      </button>
      {msg && <div className="text-green-600 mt-2">{msg}</div>}
    </div>
  );
}
