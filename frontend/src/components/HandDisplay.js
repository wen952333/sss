// frontend/src/components/HandDisplay.js
import React from 'react';
import Card from './Card';
import { getHandTypeName } from '../utils/api';

const HandDisplay = ({ label, cards, evaluation, onClick }) => {
  // evaluation might be like: { type: 'PAIR', name: 'Pair', rank_values: [...], display_cards: [...] }
  // or for misarranged hands: { isMisarranged: true, specialType: 'MISARRANGED' }
  let handTypeInfo = '';
  if (evaluation) {
    if (evaluation.isMisarranged) {
        handTypeInfo = getHandTypeName('MISARRANGED', evaluation);
    } else if (evaluation.specialType) { // For 13-card specials shown at player level
        handTypeInfo = getHandTypeName(evaluation.specialType, evaluation);
    }
     else if (evaluation.type) {
        handTypeInfo = getHandTypeName(evaluation.type, evaluation);
    }
  }


  return (
    <div className="hand-area" onClick={onClick} style={onClick ? {cursor: 'pointer'} : {}}>
      <h4>{label} ({cards?.length || 0} 张) {handTypeInfo && `- ${handTypeInfo}`}</h4>
      {cards && cards.map((cardStr, index) => (
        <Card key={index} cardString={cardStr} />
      ))}
      {(!cards || cards.length === 0) && <p style={{fontSize: '0.8em', color: '#aaa'}}>点击此处放置</p>}
    </div>
  );
};

export default HandDisplay;
