export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'joker';

export interface Card {
  id: string;
  suit: Suit | null; // null for jokers
  rank: Rank;
  value: number; // scoring value
  isFaceUp: boolean;
  specialAbility?: SpecialAbility;
}

export type SpecialAbility = 
  | 'peek-self' // King: Look at one of your own cards
  | 'flip-opponent' // 7: Turn one opponent's card face-up
  | 'swap' // Queen: Swap one of your cards with an opponent's
  | 'double-turn'; // Jack: Take another turn

export interface Player {
  id: string;
  name: string;
  email: string;
  cards: (Card | null)[][]; // n x 3 matrix, null for empty spots
  score: number;
  isHost: boolean;
  isCurrentTurn: boolean;
  hasCalledStop: boolean;
}

export type GameMode = 6 | 9 | 12 | 15 | 18 | 21 | 24 | 27 | 30;

export type GameStatus = 'waiting' | 'starting' | 'playing' | 'awaiting-ability-target' | 'ending' | 'finished';

export interface GameState {
  id: string;
  roomCode: string;
  players: Player[];
  currentPlayerIndex: number;
  deck: Card[];
  discardPile: Card[];
  gameMode: GameMode;
  status: GameStatus;
  activeAbility?: {
    playerId: string;
    ability: SpecialAbility;
    cardId: string;
  } | null;
  winner: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastAction: GameAction | null;
  turnTimeLimit?: number; // optional time limit per turn in seconds
}

export interface GameAction {
  type: 'draw' | 'discard' | 'recall' | 'use-ability' | 'stop' | 'peek';
  playerId: string;
  cardId?: string;
  targetPlayerId?: string;
  targetPosition?: { row: number; col: number };
  sourcePosition?: { row: number; col: number };
  timestamp: Date;
}

export interface GameRoom {
  id: string;
  code: string;
  hostId: string;
  playerIds: string[];
  gameMode: GameMode;
  maxPlayers: number;
  status: 'waiting' | 'in-game' | 'finished';
  createdAt: Date;
  gameId?: string; // Reference to active game
}
