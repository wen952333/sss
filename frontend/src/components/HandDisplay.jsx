// frontend/src/components/HandDisplay.jsx
import React from 'react';
import Card from './Card.jsx'; // <--- 修改导入后缀
import { getHandTypeName } from '../utils/api';

const HandDisplay = ({ label, cards, evaluation, onClick }) => {
  let handTypeInfo = '';
  if (evaluation) {
    if (evaluation.isMisarranged) {
        handTypeInfo = getHandTypeName('MISARRANGED', evaluation);
    } else if (evaluation.specialType) {
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
