import mongoose, { Schema, Document } from 'mongoose';

export interface IDraftEvent extends Document {
  leagueId: mongoose.Types.ObjectId;
  eventType: 'nominate' | 'bid' | 'purchase' | 'pass';
  
  playerId: mongoose.Types.ObjectId;
  playerName: string;
  
  ownerName: string;
  amount?: number;
  
  timestamp: Date;
}

const DraftEventSchema: Schema = new Schema({
  leagueId: { type: Schema.Types.ObjectId, ref: 'League', required: true },
  eventType: {
    type: String,
    enum: ['nominate', 'bid', 'purchase', 'pass'],
    required: true,
  },
  
  playerId: { type: Schema.Types.ObjectId, ref: 'Player', required: true },
  playerName: { type: String, required: true },
  
  ownerName: { type: String, required: true },
  amount: { type: Number },
  
  timestamp: { type: Date, default: Date.now },
});

DraftEventSchema.index({ leagueId: 1, timestamp: -1 });

export default mongoose.models.DraftEvent || mongoose.model<IDraftEvent>('DraftEvent', DraftEventSchema);
