'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface League {
  _id: string;
  name: string;
  season: number;
  draftStatus: string;
  numOwners: number;
}

export default function Home() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeagues();
  }, []);

  const fetchLeagues = async () => {
    try {
      const response = await fetch('http://localhost:4000/api/leagues');
      const data = await response.json();
      if (data.success) {
        setLeagues(data.data);
      }
    } catch (error) {
      console.error('Error fetching leagues:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">
            ⚾ Fantasy Baseball Draft Kit
          </h1>
          <p className="text-xl text-gray-300">
            Professional draft kit with real-time player valuations and live auction support
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Link href="/leagues/create" className="block">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-6 rounded-lg shadow-lg hover:shadow-xl transition-all cursor-pointer border-2 border-blue-500">
              <div className="text-4xl mb-3">🏆</div>
              <h2 className="text-2xl font-bold text-white mb-2">Create League</h2>
              <p className="text-blue-100">Set up a new fantasy league with custom settings</p>
            </div>
          </Link>

          <Link href="/players" className="block">
            <div className="bg-gradient-to-br from-green-600 to-green-700 p-6 rounded-lg shadow-lg hover:shadow-xl transition-all cursor-pointer border-2 border-green-500">
              <div className="text-4xl mb-3">👥</div>
              <h2 className="text-2xl font-bold text-white mb-2">Browse Players</h2>
              <p className="text-green-100">View player statistics and valuations</p>
            </div>
          </Link>

          <Link href="/help" className="block">
            <div className="bg-gradient-to-br from-purple-600 to-purple-700 p-6 rounded-lg shadow-lg hover:shadow-xl transition-all cursor-pointer border-2 border-purple-500">
              <div className="text-4xl mb-3">📚</div>
              <h2 className="text-2xl font-bold text-white mb-2">Help & Guide</h2>
              <p className="text-purple-100">Learn how to use the draft kit effectively</p>
            </div>
          </Link>
        </div>

        {/* Existing Leagues */}
        <div className="bg-gray-800 rounded-lg shadow-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-white">Your Leagues</h2>
            <Link
              href="/leagues/create"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              + New League
            </Link>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-600 border-t-blue-500"></div>
              <p className="text-gray-400 mt-4">Loading leagues...</p>
            </div>
          ) : leagues.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-lg mb-4">No leagues yet. Create your first league to get started!</p>
              <Link
                href="/leagues/create"
                className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create League
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {leagues.map((league) => (
                <Link key={league._id} href={`/draft/${league._id}`}>
                  <div className="bg-gray-700 p-5 rounded-lg hover:bg-gray-600 transition-colors cursor-pointer border border-gray-600">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-xl font-bold text-white">{league.name}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        league.draftStatus === 'completed'
                          ? 'bg-green-500 text-white'
                          : league.draftStatus === 'in-progress'
                          ? 'bg-yellow-500 text-gray-900'
                          : 'bg-gray-500 text-white'
                      }`}>
                        {league.draftStatus.replace('-', ' ').toUpperCase()}
                      </span>
                    </div>
                    <div className="text-gray-300 text-sm space-y-1">
                      <p>📅 Season: {league.season}</p>
                      <p>👥 Owners: {league.numOwners}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Features */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-2xl font-bold text-white mb-4">✨ Key Features</h3>
            <ul className="space-y-2 text-gray-300">
              <li>✅ Real MLB player statistics (2025 season)</li>
              <li>✅ Advanced Z-score valuation algorithm</li>
              <li>✅ Position scarcity analysis</li>
              <li>✅ Live auction draft with Socket.io</li>
              <li>✅ Budget tracking and max bid calculation</li>
              <li>✅ Keeper league support</li>
              <li>✅ Customizable scoring categories</li>
            </ul>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-2xl font-bold text-white mb-4">🎯 How It Works</h3>
            <ol className="space-y-2 text-gray-300 list-decimal list-inside">
              <li>Create a league and configure settings</li>
              <li>Add keeper players (optional)</li>
              <li>System calculates player valuations</li>
              <li>Start the draft and nominate players</li>
              <li>Bid in real-time with other owners</li>
              <li>Track roster, budget, and recommendations</li>
              <li>Complete your dream team!</li>
            </ol>
          </div>
        </div>
      </div>
    </main>
  );
}
