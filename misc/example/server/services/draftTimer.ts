import { Server } from 'socket.io';
import League from '../models/League';

interface DraftTimer {
  leagueId: string;
  timeoutId: NodeJS.Timeout;
  expiresAt: Date;
}

class DraftTimerService {
  private timers: Map<string, DraftTimer> = new Map();
  private io: Server | null = null;
  
  constructor() {}
  
  /**
   * Initialize with Socket.IO instance
   */
  setIO(io: Server) {
    this.io = io;
  }
  
  /**
   * Start a timer for the current auction
   */
  async startTimer(leagueId: string, durationSeconds: number = 30) {
    // Clear existing timer if any
    this.clearTimer(leagueId);
    
    const expiresAt = new Date(Date.now() + durationSeconds * 1000);
    
    const timeoutId = setTimeout(async () => {
      await this.handleTimeout(leagueId);
    }, durationSeconds * 1000);
    
    this.timers.set(leagueId, {
      leagueId,
      timeoutId,
      expiresAt,
    });
    
    // Broadcast timer started
    if (this.io) {
      this.io.to(`league-${leagueId}`).emit('draft:timer-started', {
        duration: durationSeconds,
        expiresAt: expiresAt.toISOString(),
      });
    }
    
    console.log(`⏱️  Draft timer started for league ${leagueId} (${durationSeconds}s)`);
  }
  
  /**
   * Extend the current timer (e.g., when a new bid is placed)
   */
  async extendTimer(leagueId: string, additionalSeconds: number = 10) {
    const timer = this.timers.get(leagueId);
    if (!timer) {
      // No timer running, start a new one
      await this.startTimer(leagueId, additionalSeconds);
      return;
    }
    
    // Clear old timeout
    clearTimeout(timer.timeoutId);
    
    // Create new timeout with extended time
    const remainingMs = timer.expiresAt.getTime() - Date.now();
    const newDurationMs = Math.max(additionalSeconds * 1000, remainingMs + additionalSeconds * 1000);
    const newExpiresAt = new Date(Date.now() + newDurationMs);
    
    const timeoutId = setTimeout(async () => {
      await this.handleTimeout(leagueId);
    }, newDurationMs);
    
    this.timers.set(leagueId, {
      leagueId,
      timeoutId,
      expiresAt: newExpiresAt,
    });
    
    // Broadcast timer extended
    if (this.io) {
      this.io.to(`league-${leagueId}`).emit('draft:timer-extended', {
        expiresAt: newExpiresAt.toISOString(),
      });
    }
    
    console.log(`⏱️  Draft timer extended for league ${leagueId}`);
  }
  
  /**
   * Clear timer for a league
   */
  clearTimer(leagueId: string) {
    const timer = this.timers.get(leagueId);
    if (timer) {
      clearTimeout(timer.timeoutId);
      this.timers.delete(leagueId);
      console.log(`⏱️  Draft timer cleared for league ${leagueId}`);
    }
  }
  
  /**
   * Handle timer timeout - auto-complete auction
   */
  private async handleTimeout(leagueId: string) {
    console.log(`⏱️  Timer expired for league ${leagueId}, auto-completing auction`);
    
    try {
      const league = await League.findById(leagueId);
      if (!league || !league.currentAuction) {
        console.log('No active auction to complete');
        return;
      }
      
      // Broadcast timeout event
      if (this.io) {
        this.io.to(`league-${leagueId}`).emit('draft:timer-expired', {
          playerName: league.currentAuction.playerName,
          winningBidder: league.currentAuction.currentBidder,
          amount: league.currentAuction.currentBid,
        });
      }
      
      // The actual completion logic should be handled by the draft handler
      // This just notifies clients to trigger the completion
      
    } catch (error) {
      console.error('Error handling timer timeout:', error);
    } finally {
      this.clearTimer(leagueId);
    }
  }
  
  /**
   * Get remaining time for a league's auction
   */
  getRemainingTime(leagueId: string): number | null {
    const timer = this.timers.get(leagueId);
    if (!timer) return null;
    
    const remaining = Math.max(0, timer.expiresAt.getTime() - Date.now());
    return Math.floor(remaining / 1000); // Return seconds
  }
  
  /**
   * Pause timer (for admin actions, etc.)
   */
  pauseTimer(leagueId: string) {
    const timer = this.timers.get(leagueId);
    if (timer) {
      clearTimeout(timer.timeoutId);
      
      if (this.io) {
        this.io.to(`league-${leagueId}`).emit('draft:timer-paused', {
          remainingSeconds: this.getRemainingTime(leagueId),
        });
      }
    }
  }
  
  /**
   * Resume paused timer
   */
  async resumeTimer(leagueId: string) {
    const remainingSeconds = this.getRemainingTime(leagueId);
    if (remainingSeconds && remainingSeconds > 0) {
      await this.startTimer(leagueId, remainingSeconds);
    }
  }
}

// Singleton instance
export const draftTimerService = new DraftTimerService();
