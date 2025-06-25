import React from "react";
import { getCardImage } from "../utils/cardMapper";
import "./ShowdownPanel.css";

export default function ShowdownPanel({ results, onContinue, onExit, mePhone }) {
  // results: [{ nickname, phone, head, mid, tail, score_head, score_mid, score_tail, total, isWinner }]
  return (
    <div className="showdown-bg">
      <div className="showdown-table">
        {results.map((r, idx) => (
          <div
            key={idx}
            className={`showdown-block ${r.phone === mePhone ? 'me' : ''} ${r.isWinner ? 'winner' : r.total<0 ? 'loser' : ''}`}
          >
            <div className="showdown-title">{r.phone === mePhone ? "你的牌型" : `${r.nickname}的牌型`}</div>
            <div className="showdown-score">{r.total > 0 ? `+${r.total}` : r.total}</div>
            <div className="showdown-row">
              <span className="showdown-row-label">头({r.score_head >= 0 ? '+' : ''}{r.score_head}):</span>
              {r.head.map(card => <img key={card} src={getCardImage(card)} alt={card} className="showdown-card" />)}
            </div>
            <div className="showdown-row">
              <span className="showdown-row-label">中({r.score_mid >= 0 ? '+' : ''}{r.score_mid}):</span>
              {r.mid.map(card => <img key={card} src={getCardImage(card)} alt={card} className="showdown-card" />)}
            </div>
            <div className="showdown-row">
              <span className="showdown-row-label">尾({r.score_tail >= 0 ? '+' : ''}{r.score_tail}):</span>
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
