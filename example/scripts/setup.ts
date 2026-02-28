import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { MLBDataService } from '../server/services/mlbData';
import Player from '../server/models/Player';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fantasy-baseball';

async function setupDatabase() {
  try {
    console.log('\n🚀 Fantasy Baseball Draft Kit - Database Setup\n');
    
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Check if players already exist
    const playerCount = await Player.countDocuments();
    if (playerCount > 0) {
      console.log(`ℹ️  Database already has ${playerCount} players`);
      console.log('   Do you want to fetch fresh data? This will update existing players.');
      console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // Fetch sample MLB data (faster for testing)
    console.log('📥 Fetching MLB player data from MLB Stats API...');
    console.log('   (Using sample data from 5 major teams for faster setup)\n');
    
    await MLBDataService.fetchSamplePlayers(2025);
    
    const finalCount = await Player.countDocuments();
    console.log(`\n✅ Setup complete! Database now has ${finalCount} players`);
    
    // Display some stats
    const pitchers = await Player.countDocuments({ isPitcher: true });
    const hitters = await Player.countDocuments({ isPitcher: false });
    
    console.log('\n📊 Player Breakdown:');
    console.log(`   Pitchers: ${pitchers}`);
    console.log(`   Hitters: ${hitters}`);
    
    console.log('\n✨ You can now start the application:');
    console.log('   1. Terminal 1: npm run dev (Next.js frontend)');
    console.log('   2. Terminal 2: npm run server (Express backend)\n');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('📡 Database connection closed\n');
    process.exit(0);
  }
}

// Run setup
setupDatabase();
