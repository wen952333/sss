import React from 'react';
import '../styles/UserStats.css';

const UserStats = ({ points }) => {
  return (
    <div className="user-stats">
      <h3>我的积分</h3>
      <div className="points-display">{points}</div>
      <div className="stats-actions">
        <button className="btn transfer-btn">
          转账积分
        </button>
        <button className="btn history-btn">
          历史记录
        </button>
      </div>
    </div>
  );
};

export default UserStats;
