import axios from 'axios';
import Player from '../models/Player';

const MLB_API_BASE = 'https://statsapi.mlb.com/api/v1';

interface MLBPlayer {
  id: number;
  fullName: string;
  primaryPosition: {
    code: string;
    name: string;
    type: string;
    abbreviation: string;
  };
  currentTeam?: {
    id: number;
    name: string;
  };
}

interface MLBStats {
  hitting?: any;
  pitching?: any;
}

export class MLBDataService {
  /**
   * Fetch all active MLB players
   */
  static async fetchAllPlayers(season: number = 2025): Promise<void> {
    try {
      console.log('Fetching MLB players...');
      
      // Get all teams
      const teamsResponse = await axios.get(`${MLB_API_BASE}/teams`, {
        params: { sportId: 1, season }
      });
      
      const teams = teamsResponse.data.teams;
      
      for (const team of teams) {
        try {
          // Get roster for each team
          const rosterResponse = await axios.get(
            `${MLB_API_BASE}/teams/${team.id}/roster`,
            {
              params: { 
                rosterType: 'active',
                season 
              }
            }
          );
          
          const roster = rosterResponse.data.roster || [];
          
          for (const rosterEntry of roster) {
            const player = rosterEntry.person;
            const position = rosterEntry.position;
            
            // Get player stats
            const stats = await this.fetchPlayerStats(player.id, season);
            
            // Determine if pitcher
            const isPitcher = position.type === 'Pitcher';
            
            // Get eligible positions
            const positions = this.getEligiblePositions(position, isPitcher);
            
            // Check if player exists
            const existingPlayer = await Player.findOne({ mlbId: player.id });
            
            const playerData = {
              mlbId: player.id,
              name: player.fullName,
              team: team.name,
              positions,
              isPitcher,
              ...(isPitcher ? {
                pitcherStats: stats.pitching
              } : {
                hitterStats: stats.hitting
              }),
              injuryStatus: 'Healthy',
              isAvailable: true,
              lastSeason: season,
            };
            
            if (existingPlayer) {
              await Player.findByIdAndUpdate(existingPlayer._id, playerData);
            } else {
              await Player.create(playerData);
            }
          }
          
          console.log(`Processed team: ${team.name}`);
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error) {
          console.error(`Error processing team ${team.name}:`, error);
        }
      }
      
      console.log('Player data fetch completed!');
      
    } catch (error) {
      console.error('Error fetching MLB data:', error);
      throw error;
    }
  }
  
  /**
   * Fetch stats for a specific player
   */
  static async fetchPlayerStats(playerId: number, season: number): Promise<MLBStats> {
    try {
      const statsResponse = await axios.get(
        `${MLB_API_BASE}/people/${playerId}/stats`,
        {
          params: {
            stats: 'season',
            season,
            group: 'hitting,pitching'
          }
        }
      );
      
      const stats = statsResponse.data.stats || [];
      const result: MLBStats = {};
      
      // Parse hitting stats
      const hittingStats = stats.find((s: any) => s.group?.displayName === 'hitting');
      if (hittingStats?.splits?.[0]?.stat) {
        const stat = hittingStats.splits[0].stat;
        result.hitting = {
          atBats: stat.atBats || 0,
          hits: stat.hits || 0,
          homeRuns: stat.homeRuns || 0,
          runs: stat.runs || 0,
          rbi: stat.rbi || 0,
          stolenBases: stat.stolenBases || 0,
          battingAverage: parseFloat(stat.avg || '0'),
          onBasePercentage: parseFloat(stat.obp || '0'),
          sluggingPercentage: parseFloat(stat.slg || '0'),
          ops: parseFloat(stat.ops || '0'),
        };
      }
      
      // Parse pitching stats
      const pitchingStats = stats.find((s: any) => s.group?.displayName === 'pitching');
      if (pitchingStats?.splits?.[0]?.stat) {
        const stat = pitchingStats.splits[0].stat;
        result.pitching = {
          wins: stat.wins || 0,
          losses: stat.losses || 0,
          saves: stat.saves || 0,
          strikeouts: stat.strikeOuts || 0,
          inningsPitched: parseFloat(stat.inningsPitched || '0'),
          era: parseFloat(stat.era || '0'),
          whip: parseFloat(stat.whip || '0'),
          qualityStarts: stat.qualityStarts || 0,
        };
      }
      
      return result;
      
    } catch (error) {
      console.error(`Error fetching stats for player ${playerId}:`, error);
      return {};
    }
  }
  
  /**
   * Get eligible positions based on primary position
   */
  static getEligiblePositions(position: any, isPitcher: boolean): string[] {
    if (isPitcher) {
      return ['P'];
    }
    
    const code = position.abbreviation;
    const eligiblePositions: string[] = [code];
    
    // Add multi-position eligibility
    if (code === '1B' || code === '3B') {
      eligiblePositions.push('1B/3B');
    }
    if (code === '2B' || code === 'SS') {
      eligiblePositions.push('2B/SS');
    }
    
    // Utility eligibility 
    if (!isPitcher && code !== 'C') {
      eligiblePositions.push('UT');
    }
    
    return eligiblePositions;
  }
  
  /**
   * Update a single player's stats
   */
  static async updatePlayerStats(mlbId: number, season: number): Promise<void> {
    try {
      const stats = await this.fetchPlayerStats(mlbId, season);
      
      const player = await Player.findOne({ mlbId });
      if (!player) {
        console.error(`Player with mlbId ${mlbId} not found`);
        return;
      }
      
      if (player.isPitcher && stats.pitching) {
        player.pitcherStats = stats.pitching;
      } else if (!player.isPitcher && stats.hitting) {
        player.hitterStats = stats.hitting;
      }
      
      await player.save();
      console.log(`Updated stats for ${player.name}`);
      
    } catch (error) {
      console.error(`Error updating player ${mlbId}:`, error);
    }
  }
  
  /**
   * Fetch sample data for testing (subset of players)
   */
  static async fetchSamplePlayers(season: number = 2025): Promise<void> {
    try {
      console.log('Fetching sample MLB players...');
      
      // Just fetch a few major teams for testing
      const teamIds = [147, 121, 110, 111, 119]; // Yankees, Mets, Dodgers, Red Sox, Astros
      
      for (const teamId of teamIds) {
        try {
          const rosterResponse = await axios.get(
            `${MLB_API_BASE}/teams/${teamId}/roster`,
            {
              params: { 
                rosterType: 'active',
                season 
              }
            }
          );
          
          const roster = rosterResponse.data.roster || [];
          const teamName = rosterResponse.data.teamName || `Team ${teamId}`;
          
          for (const rosterEntry of roster) {
            const player = rosterEntry.person;
            const position = rosterEntry.position;
            
            const stats = await this.fetchPlayerStats(player.id, season);
            const isPitcher = position.type === 'Pitcher';
            const positions = this.getEligiblePositions(position, isPitcher);
            
            const existingPlayer = await Player.findOne({ mlbId: player.id });
            
            const playerData = {
              mlbId: player.id,
              name: player.fullName,
              team: teamName,
              positions,
              isPitcher,
              ...(isPitcher ? {
                pitcherStats: stats.pitching || {
                  wins: 0, losses: 0, saves: 0, strikeouts: 0,
                  inningsPitched: 0, era: 0, whip: 0, qualityStarts: 0
                }
              } : {
                hitterStats: stats.hitting || {
                  atBats: 0, hits: 0, homeRuns: 0, runs: 0, rbi: 0,
                  stolenBases: 0, battingAverage: 0, onBasePercentage: 0,
                  sluggingPercentage: 0, ops: 0
                }
              }),
              injuryStatus: 'Healthy',
              isAvailable: true,
              lastSeason: season,
            };
            
            if (existingPlayer) {
              await Player.findByIdAndUpdate(existingPlayer._id, playerData);
            } else {
              await Player.create(playerData);
            }
          }
          
          console.log(`Processed team: ${teamName}`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.error(`Error processing team ${teamId}:`, error);
        }
      }
      
      console.log('Sample player data fetch completed!');
      
    } catch (error) {
      console.error('Error fetching sample MLB data:', error);
      throw error;
    }
  }
}
