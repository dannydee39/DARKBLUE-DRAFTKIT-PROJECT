'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Player {
  _id: string;
  name: string;
  team: string;
  positions: string[];
  isPitcher: boolean;
  calculatedValue?: number;
  hitterStats?: any;
  pitcherStats?: any;
  injuryStatus: string;
  notes: string;
}

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    position: '',
    isPitcher: '',
    team: '',
  });
  const [sortBy, setSortBy] = useState('calculatedValue');

  useEffect(() => {
    fetchPlayers();
  }, [filters, sortBy]);

  const fetchPlayers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        sortBy,
        order: 'desc',
        limit: '100',
        ...(filters.search && { search: filters.search }),
        ...(filters.position && { position: filters.position }),
        ...(filters.isPitcher && { isPitcher: filters.isPitcher }),
        ...(filters.team && { team: filters.team }),
      });

      const response = await fetch(`http://localhost:4000/api/players?${params}`);
      const data = await response.json();

      if (data.success) {
        setPlayers(data.data);
      }
    } catch (error) {
      console.error('Error fetching players:', error);
    } finally {
      setLoading(false);
    }
  };

  const positions = ['C', '1B', '2B', '3B', 'SS', 'OF', 'P'];

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <Link href="/" className="text-blue-400 hover:text-blue-300 mb-6 inline-block">
          ← Back to Home
        </Link>

        <div className="bg-gray-800 rounded-lg shadow-xl p-6">
          <h1 className="text-4xl font-bold text-white mb-6">Player Database</h1>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <input
              type="text"
              placeholder="Search players..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
            />

            <select
              value={filters.position}
              onChange={(e) => setFilters({ ...filters, position: e.target.value })}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
            >
              <option value="">All Positions</option>
              {positions.map((pos) => (
                <option key={pos} value={pos}>
                  {pos}
                </option>
              ))}
            </select>

            <select
              value={filters.isPitcher}
              onChange={(e) => setFilters({ ...filters, isPitcher: e.target.value })}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
            >
              <option value="">Hitters & Pitchers</option>
              <option value="false">Hitters Only</option>
              <option value="true">Pitchers Only</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
            >
              <option value="calculatedValue">By Value</option>
              <option value="name">By Name</option>
              <option value="team">By Team</option>
            </select>

            <button
              onClick={() => setFilters({ search: '', position: '', isPitcher: '', team: '' })}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors"
            >
              Clear Filters
            </button>
          </div>

          {/* Players Table */}
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-600 border-t-blue-500"></div>
              <p className="text-gray-400 mt-4">Loading players...</p>
            </div>
          ) : players.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-lg">No players found. Try adjusting your filters.</p>
              <p className="text-gray-500 text-sm mt-2">
                You may need to fetch player data first from the API.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-white font-semibold">Player</th>
                    <th className="px-4 py-3 text-white font-semibold">Team</th>
                    <th className="px-4 py-3 text-white font-semibold">Pos</th>
                    <th className="px-4 py-3 text-white font-semibold">Value</th>
                    <th className="px-4 py-3 text-white font-semibold">Stats</th>
                    <th className="px-4 py-3 text-white font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {players.map((player) => (
                    <tr key={player._id} className="hover:bg-gray-700 transition-colors">
                      <td className="px-4 py-3 text-white font-medium">{player.name}</td>
                      <td className="px-4 py-3 text-gray-300">{player.team}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {player.positions.map((pos) => (
                            <span
                              key={pos}
                              className={`position-badge position-${pos.split('/')[0]}`}
                            >
                              {pos}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white font-bold">
                        ${player.calculatedValue || '?'}
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-sm">
                        {player.isPitcher ? (
                          <div>
                            {player.pitcherStats?.wins || 0}W, {player.pitcherStats?.saves || 0}SV,{' '}
                            {player.pitcherStats?.strikeouts || 0}K
                            <br />
                            ERA: {player.pitcherStats?.era?.toFixed(2) || '0.00'}
                          </div>
                        ) : (
                          <div>
                            {player.hitterStats?.homeRuns || 0}HR, {player.hitterStats?.rbi || 0}RBI,{' '}
                            {player.hitterStats?.stolenBases || 0}SB
                            <br />
                            AVG: {player.hitterStats?.battingAverage?.toFixed(3) || '.000'}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            player.injuryStatus === 'Healthy'
                              ? 'bg-green-500 text-white'
                              : 'bg-red-500 text-white'
                          }`}
                        >
                          {player.injuryStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6 text-center text-gray-400">
            Showing {players.length} players
          </div>
        </div>
      </div>
    </main>
  );
}
