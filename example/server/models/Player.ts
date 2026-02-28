import mongoose, { Schema, Document } from 'mongoose';

export interface IPlayer extends Document {
  mlbId: number;
  name: string;
  team: string;
  positions: string[]; // e.g., ['C'], ['OF'], ['1B', '3B'], ['P']
  isPitcher: boolean;
  
  // Statistics for hitters
  hitterStats?: {
    atBats: number;
    hits: number;
    homeRuns: number;
    runs: number;
    rbi: number;
    stolenBases: number;
    battingAverage: number;
    onBasePercentage: number;
    sluggingPercentage: number;
    ops: number;
  };
  
  // Statistics for pitchers
  pitcherStats?: {
    wins: number;
    losses: number;
    saves: number;
    strikeouts: number;
    inningsPitched: number;
    era: number;
    whip: number;
    qualityStarts: number;
  };
  
  // Metadata
  projectedAtBats?: number;
  projectedInnings?: number;
  injuryStatus: string;
  notes: string;
  
  // Draft info
  isAvailable: boolean;
  lastSeason: number;
  
  // For valuation
  calculatedValue?: number;
  positionScarcity?: number;
  
  createdAt: Date;
  updatedAt: Date;
}

const PlayerSchema: Schema = new Schema(
  {
    mlbId: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    team: { type: String, required: true },
    positions: [{ type: String, required: true }],
    isPitcher: { type: Boolean, required: true },
    
    hitterStats: {
      atBats: { type: Number, default: 0 },
      hits: { type: Number, default: 0 },
      homeRuns: { type: Number, default: 0 },
      runs: { type: Number, default: 0 },
      rbi: { type: Number, default: 0 },
      stolenBases: { type: Number, default: 0 },
      battingAverage: { type: Number, default: 0 },
      onBasePercentage: { type: Number, default: 0 },
      sluggingPercentage: { type: Number, default: 0 },
      ops: { type: Number, default: 0 },
    },
    
    pitcherStats: {
      wins: { type: Number, default: 0 },
      losses: { type: Number, default: 0 },
      saves: { type: Number, default: 0 },
      strikeouts: { type: Number, default: 0 },
      inningsPitched: { type: Number, default: 0 },
      era: { type: Number, default: 0 },
      whip: { type: Number, default: 0 },
      qualityStarts: { type: Number, default: 0 },
    },
    
    projectedAtBats: { type: Number },
    projectedInnings: { type: Number },
    injuryStatus: { type: String, default: 'Healthy' },
    notes: { type: String, default: '' },
    
    isAvailable: { type: Boolean, default: true },
    lastSeason: { type: Number, required: true },
    
    calculatedValue: { type: Number },
    positionScarcity: { type: Number },
  },
  { timestamps: true }
);

// Indexes for efficient querying
PlayerSchema.index({ name: 1 });
PlayerSchema.index({ positions: 1 });
PlayerSchema.index({ isPitcher: 1 });
PlayerSchema.index({ isAvailable: 1 });
PlayerSchema.index({ calculatedValue: -1 });

export default mongoose.models.Player || mongoose.model<IPlayer>('Player', PlayerSchema);
