#!/bin/bash

# Script to open multiple browser windows for testing multiplayer

echo "🎮 Opening Fever Card Game in multiple windows for testing..."
echo "================================================"

# Check which browser is available
if command -v google-chrome &> /dev/null; then
    BROWSER="google-chrome"
elif command -v chromium &> /dev/null; then
    BROWSER="chromium"
elif command -v open &> /dev/null; then
    # macOS
    BROWSER="open -a 'Google Chrome'"
else
    echo "Chrome not found. Please open browsers manually."
    exit 1
fi

URL="http://localhost:5173"

echo "Opening Player 1 (Normal Window)..."
$BROWSER "$URL" &

sleep 2

echo "Opening Player 2 (Incognito)..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    open -na "Google Chrome" --args --incognito "$URL" &
else
    # Linux/Windows WSL
    $BROWSER --incognito "$URL" &
fi

sleep 2

echo "Opening Player 3 (Incognito)..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    open -na "Google Chrome" --args --incognito "$URL" &
else
    $BROWSER --incognito "$URL" &
fi

echo ""
echo "✅ Three browser windows opened!"
echo ""
echo "📝 Instructions:"
echo "1. In Window 1: Enter name, click 'Create Room'"
echo "2. Copy the 6-digit room code"
echo "3. In Windows 2 & 3: Enter names, join with the code"
echo "4. Start the game from Window 1 (as host)"
echo ""
echo "Arrange windows side-by-side to see all players!"
