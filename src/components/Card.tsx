import React from 'react';
import type { Card as CardType, Suit, SpecialAbility } from '../types/game';
import { Eye, Zap } from 'lucide-react';

interface CardProps {
  card: CardType | null;
  position?: { row: number; col: number };
  isSelected?: boolean;
  isPeekable?: boolean;
  canRecall?: boolean;
  onClick?: () => void;
  showPeek?: boolean;
}

const CardComponent: React.FC<CardProps> = ({ 
  card, 
  isSelected = false, 
  isPeekable = false,
  canRecall = false,
  onClick,
  showPeek = false
}) => {
  if (!card) {
    return (
      <div className="w-20 h-28 border-2 border-dashed border-white/30 rounded-lg" />
    );
  }
  
  const getSuitColor = (suit: Suit | null): string => {
    if (!suit) return 'text-purple-400'; // Joker
    return suit === 'hearts' || suit === 'diamonds' ? 'text-red-500' : 'text-gray-900';
  };
  
  const getSuitSymbol = (suit: Suit | null): string => {
    if (!suit) return ''; // Joker has no suit symbol
    const symbols: Record<Suit, string> = {
      hearts: 'H',
      diamonds: 'D',
      clubs: 'C',
      spades: 'S'
    };
    return symbols[suit];
  };
  
  const getAbilityDescription = (ability?: SpecialAbility): string => {
    switch (ability) {
      case 'peek-self': return 'Look at own card';
      case 'flip-opponent': return "Turn opponent's card";
      case 'swap': return 'Swap with opponent';
      case 'double-turn': return 'Go again';
      default: return '';
    }
  };
  
  const hasAbility = card.specialAbility !== undefined;
  
  return (
    <div
      onClick={onClick}
      className={`
        relative w-20 h-28 rounded-lg shadow-lg cursor-pointer transform transition-all duration-200
        ${isSelected ? 'scale-110 ring-4 ring-yellow-400' : 'hover:scale-105'}
        ${canRecall ? 'ring-2 ring-green-400 animate-pulse' : ''}
        ${card.isFaceUp ? 'bg-white' : 'bg-gradient-to-br from-blue-600 to-purple-600'}
      `}
    >
      {card.isFaceUp ? (
        <div className="h-full flex flex-col items-center justify-center p-2">
          <div className={`text-2xl font-bold ${getSuitColor(card.suit)}`}>
            {card.rank === 'joker' ? 'Joker' : card.rank}
          </div>
          <div className={`text-3xl ${getSuitColor(card.suit)}`}>
            {getSuitSymbol(card.suit)}
          </div>
          {hasAbility && (
            <Zap className="w-4 h-4 text-yellow-500 absolute top-1 right-1" />
          )}
        </div>
      ) : (
        <div className="h-full flex items-center justify-center">
          <div className="text-white text-4xl opacity-20">F</div>
        </div>
      )}
      
      {isPeekable && !card.isFaceUp && (
        <div className="absolute top-1 right-1">
          <Eye className="w-4 h-4 text-white/70" />
        </div>
      )}
      
      {showPeek && !card.isFaceUp && (
        <div className="absolute inset-0 bg-black/80 rounded-lg flex flex-col items-center justify-center text-white p-2">
          <div className="text-xs mb-1">Peeking</div>
          <div className={`text-lg font-bold ${getSuitColor(card.suit)}`}>
            {card.rank === 'joker' ? 'Joker' : card.rank}{getSuitSymbol(card.suit)}
          </div>
          <div className="text-xs mt-1">Value: {card.value}</div>
        </div>
      )}
      
      {/* Show card value and ability on hover for face-up cards */}
      {card.isFaceUp && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-white text-xs p-1 rounded-b-lg opacity-0 hover:opacity-100 transition-opacity">
          <div className="flex justify-between items-center">
            <span>{card.value > 0 ? `+${card.value}` : card.value} pts</span>
            {hasAbility && (
              <span className="text-yellow-300 text-[10px]">{getAbilityDescription(card.specialAbility)}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CardComponent;
