import React from 'react';

// 复用TryPlay中的renderPaiDunCards结构
export default function CompareResultModal({
  open,
  onClose,
  myName = '你',
  aiPlayers = [],
  head,
  middle,
  tail,
  scores = [],
  renderPaiDunCards // 必须传入！直接用TryPlay传递的函数
}) {
  if (!open) return null;

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
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{ textAlign: 'center', borderBottom: '1px solid #eee' }}>
            <div style={{ fontWeight: 700, color: i === 0 ? '#23e67a' : '#4f8cff', marginBottom: 8 }}>
              {i === 0 ? myName : aiPlayers[i - 1]?.name || `AI${i}`}（{scores[i]}分）
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 3 }}>
              {i === 0 ? renderPaiDunCards(head, 'none') : renderPaiDunCards(aiPlayers[i - 1]?.head || [], 'none')}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 3 }}>
              {i === 0 ? renderPaiDunCards(middle, 'none') : renderPaiDunCards(aiPlayers[i - 1]?.middle || [], 'none')}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
              {i === 0 ? renderPaiDunCards(tail, 'none') : renderPaiDunCards(aiPlayers[i - 1]?.tail || [], 'none')}
            </div>
          </div>
        ))}
        <button style={{
          position: 'absolute', right: 18, top: 12, background: 'transparent', border: 'none', fontSize: 22, color: '#888', cursor: 'pointer'
        }} onClick={onClose}>×</button>
      </div>
    </div>
  );
}
