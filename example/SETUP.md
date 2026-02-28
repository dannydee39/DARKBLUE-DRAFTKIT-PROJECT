# Fantasy Baseball Draft Kit - Setup Guide

Complete setup instructions for the Fantasy Baseball Draft Kit application.

## Prerequisites

Before you begin, ensure you have the following installed:

1. **Node.js** (v18 or higher)
   - Download from: https://nodejs.org/
   - Verify: `node --version`

2. **MongoDB** (v6 or higher)
   - **Option A - Local Installation:**
     - Windows: https://www.mongodb.com/try/download/community
     - Mac: `brew install mongodb-community`
     - Linux: https://docs.mongodb.com/manual/administration/install-on-linux/
   
   - **Option B - MongoDB Atlas (Cloud - Free):**
     - Sign up at: https://www.mongodb.com/cloud/atlas
     - Create a free cluster
     - Get your connection string
     - Update `MONGODB_URI` in `.env` file

3. **Git** (for version control)
   - Download from: https://git-scm.com/

## Step-by-Step Installation

### Step 1: Install Dependencies

Open PowerShell in the Attempt2 folder and run:

```powershell
npm install
```

This will install all required packages including:
- Next.js, React, TypeScript
- Express, MongoDB, Socket.io
- Axios for MLB API calls
- And more...

### Step 2: Configure Environment Variables

The `.env` file has been created with default settings. If you're using MongoDB Atlas or want to change ports, edit the `.env` file:

```
MONGODB_URI=mongodb://localhost:27017/fantasy-baseball
PORT=4000
FRONTEND_URL=http://localhost:3000
```

### Step 3: Start MongoDB

**If using local MongoDB:**

```powershell
# Start MongoDB service (Windows)
net start MongoDB

# Or if installed without service:
mongod --dbpath C:\data\db
```

**If using MongoDB Atlas:**
- No action needed - it's already running in the cloud!

### Step 4: Initialize Database with MLB Player Data

Run the setup script to fetch real MLB player data:

```powershell
npm run setup
```

This will:
- Connect to MongoDB
- Fetch player data from MLB Stats API (free, official data)
- Populate the database with ~150-200 players from major teams
- Takes about 1-2 minutes

**Note:** The setup uses sample data (5 teams) for faster initialization. To fetch ALL MLB players (~1200), edit `scripts/setup.ts` and change `fetchSamplePlayers` to `fetchAllPlayers` (takes ~15-20 minutes).

### Step 5: Start the Application

You need TWO terminal windows:

**Terminal 1 - Backend Server (Express + Socket.io):**
```powershell
npm run server
```

You should see:
```
✅ Connected to MongoDB
🚀 Fantasy Baseball Draft Kit Server
📡 Server running on port 4000
```

**Terminal 2 - Frontend (Next.js):**
```powershell
npm run dev
```

You should see:
```
- ready started server on 0.0.0.0:3000
- Local:        http://localhost:3000
```

### Step 6: Open the Application

Open your browser and navigate to:
```
http://localhost:3000
```

## Quick Start Guide

### Creating Your First League

1. Click **"Create League"** on the home page
2. Fill in:
   - League Name (e.g., "2025 Championship League")
   - Your Name as Commissioner
   - Number of Owners (default: 12)
   - Budget per Owner (default: $260)
   - Owner Names (add all participants)
3. Click **"Create League"**
4. You'll be redirected to the Draft Board

### Starting a Draft

1. On the Draft Board, click **"Start Draft"**
2. Enter your owner name (must match one you created)
3. You're ready to draft!

### Conducting the Draft

**To Nominate a Player:**
1. Switch to "Available Players" tab
2. Click on a player to select them
3. Go back to "Draft Board" tab
4. Enter initial bid amount
5. Click "Nominate"

**To Bid on a Player:**
1. Enter your bid amount (must be higher than current bid)
2. Click "Place Bid"

**To Complete an Auction:**
1. When bidding is done, click "Sold!"
2. Player is added to the winning owner's roster
3. Next owner can nominate

### Viewing Rosters

- Click the "Rosters" tab to see all teams
- View budget remaining, empty slots, and drafted players

## API Endpoints Reference

### Players
- `GET /api/players` - Get all players with filters
- `GET /api/players/:id` - Get specific player
- `GET /api/players/position/:position` - Get players by position

### Leagues
- `POST /api/leagues` - Create new league
- `GET /api/leagues` - Get all leagues
- `GET /api/leagues/:id` - Get league details
- `POST /api/leagues/:id/start-draft` - Start draft

### Draft
- `POST /api/draft/nominate` - Nominate player
- `POST /api/draft/bid` - Place bid
- `POST /api/draft/complete` - Complete auction

### Admin
- `POST /api/admin/fetch-players` - Refresh MLB data
  ```json
  {
    "season": 2025,
    "sample": true
  }
  ```

## Troubleshooting

### MongoDB Connection Issues

**Error: "MongoNetworkError"**
- Ensure MongoDB is running: `net start MongoDB`
- Check connection string in `.env`
- For Atlas: Check IP whitelist and credentials

### Port Already in Use

**Error: "Port 4000/3000 is already in use"**
```powershell
# Find and kill process on port
netstat -ano | findstr :4000
taskkill /PID <process_id> /F
```

Or change ports in `.env`:
```
PORT=4001
NEXT_PUBLIC_API_URL=http://localhost:4001
```

### No Players Showing

If no players appear:
1. Run `npm run setup` again
2. Check MongoDB is running
3. Verify API server is running on port 4000
4. Check browser console for errors

### Socket.io Connection Failed

- Ensure backend server is running
- Check CORS settings in `server/server.ts`
- Verify `FRONTEND_URL` in `.env`

### Player Stats Not Loading

- MLB Stats API is free but rate-limited
- If fetching all players, add delays between requests
- Sample data (5 teams) avoids rate limits

## Development Tips

### Hot Reload

Both servers support hot reload:
- Frontend: Changes auto-reload
- Backend: Restart with `npm run server`

### Database Reset

To start fresh:
```powershell
# Connect to MongoDB
mongosh

# Drop database
use fantasy-baseball
db.dropDatabase()

# Re-run setup
npm run setup
```

### Fetching Latest Stats

To update player statistics:
```powershell
# Send POST request
curl -X POST http://localhost:4000/api/admin/fetch-players -H "Content-Type: application/json" -d "{\"season\":2025,\"sample\":true}"
```

### Testing Multiple Users

Open multiple browser windows/tabs:
- Each can be a different owner
- Real-time updates via Socket.io
- Test auction bidding

## Project Structure

```
Attempt2/
├── app/                    # Next.js pages
│   ├── page.tsx           # Home page
│   ├── leagues/create/    # Create league
│   ├── players/           # Browse players
│   ├── draft/[leagueId]/  # Draft board
│   └── help/              # Help guide
├── server/                # Backend
│   ├── models/           # MongoDB schemas
│   ├── routes/           # API endpoints
│   ├── services/         # Business logic
│   └── socket/           # Socket.io handlers
├── types/                # TypeScript types
├── utils/                # Helper functions
└── scripts/              # Setup scripts
```

## Production Deployment

### Environment Variables for Production

```
NODE_ENV=production
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/fantasy-baseball
PORT=4000
FRONTEND_URL=https://yourdomain.com
JWT_SECRET=<generate-strong-secret>
```

### Build Commands

```powershell
# Build frontend
npm run build

# Start production
npm run start

# Server (use PM2 or similar)
npm run server
```

## Support & Resources

- **MLB Stats API Docs:** https://statsapi.mlb.com/docs/
- **MongoDB Docs:** https://docs.mongodb.com/
- **Next.js Docs:** https://nextjs.org/docs
- **Socket.io Docs:** https://socket.io/docs/

## License

MIT License - See README.md

---

🎉 **You're all set!** Enjoy your fantasy baseball draft!
