import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './config/firebase';
import { Toaster } from 'react-hot-toast';
import useGameStore from './store/gameStore';
import Auth from './components/Auth';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';
import { GameService } from './services/gameService';
import { PlayerService } from './services/playerService';
import toast from 'react-hot-toast';

function App() {
  const [loading, setLoading] = useState(true);
  const { currentUser, setCurrentUser, currentRoom, gameState, setGameState, setCurrentRoom } = useGameStore();
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser({
          id: user.uid,
          name: user.displayName || 'Anonymous',
          email: user.email || `${user.uid}@anonymous.com`
        });
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [setCurrentUser]);
  
  // Subscribe to room updates
  useEffect(() => {
    if (!currentRoom) return;
    
    let unsubscribeGame: (() => void) | null = null;
    
    const unsubscribeRoom = GameService.subscribeToRoom(currentRoom.id, (room) => {
      if (room) {
        setCurrentRoom(room);
        
        // If game has started, subscribe to game updates
        if (room.gameId && room.status === 'in-game') {
          // Unsubscribe from previous game if any
          if (unsubscribeGame) {
            unsubscribeGame();
          }
          
          // Subscribe to the new game
          unsubscribeGame = GameService.subscribeToGame(room.gameId, (game) => {
            setGameState(game);
          });
        }
      } else {
        // Room was deleted
        setCurrentRoom(null);
        setGameState(null);
      }
    });
    
    return () => {
      unsubscribeRoom();
      if (unsubscribeGame) {
        unsubscribeGame();
      }
    };
  }, [currentRoom?.id, setCurrentRoom, setGameState]);
  
  // Handle starting the game (for host)
  useEffect(() => {
    if (!currentRoom || !currentUser) return;
    
    const startGameButton = document.getElementById('start-game-button');
    if (!startGameButton) return;
    
    const handleStartGame = async () => {
      if (currentUser.id !== currentRoom.hostId) return;
      
      try {
        // Fetch actual player data from Firestore
        const playerDataList = await PlayerService.getPlayers(currentRoom.playerIds);
        
        // Create player objects with actual names
        const players = currentRoom.playerIds.map(id => {
          const playerData = playerDataList.find(p => p.id === id);
          return {
            id,
            name: playerData?.name || `Player ${currentRoom.playerIds.indexOf(id) + 1}`,
            email: playerData?.email || `${id}@anonymous.com`
          };
        });
        
        const game = await GameService.startGame(currentRoom, players);
        setGameState(game);
        toast.success('Game started!');
      } catch (error) {
        console.error('Error starting game:', error);
        toast.error('Failed to start game');
      }
    };
    
    startGameButton.addEventListener('click', handleStartGame);
    return () => startGameButton.removeEventListener('click', handleStartGame);
  }, [currentRoom, currentUser]);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-2xl animate-pulse">Loading...</div>
      </div>
    );
  }
  
  return (
    <>
      <Toaster 
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1f2937',
            color: '#fff',
          },
        }}
      />
      
      {!currentUser ? (
        <Auth />
      ) : gameState ? (
        <GameBoard gameState={gameState} />
      ) : (
        <Lobby />
      )}
    </>
  );
}

export default App;