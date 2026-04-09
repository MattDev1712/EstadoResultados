import React from 'react';
import { cardBase } from '../theme';

const Card = ({ children, style = {}, className = '' }) => (
  <div style={{ ...cardBase, ...style }} className={className}>
    {children}
  </div>
);

export default Card;
