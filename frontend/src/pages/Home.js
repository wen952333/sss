import React from "react";
import RoomList from "../modules/room/RoomList";

export default function Home({ user, onEnterRoom }) {
  return (
    <div>
      <RoomList user={user} onEnterRoom={onEnterRoom} />
    </div>
  );
}
