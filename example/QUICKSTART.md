# ⚾ Fantasy Baseball Draft Kit - QUICK START

## 🚀 Get Running in 5 Minutes!

### Step 1: Install Everything
```powershell
cd Attempt2
npm install
```

### Step 2: Start MongoDB
```powershell
# If you have MongoDB installed locally:
net start MongoDB

# OR use MongoDB Atlas (cloud):
# 1. Go to mongodb.com/cloud/atlas
# 2. Create free account
# 3. Get connection string
# 4. Update MONGODB_URI in .env file
```

### Step 3: Load Player Data
```powershell
npm run setup
```
Wait 1-2 minutes for ~150-200 MLB players to load.

### Step 4: Start Both Servers

**Terminal 1 - Backend:**
```powershell
npm run server
```
Wait for: "✅ Connected to MongoDB"

**Terminal 2 - Frontend:**
```powershell
npm run dev
```
Wait for: "Local: http://localhost:3000"

### Step 5: Open Browser
```
http://localhost:3000
```

## 🎯 First Draft in 3 Steps

### 1. Create League
- Click "Create League"
- Enter: League name, your name, 12 owners
- Add owner names (can be test names)
- Click "Create League"

### 2. Start Draft
- Click "Start Draft" button
- Enter your owner name (must match one you created)

### 3. Draft Players!
- Go to "Available Players" tab
- Click a player to select
- Go back to "Draft Board" tab
- Enter bid amount (try $20)
- Click "Nominate"
- Enter higher bid to bid on someone else's nomination
- Click "Sold!" when bidding is done

## 📖 What You Get

✅ **Real MLB Player Data** - From official MLB API
✅ **Smart Valuations** - Z-score algorithm with position scarcity
✅ **Live Auction Draft** - Real-time bidding with Socket.io
✅ **Budget Tracking** - Automatic calculations, max bid enforcement
✅ **Keeper League** - Track players across seasons
✅ **12 Owner Support** - Standard fantasy league size
✅ **23 Player Rosters** - 9 pitchers, 14 hitters

## 🎓 Quick Tips

**Budget Rules:**
- You start with $260
- Minimum $1 per player
- Must have $1 for each empty roster spot
- Max Bid = Remaining Budget - Empty Slots + 1

**Draft Strategy:**
- Green numbers = good value
- Red numbers = overpaying
- Draft catchers early (scarce)
- Save money for mid-round values

**Multi-User Testing:**
- Open multiple browser tabs
- Each tab can be a different owner
- Watch real-time updates!

## 🆘 Troubleshooting

**"MongoDB connection error"**
- Make sure MongoDB is running: `net start MongoDB`
- Or check your Atlas connection string

**"No players showing"**
- Run `npm run setup` again
- Check if backend server is running
- Look for errors in server console

**"Port already in use"**
- Kill process: `netstat -ano | findstr :4000` then `taskkill /PID <id> /F`
- Or change PORT in .env file

**"Socket connection failed"**
- Verify backend is running on port 4000
- Check browser console for errors
- Restart both servers

## 📚 Full Documentation

- **SETUP.md** - Complete installation guide
- **PROJECT_SUMMARY.md** - Technical details
- **Help page** - In-app guide (click Help from home)
- **Admin panel** - http://localhost:3000/admin

## 🎉 You're Ready!

Your fantasy baseball draft kit is now fully operational. Enjoy your draft! ⚾🏆

---

**Need more players?** 
- Go to Admin panel
- Uncheck "Use Sample Data"
- Click "Fetch Player Data" (takes 15-20 min for all ~1200 players)

**Want to start fresh?**
```powershell
# Drop database in mongosh
use fantasy-baseball
db.dropDatabase()

# Re-run setup
npm run setup
```
