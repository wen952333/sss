import React, { useState } from "react";
import { getCardImage } from "../utils/cardMapper";
import "./ArrangePanel.css";

// 拖拽等功能可根据需要引入 react-beautiful-dnd
export default function ArrangePanel({ cards, onSubmit, onAutoArrange }) {
  // 三墩区
  const [top, setTop] = useState([]);
  const [middle, setMiddle] = useState([]);
  const [bottom, setBottom] = useState([]);
  const [pool, setPool] = useState(cards || []);
  const [error, setError] = useState("");

  // 拖拽到某一墩
  const handleAdd = (card, group) => {
    if (!pool.includes(card)) return;
    if (group === "top" && top.length < 3) {
      setTop([...top, card]);
      setPool(pool.filter(c => c !== card));
    }
    if (group === "middle" && middle.length < 5) {
      setMiddle([...middle, card]);
      setPool(pool.filter(c => c !== card));
    }
    if (group === "bottom" && bottom.length < 5) {
      setBottom([...bottom, card]);
      setPool(pool.filter(c => c !== card));
    }
  };

  // 回收
  const handleRemove = (card, group) => {
    if (group === "top") setTop(top.filter(c => c !== card));
    if (group === "middle") setMiddle(middle.filter(c => c !== card));
    if (group === "bottom") setBottom(bottom.filter(c => c !== card));
    setPool([...pool, card]);
  };

  // 自动分牌
  const doAutoArrange = () => {
    if (onAutoArrange) {
      const { top: auTop, middle: auMid, bottom: auBot } = onAutoArrange(cards);
      setTop(auTop);
      setMiddle(auMid);
      setBottom(auBot);
      setPool([]);
    }
  };

  // 提交
  const handleSubmit = () => {
    setError("");
    if (top.length !== 3 || middle.length !== 5 || bottom.length !== 5) {
      setError("请按3-5-5分好13张牌");
      return;
    }
    onSubmit([...top, ...middle, ...bottom]);
  };

  // 渲染一个牌区
  const renderGroup = (group, name, max) => (
    <div className="arrange-group">
      <div className="arrange-group-title">{name}</div>
      <div className="arrange-cards">
        {group.map(card => (
          <img key={card}
            src={getCardImage(card)}
            alt={card}
            className="arrange-card"
            onClick={() => handleRemove(card, name)}
            title="点此回收"
          />
        ))}
        {[...Array(max - group.length)].map((_, i) => (
          <div key={i} className="arrange-card empty"></div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="arrange-panel">
      <div className="arrange-section">
        <div className="arrange-pool-title">待分配 ({pool.length}张)</div>
        <div className="arrange-pool">
          {pool.map(card => (
            <img key={card}
              src={getCardImage(card)}
              alt={card}
              className="arrange-card"
              onClick={() => {
                if (top.length < 3) handleAdd(card, "top");
                else if (middle.length < 5) handleAdd(card, "middle");
                else if (bottom.length < 5) handleAdd(card, "bottom");
              }}
              title="点此自动分区"
            />
          ))}
        </div>
      </div>
      <div className="arrange-section">
        {renderGroup(top, "头道", 3)}
        {renderGroup(middle, "中道", 5)}
        {renderGroup(bottom, "尾道", 5)}
      </div>
      <div className="arrange-actions">
        <button onClick={handleSubmit} className="arrange-btn ready" disabled={pool.length > 0}>准备</button>
        <button onClick={doAutoArrange} className="arrange-btn auto">自动分牌</button>
      </div>
      {error && <div className="arrange-error">{error}</div>}
      <div className="arrange-tip">点击牌面可分配或回收，点“自动分牌”可一键分好</div>
    </div>
  );
}
