import { create } from 'zustand';
import type { Player, GameState, GameRoom } from '../types/game';

interface GameStore {
  // User state
  currentUser: {
    id: string;
    name: string;
    email: string;
  } | null;
  
  // Room state
  currentRoom: GameRoom | null;
  
  // Game state
  gameState: GameState | null;
  
  // UI state
  selectedCard: { row: number; col: number } | null;
  peekedCards: Map<string, boolean>; // Track which cards player has peeked at
  isMyTurn: boolean;
  
  // Actions
  setCurrentUser: (user: { id: string; name: string; email: string } | null) => void;
  setCurrentRoom: (room: GameRoom | null) => void;
  setGameState: (state: GameState | null) => void;
  selectCard: (position: { row: number; col: number } | null) => void;
  setPeekedCard: (cardId: string) => void;
  updateIsMyTurn: (isMyTurn: boolean) => void;
  
  // Game actions
  drawCard: () => void;
  discardCard: (position: { row: number; col: number }) => void;
  recallCard: (positions: { row: number; col: number }[]) => void;
  useAbility: (ability: string, targetData?: any) => void;
  callStop: () => void;
  
  // Utility methods
  getMyPlayer: () => Player | null;
  canPerformAction: () => boolean;
  reset: () => void;
}

const useGameStore = create<GameStore>((set, get) => ({
  // Initial state
  currentUser: null,
  currentRoom: null,
  gameState: null,
  selectedCard: null,
  peekedCards: new Map(),
  isMyTurn: false,
  
  // Actions
  setCurrentUser: (user) => {
    set({ currentUser: user });
    // Save to localStorage for session recovery
    try {
      if (user) {
        localStorage.setItem('fever-current-user', JSON.stringify(user));
      } else {
        localStorage.removeItem('fever-current-user');
      }
    } catch (error) {
      console.error('Failed to save user to localStorage:', error);
    }
  },
  
  setCurrentRoom: (room) => {
    set({ currentRoom: room });
    // Save to localStorage for session recovery
    try {
      if (room) {
        localStorage.setItem('fever-current-room', JSON.stringify(room));
      } else {
        localStorage.removeItem('fever-current-room');
      }
    } catch (error) {
      console.error('Failed to save room to localStorage:', error);
    }
  },
  
  setGameState: (state) => {
    const { currentUser } = get();
    if (state && currentUser) {
      const isMyTurn = state.players[state.currentPlayerIndex]?.id === currentUser.id;
      set({ 
        gameState: state,
        isMyTurn
      });
    } else {
      set({ gameState: state, isMyTurn: false });
    }
  },
  
  selectCard: (position) => set({ selectedCard: position }),
  
  setPeekedCard: (cardId) => set((state) => {
    const newPeekedCards = new Map(state.peekedCards);
    newPeekedCards.set(cardId, true);
    return { peekedCards: newPeekedCards };
  }),
  
  updateIsMyTurn: (isMyTurn) => set({ isMyTurn }),
  
  // Game actions (these will be implemented with Firebase integration)
  drawCard: () => {
    console.log('Drawing card from deck...');
    // Will be implemented with Firebase
  },
  
  discardCard: (position) => {
    console.log('Discarding card at position:', position);
    // Will be implemented with Firebase
  },
  
  recallCard: (positions) => {
    console.log('Recalling cards at positions:', positions);
    // Will be implemented with Firebase
  },
  
  useAbility: (ability, targetData) => {
    console.log('Using ability:', ability, 'with data:', targetData);
    // Will be implemented with Firebase
  },
  
  callStop: () => {
    console.log('Calling stop!');
    // Will be implemented with Firebase
  },
  
  // Utility methods
  getMyPlayer: () => {
    const { gameState, currentUser } = get();
    if (!gameState || !currentUser) return null;
    return gameState.players.find(p => p.id === currentUser.id) || null;
  },
  
  canPerformAction: () => {
    const { isMyTurn, gameState } = get();
    return isMyTurn && gameState?.status === 'playing';
  },
  
  reset: () => set({
    currentUser: null,
    currentRoom: null,
    gameState: null,
    selectedCard: null,
    peekedCards: new Map(),
    isMyTurn: false
  })
}));

export default useGameStore;
