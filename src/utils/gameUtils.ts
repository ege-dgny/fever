import { v4 as uuidv4 } from 'uuid';
import type { Card, Suit, Rank, Player, GameMode, SpecialAbility } from '../types/game';

const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// Special ability mappings based on game rules
const specialAbilityCards: { [key: string]: SpecialAbility } = {
  // 7s - Turn somebody's card face-up
  '7_hearts': 'flip-opponent',
  '7_diamonds': 'flip-opponent',
  '7_clubs': 'flip-opponent',
  '7_spades': 'flip-opponent',
  
  // Queens - Switch cards with someone
  'Q_hearts': 'swap',
  'Q_diamonds': 'swap',
  'Q_clubs': 'swap',
  'Q_spades': 'swap',
  
  // Jacks - Go again (take another turn)
  'J_hearts': 'double-turn',
  'J_diamonds': 'double-turn',
  'J_clubs': 'double-turn',
  'J_spades': 'double-turn',
  
  // Kings - Look at own card
  'K_hearts': 'peek-self',
  'K_diamonds': 'peek-self',
  'K_clubs': 'peek-self',
  'K_spades': 'peek-self',
};

export function getCardValue(rank: Rank): number {
  switch (rank) {
    case 'A': return 1;
    case 'joker': return -1;
    case '10': return 0;
    case 'J':
    case 'Q':
    case 'K': return 15;
    default: return parseInt(rank);
  }
}

export function createDeck(numberOfDecks: number): Card[] {
  const deck: Card[] = [];
  
  for (let deckNum = 0; deckNum < numberOfDecks; deckNum++) {
    // Add regular cards
    for (const suit of suits) {
      for (const rank of ranks) {
        const cardKey = `${rank}_${suit}`;
        const card: Card = {
          id: uuidv4(),
          suit,
          rank,
          value: getCardValue(rank),
          isFaceUp: false,
          specialAbility: specialAbilityCards[cardKey] || undefined
        };
        deck.push(card);
      }
    }
    
    // Add 2 jokers per deck
    for (let i = 0; i < 2; i++) {
      deck.push({
        id: uuidv4(),
        suit: null,
        rank: 'joker',
        value: -1,
        isFaceUp: false
      });
    }
  }
  
  return shuffleDeck(deck);
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function dealCards(deck: Card[], players: Player[], gameMode: GameMode): {
  updatedDeck: Card[];
  playerHands: Map<string, (Card | null)[][]>;
} {
  const cardsPerPlayer = gameMode;
  const rows = cardsPerPlayer / 3;
  const playerHands = new Map<string, (Card | null)[][]>();
  let deckIndex = 0;
  
  for (const player of players) {
    const hand: (Card | null)[][] = [];
    
    for (let row = 0; row < rows; row++) {
      const rowCards: (Card | null)[] = [];
      for (let col = 0; col < 3; col++) {
        if (deckIndex < deck.length) {
          const card = { ...deck[deckIndex] };
          // Bottom row cards can be viewed at the start
          if (row === rows - 1) {
            card.isFaceUp = false; // They can peek but cards stay face down
          }
          rowCards.push(card);
          deckIndex++;
        } else {
          rowCards.push(null);
        }
      }
      hand.push(rowCards);
    }
    
    playerHands.set(player.id, hand);
  }
  
  return {
    updatedDeck: deck.slice(deckIndex),
    playerHands
  };
}

export function calculatePlayerScore(cards: (Card | null)[][]): number {
  let score = 0;
  for (const row of cards) {
    for (const card of row) {
      if (card) {
        score += card.value;
      }
    }
  }
  return score;
}

export function getCardDisplay(card: Card | null): string {
  if (!card) return 'Empty';
  if (!card.isFaceUp) return 'Card';
  
  if (card.rank === 'joker') return 'Joker';
  
  const suitSymbols: Record<Suit, string> = {
    hearts: 'H',
    diamonds: 'D',
    clubs: 'C',
    spades: 'S'
  };
  
  return `${card.rank}${card.suit ? suitSymbols[card.suit] : ''}`;
}

export function canRecallCard(
  trashedCard: Card,
  playerCards: (Card | null)[][]
): { canRecall: boolean; positions: { row: number; col: number }[] } {
  const positions: { row: number; col: number }[] = [];
  
  for (let row = 0; row < playerCards.length; row++) {
    for (let col = 0; col < playerCards[row].length; col++) {
      const card = playerCards[row][col];
      if (card && card.rank === trashedCard.rank && card.suit === trashedCard.suit) {
        positions.push({ row, col });
      }
    }
  }
  
  return {
    canRecall: positions.length > 0,
    positions
  };
}

export function generateRoomCode(): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
}
