import React, { useEffect, useState } from "react";
import { apiGet, apiPost } from "../../api";
import RoomCard from "./RoomCard";

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
    <div className="room-list">
      <h2 style={{color:'#6366f1'}}>房间大厅</h2>
      <div style={{display:'flex',alignItems:'center',gap:8,margin:'18px 0'}}>
        <input
          placeholder="新房间名"
          value={roomName}
          onChange={e => setRoomName(e.target.value)}
          maxLength={12}
          style={{flex:1}}
        />
        <button style={{width:98}} onClick={handleCreate}>创建房间</button>
      </div>
      {rooms.map(r => (
        <RoomCard key={r.id} room={r} onJoin={handleJoin} userId={user.id} />
      ))}
      <div style={{color:"crimson",minHeight:18}}>{msg}</div>
    </div>
  );
}
