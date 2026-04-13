const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const api = {
  // Players
  getPlayers: async (params?: Record<string, any>) => {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`${API_URL}/api/players?${query}`);
    return response.json();
  },

  getPlayer: async (id: string) => {
    const response = await fetch(`${API_URL}/api/players/${id}`);
    return response.json();
  },

  getPlayersByPosition: async (position: string, limit?: number) => {
    const query = limit ? `?limit=${limit}` : '';
    const response = await fetch(`${API_URL}/api/players/position/${position}${query}`);
    return response.json();
  },

  updatePlayer: async (id: string, data: any) => {
    const response = await fetch(`${API_URL}/api/players/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  },

  // Leagues
  getLeagues: async () => {
    const response = await fetch(`${API_URL}/api/leagues`);
    return response.json();
  },

  getLeague: async (id: string) => {
    const response = await fetch(`${API_URL}/api/leagues/${id}`);
    return response.json();
  },

  createLeague: async (data: any) => {
    const response = await fetch(`${API_URL}/api/leagues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  },

  updateLeague: async (id: string, data: any) => {
    const response = await fetch(`${API_URL}/api/leagues/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  },

  startDraft: async (id: string) => {
    const response = await fetch(`${API_URL}/api/leagues/${id}/start-draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return response.json();
  },

  addKeeper: async (id: string, data: any) => {
    const response = await fetch(`${API_URL}/api/leagues/${id}/add-keeper`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  },

  getValuations: async (id: string) => {
    const response = await fetch(`${API_URL}/api/leagues/${id}/valuations`);
    return response.json();
  },

  // Draft
  nominatePlayer: async (data: any) => {
    const response = await fetch(`${API_URL}/api/draft/nominate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  },

  placeBid: async (data: any) => {
    const response = await fetch(`${API_URL}/api/draft/bid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  },

  completeAuction: async (data: any) => {
    const response = await fetch(`${API_URL}/api/draft/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  },

  getDraftHistory: async (leagueId: string) => {
    const response = await fetch(`${API_URL}/api/draft/history/${leagueId}`);
    return response.json();
  },

  // Admin
  fetchMLBData: async (season: number = 2025, sample: boolean = true) => {
    const response = await fetch(`${API_URL}/api/admin/fetch-players`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ season, sample }),
    });
    return response.json();
  },
};
