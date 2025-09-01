# 🚀 Deployment Guide - Fever Card Game

## Deployment Options

### Option 1: Vercel (Recommended) ✨

**Why Vercel?**
- Free tier perfect for friend groups
- Automatic deployments from GitHub
- Custom domains available
- Zero configuration needed
- Games persist indefinitely in Firebase

#### Step-by-Step Deployment:

1. **Push to GitHub:**
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

2. **Deploy to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Sign up/login with GitHub
   - Click "New Project"
   - Import your GitHub repository
   - **Environment Variables:** Add your Firebase config:
     ```
     VITE_FIREBASE_API_KEY=your_api_key
     VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
     VITE_FIREBASE_PROJECT_ID=your_project_id
     VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
     VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
     VITE_FIREBASE_APP_ID=your_app_id
     ```
   - Click "Deploy"

3. **Your game is live!** 🎉
   - URL: `https://your-project.vercel.app`
   - Share links: `https://your-project.vercel.app/join/ROOMCODE`

### Option 2: Firebase Hosting

Since you're already using Firebase:

1. **Install Firebase CLI:**
```bash
npm install -g firebase-tools
```

2. **Initialize Firebase Hosting:**
```bash
firebase init hosting
# Select your Firebase project
# Public directory: dist
# Single-page app: Yes
# Don't overwrite index.html
```

3. **Build and Deploy:**
```bash
npm run build
firebase deploy --only hosting
```

4. **Your game is live at:**
   - `https://your-project.web.app`
   - or `https://your-project.firebaseapp.com`

### Option 3: Netlify

Similar to Vercel:

1. **Push to GitHub** (same as above)

2. **Deploy to Netlify:**
   - Go to [netlify.com](https://netlify.com)
   - Drag and drop your `dist` folder after building
   - OR connect GitHub for automatic deployments

3. **Add Environment Variables** in Site Settings

## 🔗 How Shareable Links Work

When you create a room, you can share the game in two ways:

1. **Room Code:** Share the 6-digit code
2. **Direct Link:** Click the share button to get a link like:
   ```
   https://your-game.vercel.app/join/ABC123
   ```

When friends click the link:
- If not logged in → They enter their name first
- Automatically joins the room
- Real-time sync via Firebase

## 🎮 Game Persistence

- **Games persist** as long as you want in Firebase
- **No time limits** - play at your own pace
- **Rejoin anytime** with the same room code
- **Turn-based or real-time** - works both ways

## 💰 Costs

**For friend groups (your use case):**
- **Vercel:** Free (100GB bandwidth/month)
- **Firebase:** Free tier includes:
  - 50K reads/day
  - 20K writes/day
  - 1GB storage
  - Perfect for friend groups!

## 🔧 Custom Domain (Optional)

Want `fevergame.com` instead?

1. **Buy domain** from Namecheap/GoDaddy ($10/year)
2. **In Vercel:** Settings → Domains → Add your domain
3. **Update DNS** at your registrar
4. **Done!** Your game at `fevergame.com`

## 📱 Mobile Support

The game works perfectly on mobile browsers:
- Responsive design
- Touch-friendly cards
- Share button uses native mobile sharing
- No app installation needed

## 🔐 Security

Your Firebase rules ensure:
- Only authenticated users can play
- Players can only modify their own data
- Rooms are private to participants
- No one can cheat by modifying game state

## Quick Deploy Commands

```bash
# Initial setup
git init
git add .
git commit -m "Fever card game"

# Deploy to Vercel (after GitHub push)
vercel

# Deploy to Firebase
firebase deploy

# Update deployment
git add .
git commit -m "Update game"
git push
# Vercel auto-deploys from GitHub
```

## Environment Variables Template

Create `.env` for local development:
```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain_here
VITE_FIREBASE_PROJECT_ID=your_project_id_here
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket_here
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id_here
VITE_FIREBASE_APP_ID=your_app_id_here
```

Remember to add these to your deployment platform's environment variables!

---

**That's it!** Your game is ready to share with friends. They just click the link and play! 🎉
