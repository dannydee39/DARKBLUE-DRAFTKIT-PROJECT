import { Router, Request, Response } from 'express';
import Player from '../models/Player';

const router = Router();

/**
 * GET /api/players - Get all players with optional filters
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      position,
      isPitcher,
      available,
      team,
      search,
      sortBy = 'calculatedValue',
      order = 'desc',
      limit = 100,
      skip = 0
    } = req.query;
    
    const query: any = {};
    
    if (position) {
      query.positions = position;
    }
    
    if (isPitcher !== undefined) {
      query.isPitcher = isPitcher === 'true';
    }
    
    if (available !== undefined) {
      query.isAvailable = available === 'true';
    }
    
    if (team) {
      query.team = team;
    }
    
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    
    const sortOrder = order === 'desc' ? -1 : 1;
    const sortObj: any = {};
    sortObj[sortBy as string] = sortOrder;
    
    const players = await Player.find(query)
      .sort(sortObj)
      .limit(Number(limit))
      .skip(Number(skip));
    
    const total = await Player.countDocuments(query);
    
    res.json({
      success: true,
      data: players,
      pagination: {
        total,
        limit: Number(limit),
        skip: Number(skip),
      },
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

/**
 * GET /api/players/:id - Get specific player
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const player = await Player.findById(req.params.id);
    
    if (!player) {
      return res.status(404).json({
        success: false,
        message: 'Player not found',
      });
    }
    
    res.json({
      success: true,
      data: player,
    });
    
  } catch (error) {
    console.error('Error fetching player:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching player',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/players/mlb/:mlbId - Get player by MLB ID
 */
router.get('/mlb/:mlbId', async (req: Request, res: Response) => {
  try {
    const player = await Player.findOne({ mlbId: Number(req.params.mlbId) });
    
    if (!player) {
      return res.status(404).json({
        success: false,
        message: 'Player not found',
      });
    }
    
    res.json({
      success: true,
      data: player,
    });
    
  } catch (error) {
    console.error('Error fetching player:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching player',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/players/position/:position - Get top players by position
 */
router.get('/position/:position', async (req: Request, res: Response) => {
  try {
    const { position } = req.params;
    const { limit = 20 } = req.query;
    
    const query: any = {
      isAvailable: true,
      positions: position,
    };
    
    const players = await Player.find(query)
      .sort({ calculatedValue: -1 })
      .limit(Number(limit));
    
    res.json({
      success: true,
      data: players,
    });
    
  } catch (error) {
    console.error('Error fetching players by position:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching players by position',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/players/teams/all - Get all unique teams
 */
router.get('/teams/all', async (req: Request, res: Response) => {
  try {
    const teams = await Player.distinct('team');
    
    res.json({
      success: true,
      data: teams.sort(),
    });
    
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching teams',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PATCH /api/players/:id - Update player (for manual adjustments)
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { notes, injuryStatus, projectedAtBats, projectedInnings } = req.body;
    
    const updateData: any = {};
    if (notes !== undefined) updateData.notes = notes;
    if (injuryStatus !== undefined) updateData.injuryStatus = injuryStatus;
    if (projectedAtBats !== undefined) updateData.projectedAtBats = projectedAtBats;
    if (projectedInnings !== undefined) updateData.projectedInnings = projectedInnings;
    
    const player = await Player.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );
    
    if (!player) {
      return res.status(404).json({
        success: false,
        message: 'Player not found',
      });
    }
    
    res.json({
      success: true,
      data: player,
    });
    
  } catch (error) {
    console.error('Error updating player:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating player',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/players/compare - Compare multiple players
 */
router.post('/compare', async (req: Request, res: Response) => {
  try {
    const { playerIds } = req.body;
    
    if (!Array.isArray(playerIds) || playerIds.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Provide at least 2 player IDs to compare',
      });
    }
    
    const players = await Player.find({ _id: { $in: playerIds } });
    
    // Calculate comparison metrics
    const comparison = players.map(player => ({
      id: player._id,
      name: player.name,
      team: player.team,
      positions: player.positions,
      isPitcher: player.isPitcher,
      calculatedValue: player.calculatedValue,
      stats: player.isPitcher ? player.pitcherStats : player.hitterStats,
      injuryStatus: player.injuryStatus,
      isAvailable: player.isAvailable,
    }));
    
    res.json({
      success: true,
      data: comparison,
    });
    
  } catch (error) {
    console.error('Error comparing players:', error);
    res.status(500).json({
      success: false,
      message: 'Error comparing players',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

