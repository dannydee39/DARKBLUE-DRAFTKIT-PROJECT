// Player Types
export interface Player {
  _id: string;
  mlbId: number;
  name: string;
  team: string;
  positions: string[];
  isPitcher: boolean;
  hitterStats?: HitterStats;
  pitcherStats?: PitcherStats;
  projectedAtBats?: number;
  projectedInnings?: number;
  injuryStatus: string;
  notes: string;
  isAvailable: boolean;
  lastSeason: number;
  calculatedValue?: number;
  positionScarcity?: number;
}

export interface HitterStats {
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
}

export interface PitcherStats {
  wins: number;
  losses: number;
  saves: number;
  strikeouts: number;
  inningsPitched: number;
  era: number;
  whip: number;
  qualityStarts: number;
}

// League Types
export interface League {
  _id: string;
  name: string;
  commissioner: string;
  season: number;
  numOwners: number;
  budgetPerOwner: number;
  rosterSize: number;
  rosterSpots: RosterSpot[];
  scoringCategories: ScoringCategory[];
  owners: Owner[];
  draftStatus: 'not-started' | 'in-progress' | 'completed';
  currentNominator?: string;
  currentAuction?: CurrentAuction;
  isKeeperLeague: boolean;
  maxKeepYears: number;
  hasTaxiSquad: boolean;
  taxiSquadSize: number;
}

export interface RosterSpot {
  position: string;
  count: number;
}

export interface ScoringCategory {
  name: string;
  type: 'counting' | 'rate';
  isPitcherStat: boolean;
  weight: number;
}

export interface Owner {
  name: string;
  budget: number;
  remainingBudget: number;
  roster: RosterPlayer[];
  emptySlots: number;
  maxBid: number;
}

export interface RosterPlayer {
  playerId: string;
  playerName: string;
  position: string;
  costDrafted: number;
  yearAcquired?: number;
  isKeeper?: boolean;
}

export interface CurrentAuction {
  playerId: string;
  playerName: string;
  nominatedBy: string;
  currentBid: number;
  currentBidder: string;
  biddingEndsAt?: Date;
}

// Draft Event Types
export interface DraftEvent {
  _id: string;
  leagueId: string;
  eventType: 'nominate' | 'bid' | 'purchase' | 'pass';
  playerId: string;
  playerName: string;
  ownerName: string;
  amount?: number;
  timestamp: Date;
}

// API Request/Response Types
export interface CreateLeagueRequest {
  name: string;
  commissioner: string;
  season: number;
  numOwners?: number;
  budgetPerOwner?: number;
  owners: string[];
  customRosterSpots?: RosterSpot[];
  customScoringCategories?: ScoringCategory[];
}

export interface NominatePlayerRequest {
  leagueId: string;
  playerId: string;
  ownerName: string;
  initialBid: number;
}

export interface BidRequest {
  leagueId: string;
  ownerName: string;
  amount: number;
}

export interface PlayerValuation {
  playerId: string;
  playerName: string;
  suggestedValue: number;
  positionValue: number;
  scarcityFactor: number;
  zScore: number;
  ranking: number;
}

// Socket Events
export interface SocketEvents {
  // Client -> Server
  'draft:join': (leagueId: string) => void;
  'draft:nominate': (data: NominatePlayerRequest) => void;
  'draft:bid': (data: BidRequest) => void;
  
  // Server -> Client
  'draft:update': (league: League) => void;
  'draft:new-bid': (data: { ownerName: string; amount: number }) => void;
  'draft:player-drafted': (data: { ownerName: string; playerName: string; amount: number }) => void;
  'draft:error': (error: string) => void;
}
