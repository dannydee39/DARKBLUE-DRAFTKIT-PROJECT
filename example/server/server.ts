import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

// Import routes
import playersRouter from './routes/players';
import leaguesRouter from './routes/leagues';
import draftRouter from './routes/draft';

// Import socket handlers
import { setupDraftSocketHandlers } from './socket/draftHandler';

// Import services
import { MLBDataService } from './services/mlbData';

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  },
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/players', playersRouter);
app.use('/api/leagues', leaguesRouter);
app.use('/api/draft', draftRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Fantasy Baseball Draft Kit API is running',
    timestamp: new Date().toISOString(),
  });
});

// Admin endpoint to fetch MLB data
app.post('/api/admin/fetch-players', async (req, res) => {
  try {
    const { season = 2025, sample = true } = req.body;
    
    if (sample) {
      await MLBDataService.fetchSamplePlayers(season);
    } else {
      await MLBDataService.fetchAllPlayers(season);
    }
    
    res.json({
      success: true,
      message: 'Player data fetch initiated',
    });
  } catch (error) {
    console.error('Error fetching players:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching players',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Socket.io setup
setupDraftSocketHandlers(io);

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fantasy-baseball';

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    console.log(`📊 Database: ${mongoose.connection.name}`);
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  });

// Start server
const PORT = process.env.PORT || 4000;

httpServer.listen(PORT, () => {
  console.log(`\n🚀 Fantasy Baseball Draft Kit Server`);
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🌐 API: http://localhost:${PORT}/api`);
  console.log(`🔌 Socket.io ready for real-time draft updates`);
  console.log(`\n📝 Available endpoints:`);
  console.log(`   GET  /api/health - Health check`);
  console.log(`   GET  /api/players - Get all players`);
  console.log(`   GET  /api/leagues - Get all leagues`);
  console.log(`   POST /api/leagues - Create new league`);
  console.log(`   POST /api/draft/nominate - Nominate player`);
  console.log(`   POST /api/draft/bid - Place bid`);
  console.log(`   POST /api/admin/fetch-players - Fetch MLB data`);
  console.log(`\n💡 To fetch player data, run:`);
  console.log(`   POST http://localhost:${PORT}/api/admin/fetch-players`);
  console.log(`   Body: { "season": 2025, "sample": true }\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  httpServer.close(() => {
    mongoose.connection.close();
    process.exit(0);
  });
});

export default app;
