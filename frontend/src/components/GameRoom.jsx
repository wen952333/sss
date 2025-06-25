import React, { useEffect, useState } from "react";
import { apiRequest } from "../api";
import { getCardImage } from "../utils/cardMapper";
import "./GameRoom.css";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";

export default function GameRoom({ user, room, leaveRoom }) {
  const [game, setGame] = useState(null);
  const [error, setError] = useState("");
  const [myCards, setMyCards] = useState([]);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let timer;
    const fetchGame = async () => {
      const res = await apiRequest("get_room", { room_id: room.id });
      if (res.success) {
        setGame(res.game);
        if (!submitted && res.game.cards) setMyCards(res.game.cards);
        setSubmitted(!!res.game.cards && res.game.cards.length === 13);
      } else setError(res.message);
    };
    fetchGame();
    timer = setInterval(fetchGame, 2000);
    return () => clearInterval(timer);
  }, [room.id, submitted]);

  const isHost = game && game.players && game.players[0].phone === user.phone;

  const handleStart = async () => {
    const res = await apiRequest("start_game", { room_id: room.id });
    if (!res.success) setError(res.message);
  };

  const handleSubmit = async () => {
    if (!myCards || myCards.length !== 13) return setError("没有13张牌");
    const res = await apiRequest("submit_hand", { room_id: room.id, cards: myCards });
    if (!res.success) setError(res.message);
    else setSubmitted(true);
  };

  const handleSettle = async () => {
    const res = await apiRequest("settle_game", { room_id: room.id });
    if (!res.success) setError(res.message);
  };

  const handleLeave = async () => {
    await apiRequest("leave_room", { room_id: room.id });
    leaveRoom();
  };

  function onDragEnd(result) {
    if (!result.destination) return;
    const newCards = Array.from(myCards);
    const [removed] = newCards.splice(result.source.index, 1);
    newCards.splice(result.destination.index, 0, removed);
    setMyCards(newCards);
  }

  if (!game) return <div>加载中...</div>;

  return (
    <div className="game-room-table">
      <div className="gr-header">
        <span>房间：{room.name}</span>
        <button className="gr-leave-btn" onClick={handleLeave}>退出</button>
      </div>
      <div className="gr-table">
        {game.players.map((p, idx) => {
          const isMe = p.phone === user.phone;
          const isZhuang = idx === 0;
          return (
            <div key={p.phone}
              className={`gr-seat gr-seat-${idx + 1} ${isMe ? "gr-me" : ""}`}>
              <div className="gr-avatar">
                <span role="img" aria-label="avatar">🧑</span>
                {isZhuang && <span className="gr-zhuang">庄</span>}
              </div>
              <div className="gr-nickname">{p.nickname}</div>
              <div className="gr-sub">{p.phone.slice(-4)} | {p.score}分</div>
              <div className="gr-status">
                {game.status === 1
                  ? p.cards
                    ? <span className="gr-ready">已出牌</span>
                    : <span className="gr-wait">等待</span>
                  : (game.status === 2 && typeof p.round_score === "number")
                  ? <span className="gr-score">本局{p.round_score}分</span>
                  : null}
              </div>
              {isMe && myCards.length > 0 && game.status === 1 && !submitted && (
                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId="hand" direction="horizontal">
                    {(provided) => (
                      <div
                        className="gr-cards draggable"
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                      >
                        {myCards.map((card, i) => (
                          <Draggable key={card} draggableId={card} index={i}>
                            {(provided, snapshot) => (
                              <img
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                src={getCardImage(card)}
                                alt={card}
                                className={`gr-card${snapshot.isDragging ? ' dragging' : ''}`}
                                style={provided.draggableProps.style}
                              />
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}
              {isMe && (game.status !== 1 || submitted) && myCards.length > 0 && (
                <div className="gr-cards">
                  {myCards.map(card => (
                    <img key={card} src={getCardImage(card)} alt={card} className="gr-card" />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="gr-actions">
        {game.status === 0 && isHost && (
          <button className="gr-btn" onClick={handleStart}>发牌开始游戏</button>
        )}
        {game.status === 1 && myCards.length === 13 && !submitted && (
          <button className="gr-btn" onClick={handleSubmit}>提交我的理牌</button>
        )}
        {game.status === 1 && isHost && (
          <button className="gr-btn" onClick={handleSettle}>结算本局</button>
        )}
        {game.status === 2 && (
          <div className="gr-info">本局已结束，积分已结算</div>
        )}
        <div style={{ color: "#888", marginTop: 8 }}>
          {game.status === 1 && !submitted && "可拖拽你的手牌，理好后提交"}
        </div>
        {error && <div className="gr-error">{error}</div>}
      </div>
    </div>
  );
}
