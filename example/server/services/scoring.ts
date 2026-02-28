import Player from '../models/Player';
import { ILeague, IScoringCategory } from '../models/League';

interface PlayerScore {
  playerId: string;
  playerName: string;
  totalZScore: number;
  categoryScores: { [category: string]: number };
  positionScarcity: number;
  suggestedValue: number;
}

export class ScoringService {
  /**
   * Calculate Z-scores for all players based on league scoring categories
   */
  static async calculatePlayerValues(
    league: ILeague
  ): Promise<PlayerScore[]> {
    try {
      const players = await Player.find({ isAvailable: true });
      
      // Separate pitchers and hitters
      const pitchers = players.filter(p => p.isPitcher);
      const hitters = players.filter(p => !p.isPitcher);
      
      // Get scoring categories
      const pitcherCategories = league.scoringCategories.filter(c => c.isPitcherStat);
      const hitterCategories = league.scoringCategories.filter(c => !c.isPitcherStat);
      
      // Calculate Z-scores for each category
      const pitcherScores = this.calculateZScores(pitchers, pitcherCategories, true);
      const hitterScores = this.calculateZScores(hitters, hitterCategories, false);
      
      // Combine scores
      const allScores = [...pitcherScores, ...hitterScores];
      
      // Calculate position scarcity
      const scoresWithScarcity = this.applyPositionScarcity(
        allScores,
        league.rosterSpots,
        league.numOwners
      );
      
      // Convert Z-scores to dollar values
      const totalBudget = league.numOwners * league.budgetPerOwner;
      const rosterSpots = league.numOwners * league.rosterSize;
      const scoresWithValues = this.convertToValues(
        scoresWithScarcity,
        totalBudget,
        rosterSpots
      );
      
      // Update player documents with calculated values
      for (const score of scoresWithValues) {
        await Player.findByIdAndUpdate(score.playerId, {
          calculatedValue: score.suggestedValue,
          positionScarcity: score.positionScarcity,
        });
      }
      
      // Sort by value
      return scoresWithValues.sort((a, b) => b.suggestedValue - a.suggestedValue);
      
    } catch (error) {
      console.error('Error calculating player values:', error);
      throw error;
    }
  }
  
  /**
   * Calculate Z-scores for players based on categories
   */
  private static calculateZScores(
    players: any[],
    categories: IScoringCategory[],
    isPitcher: boolean
  ): PlayerScore[] {
    const scores: PlayerScore[] = [];
    
    // Calculate mean and std dev for each category
    const categoryStats: { [key: string]: { mean: number; stdDev: number } } = {};
    
    for (const category of categories) {
      const values = players.map(p => 
        this.getStatValue(p, category.name, isPitcher)
      ).filter(v => v !== null && !isNaN(v)) as number[];
      
      if (values.length === 0) continue;
      
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);
      
      categoryStats[category.name] = { mean, stdDev };
    }
    
    // Calculate Z-score for each player
    for (const player of players) {
      const categoryScores: { [category: string]: number } = {};
      let totalZScore = 0;
      
      for (const category of categories) {
        const value = this.getStatValue(player, category.name, isPitcher);
        
        if (value !== null && categoryStats[category.name]) {
          const { mean, stdDev } = categoryStats[category.name];
          
          let zScore = stdDev > 0 ? (value - mean) / stdDev : 0;
          
          // For ERA and WHIP, lower is better, so invert
          if (category.name === 'ERA' || category.name === 'WHIP') {
            zScore = -zScore;
          }
          
          // Apply weight
          zScore *= category.weight;
          
          categoryScores[category.name] = zScore;
          totalZScore += zScore;
        }
      }
      
      scores.push({
        playerId: player._id.toString(),
        playerName: player.name,
        totalZScore,
        categoryScores,
        positionScarcity: 0,
        suggestedValue: 0,
      });
    }
    
    return scores;
  }
  
  /**
   * Get stat value for a player
   */
  private static getStatValue(
    player: any,
    statName: string,
    isPitcher: boolean
  ): number | null {
    if (isPitcher && player.pitcherStats) {
      const stats = player.pitcherStats;
      switch (statName) {
        case 'Wins': return stats.wins;
        case 'Saves': return stats.saves;
        case 'Strikeouts': return stats.strikeouts;
        case 'ERA': return stats.era;
        case 'WHIP': return stats.whip;
        case 'Quality Starts': return stats.qualityStarts;
        default: return null;
      }
    } else if (!isPitcher && player.hitterStats) {
      const stats = player.hitterStats;
      switch (statName) {
        case 'Home Runs': return stats.homeRuns;
        case 'Runs': return stats.runs;
        case 'RBI': return stats.rbi;
        case 'Stolen Bases': return stats.stolenBases;
        case 'Batting Average': return stats.battingAverage;
        case 'OBP': return stats.onBasePercentage;
        case 'OPS': return stats.ops;
        default: return null;
      }
    }
    return null;
  }
  
  /**
   * Apply position scarcity bonus
   */
  private static applyPositionScarcity(
    scores: PlayerScore[],
    rosterSpots: any[],
    numOwners: number
  ): PlayerScore[] {
    // Count how many players are needed per position
    const positionDemand: { [position: string]: number } = {};
    for (const spot of rosterSpots) {
      positionDemand[spot.position] = spot.count * numOwners;
    }
    
    // Get players and their positions
    const scoresWithPositions = scores.map(score => {
      const player = Player.findById(score.playerId);
      return { ...score, positions: [] }; // Will be populated from DB
    });
    
    // For scarce positions (like catchers), add bonus
    const scarcityBonuses: { [position: string]: number } = {
      'C': 0.15,      // Catchers are scarce
      '2B/SS': 0.08,
      '1B/3B': 0.08,
      'P': 0.05,
    };
    
    return scores.map(score => {
      // This is simplified - in real impl, look up player positions
      const scarcityBonus = 0; // Calculate based on position
      score.positionScarcity = scarcityBonus;
      score.totalZScore += scarcityBonus;
      return score;
    });
  }
  
  /**
   * Convert Z-scores to dollar values
   */
  private static convertToValues(
    scores: PlayerScore[],
    totalBudget: number,
    totalRosterSpots: number
  ): PlayerScore[] {
    // Reserve $1 per roster spot (minimum)
    const availableBudget = totalBudget - totalRosterSpots;
    
    // Calculate total positive Z-score
    const totalPositiveZScore = scores
      .filter(s => s.totalZScore > 0)
      .reduce((sum, s) => sum + s.totalZScore, 0);
    
    if (totalPositiveZScore === 0) {
      return scores.map(s => ({ ...s, suggestedValue: 1 }));
    }
    
    // Distribute budget based on Z-score proportion
    return scores.map(score => {
      if (score.totalZScore <= 0) {
        score.suggestedValue = 1;
      } else {
        const proportion = score.totalZScore / totalPositiveZScore;
        const value = Math.max(1, Math.round(proportion * availableBudget));
        score.suggestedValue = value;
      }
      return score;
    });
  }
  
  /**
   * Get top players by position
   */
  static async getTopPlayersByPosition(
    position: string,
    limit: number = 20
  ): Promise<any[]> {
    const query: any = { isAvailable: true };
    
    if (position !== 'ALL') {
      query.positions = position;
    }
    
    return await Player.find(query)
      .sort({ calculatedValue: -1 })
      .limit(limit);
  }
  
  /**
   * Get player recommendations based on current roster needs
   */
  static async getRecommendations(
    leagueId: string,
    ownerName: string,
    maxPrice: number
  ): Promise<any[]> {
    // This would analyze the owner's current roster and recommend
    // players that fill position needs and are within budget
    // Simplified implementation here
    
    return await Player.find({
      isAvailable: true,
      calculatedValue: { $lte: maxPrice },
    })
      .sort({ calculatedValue: -1 })
      .limit(10);
  }
}
