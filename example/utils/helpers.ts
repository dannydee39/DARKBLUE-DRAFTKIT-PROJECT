export function formatCurrency(amount: number): string {
  return `$${amount}`;
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getValueColor(
  currentBid: number,
  suggestedValue: number
): 'excellent' | 'good' | 'fair' | 'poor' {
  const ratio = currentBid / suggestedValue;

  if (ratio <= 0.7) return 'excellent'; // 30%+ discount
  if (ratio <= 0.9) return 'good'; // 10-30% discount
  if (ratio <= 1.1) return 'fair'; // Within 10%
  return 'poor'; // Overpaying
}

export function calculateMaxBid(remainingBudget: number, emptySlots: number): number {
  return Math.max(1, remainingBudget - emptySlots + 1);
}

export function getPositionColor(position: string): string {
  const colors: { [key: string]: string } = {
    C: 'blue',
    '1B': 'green',
    '2B': 'green',
    '3B': 'green',
    SS: 'green',
    OF: 'yellow',
    P: 'red',
    UT: 'purple',
  };

  const basePosition = position.split('/')[0];
  return colors[basePosition] || 'gray';
}

export function sortPlayers(
  players: any[],
  sortBy: string,
  order: 'asc' | 'desc' = 'desc'
): any[] {
  return [...players].sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];

    // Handle nested properties
    if (sortBy.includes('.')) {
      const parts = sortBy.split('.');
      aVal = a[parts[0]]?.[parts[1]];
      bVal = b[parts[0]]?.[parts[1]];
    }

    if (aVal === undefined || aVal === null) return 1;
    if (bVal === undefined || bVal === null) return -1;

    if (typeof aVal === 'string') {
      return order === 'desc'
        ? bVal.localeCompare(aVal)
        : aVal.localeCompare(bVal);
    }

    return order === 'desc' ? bVal - aVal : aVal - bVal;
  });
}

export function filterPlayers(players: any[], filters: {
  search?: string;
  position?: string;
  team?: string;
  isPitcher?: boolean;
  minValue?: number;
  maxValue?: number;
}): any[] {
  return players.filter((player) => {
    if (filters.search) {
      const search = filters.search.toLowerCase();
      if (!player.name.toLowerCase().includes(search) &&
          !player.team.toLowerCase().includes(search)) {
        return false;
      }
    }

    if (filters.position && !player.positions.includes(filters.position)) {
      return false;
    }

    if (filters.team && player.team !== filters.team) {
      return false;
    }

    if (filters.isPitcher !== undefined && player.isPitcher !== filters.isPitcher) {
      return false;
    }

    if (filters.minValue !== undefined &&
        player.calculatedValue < filters.minValue) {
      return false;
    }

    if (filters.maxValue !== undefined &&
        player.calculatedValue > filters.maxValue) {
      return false;
    }

    return true;
  });
}

export function getRosterProgress(roster: any[], rosterSize: number): {
  filled: number;
  total: number;
  percentage: number;
} {
  const filled = roster.length;
  const total = rosterSize;
  const percentage = (filled / total) * 100;

  return { filled, total, percentage };
}

export function getBudgetStatus(
  remainingBudget: number,
  totalBudget: number
): 'healthy' | 'caution' | 'danger' {
  const percentage = (remainingBudget / totalBudget) * 100;

  if (percentage >= 30) return 'healthy';
  if (percentage >= 10) return 'caution';
  return 'danger';
}

export function getPositionNeeds(
  roster: any[],
  rosterSpots: any[]
): { position: string; needed: number }[] {
  const needs: { position: string; needed: number }[] = [];

  for (const spot of rosterSpots) {
    const filled = roster.filter((p) =>
      p.position === spot.position
    ).length;

    const needed = spot.count - filled;

    if (needed > 0) {
      needs.push({ position: spot.position, needed });
    }
  }

  return needs.sort((a, b) => b.needed - a.needed);
}

export function validateBid(
  bid: number,
  currentBid: number,
  maxBid: number
): { valid: boolean; message?: string } {
  if (bid <= currentBid) {
    return {
      valid: false,
      message: `Bid must be higher than current bid of $${currentBid}`,
    };
  }

  if (bid > maxBid) {
    return {
      valid: false,
      message: `Cannot bid more than max bid of $${maxBid}`,
    };
  }

  if (bid < 1) {
    return {
      valid: false,
      message: 'Minimum bid is $1',
    };
  }

  return { valid: true };
}

export function getStatDisplay(player: any): {
  label: string;
  value: string;
}[] {
  if (player.isPitcher && player.pitcherStats) {
    const stats = player.pitcherStats;
    return [
      { label: 'W', value: stats.wins.toString() },
      { label: 'SV', value: stats.saves.toString() },
      { label: 'K', value: stats.strikeouts.toString() },
      { label: 'ERA', value: stats.era.toFixed(2) },
      { label: 'WHIP', value: stats.whip.toFixed(2) },
    ];
  } else if (player.hitterStats) {
    const stats = player.hitterStats;
    return [
      { label: 'HR', value: stats.homeRuns.toString() },
      { label: 'R', value: stats.runs.toString() },
      { label: 'RBI', value: stats.rbi.toString() },
      { label: 'SB', value: stats.stolenBases.toString() },
      { label: 'AVG', value: stats.battingAverage.toFixed(3) },
    ];
  }

  return [];
}
