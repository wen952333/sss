import React, { useState } from 'react';
import '../styles/CreateRoom.css';

const CreateRoom = ({ onCreate, onCancel }) => {
  const [roomName, setRoomName] = useState('');

  const handleCreate = () => {
    if (roomName.trim()) {
      onCreate(roomName);
    }
  };

  return (
    <div className="create-room-modal">
      <div className="modal-content">
        <h3>创建新房间</h3>
        <div className="form-group">
          <input
            type="text"
            className="form-control"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="输入房间名称"
            maxLength={20}
          />
        </div>
        <div className="modal-actions">
          <button className="btn cancel-btn" onClick={onCancel}>
            取消
          </button>
          <button className="btn create-btn" onClick={handleCreate}>
            创建
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateRoom;
