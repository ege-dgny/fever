import { GameService } from '../services/gameService';
import useGameStore from '../store/gameStore';
import toast from 'react-hot-toast';

export class SessionRecovery {
  /**
   * Attempts to recover the user's game session
   * This includes reconnecting to their current room and game
   */
  static async recoverSession(): Promise<boolean> {
    const { currentUser, currentRoom, setCurrentRoom, setGameState } = useGameStore.getState();
    
    if (!currentUser) {
      console.log('No user to recover session for');
      return false;
    }

    console.log('Attempting to recover session for user:', currentUser.name);

    try {
      // If we have a room, try to reconnect to it
      if (currentRoom) {
        console.log('Attempting to reconnect to room:', currentRoom.code);
        
        // Check if the room still exists and user is still a member
        const updatedRoom = await GameService.getRoomByCode(currentRoom.code);
        
        if (updatedRoom && updatedRoom.playerIds.includes(currentUser.id)) {
          setCurrentRoom(updatedRoom);
          console.log('Successfully reconnected to room');
          
          // Check if there's an active game in this room
          if (updatedRoom.gameId) {
            console.log('Found active game, attempting to reconnect...');
            
            try {
              // Subscribe to the game
              const unsubscribe = GameService.subscribeToGame(updatedRoom.gameId, (gameState) => {
                if (gameState) {
                  setGameState(gameState);
                  console.log('Successfully reconnected to game');
                }
              });
              
              // Store the unsubscribe function globally so we can clean up later
              (window as any).gameUnsubscribe = unsubscribe;
              
              toast.success('Welcome back! Reconnected to your game.');
              return true;
            } catch (gameError) {
              console.error('Failed to reconnect to game:', gameError);
              toast.error('Failed to reconnect to your game');
            }
          } else {
            toast.success('Welcome back! Reconnected to your room.');
            return true;
          }
        } else {
          console.log('Room no longer exists or user is not a member');
          setCurrentRoom(null);
          toast('Your previous room is no longer available');
        }
      }
      
      return false;
    } catch (error) {
      console.error('Session recovery failed:', error);
      // Don't show an error toast here as it might be a network issue
      return false;
    }
  }

  /**
   * Cleans up any existing subscriptions
   */
  static cleanup(): void {
    const unsubscribe = (window as any).gameUnsubscribe;
    if (unsubscribe && typeof unsubscribe === 'function') {
      unsubscribe();
      delete (window as any).gameUnsubscribe;
    }
  }

  /**
   * Handles page visibility changes to pause/resume real-time updates
   */
  static handleVisibilityChange(): void {
    if (document.hidden) {
      console.log('Page hidden - maintaining connection');
      // Keep the connection alive but could reduce frequency if needed
    } else {
      console.log('Page visible - ensuring full sync');
      // Ensure we're fully synced when user returns
      this.recoverSession();
    }
  }
}

// Set up visibility change listener
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    SessionRecovery.handleVisibilityChange();
  });
}
