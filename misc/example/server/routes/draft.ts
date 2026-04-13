import { Router, Request, Response } from 'express';
import League from '../models/League';
import Player from '../models/Player';
import DraftEvent from '../models/DraftEvent';

const router = Router();

/**
 * POST /api/draft/nominate - Nominate a player for auction
 */
router.post('/nominate', async (req: Request, res: Response) => {
  try {
    const { leagueId, playerId, ownerName, initialBid } = req.body;
    
    const league = await League.findById(leagueId);
    if (!league) {
      return res.status(404).json({
        success: false,
        message: 'League not found',
      });
    }
    
    if (league.draftStatus !== 'in-progress') {
      return res.status(400).json({
        success: false,
        message: 'Draft is not in progress',
      });
    }
    
    const player = await Player.findById(playerId);
    if (!player) {
      return res.status(404).json({
        success: false,
        message: 'Player not found',
      });
    }
    
    if (!player.isAvailable) {
      return res.status(400).json({
        success: false,
        message: 'Player is not available',
      });
    }
    
    const owner = league.owners.find((o: any) => o.name === ownerName);
    if (!owner) {
      return res.status(404).json({
        success: false,
        message: 'Owner not found',
      });
    }
    
    // Check if owner can afford the bid
    if (initialBid > owner.maxBid) {
      return res.status(400).json({
        success: false,
        message: `Cannot bid more than max bid of $${owner.maxBid}`,
      });
    }
    
    if (initialBid < 1) {
      return res.status(400).json({
        success: false,
        message: 'Minimum bid is $1',
      });
    }
    
    // Set current auction
    league.currentAuction = {
      playerId: player._id,
      playerName: player.name,
      nominatedBy: ownerName,
      currentBid: initialBid,
      currentBidder: ownerName,
    };
    
    await league.save();
    
    // Log draft event
    await DraftEvent.create({
      leagueId,
      eventType: 'nominate',
      playerId,
      playerName: player.name,
      ownerName,
      amount: initialBid,
    });
    
    res.json({
      success: true,
      data: league,
    });
    
  } catch (error) {
    console.error('Error nominating player:', error);
    res.status(500).json({
      success: false,
      message: 'Error nominating player',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/draft/bid - Place a bid on current auction
 */
router.post('/bid', async (req: Request, res: Response) => {
  try {
    const { leagueId, ownerName, amount } = req.body;
    
    const league = await League.findById(leagueId);
    if (!league) {
      return res.status(404).json({
        success: false,
        message: 'League not found',
      });
    }
    
    if (!league.currentAuction) {
      return res.status(400).json({
        success: false,
        message: 'No active auction',
      });
    }
    
    const owner = league.owners.find((o: any) => o.name === ownerName);
    if (!owner) {
      return res.status(404).json({
        success: false,
        message: 'Owner not found',
      });
    }
    
    // Check valid bid
    if (amount <= league.currentAuction.currentBid) {
      return res.status(400).json({
        success: false,
        message: `Bid must be higher than current bid of $${league.currentAuction.currentBid}`,
      });
    }
    
    if (amount > owner.maxBid) {
      return res.status(400).json({
        success: false,
        message: `Cannot bid more than max bid of $${owner.maxBid}`,
      });
    }
    
    // Update auction
    league.currentAuction.currentBid = amount;
    league.currentAuction.currentBidder = ownerName;
    await league.save();
    
    // Log draft event
    await DraftEvent.create({
      leagueId,
      eventType: 'bid',
      playerId: league.currentAuction.playerId,
      playerName: league.currentAuction.playerName,
      ownerName,
      amount,
    });
    
    res.json({
      success: true,
      data: league,
    });
    
  } catch (error) {
    console.error('Error placing bid:', error);
    res.status(500).json({
      success: false,
      message: 'Error placing bid',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/draft/complete - Complete current auction
 */
router.post('/complete', async (req: Request, res: Response) => {
  try {
    const { leagueId } = req.body;
    
    const league = await League.findById(leagueId);
    if (!league) {
      return res.status(404).json({
        success: false,
        message: 'League not found',
      });
    }
    
    if (!league.currentAuction) {
      return res.status(400).json({
        success: false,
        message: 'No active auction',
      });
    }
    
    const auction = league.currentAuction;
    const owner = league.owners.find((o: any) => o.name === auction.currentBidder);
    if (!owner) {
      return res.status(404).json({
        success: false,
        message: 'Owner not found',
      });
    }
    
    const player = await Player.findById(auction.playerId);
    if (!player) {
      return res.status(404).json({
        success: false,
        message: 'Player not found',
      });
    }
    
    // Add player to owner's roster
    owner.roster.push({
      playerId: player._id,
      playerName: player.name,
      position: player.positions[0],
      costDrafted: auction.currentBid,
      isKeeper: false,
    });
    
    // Update owner's budget
    owner.remainingBudget -= auction.currentBid;
    owner.emptySlots -= 1;
    owner.maxBid = owner.remainingBudget - owner.emptySlots + 1;
    
    // Mark player as unavailable
    player.isAvailable = false;
    await player.save();
    
    // Log purchase event
    await DraftEvent.create({
      leagueId,
      eventType: 'purchase',
      playerId: player._id,
      playerName: player.name,
      ownerName: auction.currentBidder,
      amount: auction.currentBid,
    });
    
    // Clear current auction
    league.currentAuction = undefined;
    
    // Move to next nominator (if owner still has slots)
    if (owner.emptySlots === 0) {
      // Owner is done drafting
      const activeOwners = league.owners.filter((o: any) => o.emptySlots > 0);
      if (activeOwners.length > 0) {
        league.currentNominator = activeOwners[0].name;
      } else {
        // Draft is complete
        league.draftStatus = 'completed';
        league.currentNominator = undefined;
      }
    } else {
      // Rotate to next owner with empty slots
      const currentIndex = league.owners.findIndex(
        (o: any) => o.name === league.currentNominator
      );
      let nextIndex = (currentIndex + 1) % league.owners.length;
      
      // Find next owner with empty slots
      let attempts = 0;
      while (
        league.owners[nextIndex].emptySlots === 0 &&
        attempts < league.owners.length
      ) {
        nextIndex = (nextIndex + 1) % league.owners.length;
        attempts++;
      }
      
      if (attempts < league.owners.length) {
        league.currentNominator = league.owners[nextIndex].name;
      } else {
        league.draftStatus = 'completed';
        league.currentNominator = undefined;
      }
    }
    
    await league.save();
    
    res.json({
      success: true,
      data: league,
    });
    
  } catch (error) {
    console.error('Error completing auction:', error);
    res.status(500).json({
      success: false,
      message: 'Error completing auction',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/draft/history/:leagueId - Get draft history
 */
router.get('/history/:leagueId', async (req: Request, res: Response) => {
  try {
    const events = await DraftEvent.find({
      leagueId: req.params.leagueId,
    }).sort({ timestamp: -1 });
    
    res.json({
      success: true,
      data: events,
    });
    
  } catch (error) {
    console.error('Error fetching draft history:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching draft history',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
