import React, { useState, useEffect } from "react";
import { apiRequest } from "../api";
import "./RoomList.css";

export default function RoomList({ user, joinRoom }) {
  const [rooms, setRooms] = useState([]);
  const [roomName, setRoomName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchRooms = async () => {
    setLoading(true);
    const res = await apiRequest("list_rooms", {});
    if (res.success) setRooms(res.rooms);
    setLoading(false);
  };

  useEffect(() => {
    fetchRooms();
    const timer = setInterval(fetchRooms, 3000);
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
    <div className="room-list-card">
      <div className="room-list-header">
        <h2>房间列表</h2>
        <button className="room-list-refresh" onClick={fetchRooms}>⟳</button>
      </div>
      {loading ? (
        <div className="room-list-loading">正在加载房间...</div>
      ) : rooms.length === 0 ? (
        <div className="room-list-empty">暂无房间，快创建一个吧！</div>
      ) : (
        <div className="room-list-table">
          {rooms.map(r => (
            <div className="room-list-row" key={r.id}>
              <div className="room-list-info">
                <span className="room-list-title">{r.name}</span>
                <span className="room-list-players">{r.players.length}/4</span>
              </div>
              <button disabled={r.players.length >= 4} onClick={() => handleJoin(r.id)}>
                {r.players.length >= 4 ? "已满" : "进入"}
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="room-list-create">
        <input value={roomName} onChange={e => setRoomName(e.target.value)} placeholder="新房间名称" />
        <button onClick={createRoom}>创建房间</button>
      </div>
      {error && <div className="error">{error}</div>}
    </div>
  );
}
