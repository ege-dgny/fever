import React, { useState, useEffect } from 'react';
import type { GameState, Card as CardType, Player } from '../types/game';
import CardComponent from './Card';
import useGameStore from '../store/gameStore';
import { GameService } from '../services/gameService';
import { 
  RefreshCw, 
  StopCircle, 
  Eye,
  Layers,
  Trash2,
  Clock,
  Trophy,
  HelpCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { canRecallCard } from '../utils/gameUtils';
import { SpecialAbility } from '../types/game';

interface GameBoardProps {
  gameState: GameState;
}

interface AbilityTarget {
  ownCardPosition?: { row: number; col: number };
  opponentPlayerId?: string;
  opponentCardPosition?: { row: number; col: number };
}

const GameBoard: React.FC<GameBoardProps> = ({ gameState }) => {
  const [drawnCard, setDrawnCard] = useState<CardType | null>(null);
  const [isPeeking, setIsPeeking] = useState(false);
  const [peekingPositions, setPeekingPositions] = useState<Set<string>>(new Set());
  const [recallablePositions, setRecallablePositions] = useState<{ row: number; col: number }[]>([]);
  const [peekTimeRemaining, setPeekTimeRemaining] = useState(60);
  const [showHelp, setShowHelp] = useState(false);
  const [abilityTarget, setAbilityTarget] = useState<AbilityTarget>({});
  
  const { 
    currentUser, 
    selectedCard, 
    selectCard, 
    isMyTurn
  } = useGameStore();
  
  const myPlayer = gameState.players.find(p => p.id === currentUser?.id);
  const otherPlayers = gameState.players.filter(p => p.id !== currentUser?.id);
  
  // Check for game start to allow peeking at bottom row
  useEffect(() => {
    if (gameState.status === 'starting' && myPlayer) {
      const bottomRow = myPlayer.cards.length - 1;
      const positions = new Set<string>();
      for (let col = 0; col < 3; col++) {
        positions.add(`${bottomRow}-${col}`);
      }
      setPeekingPositions(positions);
      setIsPeeking(true); // Auto-show peek at start
      setPeekTimeRemaining(60);
      
      // Countdown timer
      const interval = setInterval(() => {
        setPeekTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            setPeekingPositions(new Set());
            setIsPeeking(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      // Cleanup on unmount or status change
      return () => clearInterval(interval);
    }
  }, [gameState.status]);
  
  // Check for recallable cards when discard pile changes
  useEffect(() => {
    if (gameState.discardPile.length > 0 && myPlayer) {
      const topCard = gameState.discardPile[0];
      const { positions } = canRecallCard(topCard, myPlayer.cards);
      setRecallablePositions(positions);
    } else {
      setRecallablePositions([]);
    }
  }, [gameState.discardPile, myPlayer]);
  
  const handleDrawFromDeck = async () => {
    if (!isMyTurn || drawnCard) return;
    
    try {
      const card = await GameService.drawFromDeck(gameState.id, currentUser!.id);
      if (card) {
        setDrawnCard(card);
        toast.success('Card drawn from deck');
      } else {
        toast.error('Deck is empty!');
      }
    } catch (error) {
      console.error('Error drawing card:', error);
      toast.error('Failed to draw card');
    }
  };
  
  const handlePickFromDiscard = async () => {
    if (!isMyTurn || drawnCard || gameState.discardPile.length === 0) return;
    
    try {
      const card = await GameService.pickFromDiscard(gameState.id, currentUser!.id);
      if (card) {
        setDrawnCard(card);
        toast.success('Card picked from discard pile');
      }
    } catch (error) {
      console.error('Error picking from discard:', error);
      toast.error('Failed to pick card');
    }
  };
  
  const handleReplaceCard = async (position: { row: number; col: number }) => {
    if (!drawnCard || !isMyTurn) return;
    
    try {
      await GameService.discardAndReplace(
        gameState.id,
        currentUser!.id,
        drawnCard,
        position
      );
      setDrawnCard(null);
      selectCard(null);
      toast.success('Card replaced!');
    } catch (error) {
      console.error('Error replacing card:', error);
      toast.error('Failed to replace card');
    }
  };
  
  const handleDiscardDrawnCard = async () => {
    if (!drawnCard || !isMyTurn) return;
    
    try {
      await GameService.discardDrawnCard(
        gameState.id,
        currentUser!.id,
        drawnCard
      );
      setDrawnCard(null);
      toast.success('Card discarded!');
    } catch (error) {
      console.error('Error discarding card:', error);
      toast.error('Failed to discard card');
    }
  };
  
  const handleAbilityTargetSelection = (
    player: Player, 
    position: { row: number; col: number }
  ) => {
    if (!gameState.activeAbility || !currentUser || currentUser.id !== gameState.activeAbility.playerId) return;

    const { ability } = gameState.activeAbility;

    if (ability === 'peek-self') {
      // Client-side peek for 3 seconds
      const cardKey = `${position.row}-${position.col}`;
      setPeekingPositions(prev => new Set(prev).add(cardKey));
      setTimeout(() => {
        setPeekingPositions(prev => {
          const newSet = new Set(prev);
          newSet.delete(cardKey);
          return newSet;
        });
      }, 3000);
      // Execute to advance turn
      GameService.executeAbility(gameState.id, ability, currentUser.id, {});
      return;
    }

    if (ability === 'flip-opponent') {
      GameService.executeAbility(gameState.id, ability, currentUser.id, {
        opponentPlayerId: player.id,
        opponentCardPosition: position,
      });
      return;
    }

    if (ability === 'swap') {
      if (!abilityTarget.ownCardPosition) {
        // Step 1: Select own card
        if (player.id !== currentUser.id) {
          toast.error("Select one of your own cards first.");
          return;
        }
        setAbilityTarget({ ownCardPosition: position });
        toast.success("Now select an opponent's card to swap with.");
      } else {
        // Step 2: Select opponent's card
        if (player.id === currentUser.id) {
          toast.error("Select an opponent's card.");
          return;
        }
        GameService.executeAbility(gameState.id, ability, currentUser.id, {
          ...abilityTarget,
          opponentPlayerId: player.id,
          opponentCardPosition: position,
        });
        setAbilityTarget({});
      }
    }
  };

  const cancelAbility = () => {
    setAbilityTarget({});
    // In a real scenario, you might want to inform the service layer,
    // but for now, we just reset the client state. The game will be "stuck"
    // until the ability is used. A future improvement could be to allow the service
    // to reset the activeAbility.
  };

  const handleRecallCards = async () => {
    if (recallablePositions.length === 0) return;
    
    try {
      await GameService.recallCards(
        gameState.id,
        currentUser!.id,
        recallablePositions
      );
      toast.success(`Recalled ${recallablePositions.length} card(s)!`);
      setRecallablePositions([]);
    } catch (error) {
      console.error('Error recalling cards:', error);
      toast.error('Failed to recall cards');
    }
  };
  
  const handleCallStop = async () => {
    if (!isMyTurn) return;
    
    try {
      await GameService.callStop(gameState.id, currentUser!.id);
      toast.success('Called stop! Game ending soon...');
    } catch (error) {
      console.error('Error calling stop:', error);
      toast.error('Failed to call stop');
    }
  };
  
  const togglePeek = () => {
    if (gameState.status === 'starting' && myPlayer) {
      setIsPeeking(!isPeeking);
    }
  };
  
  const isPositionRecallable = (row: number, col: number): boolean => {
    return recallablePositions.some(pos => pos.row === row && pos.col === col);
  };
  
  const renderPlayerArea = (player: Player, isCurrentPlayer: boolean = false) => {
    
    return (
      <div className={`bg-white/10 rounded-xl p-4 ${player.isCurrentTurn ? 'ring-2 ring-yellow-400' : ''}`}>
        <div className="flex justify-between items-center mb-3">
          <div>
            <h3 className="text-white font-semibold">
              {player.name} {player.isHost && '(Host)'} {isCurrentPlayer && '(You)'}
            </h3>
            {gameState.status === 'finished' && (
              <p className="text-white/70 text-sm">Score: {player.score}</p>
            )}
          </div>
          {player.isCurrentTurn && (
            <Clock className="w-5 h-5 text-yellow-400 animate-pulse" />
          )}
        </div>
        
        <div className="space-y-2">
          {player.cards.map((row, rowIndex) => (
            <div key={`row-${rowIndex}`} className="flex gap-2 justify-center">
              {row.map((card, colIndex) => {
                const posKey = `${rowIndex}-${colIndex}`;
                const canPeek = (isCurrentPlayer && peekingPositions.has(posKey)) || (showHelp && card?.isFaceUp === false);
                const showPeek = canPeek && isPeeking;
                const isRecallable = isCurrentPlayer && isPositionRecallable(rowIndex, colIndex);
                
                return (
                  <CardComponent
                    key={`card-${rowIndex}-${colIndex}`}
                    card={card}
                    position={{ row: rowIndex, col: colIndex }}
                    isSelected={isCurrentPlayer && (selectedCard?.row === rowIndex && selectedCard?.col === colIndex || abilityTarget.ownCardPosition?.row === rowIndex && abilityTarget.ownCardPosition?.col === colIndex)}
                    isPeekable={canPeek}
                    canRecall={isRecallable}
                    showPeek={showPeek}
                    onClick={() => {
                      if (gameState.status === 'awaiting-ability-target') {
                        handleAbilityTargetSelection(player, { row: rowIndex, col: colIndex });
                      } else if (isCurrentPlayer && drawnCard && isMyTurn) {
                        handleReplaceCard({ row: rowIndex, col: colIndex });
                      } else if (isCurrentPlayer) {
                        selectCard({ row: rowIndex, col: colIndex });
                      }
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  const getAbilityPrompt = (ability?: SpecialAbility): string => {
    switch (ability) {
      case 'peek-self': return "King's Ability: Select one of your cards to peek at for 3 seconds.";
      case 'flip-opponent': return "7's Ability: Select an opponent's card to turn face-up permanently.";
      case 'swap': 
        return abilityTarget.ownCardPosition 
          ? "Queen's Ability: Now select an opponent's card to swap with."
          : "Queen's Ability: Select one of your own cards to swap.";
      default: return '';
    }
  };

  if (gameState.status === 'finished') {
    const winner = gameState.players.find(p => p.id === gameState.winner);
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 text-center mb-6">
            <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
            <h1 className="text-4xl font-bold text-white mb-2">Game Over!</h1>
            <p className="text-2xl text-white/90">Winner: {winner?.name}</p>
            <p className="text-xl text-white/70">Score: {winner?.score}</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6">
            <h2 className="text-2xl font-bold text-white mb-4">Final Scores</h2>
            <div className="space-y-3">
              {gameState.players
                .sort((a, b) => a.score - b.score)
                .map((player, index) => (
                  <div key={player.id} className="bg-white/10 rounded-lg p-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold w-8 text-center">{index + 1}.</span>
                      <span className="text-white font-semibold">{player.name}</span>
                    </div>
                    <span className="text-white text-xl">{player.score} points</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Game Header */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-4 mb-4 flex justify-between items-center">
          <div className="text-white">
            <p className="text-sm opacity-70">Room Code</p>
            <p className="text-xl font-bold">{gameState.roomCode}</p>
          </div>
          <div className="text-white text-center">
            <p className="text-sm opacity-70">Status</p>
            <p className="text-xl font-bold capitalize">{gameState.status}</p>
          </div>
          <div className="text-white text-right">
            <p className="text-sm opacity-70">Cards in Deck</p>
            <p className="text-xl font-bold">{gameState.deck.length}</p>
          </div>
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="bg-white/20 hover:bg-white/30 p-2 rounded-lg transition"
            title="Show card abilities"
          >
            <HelpCircle className="w-5 h-5 text-white" />
          </button>
        </div>
        
        {/* Help Section */}
        {showHelp && (
          <div className="bg-black/50 backdrop-blur-sm rounded-xl p-4 mb-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-white font-semibold">Card Values & Abilities</h3>
              <button
                onClick={() => setShowHelp(false)}
                className="text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="text-white/90">
                <span className="font-semibold text-red-400">A:</span> 1 point
              </div>
              <div className="text-white/90">
                <span className="font-semibold text-yellow-400">7:</span> Turn opponent's card
              </div>
              <div className="text-white/90">
                <span className="font-semibold text-green-400">10:</span> 0 points
              </div>
              <div className="text-white/90">
                <span className="font-semibold text-blue-400">J:</span> Go again
              </div>
              <div className="text-white/90">
                <span className="font-semibold text-purple-400">Q:</span> Swap cards
              </div>
              <div className="text-white/90">
                <span className="font-semibold text-orange-400">K:</span> Look at own card
              </div>
              <div className="text-white/90">
                <span className="font-semibold text-pink-400">Joker:</span> -1 point
              </div>
              <div className="text-white/90">
                <span className="font-semibold">Others:</span> Face value
              </div>
            </div>
          </div>
        )}
        
        {/* Ability Prompt */}
        {gameState.status === 'awaiting-ability-target' && gameState.activeAbility?.playerId === currentUser?.id && (
          <div className="bg-blue-500/20 border border-blue-400 rounded-xl p-4 mb-4 text-center">
            <p className="text-blue-200 font-semibold">{getAbilityPrompt(gameState.activeAbility?.ability)}</p>
            {gameState.activeAbility?.ability === 'swap' && abilityTarget.ownCardPosition && (
              <button onClick={cancelAbility} className="text-xs text-white/70 mt-1 hover:underline">Cancel Selection</button>
            )}
          </div>
        )}

        {/* Game Controls */}
        {gameState.status === 'starting' && (
          <div className="bg-yellow-500/20 border border-yellow-400 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between">
              <p className="text-yellow-200 flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Look at your bottom row cards!
              </p>
              <div className="flex items-center gap-4">
                <span className="text-yellow-200 font-bold">
                  Time: {Math.floor(peekTimeRemaining / 60)}:{(peekTimeRemaining % 60).toString().padStart(2, '0')}
                </span>
                <button
                  onClick={togglePeek}
                  className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition text-white"
                >
                  {isPeeking ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Main Game Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          {/* Other Players */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-white text-xl font-semibold">Opponents</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {otherPlayers.map(player => (
                <div key={player.id}>
                  {renderPlayerArea(player)}
                </div>
              ))}
            </div>
          </div>
          
          {/* Center Area - Deck and Discard */}
          <div className="space-y-4">
            <h2 className="text-white text-xl font-semibold">Table</h2>
            <div className="bg-white/10 rounded-xl p-4 space-y-4">
              {/* Drawn Card */}
              {drawnCard && (
                <div className="bg-white/20 rounded-lg p-3">
                  <p className="text-white/70 text-sm mb-2">Your drawn card:</p>
                  <div className="flex justify-center">
                    <CardComponent card={{ ...drawnCard, isFaceUp: true }} />
                  </div>
                  <div className="mt-3 space-y-2">
                    <p className="text-white/60 text-xs text-center">
                      Click on one of your cards to replace it
                    </p>
                    <button
                      onClick={handleDiscardDrawnCard}
                      className="w-full py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm rounded-lg transition flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Discard without replacing
                    </button>
                  </div>
                </div>
              )}
              
              {/* Deck */}
              <div className="text-center">
                <p className="text-white/70 text-sm mb-2">Deck ({gameState.deck.length} cards)</p>
                <button
                  onClick={handleDrawFromDeck}
                  disabled={!isMyTurn || drawnCard !== null || gameState.status !== 'playing'}
                  className="w-20 h-28 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg shadow-lg hover:scale-105 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  <Layers className="w-8 h-8 text-white/50" />
                </button>
              </div>
              
              {/* Discard Pile */}
              <div className="text-center">
                <p className="text-white/70 text-sm mb-2">Discard Pile</p>
                {gameState.discardPile.length > 0 ? (
                  <div>
                    <button
                      onClick={handlePickFromDiscard}
                      disabled={!isMyTurn || drawnCard !== null || gameState.status !== 'playing'}
                      className="inline-block hover:scale-105 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CardComponent card={{ ...gameState.discardPile[0], isFaceUp: true }} />
                    </button>
                    {gameState.discardPile.length > 1 && (
                      <p className="text-white/50 text-xs mt-1">
                        {gameState.discardPile.length - 1} more card{gameState.discardPile.length > 2 ? 's' : ''} below
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="w-20 h-28 border-2 border-dashed border-white/30 rounded-lg flex items-center justify-center">
                    <Trash2 className="w-6 h-6 text-white/30" />
                  </div>
                )}
              </div>
              
              {/* Recall Button */}
              {recallablePositions.length > 0 && (
                <button
                  onClick={handleRecallCards}
                  className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Recall {recallablePositions.length} card(s)
                </button>
              )}
              
              {/* Stop Button */}
              {isMyTurn && gameState.status === 'playing' && !drawnCard && (
                <button
                  onClick={handleCallStop}
                  className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition flex items-center justify-center gap-2"
                >
                  <StopCircle className="w-4 h-4" />
                  Call Stop
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Current Player Area */}
        {myPlayer && (
          <div>
            <h2 className="text-white text-xl font-semibold mb-2">Your Cards</h2>
            {renderPlayerArea(myPlayer, true)}
          </div>
        )}
      </div>
    </div>
  );
};

export default GameBoard;
