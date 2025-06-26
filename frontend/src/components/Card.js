// frontend/src/components/Card.js
import React from 'react';
import { getCardImageUrl } from '../utils/api';

const Card = ({ cardString, onClick, isSelected, isDisabled }) => {
  const imageUrl = getCardImageUrl(cardString);
  const classNames = `card ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`;

  return (
    <img
      src={imageUrl}
      alt={cardString || 'Card'}
      className={classNames}
      onClick={!isDisabled && onClick ? () => onClick(cardString) : undefined}
      style={{ cursor: onClick && !isDisabled ? 'pointer' : 'default' }}
    />
  );
};

export default Card;
