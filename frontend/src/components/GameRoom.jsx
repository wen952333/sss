import React, { useEffect, useState } from "react";
import { apiRequest } from "../api";
import "./GameRoom.css";

export default function GameRoom({ user, room, leaveRoom }) {
  const [game, setGame] = useState(null);
  const [players, setPlayers] = useState([]);
  const [myHand, setMyHand] = useState([]); // 13张手牌
  const [arranged, setArranged] = useState({ head: [], mid: [], tail: [] });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(0); // 0等待准备 1理牌中 2比牌中 3结算
  const [isHost, setIsHost] = useState(false);

  // 拉取房间与玩家状态
  useEffect(() => {
    let timer;
    const fetchRoom = async () => {
      const res = await apiRequest("get_room", { room_id: room.id });
      if (res.success) {
        setGame(res.game);
        setPlayers(res.game.players);
        setStatus(res.game.status);
        if (res.game.cards && res.game.cards.length === 13) setMyHand(res.game.cards);
        setIsHost(res.game.players[0].phone === user.phone);
      }
    };
    fetchRoom();
    timer = setInterval(fetchRoom, 2000);
    return () => clearInterval(timer);
  }, [room.id]);

  // 自动分牌
  const autoArrange = () => {
    if (myHand.length !== 13) return;
    setArranged({
      head: myHand.slice(0, 3),
      mid: myHand.slice(3, 8),
      tail: myHand.slice(8, 13)
    });
  };

  // 玩家准备
  const handleReady = () => {
    setReady(true);
    // 后端可补充ready接口
  };

  // 玩家分牌提交
  const handleSubmit = async () => {
    const all = [...arranged.head, ...arranged.mid, ...arranged.tail];
    if (all.length !== 13) return setError("请分好13张牌");
    const res = await apiRequest("submit_hand", { room_id: room.id, cards: all });
    if (!res.success) setError(res.message);
  };

  // 主人开始比牌
  const handleStartCompare = async () => {
    const res = await apiRequest("settle_game", { room_id: room.id });
    if (!res.success) setError(res.message);
  };

  return (
    <div className="room-root">
      {/* 顶部深色横幅 */}
      <div className="room-bar">
        <span className="room-bar-back" onClick={leaveRoom}>〈 返回</span>
        <span className="room-bar-title">十三水牌桌（{room.name}）</span>
        <span className="room-bar-user">
          欢迎, {user.nickname} (积分: {user.score}) &nbsp;
          <span className="room-bar-profile">个人中心</span>
        </span>
      </div>

      <div className="room-main">
        {/* 玩家列表 */}
        <div className="room-players">
          {players.map((p, idx) => (
            <div key={p.phone} className={`room-player ${p.phone === user.phone ? "me" : ""}`}>
              <div>{p.nickname}</div>
              <div>{p.cards ? "已准备" : "未准备"}</div>
            </div>
          ))}
          {Array(4 - players.length).fill(0).map((_, i) => (
            <div key={i + players.length} className="room-player empty">
              等待加入...
            </div>
          ))}
        </div>

        {/* 理牌区 */}
        <div className="room-cardarea">
          <div className="room-section">
            <div>请放置3张牌 <span className="room-section-label">头道</span></div>
            <div className="room-cardbox">{arranged.head.map(card => <CardView key={card} card={card} />)}</div>
          </div>
          <div className="room-section">
            <div>请放置5张牌 <span className="room-section-label">中道</span></div>
            <div className="room-cardbox">{arranged.mid.map(card => <CardView key={card} card={card} />)}</div>
          </div>
          <div className="room-section">
            <div>请放置5张牌 <span className="room-section-label">尾道</span></div>
            <div className="room-cardbox">{arranged.tail.map(card => <CardView key={card} card={card} />)}</div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="room-actions">
          <button className={`room-btn ready${ready ? " on" : ""}`} onClick={handleReady}>准备</button>
          <button className="room-btn" onClick={autoArrange}>自动分牌</button>
          {isHost && <button className="room-btn" onClick={handleStartCompare}>开始比牌</button>}
        </div>
        <div className="room-tip">点击“准备”以开始</div>
        {error && <div className="room-error">{error}</div>}
      </div>
    </div>
  );
}

function CardView({ card }) {
  // 你可以用图片或文字
  return <span className="card-view">{card}</span>;
}
