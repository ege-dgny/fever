import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useSearchParams } from 'react-router-dom';
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

function AppContent() {
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const roomCodeFromUrl = searchParams.get('join');
  
  const currentUser = useGameStore(state => state.currentUser);
  const setCurrentUser = useGameStore(state => state.setCurrentUser);
  const currentRoom = useGameStore(state => state.currentRoom);
  const setCurrentRoom = useGameStore(state => state.setCurrentRoom);
  const gameState = useGameStore(state => state.gameState);

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

  // Handle room joining from URL and session recovery
  useEffect(() => {
    if (!currentUser) return;

    const handleRoomConnection = async () => {
      // First, try to recover from localStorage
      let roomToConnect = null;
      
      try {
        const savedRoom = localStorage.getItem('fever-current-room');
        if (savedRoom) {
          roomToConnect = JSON.parse(savedRoom);
        }
      } catch (error) {
        console.error('Failed to parse saved room:', error);
      }

      // If there's a room code in URL, prioritize that
      if (roomCodeFromUrl) {
        try {
          const roomFromUrl = await GameService.getRoomByCode(roomCodeFromUrl.toUpperCase());
          if (roomFromUrl && roomFromUrl.playerIds.includes(currentUser.id)) {
            // User is already in this room, just reconnect
            roomToConnect = roomFromUrl;
            toast.success('Reconnected to your game!');
          } else if (roomFromUrl && !roomFromUrl.playerIds.includes(currentUser.id)) {
            // User is not in this room, try to join
            const joinedRoom = await GameService.joinRoom(roomCodeFromUrl.toUpperCase(), currentUser.id);
            if (joinedRoom) {
              roomToConnect = joinedRoom;
              toast.success('Joined room successfully!');
            } else {
              toast.error('Room not found or game already started');
            }
          } else {
            toast.error('Room not found');
          }
        } catch (error: any) {
          console.error('Error connecting to room from URL:', error);
          toast.error(error.message || 'Failed to connect to room');
        }
      }
      // If no URL but we have a saved room, try to reconnect
      else if (roomToConnect) {
        try {
          const updatedRoom = await GameService.getRoomByCode(roomToConnect.code);
          if (updatedRoom && updatedRoom.playerIds.includes(currentUser.id)) {
            roomToConnect = updatedRoom;
            console.log('Session recovered automatically');
          } else {
            // Room no longer exists or user not in it
            localStorage.removeItem('fever-current-room');
            roomToConnect = null;
          }
        } catch (error) {
          console.error('Session recovery failed:', error);
          localStorage.removeItem('fever-current-room');
          roomToConnect = null;
        }
      }

      if (roomToConnect && !currentRoom) {
        setCurrentRoom(roomToConnect);
      }
    };

    // Only run this once when user is authenticated and we don't have a room
    if (!currentRoom) {
      handleRoomConnection();
    }
  }, [currentUser, roomCodeFromUrl, currentRoom, setCurrentRoom]);

  // Subscribe to room updates when user has a room
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
          
          unsubscribeGame = GameService.subscribeToGame(room.gameId, (gameState) => {
            if (gameState) {
              useGameStore.getState().setGameState(gameState);
            }
          });
        }
      } else {
        // Room was deleted
        setCurrentRoom(null);
        if (unsubscribeGame) {
          unsubscribeGame();
          unsubscribeGame = null;
        }
      }
    });
    
    return () => {
      unsubscribeRoom();
      if (unsubscribeGame) {
        unsubscribeGame();
      }
    };
  }, [currentRoom?.id, setCurrentRoom]);

  // Handle start game button clicks
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
        
        await GameService.startGame(currentRoom, players);
        toast.success('Game started!');
      } catch (error) {
        console.error('Error starting game:', error);
        toast.error('Failed to start game');
      }
    };
    
    startGameButton.addEventListener('click', handleStartGame);
    
    return () => {
      startGameButton.removeEventListener('click', handleStartGame);
    };
  }, [currentRoom, currentUser]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-200 via-orange-400 to-red-600 flex items-center justify-center">
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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<AppContent />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
