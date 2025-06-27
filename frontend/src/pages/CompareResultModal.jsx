import React from 'react';

// 4格比牌弹窗，十字红线分区，牌缩小10%
export default function CompareResultModal({
  open,
  onClose,
  myName = '你',
  aiPlayers = [],
  head = [],
  middle = [],
  tail = [],
  scores = [0,0,0,0],
}) {
  if (!open) return null;

  // 缩小10%的牌尺寸
  const CARD_HEIGHT = 59; // 原66*0.9
  const CARD_WIDTH = 41;  // 原46*0.9

  // 统一渲染三道
  function renderPaiDunCards(arr) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
        {arr.map(card =>
          <img
            key={card}
            src={`/cards/${card}.svg`}
            alt={card}
            style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
            draggable={false}
          />
        )}
      </div>
    );
  }

  // 4格内容
  function renderPlayerBlock(player, score, head, middle, tail, color) {
    return (
      <div style={{
        textAlign: 'center',
        padding: 10,
        boxSizing: 'border-box',
        height: '100%',
      }}>
        <div style={{ fontWeight: 700, color, marginBottom: 6 }}>{player}（{score}分）</div>
        {renderPaiDunCards(head)}
        {renderPaiDunCards(middle)}
        {renderPaiDunCards(tail)}
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.37)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 15,
        padding: 24,
        minWidth: 440,
        minHeight: 420,
        boxShadow: '0 8px 40px #0002',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: 0,
        position: 'relative',
        width: 480,
        height: 540,
      }}>
        {/* 红色十字线 */}
        <div style={{
          position: 'absolute', left: '50%', top: 0, width: 2, height: '100%',
          background: 'red', zIndex: 10, transform: 'translateX(-1px)'
        }} />
        <div style={{
          position: 'absolute', top: '50%', left: 0, height: 2, width: '100%',
          background: 'red', zIndex: 10, transform: 'translateY(-1px)'
        }} />
        {/* 4区内容 */}
        {/* 左上 */}
        {renderPlayerBlock(myName, scores[0], head, middle, tail, '#23e67a')}
        {/* 右上 */}
        {renderPlayerBlock(
          aiPlayers[0]?.name || '', scores[1],
          aiPlayers[0]?.head || [], aiPlayers[0]?.middle || [], aiPlayers[0]?.tail || [],
          '#4f8cff'
        )}
        {/* 左下 */}
        {renderPlayerBlock(
          aiPlayers[1]?.name || '', scores[2],
          aiPlayers[1]?.head || [], aiPlayers[1]?.middle || [], aiPlayers[1]?.tail || [],
          '#4f8cff'
        )}
        {/* 右下 */}
        {renderPlayerBlock(
          aiPlayers[2]?.name || '', scores[3],
          aiPlayers[2]?.head || [], aiPlayers[2]?.middle || [], aiPlayers[2]?.tail || [],
          '#4f8cff'
        )}
        {/* 关闭按钮 */}
        <button style={{
          position: 'absolute', right: 18, top: 12, background: 'transparent', border: 'none',
          fontSize: 22, color: '#888', cursor: 'pointer', zIndex: 20
        }} onClick={onClose}>×</button>
      </div>
    </div>
  );
}
