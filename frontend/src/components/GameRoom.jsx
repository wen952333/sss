import React, { useEffect, useState } from "react";
import { apiRequest } from "../api";
import { getCardImage } from "../utils/cardMapper";
import "./GameRoom.css";
import ArrangePanel from "./ArrangePanel";
import ShowdownPanel from "./ShowdownPanel";

// 简单自动分牌（按顺序3-5-5）
function autoArrange13(cards) {
  return {
    top: cards.slice(0, 3),
    middle: cards.slice(3, 8),
    bottom: cards.slice(8, 13)
  };
}

export default function GameRoom({ user, room, leaveRoom }) {
  const [game, setGame] = useState(null);
  const [myCards, setMyCards] = useState([]);
  const [arrangeMode, setArrangeMode] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showdown, setShowdown] = useState(null); // 比牌结果
  const [error, setError] = useState("");

  // 获取房间和游戏状态
  useEffect(() => {
    let timer;
    const fetchGame = async () => {
      const res = await apiRequest("get_room", { room_id: room.id });
      if (res.success) {
        setGame(res.game);
        // 只在未理牌时设手牌
        if (!submitted && res.game.cards) setMyCards(res.game.cards);
        setSubmitted(!!res.game.cards && res.game.cards.length === 13);
        // 比牌后加载比牌界面
        if (res.game.status === 2) {
          // 拉取结算信息
          const detail = await apiRequest("get_showdown", { room_id: room.id });
          if (detail.success) setShowdown(detail.results);
        } else {
          setShowdown(null);
        }
      } else setError(res.message);
    };
    fetchGame();
    timer = setInterval(fetchGame, 2000);
    return () => clearInterval(timer);
  }, [room.id, submitted]);

  const isHost = game && game.players && game.players[0].phone === user.phone;

  // 开始发牌
  const handleStart = async () => {
    const res = await apiRequest("start_game", { room_id: room.id });
    if (!res.success) setError(res.message);
  };

  // 理牌提交
  const handleSubmit = arrangedCards => {
    if (!arrangedCards || arrangedCards.length !== 13) {
      setError("请按3-5-5理好13张牌");
      return;
    }
    apiRequest("submit_hand", { room_id: room.id, cards: arrangedCards }).then(res => {
      if (!res.success) setError(res.message);
      else {
        setSubmitted(true);
        setArrangeMode(false);
      }
    });
  };

  // 结算比牌
  const handleSettle = async () => {
    const res = await apiRequest("settle_game", { room_id: room.id });
    if (!res.success) setError(res.message);
  };

  // 继续游戏（清理状态，等房主发牌）
  const handleContinue = () => {
    setSubmitted(false);
    setArrangeMode(false);
    setShowdown(null);
    setError("");
    setMyCards([]);
  };

  // 离开房间
  const handleLeave = async () => {
    await apiRequest("leave_room", { room_id: room.id });
    leaveRoom();
  };

  // 进入理牌界面
  if (arrangeMode && myCards.length === 13 && !submitted)
    return (
      <div className="game-room-table">
        <div className="gr-header">
          <span>理牌（三墩分配）</span>
          <button className="gr-leave-btn" onClick={handleLeave}>退出</button>
        </div>
        <ArrangePanel
          cards={myCards}
          onAutoArrange={autoArrange13}
          onSubmit={handleSubmit}
        />
        <div className="gr-actions">
          <button className="gr-btn" onClick={() => setArrangeMode(false)}>返回房间</button>
        </div>
      </div>
    );

  // 比牌界面
  if (showdown && game)
    return (
      <ShowdownPanel
        results={showdown}
        mePhone={user.phone}
        onContinue={handleContinue}
        onExit={handleLeave}
      />
    );

  // 默认牌桌界面
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
                    : <span className="gr-wait">等待理牌</span>
                  : (game.status === 2 && typeof p.round_score === "number")
                  ? <span className="gr-score">本局{p.round_score}分</span>
                  : null}
              </div>
              {isMe && myCards.length > 0 && game.status === 1 && !submitted && (
                <div className="gr-actions">
                  <button className="gr-btn" onClick={() => setArrangeMode(true)}>去理牌</button>
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
        {game.status === 1 && isHost && (
          <button className="gr-btn" onClick={handleSettle}>结算本局</button>
        )}
        {game.status === 2 && (
          <div className="gr-info">本局已结束，积分已结算</div>
        )}
        {error && <div className="gr-error">{error}</div>}
      </div>
    </div>
  );
}
