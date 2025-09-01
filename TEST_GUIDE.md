# Testing Guide - Multiplayer on Single Device

## Quick Start Testing

### 1. Open Multiple Browser Windows

#### Option A: Using Incognito Windows (Easiest)
1. **Player 1 - Normal Window:**
   - Open Chrome/Firefox/Safari
   - Go to http://localhost:5173
   - Enter name "Player 1"
   - Click "Create Room"
   - Note the 6-digit room code

2. **Player 2 - Incognito Window:**
   - Open Incognito/Private window (Ctrl+Shift+N or Cmd+Shift+N)
   - Go to http://localhost:5173
   - Enter name "Player 2"
   - Join room with the code from Player 1

3. **Player 3 & 4 - Additional Incognito Windows:**
   - Open more incognito windows
   - Repeat the process

#### Option B: Using Different Browsers
- Chrome: Player 1
- Firefox: Player 2
- Safari: Player 3
- Edge: Player 4

### 2. Arrange Windows for Testing

**Recommended Setup:**
- Split your screen into quadrants
- Place each player's window in a corner
- This lets you see all players simultaneously

**On Mac:**
- Use Mission Control or Split View
- Drag windows to corners

**On Windows:**
- Windows + Arrow keys to snap windows
- Or drag to screen corners for quarter snap

### 3. Testing Game Flow

1. **Room Creation:**
   - Player 1 creates room
   - Other players join with code

2. **Start Game:**
   - Host (Player 1) clicks "Start Game"
   - All players see the game board

3. **Game Phases:**
   - **Starting Phase:** All players peek at bottom row (3 seconds)
   - **Playing Phase:** Take turns drawing/discarding
   - **Recall:** Any player can recall matching cards
   - **Ending:** Someone calls "Stop"

### 4. Testing Features

#### Turn-Based Actions:
- [x] Drawing from deck
- [x] Picking from discard pile
- [x] Replacing cards
- [x] Turn indicator updates

#### Recall Mechanism:
- [x] When a card is discarded, matching cards glow
- [x] Any player can recall (not just current turn)
- [x] Multiple recalls possible

#### Special Abilities:
- [x] 7♥, 7♦: Peek at own card
- [x] 8♥, 8♦: Peek at opponent's card
- [x] 9♣, 9♠: Swap cards
- [x] J♥, J♦: Double turn
- [x] Q♣, Q♠: Shuffle opponent

#### End Game:
- [x] Call "Stop" button
- [x] Final round for other players
- [x] Score calculation
- [x] Winner announcement

## Debugging Tips

### Browser Console
- Open DevTools: F12
- Check Console tab for errors
- Network tab to see Firebase requests

### Common Issues:

1. **"Too many attempts" error:**
   - Wait 10-15 minutes
   - Clear browser cache
   - Try incognito mode

2. **Players not syncing:**
   - Check Firebase Firestore Rules
   - Ensure all players joined same room code
   - Refresh both windows

3. **Can't see other players:**
   - Check room player count
   - Ensure game hasn't started yet
   - Verify room code matches

## Testing Checklist

### Pre-Game:
- [ ] Create room as Player 1
- [ ] Join room as Players 2-4
- [ ] All players show in waiting room
- [ ] Room code displays correctly
- [ ] Host can start game with 2+ players

### During Game:
- [ ] All players can peek at bottom row
- [ ] Turn order works clockwise
- [ ] Current player highlighted
- [ ] Cards can be drawn from deck
- [ ] Cards can be picked from discard
- [ ] Card replacement works
- [ ] Recall mechanism triggers
- [ ] Special abilities activate

### End Game:
- [ ] Stop button works
- [ ] Scores calculate correctly
- [ ] Winner determined (lowest score)
- [ ] All cards revealed

## Advanced Testing

### Simulating Network Issues:
1. Open DevTools (F12)
2. Network tab → Throttling
3. Select "Slow 3G" or "Offline"
4. Test game behavior

### Testing Edge Cases:
- Empty deck scenario
- All players recall simultaneously
- Player leaves mid-game
- Multiple special abilities in sequence

## Keyboard Shortcuts for Testing

- **New Incognito:** Ctrl/Cmd + Shift + N
- **Switch Tabs:** Ctrl/Cmd + Tab
- **DevTools:** F12
- **Hard Refresh:** Ctrl/Cmd + Shift + R
- **Clear Cache:** Ctrl/Cmd + Shift + Delete

Happy Testing! 🎮
