import { Router, Request, Response } from 'express';
import League from '../models/League';
import Player from '../models/Player';
import { ScoringService } from '../services/scoring';

const router = Router();

/**
 * POST /api/leagues - Create new league
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      name,
      commissioner,
      season,
      numOwners = 12,
      budgetPerOwner = 260,
      rosterSize = 23,
      owners,
      customRosterSpots,
      customScoringCategories,
    } = req.body;
    
    // Default roster configuration
    const defaultRosterSpots = [
      { position: 'C', count: 2 },
      { position: '1B', count: 1 },
      { position: '2B', count: 1 },
      { position: '3B', count: 1 },
      { position: 'SS', count: 1 },
      { position: '1B/3B', count: 1 },
      { position: '2B/SS', count: 1 },
      { position: 'OF', count: 5 },
      { position: 'UT', count: 1 },
      { position: 'P', count: 9 },
    ];
    
    // Default scoring categories
    const defaultScoringCategories = [
      // Hitter categories
      { name: 'Home Runs', type: 'counting', isPitcherStat: false, weight: 1 },
      { name: 'Runs', type: 'counting', isPitcherStat: false, weight: 1 },
      { name: 'RBI', type: 'counting', isPitcherStat: false, weight: 1 },
      { name: 'Stolen Bases', type: 'counting', isPitcherStat: false, weight: 1 },
      { name: 'Batting Average', type: 'rate', isPitcherStat: false, weight: 1 },
      { name: 'OPS', type: 'rate', isPitcherStat: false, weight: 1 },
      
      // Pitcher categories
      { name: 'Wins', type: 'counting', isPitcherStat: true, weight: 1 },
      { name: 'Saves', type: 'counting', isPitcherStat: true, weight: 1 },
      { name: 'Strikeouts', type: 'counting', isPitcherStat: true, weight: 1 },
      { name: 'ERA', type: 'rate', isPitcherStat: true, weight: 1 },
      { name: 'WHIP', type: 'rate', isPitcherStat: true, weight: 1 },
    ];
    
    // Create owner objects
    const ownerObjects = owners.map((ownerName: string) => ({
      name: ownerName,
      budget: budgetPerOwner,
      remainingBudget: budgetPerOwner,
      roster: [],
      emptySlots: rosterSize,
      maxBid: budgetPerOwner - rosterSize + 1,
    }));
    
    const league = await League.create({
      name,
      commissioner,
      season,
      numOwners,
      budgetPerOwner,
      rosterSize,
      rosterSpots: customRosterSpots || defaultRosterSpots,
      scoringCategories: customScoringCategories || defaultScoringCategories,
      owners: ownerObjects,
      draftStatus: 'not-started',
    });
    
    // Calculate initial player valuations
    await ScoringService.calculatePlayerValues(league);
    
    res.status(201).json({
      success: true,
      data: league,
    });
    
  } catch (error) {
    console.error('Error creating league:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating league',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/leagues - Get all leagues
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const leagues = await League.find().sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: leagues,
    });
    
  } catch (error) {
    console.error('Error fetching leagues:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching leagues',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/leagues/:id - Get specific league
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const league = await League.findById(req.params.id);
    
    if (!league) {
      return res.status(404).json({
        success: false,
        message: 'League not found',
      });
    }
    
    res.json({
      success: true,
      data: league,
    });
    
  } catch (error) {
    console.error('Error fetching league:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching league',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PATCH /api/leagues/:id - Update league settings
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const updates = req.body;
    
    const league = await League.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    );
    
    if (!league) {
      return res.status(404).json({
        success: false,
        message: 'League not found',
      });
    }
    
    res.json({
      success: true,
      data: league,
    });
    
  } catch (error) {
    console.error('Error updating league:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating league',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/leagues/:id/start-draft - Start the draft
 */
router.post('/:id/start-draft', async (req: Request, res: Response) => {
  try {
    const league = await League.findById(req.params.id);
    
    if (!league) {
      return res.status(404).json({
        success: false,
        message: 'League not found',
      });
    }
    
    if (league.draftStatus !== 'not-started') {
      return res.status(400).json({
        success: false,
        message: 'Draft already started or completed',
      });
    }
    
    league.draftStatus = 'in-progress';
    league.currentNominator = league.owners[0].name;
    await league.save();
    
    res.json({
      success: true,
      data: league,
    });
    
  } catch (error) {
    console.error('Error starting draft:', error);
    res.status(500).json({
      success: false,
      message: 'Error starting draft',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/leagues/:id/add-keeper - Add keeper player to owner's roster
 */
router.post('/:id/add-keeper', async (req: Request, res: Response) => {
  try {
    const { ownerName, playerId, costDrafted, yearAcquired } = req.body;
    
    const league = await League.findById(req.params.id);
    if (!league) {
      return res.status(404).json({
        success: false,
        message: 'League not found',
      });
    }
    
    const owner = league.owners.find((o: any) => o.name === ownerName);
    if (!owner) {
      return res.status(404).json({
        success: false,
        message: 'Owner not found',
      });
    }
    
    const player = await Player.findById(playerId);
    if (!player) {
      return res.status(404).json({
        success: false,
        message: 'Player not found',
      });
    }
    
    // Add to roster
    owner.roster.push({
      playerId: player._id,
      playerName: player.name,
      position: player.positions[0],
      costDrafted,
      yearAcquired,
      isKeeper: true,
    });
    
    // Update budget
    owner.remainingBudget -= costDrafted;
    owner.emptySlots -= 1;
    owner.maxBid = owner.remainingBudget - owner.emptySlots + 1;
    
    // Mark player as unavailable
    player.isAvailable = false;
    await player.save();
    
    await league.save();
    
    res.json({
      success: true,
      data: league,
    });
    
  } catch (error) {
    console.error('Error adding keeper:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding keeper',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/leagues/:id/valuations - Get player valuations for this league
 */
router.get('/:id/valuations', async (req: Request, res: Response) => {
  try {
    const league = await League.findById(req.params.id);
    if (!league) {
      return res.status(404).json({
        success: false,
        message: 'League not found',
      });
    }
    
    const valuations = await ScoringService.calculatePlayerValues(league);
    
    res.json({
      success: true,
      data: valuations,
    });
    
  } catch (error) {
    console.error('Error calculating valuations:', error);
    res.status(500).json({
      success: false,
      message: 'Error calculating valuations',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/leagues/:id/statistics - Get league statistics
 */
router.get('/:id/statistics', async (req: Request, res: Response) => {
  try {
    const league = await League.findById(req.params.id);
    if (!league) {
      return res.status(404).json({
        success: false,
        message: 'League not found',
      });
    }
    
    // Calculate statistics
    const totalPlayersDrafted = league.owners.reduce((sum: any, owner: any) => 
      sum + owner.roster.length, 0
    );
    
    const totalSpent = league.owners.reduce((sum: any, owner: any) => 
      owner.budget - owner.remainingBudget, 0
    );
    
    const totalRosterSpots = league.numOwners * league.rosterSize;
    const emptySpots = league.owners.reduce((sum: any, owner: any) => 
      sum + owner.emptySlots, 0
    );
    
    const avgPlayerCost = totalPlayersDrafted > 0 
      ? totalSpent / totalPlayersDrafted 
      : 0;
    
    const draftProgress = totalRosterSpots > 0 
      ? (totalPlayersDrafted / totalRosterSpots) * 100 
      : 0;
    
    // Owner standings
    const ownerStats = league.owners.map((owner: any) => ({
      name: owner.name,
      playersAcquired: owner.roster.length,
      totalSpent: owner.budget - owner.remainingBudget,
      remainingBudget: owner.remainingBudget,
      emptySlots: owner.emptySlots,
      maxBid: owner.maxBid,
      avgPay: owner.roster.length > 0 
        ? (owner.budget - owner.remainingBudget) / owner.roster.length 
        : 0,
    }));
    
    res.json({
      success: true,
      data: {
        leagueName: league.name,
        draftStatus: league.draftStatus,
        progress: {
          playersDrafted: totalPlayersDrafted,
          totalRosterSpots,
          emptySpots,
          percentComplete: draftProgress.toFixed(1),
        },
        financial: {
          totalBudget: league.numOwners * league.budgetPerOwner,
          totalSpent,
          totalRemaining: league.numOwners * league.budgetPerOwner - totalSpent,
          avgPlayerCost: avgPlayerCost.toFixed(1),
        },
        owners: ownerStats.sort((a: any, b: any) => b.playersAcquired - a.playersAcquired),
      },
    });
    
  } catch (error) {
    console.error('Error calculating league statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error calculating league statistics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/leagues/:id/roster/:ownerName - Get specific owner's roster
 */
router.get('/:id/roster/:ownerName', async (req: Request, res: Response) => {
  try {
    const league = await League.findById(req.params.id);
    if (!league) {
      return res.status(404).json({
        success: false,
        message: 'League not found',
      });
    }
    
    const owner = league.owners.find((o: any) => o.name === req.params.ownerName);
    if (!owner) {
      return res.status(404).json({
        success: false,
        message: 'Owner not found',
      });
    }
    
    // Get full player details for roster
    const playerIds = owner.roster.map((r: any) => r.playerId);
    const players = await Player.find({ _id: { $in: playerIds } });
    
    const rosterWithDetails = owner.roster.map((r: any) => {
      const player = players.find((p: any) => p._id.toString() === r.playerId.toString());
      return {
        ...r.toObject(),
        fullDetails: player,
      };
    });
    
    res.json({
      success: true,
      data: {
        owner: owner.name,
        budget: owner.budget,
        remainingBudget: owner.remainingBudget,
        emptySlots: owner.emptySlots,
        maxBid: owner.maxBid,
        roster: rosterWithDetails,
      },
    });
    
  } catch (error) {
    console.error('Error fetching roster:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching roster',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

