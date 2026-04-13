import mongoose, { Schema, Document } from 'mongoose';

export interface IOwner {
  name: string;
  budget: number;
  remainingBudget: number;
  roster: {
    playerId: mongoose.Types.ObjectId;
    playerName: string;
    position: string;
    costDrafted: number;
    yearAcquired?: number;
    isKeeper?: boolean;
  }[];
  emptySlots: number;
  maxBid: number; // calculated: remainingBudget - emptySlots + 1
}

export interface IScoringCategory {
  name: string;
  type: 'counting' | 'rate'; // counting = integers (HR, RBI), rate = decimals (AVG, ERA)
  isPitcherStat: boolean;
  weight: number; // all default to 1, all weighted equally
}

export interface ILeague extends Document {
  name: string;
  commissioner: string;
  season: number;
  
  // League settings
  numOwners: number;
  budgetPerOwner: number;
  rosterSize: number;
  
  // Roster configuration
  rosterSpots: {
    position: string; // 'P', 'C', '1B', '2B', '3B', 'SS', 'OF', '1B/3B', '2B/SS', 'UT'
    count: number;
  }[];
  
  // Scoring categories
  scoringCategories: IScoringCategory[];
  
  // Owners
  owners: IOwner[];
  
  // Draft state
  draftStatus: 'not-started' | 'in-progress' | 'completed';
  currentNominator?: string;
  currentAuction?: {
    playerId: mongoose.Types.ObjectId;
    playerName: string;
    nominatedBy: string;
    currentBid: number;
    currentBidder: string;
    biddingEndsAt?: Date;
  };
  
  // Keeper settings
  isKeeperLeague: boolean;
  maxKeepYears: number;
  
  // Taxi squad
  hasTaxiSquad: boolean;
  taxiSquadSize: number;
  
  createdAt: Date;
  updatedAt: Date;
}

const LeagueSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    commissioner: { type: String, required: true },
    season: { type: Number, required: true },
    
    numOwners: { type: Number, required: true, default: 12 },
    budgetPerOwner: { type: Number, required: true, default: 260 },
    rosterSize: { type: Number, required: true, default: 23 },
    
    rosterSpots: [
      {
        position: { type: String, required: true },
        count: { type: Number, required: true },
      },
    ],
    
    scoringCategories: [
      {
        name: { type: String, required: true },
        type: { type: String, enum: ['counting', 'rate'], required: true },
        isPitcherStat: { type: Boolean, required: true },
        weight: { type: Number, default: 1 },
      },
    ],
    
    owners: [
      {
        name: { type: String, required: true },
        budget: { type: Number, required: true },
        remainingBudget: { type: Number, required: true },
        roster: [
          {
            playerId: { type: Schema.Types.ObjectId, ref: 'Player' },
            playerName: { type: String, required: true },
            position: { type: String, required: true },
            costDrafted: { type: Number, required: true },
            yearAcquired: { type: Number },
            isKeeper: { type: Boolean, default: false },
          },
        ],
        emptySlots: { type: Number, required: true },
        maxBid: { type: Number, required: true },
      },
    ],
    
    draftStatus: {
      type: String,
      enum: ['not-started', 'in-progress', 'completed'],
      default: 'not-started',
    },
    currentNominator: { type: String },
    currentAuction: {
      playerId: { type: Schema.Types.ObjectId, ref: 'Player' },
      playerName: { type: String },
      nominatedBy: { type: String },
      currentBid: { type: Number },
      currentBidder: { type: String },
      biddingEndsAt: { type: Date },
    },
    
    isKeeperLeague: { type: Boolean, default: true },
    maxKeepYears: { type: Number, default: 3 },
    
    hasTaxiSquad: { type: Boolean, default: true },
    taxiSquadSize: { type: Number, default: 9 },
  },
  { timestamps: true }
);

export default mongoose.models.League || mongoose.model<ILeague>('League', LeagueSchema);
