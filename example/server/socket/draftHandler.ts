import { Server, Socket } from 'socket.io';
import League from '../models/League';
import Player from '../models/Player';
import DraftEvent from '../models/DraftEvent';

export function setupDraftSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id);
    
    // Join a league's draft room
    socket.on('draft:join', async (leagueId: string) => {
      try {
        socket.join(`league-${leagueId}`);
        console.log(`Socket ${socket.id} joined league ${leagueId}`);
        
        // Send current league state
        const league = await League.findById(leagueId);
        if (league) {
          socket.emit('draft:update', league);
        }
      } catch (error) {
        console.error('Error joining draft:', error);
        socket.emit('draft:error', 'Failed to join draft');
      }
    });
    
    // Nominate player for auction
    socket.on('draft:nominate', async (data: {
      leagueId: string;
      playerId: string;
      ownerName: string;
      initialBid: number;
    }) => {
      try {
        const { leagueId, playerId, ownerName, initialBid } = data;
        
        const league = await League.findById(leagueId);
        if (!league) {
          socket.emit('draft:error', 'League not found');
          return;
        }
        
        const player = await Player.findById(playerId);
        if (!player) {
          socket.emit('draft:error', 'Player not found');
          return;
        }
        
        if (!player.isAvailable) {
          socket.emit('draft:error', 'Player already drafted');
          return;
        }
        
        const owner = league.owners.find((o: any) => o.name === ownerName);
        if (!owner) {
          socket.emit('draft:error', 'Owner not found');
          return;
        }
        
        if (initialBid > owner.maxBid) {
          socket.emit('draft:error', `Cannot bid more than $${owner.maxBid}`);
          return;
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
        
        // Log event
        await DraftEvent.create({
          leagueId,
          eventType: 'nominate',
          playerId,
          playerName: player.name,
          ownerName,
          amount: initialBid,
        });
        
        // Broadcast to all clients in the league
        io.to(`league-${leagueId}`).emit('draft:update', league);
        io.to(`league-${leagueId}`).emit('draft:player-nominated', {
          playerName: player.name,
          ownerName,
          amount: initialBid,
        });
        
      } catch (error) {
        console.error('Error nominating player:', error);
        socket.emit('draft:error', 'Failed to nominate player');
      }
    });
    
    // Place bid on current auction
    socket.on('draft:bid', async (data: {
      leagueId: string;
      ownerName: string;
      amount: number;
    }) => {
      try {
        const { leagueId, ownerName, amount } = data;
        
        const league = await League.findById(leagueId);
        if (!league || !league.currentAuction) {
          socket.emit('draft:error', 'No active auction');
          return;
        }
        
        const owner = league.owners.find((o: any) => o.name === ownerName);
        if (!owner) {
          socket.emit('draft:error', 'Owner not found');
          return;
        }
        
        if (amount <= league.currentAuction.currentBid) {
          socket.emit('draft:error', 'Bid must be higher than current bid');
          return;
        }
        
        if (amount > owner.maxBid) {
          socket.emit('draft:error', `Cannot bid more than $${owner.maxBid}`);
          return;
        }
        
        // Update auction
        league.currentAuction.currentBid = amount;
        league.currentAuction.currentBidder = ownerName;
        await league.save();
        
        // Log event
        await DraftEvent.create({
          leagueId,
          eventType: 'bid',
          playerId: league.currentAuction.playerId,
          playerName: league.currentAuction.playerName,
          ownerName,
          amount,
        });
        
        // Broadcast to all clients
        io.to(`league-${leagueId}`).emit('draft:update', league);
        io.to(`league-${leagueId}`).emit('draft:new-bid', {
          ownerName,
          amount,
        });
        
      } catch (error) {
        console.error('Error placing bid:', error);
        socket.emit('draft:error', 'Failed to place bid');
      }
    });
    
    // Complete current auction
    socket.on('draft:complete', async (data: { leagueId: string }) => {
      try {
        const { leagueId } = data;
        
        const league = await League.findById(leagueId);
        if (!league || !league.currentAuction) {
          socket.emit('draft:error', 'No active auction');
          return;
        }
        
        const auction = league.currentAuction;
        const owner = league.owners.find((o: any) => o.name === auction.currentBidder);
        if (!owner) {
          socket.emit('draft:error', 'Owner not found');
          return;
        }
        
        const player = await Player.findById(auction.playerId);
        if (!player) {
          socket.emit('draft:error', 'Player not found');
          return;
        }
        
        // Add to roster
        owner.roster.push({
          playerId: player._id,
          playerName: player.name,
          position: player.positions[0],
          costDrafted: auction.currentBid,
          isKeeper: false,
        });
        
        owner.remainingBudget -= auction.currentBid;
        owner.emptySlots -= 1;
        owner.maxBid = owner.remainingBudget - owner.emptySlots + 1;
        
        // Mark player unavailable
        player.isAvailable = false;
        await player.save();
        
        // Log event
        await DraftEvent.create({
          leagueId,
          eventType: 'purchase',
          playerId: player._id,
          playerName: player.name,
          ownerName: auction.currentBidder,
          amount: auction.currentBid,
        });
        
        const draftedPlayer = {
          ownerName: auction.currentBidder,
          playerName: player.name,
          amount: auction.currentBid,
        };
        
        // Clear auction
        league.currentAuction = undefined;
        
        // Move to next nominator
        const currentIndex = league.owners.findIndex(
          (o: any) => o.name === league.currentNominator
        );
        let nextIndex = (currentIndex + 1) % league.owners.length;
        
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
        
        await league.save();
        
        // Broadcast
        io.to(`league-${leagueId}`).emit('draft:update', league);
        io.to(`league-${leagueId}`).emit('draft:player-drafted', draftedPlayer);
        
        if (league.draftStatus === 'completed') {
          io.to(`league-${leagueId}`).emit('draft:completed');
        }
        
      } catch (error) {
        console.error('Error completing auction:', error);
        socket.emit('draft:error', 'Failed to complete auction');
      }
    });
    
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
}
