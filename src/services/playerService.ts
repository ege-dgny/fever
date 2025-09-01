import { 
  doc, 
  setDoc, 
  getDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';

const PLAYERS_COLLECTION = 'players';

export interface PlayerData {
  id: string;
  name: string;
  email: string;
  createdAt?: Date;
}

export class PlayerService {
  // Store player data when they join
  static async registerPlayer(playerId: string, name: string, email: string): Promise<void> {
    const playerRef = doc(db, PLAYERS_COLLECTION, playerId);
    
    await setDoc(playerRef, {
      id: playerId,
      name,
      email,
      createdAt: serverTimestamp()
    }, { merge: true }); // Merge to update if exists
  }
  
  // Get player data
  static async getPlayer(playerId: string): Promise<PlayerData | null> {
    const playerRef = doc(db, PLAYERS_COLLECTION, playerId);
    const playerDoc = await getDoc(playerRef);
    
    if (!playerDoc.exists()) {
      return null;
    }
    
    const data = playerDoc.data();
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date()
    };
  }
  
  // Get multiple players
  static async getPlayers(playerIds: string[]): Promise<PlayerData[]> {
    const players: PlayerData[] = [];
    
    for (const playerId of playerIds) {
      const player = await this.getPlayer(playerId);
      if (player) {
        players.push(player);
      }
    }
    
    return players;
  }
}
