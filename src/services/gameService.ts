import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  where,
  getDocs,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  deleteDoc,
  runTransaction
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { GameState, GameRoom, Player, GameMode, Card, SpecialAbility, Rank } from '../types/game';
import { createDeck, dealCards, generateRoomCode, calculatePlayerScore, getCardValue } from '../utils/gameUtils';
import { v4 as uuidv4 } from 'uuid';

// Helper: reconstruct players' hands from flattened Firestore representation to 2D arrays
function reconstructPlayersHands2D(game: any): Player[] {
  const rows = Math.max(1, Math.floor((game.gameMode || 6) / 3));
  return (game.players as any[]).map((player: any) => {
    const cards2D: (Card | null)[][] = Array.from({ length: rows }, () => [null, null, null]);
    // If already 2D, ensure values exist and return
    if (Array.isArray(player.cards) && Array.isArray(player.cards[0])) {
      const fixed = (player.cards as (Card | null)[][]).map(r => r.map(c => (c ? normalizeCard({ ...c }) : c)));
      return { ...player, cards: fixed } as Player;
    }
    // Flattened form: array of { card, row, col }
    if (Array.isArray(player.cards)) {
      player.cards.forEach((item: any) => {
        if (item && item.row !== undefined && item.col !== undefined) {
          const c = item.card || null;
          cards2D[item.row][item.col] = c ? normalizeCard({ ...c }) : c;
        }
      });
    }
    return {
      ...player,
      cards: cards2D,
    } as Player;
  });
}

function toFirestoreCard(c: any): any {
  if (!c) return null;
  
  // Check if we're receiving a corrupted card (only log in development)
  if ((!c.id || !c.rank) && process.env.NODE_ENV === 'development') {
    console.error('CRITICAL: toFirestoreCard received corrupted card:', c);
  }
  
  // Preserve original card properties - don't override them
  const originalRank = c.rank;
  const originalValue = c.value;
  const originalSuit = c.suit;
  const originalId = c.id;
  
  // Only compute missing values, don't override existing ones
  let finalRank = originalRank;
  let finalValue = Number(originalValue);
  
  // If value is missing but rank exists, compute value from rank
  if (!Number.isFinite(finalValue) && finalRank) {
    finalValue = getCardValue(finalRank as Rank);
  }
  
  // If rank is missing but value exists, compute rank from value (fallback only)
  if (!finalRank && Number.isFinite(finalValue)) {
    if (finalValue === -1) finalRank = 'joker';
    else if (finalValue === 0) finalRank = '10';
    else if (finalValue === 1) finalRank = 'A';
    else if (finalValue === 15) finalRank = 'K';
    else finalRank = String(finalValue);
  }
  
  const result = {
    id: originalId,
    suit: originalSuit ?? null,
    rank: finalRank,
    value: Number.isFinite(finalValue) ? finalValue : (finalRank ? getCardValue(finalRank as Rank) : 0),
    isFaceUp: !!c.isFaceUp,
    specialAbility: c.specialAbility
  };
  
  // Log result in development only
  if ((!result.id || !result.rank) && process.env.NODE_ENV === 'development') {
    console.error('CRITICAL: About to write corrupted card to Firestore:', result);
  }
  
  return result;
}

// Helper: flatten 2D hands back for Firestore
function flattenPlayersHandsForFirestore(players: Player[]): any[] {
  return players.map(player => ({
    ...player,
    cards: player.cards.flat().map((card, index) => {
      // Check if we're getting metadata objects instead of cards (development only)
      if (card && typeof card === 'object' && 'card' in card && 'row' in card && 'col' in card) {
        if (process.env.NODE_ENV === 'development') {
          console.error('ERROR: Card in 2D array is metadata object, not actual card:', card);
        }
        // Extract the actual card from the metadata
        return {
          card: toFirestoreCard(card.card),
          row: Math.floor(index / 3),
          col: index % 3
        };
      }
      
      return {
        card: toFirestoreCard(card),
        row: Math.floor(index / 3),
        col: index % 3
      };
    })
  }));
}

const ROOMS_COLLECTION = 'rooms';
const GAMES_COLLECTION = 'games';

// Helper function to remove undefined values for Firestore
function cleanForFirestore(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => cleanForFirestore(item));
  }
  
  if (typeof obj === 'object' && obj !== null) {
    const cleaned: any = {};
    for (const key in obj) {
      const value = obj[key];
      if (value !== undefined) {
        cleaned[key] = cleanForFirestore(value);
      }
    }
    return cleaned;
  }
  
  return obj;
}

function normalizeCard(c: any): Card {
  if (!c) return c;
  
  // If card is missing critical properties, it's corrupted - reject it
  if (!c.id || !c.rank) {
    if (process.env.NODE_ENV === 'development') {
      console.error('CRITICAL: normalizeCard received corrupted card missing id/rank:', c);
    }
    // Return a placeholder to prevent crashes, but this shouldn't happen
    return {
      id: 'corrupted-' + Math.random(),
      rank: 'A', // Use a valid rank to prevent TypeScript errors
      suit: null,
      value: 0,
      isFaceUp: !!c.isFaceUp,
      specialAbility: undefined
    } as Card;
  }
  
  // Preserve original properties, only fill in missing ones
  const normalized = { ...c };
  
  // Ensure value is a number, but don't override if already set
  if (typeof normalized.value !== 'number' || !Number.isFinite(normalized.value)) {
    if (normalized.rank) {
      normalized.value = getCardValue(normalized.rank);
    } else {
      normalized.value = 0; // fallback
    }
  }
  
  // Ensure isFaceUp is boolean
  normalized.isFaceUp = !!normalized.isFaceUp;
  
  return normalized as Card;
}

export class GameService {
  // Room Management
  static async createRoom(hostId: string, _hostName: string, gameMode: GameMode): Promise<GameRoom> {
    const roomCode = generateRoomCode();
    const roomId = uuidv4();
    
    const room: GameRoom = {
      id: roomId,
      code: roomCode,
      hostId,
      playerIds: [hostId],
      gameMode,
      maxPlayers: 4, // Can be configurable
      status: 'waiting',
      createdAt: new Date()
    };
    
    await setDoc(doc(db, ROOMS_COLLECTION, roomId), {
      ...room,
      createdAt: serverTimestamp()
    });
    
    return room;
  }
  
  static async joinRoom(roomCode: string, playerId: string): Promise<GameRoom | null> {
    const q = query(collection(db, ROOMS_COLLECTION), where('code', '==', roomCode));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    const roomDoc = querySnapshot.docs[0];
    const room = roomDoc.data() as GameRoom;
    
    if (room.status !== 'waiting') {
      throw new Error('Game has already started');
    }
    
    if (room.playerIds.length >= room.maxPlayers) {
      throw new Error('Room is full');
    }
    
    if (!room.playerIds.includes(playerId)) {
      await updateDoc(doc(db, ROOMS_COLLECTION, room.id), {
        playerIds: arrayUnion(playerId)
      });
      room.playerIds.push(playerId);
    }
    
    return room;
  }
  
  static async leaveRoom(roomId: string, playerId: string): Promise<void> {
    const roomRef = doc(db, ROOMS_COLLECTION, roomId);
    const roomDoc = await getDoc(roomRef);
    
    if (!roomDoc.exists()) {
      throw new Error('Room not found');
    }
    
    const room = roomDoc.data() as GameRoom;
    
    if (room.hostId === playerId) {
      // If host leaves, delete the room
      await deleteDoc(roomRef);
    } else {
      await updateDoc(roomRef, {
        playerIds: arrayRemove(playerId)
      });
    }
  }
  
  static subscribeToRoom(roomId: string, callback: (room: GameRoom | null) => void): () => void {
    const roomRef = doc(db, ROOMS_COLLECTION, roomId);
    
    const unsubscribe = onSnapshot(roomRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        const room: GameRoom = {
          id: doc.id,
          code: data.code,
          hostId: data.hostId,
          playerIds: data.playerIds,
          gameMode: data.gameMode,
          maxPlayers: data.maxPlayers,
          status: data.status,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt?.seconds * 1000 || Date.now()),
          gameId: data.gameId
        };
        callback(room);
      } else {
        callback(null);
      }
    });
    
    return unsubscribe;
  }
  
  // Game Management
  static async startGame(room: GameRoom, players: { id: string; name: string; email: string }[]): Promise<GameState> {
    const gameId = uuidv4();
    const numberOfDecks = players.length * 2;
    const deck = createDeck(numberOfDecks);
    
    // Initialize players
    const gamePlayers: Player[] = players.map((p, index) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      cards: [],
      score: 0,
      isHost: p.id === room.hostId,
      isCurrentTurn: index === 0,
      hasCalledStop: false
    }));
    
    // Deal cards
    const { updatedDeck, playerHands } = dealCards(deck, gamePlayers, room.gameMode);
    
    // Assign cards to players
    gamePlayers.forEach(player => {
      player.cards = playerHands.get(player.id) || [];
      player.cards = player.cards.map(r => r.map(c => (c ? normalizeCard({ ...c }) : c)));
    });
    
    const gameState: GameState = {
      id: gameId,
      roomCode: room.code,
      players: gamePlayers,
      currentPlayerIndex: 0,
      deck: updatedDeck,
      discardPile: [],
      gameMode: room.gameMode,
      status: 'starting',
      winner: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastAction: null
    };
    
    // Convert nested arrays to a Firestore-compatible format
    const firestoreGameState = {
      id: gameState.id,
      roomCode: gameState.roomCode,
      players: gameState.players.map(player => ({
        ...player,
        // Flatten the 2D array into a 1D array with metadata
        cards: player.cards.flat().map((card, index) => ({
          card: toFirestoreCard(card),
          row: Math.floor(index / 3),
          col: index % 3
        }))
      })),
      currentPlayerIndex: gameState.currentPlayerIndex,
      deck: (gameState.deck || []).map(c => toFirestoreCard(c)),
      discardPile: (gameState.discardPile || []).map(c => toFirestoreCard(c)),
      gameMode: gameState.gameMode,
      status: gameState.status,
      winner: gameState.winner || null,
      lastAction: gameState.lastAction || null,
      turnTimeLimit: gameState.turnTimeLimit || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    // Save game to Firestore (clean undefined values)
    await setDoc(doc(db, GAMES_COLLECTION, gameId), cleanForFirestore(firestoreGameState));
    
    // Update room with game reference
    await updateDoc(doc(db, ROOMS_COLLECTION, room.id), {
      status: 'in-game',
      gameId: gameId
    });
    
    // After a delay, change status to playing
    setTimeout(async () => {
      await updateDoc(doc(db, GAMES_COLLECTION, gameId), cleanForFirestore({
        status: 'playing',
        updatedAt: serverTimestamp()
      }));
    }, 20000); // 20 seconds for players to peek at bottom row
    
    return gameState;
  }
  
  static subscribeToGame(gameId: string, callback: (game: GameState | null) => void): () => void {
    const gameRef = doc(db, GAMES_COLLECTION, gameId);
    
    const unsubscribe = onSnapshot(gameRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // Convert flattened cards array back to 2D array
        const players = data.players.map((player: any) => {
          // Handle empty cards array
          if (!player.cards || player.cards.length === 0) {
            return {
              ...player,
              cards: []
            } as Player;
          }
          
          const rows = Math.max(...player.cards.map((c: any) => c.row)) + 1;
          const cards: (Card | null)[][] = [];
          
          // Initialize empty 2D array
          for (let i = 0; i < rows; i++) {
            cards.push([null, null, null]);
          }
          
          // Place cards back in their positions
          player.cards.forEach((item: any) => {
            if (item && item.row !== undefined && item.col !== undefined) {
              const c = item.card || null;
              cards[item.row][item.col] = c ? normalizeCard({ ...c }) : c;
            }
          });
          
          return {
            ...player,
            cards
          } as Player;
        });
        
        const game: GameState = {
          id: docSnap.id,
          roomCode: data.roomCode,
          players,
          currentPlayerIndex: data.currentPlayerIndex,
          deck: data.deck || [],
          discardPile: data.discardPile || [],
          gameMode: data.gameMode,
          status: data.status,
          activeAbility: data.activeAbility || null,
          winner: data.winner,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt?.seconds * 1000 || Date.now()),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt?.seconds * 1000 || Date.now()),
          lastAction: data.lastAction || null,
          turnTimeLimit: data.turnTimeLimit || null
        };
        callback(game);
      } else {
        callback(null);
      }
    });
    
    return unsubscribe;
  }
  
  // Game Actions
  static async drawFromDeck(gameId: string, playerId: string): Promise<Card | null> {
    const gameRef = doc(db, GAMES_COLLECTION, gameId);
    const gameDoc = await getDoc(gameRef);
    
    if (!gameDoc.exists()) {
      throw new Error('Game not found');
    }
    
    const game = gameDoc.data() as GameState;
    
    if (game.deck.length === 0) {
      return null;
    }
    
    const drawnCard = game.deck[0];
    const updatedDeck = game.deck.slice(1);
    
    await updateDoc(gameRef, cleanForFirestore({
      deck: updatedDeck,
      lastAction: {
        type: 'draw',
        playerId,
        cardId: drawnCard.id,
        timestamp: serverTimestamp()
      },
      updatedAt: serverTimestamp()
    }));
    
    return drawnCard;
  }
  
  static async discardAndReplace(
    gameId: string,
    playerId: string,
    newCardFromDraw: Card,
    position: { row: number; col: number }
  ): Promise<void> {
    const gameRef = doc(db, GAMES_COLLECTION, gameId);
    try {
      await runTransaction(db, async (transaction) => {
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) { throw "Game not found!"; }

        const raw = gameDoc.data() as any;
        const players2D = reconstructPlayersHands2D(raw);
        const game = { ...raw, players: players2D } as GameState;

        const playerIndex = game.players.findIndex(p => p.id === playerId);
        if (playerIndex === -1) { throw "Player not found!"; }

        const rows = game.players[playerIndex].cards.length;
        if (position.row < 0 || position.row >= rows || position.col < 0 || position.col >= 3) {
          throw "Invalid replace position";
        }

        const replacedCard = game.players[playerIndex].cards[position.row][position.col];
        if (!replacedCard) { throw "Cannot replace an empty card slot."; }

        const newPlayers = game.players.map(p => ({ ...p, cards: p.cards.map(row => [...row]) }));
        newPlayers[playerIndex].cards[position.row][position.col] = { ...newCardFromDraw, isFaceUp: false };

        const cardToDiscard = { ...replacedCard, isFaceUp: true };
        const newDiscardPile = [cardToDiscard, ...(game.discardPile || [])];

        let newStatus = game.status;
        let newActiveAbility = game.activeAbility;
        let newCurrentPlayerIndex = game.currentPlayerIndex;

        const ability = cardToDiscard.specialAbility;
        if (ability && ability === 'double-turn') {
          // Jack: Player goes again
        } else if (ability) {
          newStatus = 'awaiting-ability-target';
          newActiveAbility = { playerId, ability, cardId: cardToDiscard.id };
        } else {
          newCurrentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
        }

        newPlayers.forEach((p, i) => { p.isCurrentTurn = i === newCurrentPlayerIndex; });

        const firestorePlayers = flattenPlayersHandsForFirestore(newPlayers);

        const updatePayload = {
          players: firestorePlayers,
          discardPile: newDiscardPile.map(c => toFirestoreCard(c)),
          currentPlayerIndex: newCurrentPlayerIndex,
          status: newStatus,
          activeAbility: newActiveAbility || null,
          lastAction: {
            type: 'discard',
            playerId,
            cardId: cardToDiscard.id,
            targetPosition: position,
            timestamp: serverTimestamp()
          },
          updatedAt: serverTimestamp()
        };

        transaction.update(gameRef, cleanForFirestore(updatePayload));
      });
    } catch (e) {
      console.error("Replace and discard transaction failed: ", e);
      throw e;
    }
  }

  static async discardDrawnCard(
    gameId: string,
    playerId: string,
    cardToDiscard: Card
  ): Promise<void> {
    const gameRef = doc(db, GAMES_COLLECTION, gameId);
    try {
      await runTransaction(db, async (transaction) => {
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) { throw "Game not found!"; }

        const raw = gameDoc.data() as any;
        const players2D = reconstructPlayersHands2D(raw);
        const game = { ...raw, players: players2D } as GameState;
        
        const discardedCard = { ...cardToDiscard, isFaceUp: true };
        const newDiscardPile = [discardedCard, ...(game.discardPile || [])];

        let newStatus = game.status;
        let newActiveAbility = game.activeAbility;
        let newCurrentPlayerIndex = game.currentPlayerIndex;

        const ability = discardedCard.specialAbility;
        if (ability && ability === 'double-turn') {
          // Jack: Player goes again
        } else if (ability) {
          newStatus = 'awaiting-ability-target';
          newActiveAbility = { playerId, ability, cardId: discardedCard.id };
        } else {
          newCurrentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
        }

        const newPlayers = [...game.players];
        newPlayers.forEach((p, i) => { p.isCurrentTurn = i === newCurrentPlayerIndex; });

        const firestorePlayers = flattenPlayersHandsForFirestore(newPlayers);

        const updatePayload = {
          players: firestorePlayers,
          discardPile: newDiscardPile.map(c => toFirestoreCard(c)),
          currentPlayerIndex: newCurrentPlayerIndex,
          status: newStatus,
          activeAbility: newActiveAbility || null,
          lastAction: {
            type: 'discard',
            playerId,
            cardId: cardToDiscard.id,
            timestamp: serverTimestamp()
          },
          updatedAt: serverTimestamp()
        };

        transaction.update(gameRef, cleanForFirestore(updatePayload));
      });
    } catch (e) {
      console.error("Discard drawn card transaction failed: ", e);
      throw e;
    }
  }
  
  static async executeAbility(
    gameId: string,
    ability: SpecialAbility,
    actingPlayerId: string,
    targets: {
      ownCardPosition?: { row: number; col: number };
      opponentPlayerId?: string;
      opponentCardPosition?: { row: number; col: number };
    }
  ): Promise<void> {
    const gameRef = doc(db, 'games', gameId);
    
    try {
      await runTransaction(db, async (transaction) => {
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) {
          throw new Error("Game not found!");
        }
        
        const raw = gameDoc.data() as any;
        const players2D = reconstructPlayersHands2D(raw);
        const game = { ...raw, players: players2D } as GameState;
        
        // --- Apply Ability Logic ---
        if (ability === 'flip-opponent' && targets.opponentPlayerId && targets.opponentCardPosition) {
          const opponentIndex = game.players.findIndex(p => p.id === targets.opponentPlayerId);
          if (opponentIndex !== -1) {
            const { row, col } = targets.opponentCardPosition;
            if (row >= 0 && row < game.players[opponentIndex].cards.length && col >= 0 && col < 3) {
              const card = game.players[opponentIndex].cards[row][col];
              if (card) {
                card.isFaceUp = true;
              }
            }
          }
        }
        
        if (ability === 'swap' && targets.ownCardPosition && targets.opponentPlayerId && targets.opponentCardPosition) {
          const playerIndex = game.players.findIndex(p => p.id === actingPlayerId);
          const opponentIndex = game.players.findIndex(p => p.id === targets.opponentPlayerId);
          
          if (playerIndex !== -1 && opponentIndex !== -1) {
            const { row: ownRow, col: ownCol } = targets.ownCardPosition;
            const { row: oppRow, col: oppCol } = targets.opponentCardPosition;

            if (
              ownRow >= 0 && ownRow < game.players[playerIndex].cards.length && ownCol >= 0 && ownCol < 3 &&
              oppRow >= 0 && oppRow < game.players[opponentIndex].cards.length && oppCol >= 0 && oppCol < 3
            ) {
              const ownCard = game.players[playerIndex].cards[ownRow][ownCol];
              const opponentCard = game.players[opponentIndex].cards[oppRow][oppCol];
              
              // Perform the swap (cards can be face-up or face-down)
              game.players[playerIndex].cards[ownRow][ownCol] = opponentCard;
              game.players[opponentIndex].cards[oppRow][oppCol] = ownCard;
            }
          }
        }

        // King's peek is client-side; advancing turn happens here after client calls executeAbility.
        
        // --- Reset State and Advance Turn ---
        const nextIndex = (game.currentPlayerIndex + 1) % game.players.length;
        game.status = 'playing';
        game.activeAbility = null;
        game.currentPlayerIndex = nextIndex;
        
        // Update current turn flags
        game.players.forEach((p, i) => {
          p.isCurrentTurn = i === nextIndex;
        });
        
        // Convert players array to Firestore-compatible format before updating
        const firestorePlayers = flattenPlayersHandsForFirestore(game.players);
        
        transaction.update(gameRef, cleanForFirestore({
          players: firestorePlayers,
          status: game.status,
          activeAbility: game.activeAbility,
          currentPlayerIndex: game.currentPlayerIndex,
          lastAction: {
            type: 'use-ability',
            playerId: actingPlayerId,
            timestamp: serverTimestamp()
          },
          updatedAt: serverTimestamp()
        }));
      });
    } catch (e) {
      console.error("Ability execution failed: ", e);
      throw e;
    }
  }

  static async pickFromDiscard(gameId: string, _playerId: string): Promise<Card | null> {
    const gameRef = doc(db, GAMES_COLLECTION, gameId);
    const gameDoc = await getDoc(gameRef);
    
    if (!gameDoc.exists()) {
      throw new Error('Game not found');
    }
    
    const game = gameDoc.data() as GameState;
    
    if (game.discardPile.length === 0) {
      return null;
    }
    
    const pickedCard = game.discardPile[0];
    const updatedDiscardPile = game.discardPile.slice(1);
    
    await updateDoc(gameRef, cleanForFirestore({
      discardPile: updatedDiscardPile.map(c => toFirestoreCard(c)),
      updatedAt: serverTimestamp()
    }));
    
    return pickedCard;
  }
  
  static async recallCards(
    gameId: string, 
    playerId: string, 
    positions: { row: number; col: number }[]
  ): Promise<void> {
    const gameRef = doc(db, GAMES_COLLECTION, gameId);
    const gameDoc = await getDoc(gameRef);
    
    if (!gameDoc.exists()) {
      throw new Error('Game not found');
    }
    
    const game = gameDoc.data() as GameState;
    const playerIndex = game.players.findIndex(p => p.id === playerId);
    
    if (playerIndex === -1) {
      throw new Error('Player not found');
    }
    
    // Remove cards at specified positions and add to discard
    const recalledCards: Card[] = [];
    positions.forEach(pos => {
      const card = game.players[playerIndex].cards[pos.row][pos.col];
      if (card) {
        card.isFaceUp = true;
        recalledCards.push(card);
        game.players[playerIndex].cards[pos.row][pos.col] = null;
      }
    });
    
    // Add to discard pile
    game.discardPile.unshift(...recalledCards);
    
    // Convert players array to Firestore-compatible format
    const firestorePlayers = game.players.map(player => ({
      ...player,
      cards: player.cards.flat().map((card, index) => ({
        card: toFirestoreCard(card),
        row: Math.floor(index / 3),
        col: index % 3
      }))
    }));
    
    await updateDoc(gameRef, cleanForFirestore({
      players: firestorePlayers,
      discardPile: game.discardPile,
      lastAction: {
        type: 'recall',
        playerId,
        timestamp: serverTimestamp()
      },
      updatedAt: serverTimestamp()
    }));
  }
  
  static async callStop(gameId: string, playerId: string): Promise<void> {
    const gameRef = doc(db, GAMES_COLLECTION, gameId);
    const gameDoc = await getDoc(gameRef);
    
    if (!gameDoc.exists()) {
      throw new Error('Game not found');
    }
    
    const rawGame = gameDoc.data() as any;
    // Properly reconstruct 2D arrays from Firestore data
    const players2D = reconstructPlayersHands2D(rawGame);
    const game = { ...rawGame, players: players2D } as GameState;
    
    const playerIndex = game.players.findIndex(p => p.id === playerId);
    
    if (playerIndex === -1) {
      throw new Error('Player not found');
    }
    
    game.players[playerIndex].hasCalledStop = true;
    game.status = 'ending';
    
    // Use the flattenPlayersHandsForFirestore helper to properly convert 2D arrays
    const firestorePlayers = flattenPlayersHandsForFirestore(game.players);
    
    await updateDoc(gameRef, cleanForFirestore({
      players: firestorePlayers,
      status: 'ending',
      lastAction: {
        type: 'stop',
        playerId,
        timestamp: serverTimestamp()
      },
      updatedAt: serverTimestamp()
    }));
    
    // End game after allowing other players one more turn
    setTimeout(async () => {
      await this.endGame(gameId);
    }, 5000);
  }
  
  static async endGame(gameId: string): Promise<void> {
    const gameRef = doc(db, GAMES_COLLECTION, gameId);
    try {
      await runTransaction(db, async (transaction) => {
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) {
          throw new Error('Game not found');
        }

        const raw = gameDoc.data() as any;
        const players2D = reconstructPlayersHands2D(raw);
        const game = { ...raw, players: players2D } as GameState;

        // Reveal all cards and calculate scores
        game.players.forEach((player) => {
          player.cards.forEach((row) => {
            row.forEach((card) => {
              if (card) card.isFaceUp = true;
            });
          });
          player.score = calculatePlayerScore(player.cards);
        });

        // Determine winner (lowest score)
        const winner = game.players.reduce((prev, current) =>
          prev.score < current.score ? prev : current
        );

        const firestorePlayers = flattenPlayersHandsForFirestore(game.players);

        transaction.update(gameRef, cleanForFirestore({
          players: firestorePlayers,
          status: 'finished',
          winner: winner.id,
          updatedAt: serverTimestamp()
        }));
      });
    } catch (e) {
      console.error('endGame failed:', e);
      throw e;
    }
  }
}
