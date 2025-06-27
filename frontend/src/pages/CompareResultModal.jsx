import React from 'react';

// 通用比牌弹窗组件
export default function CompareResultModal({
  show,
  onClose,
  playerNames = [],
  playerCards = [],
  scores = []
}) {
  // playerNames: ['你', '小明', ...]
  // playerCards: [{ head:[], middle:[], tail:[] }, ...]
  // scores: [0, 1, 2, 3]
  if (!show) return null;

  function renderPaiDunCards(cards) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 3 }}>
        {cards.map(card => (
          <img
            key={card}
            src={`/cards/${card}.svg`}
            alt={card}
            style={{
              width: 46,
              height: 66,
              borderRadius: 8,
              background: '#fff',
              boxShadow: '0 2px 8px #bec7dd3a',
              marginRight: 2
            }}
            draggable={false}
          />
        ))}
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.37)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 15,
        padding: 24,
        minWidth: 400,
        minHeight: 300,
        boxShadow: '0 8px 40px #0002',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: 16,
        position: 'relative'
      }}>
        {playerNames.map((name, i) => (
          <div key={i} style={{ textAlign: 'center', borderBottom: '1px solid #eee' }}>
            <div style={{ fontWeight: 700, color: i === 0 ? '#23e67a' : '#4f8cff', marginBottom: 8 }}>
              {name}（{scores[i]}分）
            </div>
            {renderPaiDunCards(playerCards[i]?.head || [])}
            {renderPaiDunCards(playerCards[i]?.middle || [])}
            {renderPaiDunCards(playerCards[i]?.tail || [])}
          </div>
        ))}
        <button style={{
          position: 'absolute', right: 18, top: 12, background: 'transparent', border: 'none', fontSize: 22, color: '#888', cursor: 'pointer'
        }} onClick={onClose}>×</button>
      </div>
    </div>
  );
}
