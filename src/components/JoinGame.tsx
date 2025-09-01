import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useGameStore from '../store/gameStore';
import { GameService } from '../services/gameService';
import toast from 'react-hot-toast';

const JoinGame: React.FC = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const { currentUser, setCurrentRoom } = useGameStore();
  
  useEffect(() => {
    if (!roomCode) {
      navigate('/');
      return;
    }
    
    if (!currentUser) {
      // Store room code for after auth
      sessionStorage.setItem('pendingRoomCode', roomCode);
      navigate('/');
      return;
    }
    
    const joinRoom = async () => {
      try {
        const room = await GameService.joinRoom(roomCode.toUpperCase(), currentUser.id);
        if (room) {
          setCurrentRoom(room);
          toast.success('Joined room successfully!');
          navigate('/');
        } else {
          toast.error('Room not found');
          navigate('/');
        }
      } catch (error: any) {
        console.error('Error joining room:', error);
        toast.error(error.message || 'Failed to join room');
        navigate('/');
      }
    };
    
    joinRoom();
  }, [roomCode, currentUser, setCurrentRoom, navigate]);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
      <div className="text-white text-2xl animate-pulse">Joining game...</div>
    </div>
  );
};

export default JoinGame;
