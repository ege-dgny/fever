# Fever Card Game 🎴

A multiplayer card game built with React, TypeScript, Firebase, and Tailwind CSS.

## Features

- **Real-time Multiplayer**: Play with friends in real-time using Firebase
- **Multiple Game Modes**: Choose from 6 to 30 cards (in multiples of 3)
- **Special Abilities**: Some cards have special abilities (to be customized)
- **Recall Mechanism**: Match and recall cards from your hand
- **Clean UI**: Modern, aesthetic design with smooth animations
- **Turn-based or Real-time**: Play at your own pace

## Game Rules

1. **Setup**: 
   - Number of decks = 2 × number of players
   - Jokers included
   - Cards placed in n×3 matrix, face down
   - Players can peek at bottom row at game start

2. **Gameplay**:
   - Draw from deck or pick from discard pile
   - Replace one of your cards
   - Game continues clockwise
   - Call "Stop" to end the game
   - Recall matching cards when opponents discard them

3. **Scoring**:
   - Aces = 1 point
   - Jokers = -1 point
   - 10s = 0 points
   - Court cards (J, Q, K) = 15 points
   - Goal: Lowest score wins!

## Setup Instructions

### 1. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable Authentication:
   - Go to Authentication → Sign-in method
   - Enable Anonymous authentication
4. Create Firestore Database:
   - Go to Firestore Database
   - Create database in production mode
   - Set up security rules (see below)
5. Get your config:
   - Go to Project Settings → General
   - Scroll down to "Your apps" → Web app
   - Register app and copy the config

### 2. Environment Variables

Create a `.env` file in the root directory:

```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain_here
VITE_FIREBASE_PROJECT_ID=your_project_id_here
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket_here
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id_here
VITE_FIREBASE_APP_ID=your_app_id_here
```

### 3. Firestore Security Rules

Add these rules to your Firestore:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write rooms
    match /rooms/{roomId} {
      allow read, write: if request.auth != null;
    }
    
    // Allow authenticated users to read/write games
    match /games/{gameId} {
      allow read, write: if request.auth != null;
    }
    
    // Allow authenticated users to read/write player profiles
    match /players/{playerId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == playerId;
    }
  }
}
```

### 4. Install & Run

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## Deployment

### Deploy to Firebase Hosting

1. Install Firebase CLI:
```bash
npm install -g firebase-tools
```

2. Initialize Firebase:
```bash
firebase init
```
- Select Hosting
- Choose your project
- Set public directory to `dist`
- Configure as single-page app: Yes
- Don't overwrite index.html

3. Build and deploy:
```bash
npm run build
firebase deploy
```

## Special Card Abilities

Card values and abilities:

- **Ace**: 1 point
- **2-6**: Face value points
- **7**: Turn one opponent's card face-up (all suits)
- **8-9**: Face value points
- **10**: 0 points
- **Jack**: Take another turn (all suits)
- **Queen**: Swap one of your cards with an opponent's (all suits)
- **King**: Look at one of your own cards (all suits)
- **Joker**: -1 point

## Tech Stack

- **Frontend**: React + TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Backend**: Firebase (Firestore + Auth)
- **Build Tool**: Vite
- **Icons**: Lucide React

## Project Structure

```
src/
├── components/       # React components
│   ├── Auth.tsx     # Login screen
│   ├── Lobby.tsx    # Room creation/joining
│   ├── GameBoard.tsx # Main game interface
│   └── Card.tsx     # Card component
├── config/          # Configuration files
│   └── firebase.ts  # Firebase setup
├── services/        # Business logic
│   └── gameService.ts # Game operations
├── store/           # State management
│   └── gameStore.ts # Zustand store
├── types/           # TypeScript types
│   └── game.ts      # Game type definitions
└── utils/           # Utility functions
    └── gameUtils.ts # Game logic helpers
```

## Contributing

Feel free to customize the game rules, add new features, or improve the UI!

## License

MIT# fever
# fever
