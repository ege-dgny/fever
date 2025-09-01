import React, { useState, useEffect } from 'react';
import type { GameMode } from '../types/game';
import { GameService } from '../services/gameService';
import { PlayerService } from '../services/playerService';
import type { PlayerData } from '../services/playerService';
import useGameStore from '../store/gameStore';
import { Plus, LogIn, Copy, Check, Share2 } from 'lucide-react';
import { auth } from '../config/firebase';
import toast from 'react-hot-toast';

const Lobby: React.FC = () => {
  const [isCreating, setIsCreating] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [selectedMode, setSelectedMode] = useState<GameMode>(6);
  const [isJoining, setIsJoining] = useState(false);
  const [copied, setCopied] = useState(false);
  const [roomPlayers, setRoomPlayers] = useState<PlayerData[]>([]);
  
  const { currentUser, currentRoom, setCurrentRoom } = useGameStore();
  
  // Fetch player names when room updates
  useEffect(() => {
    if (currentRoom?.playerIds) {
      PlayerService.getPlayers(currentRoom.playerIds).then(players => {
        setRoomPlayers(players);
      });
    }
  }, [currentRoom?.playerIds]);
  
  const gameModes: GameMode[] = [6, 9, 12, 15, 18, 21, 24, 27, 30];
  
  const handleCreateRoom = async () => {
    if (!currentUser) return;
    
    setIsCreating(true);
    try {
      const room = await GameService.createRoom(currentUser.id, currentUser.name, selectedMode);
      setCurrentRoom(room);
      toast.success(`Room created! Code: ${room.code}`);
    } catch (error) {
      console.error('Error creating room:', error);
      toast.error('Failed to create room');
    } finally {
      setIsCreating(false);
    }
  };
  
  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !roomCode.trim()) return;
    
    setIsJoining(true);
    try {
      const room = await GameService.joinRoom(roomCode.toUpperCase(), currentUser.id);
      if (room) {
        setCurrentRoom(room);
        toast.success('Joined room successfully!');
      } else {
        toast.error('Room not found');
      }
    } catch (error: any) {
      console.error('Error joining room:', error);
      toast.error(error.message || 'Failed to join room');
    } finally {
      setIsJoining(false);
    }
  };
  
  const copyRoomCode = () => {
    if (currentRoom) {
      navigator.clipboard.writeText(currentRoom.code);
      setCopied(true);
      toast.success('Room code copied!');
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  const shareGameLink = () => {
    if (currentRoom) {
      const gameUrl = `${window.location.origin}/join/${currentRoom.code}`;
      
      if (navigator.share) {
        // Use Web Share API if available (mobile)
        navigator.share({
          title: 'Join my Fever Card Game!',
          text: `Join my game with code: ${currentRoom.code}`,
          url: gameUrl
        }).catch(() => {
          // Fallback to clipboard if share fails
          navigator.clipboard.writeText(gameUrl);
          toast.success('Game link copied!');
        });
      } else {
        // Fallback to clipboard
        navigator.clipboard.writeText(gameUrl);
        toast.success('Game link copied! Share it with friends to invite them.');
      }
    }
  };
  
  const handleLeaveRoom = async () => {
    if (!currentRoom || !currentUser) return;
    
    try {
      await GameService.leaveRoom(currentRoom.id, currentUser.id);
      setCurrentRoom(null);
      toast.success('Left room');
    } catch (error) {
      console.error('Error leaving room:', error);
      toast.error('Failed to leave room');
    }
  };
  
  if (currentRoom) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl shadow-2xl p-8 w-full max-w-2xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-white">Waiting Room</h2>
            <button
              onClick={handleLeaveRoom}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
            >
              Leave Room
            </button>
          </div>
          
          <div className="bg-white/20 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-white/70 text-sm">Room Code</p>
                <p className="text-4xl font-bold text-white tracking-wider">{currentRoom.code}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={copyRoomCode}
                  className="p-3 bg-white/20 hover:bg-white/30 rounded-lg transition"
                  title="Copy room code"
                >
                  {copied ? <Check className="w-6 h-6 text-green-400" /> : <Copy className="w-6 h-6 text-white" />}
                </button>
                <button
                  onClick={shareGameLink}
                  className="p-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition"
                  title="Share game link"
                >
                  <Share2 className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>
            <p className="text-white/70">Game Mode: {currentRoom.gameMode} cards</p>
            <p className="text-white/60 text-sm mt-2">
              Share link: {window.location.origin}/join/{currentRoom.code}
            </p>
          </div>
          
          <div className="space-y-3">
            <p className="text-white/90 font-semibold">Players ({currentRoom.playerIds.length}/{currentRoom.maxPlayers})</p>
            <div className="bg-white/10 rounded-lg p-4">
              {currentRoom.playerIds.map((playerId) => {
                const player = roomPlayers.find(p => p.id === playerId);
                return (
                  <div key={playerId} className="flex items-center justify-between py-2">
                    <span className="text-white">
                      {player?.name || `Player ${currentRoom.playerIds.indexOf(playerId) + 1}`} 
                      {playerId === currentRoom.hostId && ' (Host)'}
                      {playerId === currentUser?.id && ' (You)'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          
          {currentUser?.id === currentRoom.hostId && currentRoom.playerIds.length >= 2 && (
            <button
              id="start-game-button"
              className="w-full mt-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold rounded-xl shadow-lg transform transition hover:scale-105"
            >
              Start Game
            </button>
          )}
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-3xl shadow-2xl p-8 w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Fever</h1>
          <p className="text-white/70">Welcome, {currentUser?.name}!</p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8">
          {/* Create Room */}
          <div className="bg-white/10 rounded-2xl p-6">
            <div className="flex items-center mb-4">
              <Plus className="w-6 h-6 text-white mr-2" />
              <h2 className="text-2xl font-semibold text-white">Create Room</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-white/90 mb-2">Select Game Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {gameModes.map(mode => (
                    <button
                      key={mode}
                      onClick={() => setSelectedMode(mode)}
                      className={`py-2 px-3 rounded-lg font-semibold transition ${
                        selectedMode === mode
                          ? 'bg-purple-600 text-white'
                          : 'bg-white/20 text-white/80 hover:bg-white/30'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                <p className="text-white/60 text-sm mt-2">Number of cards per player</p>
              </div>
              
              <button
                onClick={handleCreateRoom}
                disabled={isCreating}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold rounded-xl shadow-lg transform transition hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isCreating ? 'Creating...' : 'Create Room'}
              </button>
            </div>
          </div>
          
          {/* Join Room */}
          <div className="bg-white/10 rounded-2xl p-6">
            <div className="flex items-center mb-4">
              <LogIn className="w-6 h-6 text-white mr-2" />
              <h2 className="text-2xl font-semibold text-white">Join Room</h2>
            </div>
            
            <form onSubmit={handleJoinRoom} className="space-y-4">
              <div>
                <label htmlFor="roomCode" className="block text-white/90 mb-2">
                  Room Code
                </label>
                <input
                  type="text"
                  id="roomCode"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition uppercase tracking-wider"
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  disabled={isJoining}
                />
              </div>
              
              <button
                type="submit"
                disabled={isJoining || roomCode.length !== 6}
                className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold rounded-xl shadow-lg transform transition hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isJoining ? 'Joining...' : 'Join Room'}
              </button>
            </form>
          </div>
        </div>
        
        <div className="mt-8 text-center">
          <button
            onClick={() => {
              auth.signOut();
              useGameStore.getState().reset();
            }}
            className="text-white/60 hover:text-white/80 transition"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default Lobby;
