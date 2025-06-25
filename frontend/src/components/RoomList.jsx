import React, { useState, useEffect } from "react";
import { apiRequest } from "../api";

export default function RoomList({ user, joinRoom }) {
  const [rooms, setRooms] = useState([]);
  const [roomName, setRoomName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchRooms = async () => {
      const res = await apiRequest("list_rooms", {});
      if (res.success) setRooms(res.rooms);
    };
    fetchRooms();
    const timer = setInterval(fetchRooms, 3000); // 轮询房间列表
    return () => clearInterval(timer);
  }, []);

  const createRoom = async () => {
    if (!roomName.trim()) return;
    const res = await apiRequest("create_room", { name: roomName });
    if (res.success) joinRoom(res.room);
    else setError(res.message);
  };

  const handleJoin = async roomId => {
    const res = await apiRequest("join_room", { room_id: roomId });
    if (res.success) joinRoom(res.room);
    else setError(res.message);
  };

  return (
    <div className="room-list">
      <h2>房间列表</h2>
      <ul>
        {rooms.map(r => (
          <li key={r.id}>
            <span>{r.name} ({r.players.length}/4)</span>
            <button disabled={r.players.length >= 4} onClick={() => handleJoin(r.id)}>进入</button>
          </li>
        ))}
      </ul>
      <div className="create-room">
        <input value={roomName} onChange={e => setRoomName(e.target.value)} placeholder="新房间名称" />
        <button onClick={createRoom}>创建房间</button>
      </div>
      {error && <div className="error">{error}</div>}
    </div>
  );
}
