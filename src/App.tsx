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

  // Handle room joining from URL
  useEffect(() => {
    if (roomCodeFromUrl && currentUser && !currentRoom) {
      const joinRoom = async () => {
        try {
          const room = await GameService.joinRoom(roomCodeFromUrl.toUpperCase(), currentUser.id);
          if (room) {
            setCurrentRoom(room);
            toast.success('Joined room successfully!');
          } else {
            toast.error('Room not found');
          }
        } catch (error: any) {
          console.error('Error joining room from URL:', error);
          toast.error(error.message || 'Failed to join room');
        }
      };
      joinRoom();
    }
  }, [roomCodeFromUrl, currentUser, currentRoom, setCurrentRoom]);

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
