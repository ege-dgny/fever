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
import type { GameState, GameRoom, Player, GameMode, Card, SpecialAbility } from '../types/game';
import { createDeck, dealCards, generateRoomCode, calculatePlayerScore } from '../utils/gameUtils';
import { v4 as uuidv4 } from 'uuid';

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
          card: card || null,
          row: Math.floor(index / 3),
          col: index % 3
        }))
      })),
      currentPlayerIndex: gameState.currentPlayerIndex,
      deck: gameState.deck || [],
      discardPile: gameState.discardPile || [],
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
    }, 60000); // 60 seconds (1 minute) for players to peek at bottom row
    
    return gameState;
  }
  
  static subscribeToGame(gameId: string, callback: (game: GameState | null) => void): () => void {
    const gameRef = doc(db, GAMES_COLLECTION, gameId);
    
    const unsubscribe = onSnapshot(gameRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        
        // Convert flattened cards array back to 2D array
        const players = data.players.map((player: any) => {
          // Handle empty cards array
          if (!player.cards || player.cards.length === 0) {
            return {
              ...player,
              cards: []
            };
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
              cards[item.row][item.col] = item.card || null;
            }
          });
          
          return {
            ...player,
            cards
          };
        });
        
        const game: GameState = {
          id: doc.id,
          roomCode: data.roomCode,
          players,
          currentPlayerIndex: data.currentPlayerIndex,
          deck: data.deck || [],
          discardPile: data.discardPile || [],
          gameMode: data.gameMode,
          status: data.status,
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
  
  static async discardDrawnCard(
    gameId: string,
    playerId: string,
    cardToDiscard: Card
  ): Promise<void> {
    const gameRef = doc(db, GAMES_COLLECTION, gameId);
    const gameDoc = await getDoc(gameRef);
    
    if (!gameDoc.exists()) {
      throw new Error('Game not found');
    }
    
    const game = gameDoc.data() as GameState;
    
    // Add the drawn card to discard pile (face-up)
    const discardedCard = { ...cardToDiscard, isFaceUp: true };
    game.discardPile.unshift(discardedCard);
    
    // Check for special ability and update game state accordingly
    const ability = discardedCard.specialAbility;
    if (ability) {
      if (ability === 'double-turn') {
        // Jack: Don't advance turn, player goes again.
        // We simply don't advance the nextPlayerIndex.
      } else {
        // 7, Q, K: Await player action for ability
        game.status = 'awaiting-ability-target';
        game.activeAbility = {
          playerId: playerId,
          ability: ability,
          cardId: discardedCard.id,
        };
      }
    } else {
      // No ability, advance turn as normal
      game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
    }
    
    // Update current turn flags
    game.players.forEach((p, i) => {
      p.isCurrentTurn = i === game.currentPlayerIndex;
    });
    
    // Convert players array to Firestore-compatible format
    const firestorePlayers = game.players.map(player => ({
      ...player,
      cards: player.cards.flat().map((card, index) => ({
        card: card,
        row: Math.floor(index / 3),
        col: index % 3
      }))
    }));
    
    await updateDoc(gameRef, cleanForFirestore({
      players: firestorePlayers,
      discardPile: game.discardPile,
      currentPlayerIndex: game.currentPlayerIndex,
      status: game.status,
      activeAbility: game.activeAbility || null,
      lastAction: {
        type: 'discard',
        playerId,
        cardId: cardToDiscard.id,
        timestamp: serverTimestamp()
      },
      updatedAt: serverTimestamp()
    }));
  }
  
  static async discardAndReplace(
    gameId: string, 
    playerId: string, 
    cardToDiscard: Card,
    position: { row: number; col: number }
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
    
    // Get the card being replaced
    const replacedCard = game.players[playerIndex].cards[position.row][position.col];
    
    // Update player's cards (the new card stays face down in player's hand)
    const newCard = { ...cardToDiscard, isFaceUp: false };
    game.players[playerIndex].cards[position.row][position.col] = newCard;
    
    // Add replaced card to discard pile if it exists (face-up)
    if (replacedCard) {
      const discardedCard = { ...replacedCard, isFaceUp: true };
      game.discardPile.unshift(discardedCard);

      // Check for special ability and update game state accordingly
      const ability = discardedCard.specialAbility;
      if (ability) {
        if (ability === 'double-turn') {
          // Jack: Don't advance turn, player goes again.
        } else {
          // 7, Q, K: Await player action for ability
          game.status = 'awaiting-ability-target';
          game.activeAbility = {
            playerId: playerId,
            ability: ability,
            cardId: discardedCard.id,
          };
        }
      } else {
        // No ability, advance turn as normal
        game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
      }
    } else {
      // No card was replaced (shouldn't happen in this function), advance turn
      game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
    }
    
    // Update current turn flags
    game.players.forEach((p, i) => {
      p.isCurrentTurn = i === game.currentPlayerIndex;
    });
    
    // Convert players array to Firestore-compatible format
    const firestorePlayers = game.players.map(player => ({
      ...player,
      cards: player.cards.flat().map((card, index) => ({
        card: card,
        row: Math.floor(index / 3),
        col: index % 3
      }))
    }));
    
    await updateDoc(gameRef, cleanForFirestore({
      players: firestorePlayers,
      discardPile: game.discardPile,
      currentPlayerIndex: game.currentPlayerIndex,
      status: game.status,
      activeAbility: game.activeAbility || null,
      lastAction: {
        type: 'discard',
        playerId,
        cardId: cardToDiscard.id,
        targetPosition: position,
        timestamp: serverTimestamp()
      },
      updatedAt: serverTimestamp()
    }));
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
        
        const game = gameDoc.data() as GameState;
        
        // --- Apply Ability Logic ---
        if (ability === 'flip-opponent' && targets.opponentPlayerId && targets.opponentCardPosition) {
          const opponentIndex = game.players.findIndex(p => p.id === targets.opponentPlayerId);
          if (opponentIndex !== -1) {
            const card = game.players[opponentIndex].cards[targets.opponentCardPosition.row][targets.opponentCardPosition.col];
            if (card) {
              card.isFaceUp = true;
            }
          }
        }
        
        if (ability === 'swap' && targets.ownCardPosition && targets.opponentPlayerId && targets.opponentCardPosition) {
          const playerIndex = game.players.findIndex(p => p.id === actingPlayerId);
          const opponentIndex = game.players.findIndex(p => p.id === targets.opponentPlayerId);
          
          if (playerIndex !== -1 && opponentIndex !== -1) {
            const ownCard = game.players[playerIndex].cards[targets.ownCardPosition.row][targets.ownCardPosition.col];
            const opponentCard = game.players[opponentIndex].cards[targets.opponentCardPosition.row][targets.opponentCardPosition.col];
            
            // Perform the swap
            game.players[playerIndex].cards[targets.ownCardPosition.row][targets.ownCardPosition.col] = opponentCard;
            game.players[opponentIndex].cards[targets.opponentCardPosition.row][targets.opponentCardPosition.col] = ownCard;
          }
        }

        // King's peek is client-side, this call just advances the turn.
        
        // --- Reset State and Advance Turn ---
        game.status = 'playing';
        game.activeAbility = null;
        game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
        
        // Update current turn flags
        game.players.forEach((p, i) => {
          p.isCurrentTurn = i === game.currentPlayerIndex;
        });
        
        // Convert players array to Firestore-compatible format before updating
        const firestorePlayers = game.players.map(player => ({
          ...player,
          cards: player.cards.flat().map((card, index) => ({
            card: card,
            row: Math.floor(index / 3),
            col: index % 3
          }))
        }));
        
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
      discardPile: updatedDiscardPile,
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
        card: card,
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
    
    const game = gameDoc.data() as GameState;
    const playerIndex = game.players.findIndex(p => p.id === playerId);
    
    if (playerIndex === -1) {
      throw new Error('Player not found');
    }
    
    game.players[playerIndex].hasCalledStop = true;
    game.status = 'ending';
    
    // Convert players array to Firestore-compatible format
    const firestorePlayers = game.players.map(player => ({
      ...player,
      cards: player.cards.flat().map((card, index) => ({
        card: card,
        row: Math.floor(index / 3),
        col: index % 3
      }))
    }));
    
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
    const gameDoc = await getDoc(gameRef);
    
    if (!gameDoc.exists()) {
      throw new Error('Game not found');
    }
    
    const game = gameDoc.data() as GameState;
    
    // Calculate scores
    game.players.forEach(player => {
      // Reveal all cards
      player.cards.forEach(row => {
        row.forEach(card => {
          if (card) card.isFaceUp = true;
        });
      });
      player.score = calculatePlayerScore(player.cards);
    });
    
    // Determine winner (lowest score)
    const winner = game.players.reduce((prev, current) => 
      prev.score < current.score ? prev : current
    );
    
    // Convert players array to Firestore-compatible format
    const firestorePlayers = game.players.map(player => ({
      ...player,
      cards: player.cards.flat().map((card, index) => ({
        card: card,
        row: Math.floor(index / 3),
        col: index % 3
      }))
    }));
    
    await updateDoc(gameRef, cleanForFirestore({
      players: firestorePlayers,
      status: 'finished',
      winner: winner.id,
      updatedAt: serverTimestamp()
    }));
  }
}
