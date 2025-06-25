import React from "react";
import { getCardImage } from "../utils/cardMapper";
import "./ShowdownPanel.css";

export default function ShowdownPanel({ results, onContinue, onExit, mePhone }) {
  // results: [{ nickname, phone, head, mid, tail, score, isWinner }]
  return (
    <div className="showdown-bg">
      <div className="showdown-table">
        {results.map((r, idx) => (
          <div
            key={idx}
            className={`showdown-block ${r.phone === mePhone ? 'me' : ''} ${r.isWinner ? 'winner' : r.score<0 ? 'loser' : ''}`}
          >
            <div className="showdown-title">{r.phone === mePhone ? "你的牌型" : `${r.nickname}的牌型`}</div>
            <div className="showdown-score">{r.score > 0 ? `+${r.score}` : r.score}</div>
            <div className="showdown-row">
              {r.head.map(card => <img key={card} src={getCardImage(card)} alt={card} className="showdown-card" />)}
            </div>
            <div className="showdown-row">
              {r.mid.map(card => <img key={card} src={getCardImage(card)} alt={card} className="showdown-card" />)}
            </div>
            <div className="showdown-row">
              {r.tail.map(card => <img key={card} src={getCardImage(card)} alt={card} className="showdown-card" />)}
            </div>
          </div>
        ))}
      </div>
      <div className="showdown-actions">
        <button className="btn green" onClick={onContinue}>继续游戏</button>
        <button className="btn red" onClick={onExit}>退出游戏</button>
      </div>
    </div>
  );
}
