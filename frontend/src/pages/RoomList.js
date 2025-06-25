import React, { useEffect, useState } from "react";
import { apiGet, apiPost } from "../api";

export default function RoomList({ user, onEnterRoom }) {
  const [rooms, setRooms] = useState([]);
  const [roomName, setRoomName] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const interval = setInterval(() => loadRooms(), 2000);
    loadRooms();
    return () => clearInterval(interval);
  }, []);

  async function loadRooms() {
    const res = await apiGet("room.php", { action: "list" });
    if (res.ok) setRooms(res.rooms);
  }

  async function handleCreate() {
    if (!roomName) return setMsg("请输入房间名");
    const res = await apiPost("room.php", { action: "create", name: roomName, token: user.token });
    if (res.ok) onEnterRoom(res.room.id);
    else setMsg(res.error || "创建失败");
  }

  async function handleJoin(id) {
    const res = await apiPost("room.php", { action: "join", id, token: user.token });
    if (res.ok) onEnterRoom(id);
    else setMsg(res.error || "加入失败");
  }

  return (
    <div>
      <h2>房间列表</h2>
      <input placeholder="新房间名" value={roomName} onChange={e => setRoomName(e.target.value)} maxLength={12} />
      <button onClick={handleCreate}>创建房间</button>
      <ul>
        {rooms.map(r => (
          <li key={r.id}>
            {r.name}（{r.players.length}/4）
            <button onClick={() => handleJoin(r.id)}>加入</button>
          </li>
        ))}
      </ul>
      <div style={{ color: "red" }}>{msg}</div>
    </div>
  );
}
