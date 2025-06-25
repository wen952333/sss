import React, { useEffect, useState } from "react";
import { apiRequest } from "../../api";

export default function RoomList({ onJoinRoom }) {
  const [rooms, setRooms] = useState([]);

  useEffect(() => {
    const fetchRooms = async () => {
      const res = await apiRequest("room_list", {});
      if (res.success) setRooms(res.rooms);
    };
    fetchRooms();
    const interval = setInterval(fetchRooms, 2000); // 轮询房间列表
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h2 className="font-bold text-lg">房间列表</h2>
      <ul>
        {rooms.map((r) => (
          <li key={r.id} className="flex justify-between py-2 items-center">
            <span>
              {r.name}（{r.players.length}人）
            </span>
            <button onClick={() => onJoinRoom(r.id)} className="btn">
              加入
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
