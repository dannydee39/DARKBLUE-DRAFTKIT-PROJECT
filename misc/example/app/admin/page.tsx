'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function AdminPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [season, setSeason] = useState(2025);
  const [useSample, setUseSample] = useState(true);

  const fetchPlayers = async () => {
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('http://localhost:4000/api/admin/fetch-players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season,
          sample: useSample,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage(
          `✅ Success! ${useSample ? 'Sample' : 'Full'} player data fetch initiated. This may take a few minutes. Check the server console for progress.`
        );
      } else {
        setMessage(`❌ Error: ${data.message}`);
      }
    } catch (error) {
      setMessage(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="text-blue-400 hover:text-blue-300 mb-6 inline-block">
          ← Back to Home
        </Link>

        <div className="bg-gray-800 rounded-lg shadow-xl p-8">
          <h1 className="text-4xl font-bold text-white mb-2">⚙️ Admin Panel</h1>
          <p className="text-gray-400 mb-8">Manage player data and system settings</p>

          {/* Fetch MLB Data */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">📥 Fetch MLB Player Data</h2>
            <div className="bg-gray-700 p-6 rounded-lg space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Season</label>
                <input
                  type="number"
                  value={season}
                  onChange={(e) => setSeason(Number(e.target.value))}
                  min="2020"
                  max="2030"
                  className="w-full md:w-48 px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="flex items-center text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useSample}
                    onChange={(e) => setUseSample(e.target.checked)}
                    className="mr-2 w-4 h-4"
                  />
                  <span>Use Sample Data (5 teams, faster)</span>
                </label>
                <p className="text-gray-400 text-sm mt-1 ml-6">
                  {useSample
                    ? 'Fetches ~150-200 players from major teams (1-2 minutes)'
                    : 'Fetches ALL ~1200 MLB players (15-20 minutes)'}
                </p>
              </div>

              <button
                onClick={fetchPlayers}
                disabled={loading}
                className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Fetching Data...' : 'Fetch Player Data'}
              </button>

              {message && (
                <div
                  className={`p-4 rounded-lg ${
                    message.includes('✅')
                      ? 'bg-green-900 border border-green-700 text-green-100'
                      : 'bg-red-900 border border-red-700 text-red-100'
                  }`}
                >
                  {message}
                </div>
              )}
            </div>
          </section>

          {/* Info */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">ℹ️ Information</h2>
            <div className="bg-gray-700 p-6 rounded-lg space-y-3">
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">Data Source</h3>
                <p className="text-gray-300 text-sm">
                  MLB Stats API (statsapi.mlb.com) - Official, free MLB data
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-1">What Gets Updated</h3>
                <ul className="text-gray-300 text-sm space-y-1">
                  <li>• Player names and teams</li>
                  <li>• Batting statistics (AVG, HR, RBI, SB, etc.)</li>
                  <li>• Pitching statistics (W, SV, K, ERA, WHIP, etc.)</li>
                  <li>• Position eligibility</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-1">Rate Limits</h3>
                <p className="text-gray-300 text-sm">
                  The MLB API is free but rate-limited. Sample data includes delays between requests
                  to avoid issues. Full data fetch may take longer due to rate limiting.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-1">When to Refresh</h3>
                <ul className="text-gray-300 text-sm space-y-1">
                  <li>• At the start of a new season</li>
                  <li>• When major trades or signings occur</li>
                  <li>• If player statistics seem outdated</li>
                  <li>• Initial setup (run at least once)</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Quick Actions */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">🔧 Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link
                href="/players"
                className="block bg-gray-700 p-4 rounded-lg hover:bg-gray-600 transition-colors"
              >
                <h3 className="text-lg font-bold text-white mb-1">View Players</h3>
                <p className="text-gray-400 text-sm">Browse all players in the database</p>
              </Link>

              <Link
                href="/leagues/create"
                className="block bg-gray-700 p-4 rounded-lg hover:bg-gray-600 transition-colors"
              >
                <h3 className="text-lg font-bold text-white mb-1">Create League</h3>
                <p className="text-gray-400 text-sm">Set up a new draft league</p>
              </Link>

              <Link
                href="/"
                className="block bg-gray-700 p-4 rounded-lg hover:bg-gray-600 transition-colors"
              >
                <h3 className="text-lg font-bold text-white mb-1">View Leagues</h3>
                <p className="text-gray-400 text-sm">See all existing leagues</p>
              </Link>

              <Link
                href="/help"
                className="block bg-gray-700 p-4 rounded-lg hover:bg-gray-600 transition-colors"
              >
                <h3 className="text-lg font-bold text-white mb-1">Help Guide</h3>
                <p className="text-gray-400 text-sm">Learn how to use the system</p>
              </Link>
            </div>
          </section>
        </div>

        {/* Warning */}
        <div className="mt-8 bg-yellow-900 border border-yellow-700 rounded-lg p-6">
          <h3 className="text-lg font-bold text-white mb-2">⚠️ Important Notes</h3>
          <ul className="text-yellow-100 text-sm space-y-1">
            <li>• Fetching data will update existing players with the same MLB ID</li>
            <li>• This does NOT affect active drafts or leagues</li>
            <li>• Player valuations are recalculated based on updated stats</li>
            <li>• Server console shows detailed progress during fetch</li>
            <li>• Large data fetches may strain the API - use sample data for testing</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
