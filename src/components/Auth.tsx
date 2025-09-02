import React, { useState } from 'react';
import { signInAnonymously, updateProfile } from 'firebase/auth';
import { auth } from '../config/firebase';
import useGameStore from '../store/gameStore';
import { User, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useFirebaseStatus } from '../hooks/useFirebaseStatus';
import { PlayerService } from '../services/playerService';
import { GameService } from '../services/gameService';

const Auth: React.FC = () => {
  const [playerName, setPlayerName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { setCurrentUser, setCurrentRoom } = useGameStore();
  const firebaseStatus = useFirebaseStatus();

  // Removed automatic test - it was causing too many auth attempts

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!playerName.trim()) {
      toast.error('Please enter your name');
      return;
    }

    setIsLoading(true);
    
    try {
      const userCredential = await signInAnonymously(auth);
      const user = userCredential.user;
      
      await updateProfile(user, {
        displayName: playerName
      });
      
      const email = user.email || `${user.uid}@anonymous.com`;
      
      // Register player in Firestore
      await PlayerService.registerPlayer(user.uid, playerName, email);
      
      setCurrentUser({
        id: user.uid,
        name: playerName,
        email: email
      });
      
      // Check for pending room code from URL navigation
      const pendingRoomCode = sessionStorage.getItem('pendingRoomCode');
      if (pendingRoomCode) {
        sessionStorage.removeItem('pendingRoomCode');
        try {
          const room = await GameService.joinRoom(pendingRoomCode, user.uid);
          if (room) {
            setCurrentRoom(room);
            toast.success(`Welcome, ${playerName}! Joined room ${pendingRoomCode}.`);
          } else {
            toast.success(`Welcome, ${playerName}!`);
            toast.error('Room not found');
          }
        } catch (error) {
          console.error('Error joining pending room:', error);
          toast.success(`Welcome, ${playerName}!`);
        }
      } else {
        toast.success(`Welcome, ${playerName}!`);
      }
    } catch (error: any) {
      console.error('Error signing in:', error);
      
      // More specific error messages
      if (error.code === 'auth/operation-not-allowed') {
        toast.error('Anonymous authentication is not enabled. Please enable it in Firebase Console.');
      } else if (error.code === 'auth/network-request-failed') {
        toast.error('Network error. Please check your internet connection.');
      } else if (error.code === 'auth/too-many-requests') {
        toast.error('Too many attempts. Please try again later.');
      } else {
        toast.error(`Sign in failed: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-black/20 backdrop-blur-lg rounded-3xl shadow-2xl p-8 w-full max-w-md border border-white/20">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-white/20 rounded-full p-4 mb-4">
            <User className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">fever</h1>
          <p className="text-white/70 text-center">Enter your name to start playing</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-white/90 mb-2">
              Player Name
            </label>
            <input
              type="text"
              id="name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition"
              placeholder="Enter your name"
              disabled={isLoading}
              maxLength={20}
            />
          </div>
          
          <button
            type="submit"
            disabled={isLoading || !playerName.trim()}
            className="w-full py-3 px-4 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-semibold rounded-xl shadow-lg transform transition hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isLoading ? 'Signing in...' : 'Start Playing'}
          </button>
        </form>
        
        <div className="mt-8 text-center text-white/60 text-sm">
          <p> </p>
          
          {/* Firebase Status Indicator */}
          <div className="mt-4 flex justify-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              {firebaseStatus.auth ? (
                <CheckCircle className="w-3 h-3 text-green-400" />
              ) : (
                <XCircle className="w-3 h-3 text-red-400" />
              )}
              <span>Auth</span>
            </div>
            <div className="flex items-center gap-1">
              {firebaseStatus.firestore ? (
                <CheckCircle className="w-3 h-3 text-green-400" />
              ) : (
                <XCircle className="w-3 h-3 text-red-400" />
              )}
              <span>Firestore</span>
            </div>
          </div>
          {firebaseStatus.error && (
            <p className="text-red-400 text-xs mt-2">{firebaseStatus.error}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
