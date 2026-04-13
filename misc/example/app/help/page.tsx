'use client';

import Link from 'next/link';

export default function HelpPage() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="text-blue-400 hover:text-blue-300 mb-6 inline-block">
          ← Back to Home
        </Link>

        <div className="bg-gray-800 rounded-lg shadow-xl p-8">
          <h1 className="text-4xl font-bold text-white mb-2">📚 Help & User Guide</h1>
          <p className="text-gray-400 mb-8">Learn how to use the Fantasy Baseball Draft Kit</p>

          {/* Getting Started */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">🚀 Getting Started</h2>
            <div className="bg-gray-700 p-6 rounded-lg space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">1. Create a League</h3>
                <p className="text-gray-300">
                  Start by creating a new league with your desired settings. Enter league name,
                  commissioner, number of owners, budget, and roster size.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">2. Add Owners</h3>
                <p className="text-gray-300">
                  Enter the names of all participants. Each owner gets the budget you specified
                  (default $260).
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">3. Start the Draft</h3>
                <p className="text-gray-300">
                  Once ready, click "Start Draft" to begin the auction. Enter your owner name to
                  participate.
                </p>
              </div>
            </div>
          </section>

          {/* Draft Mechanics */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">⚡ Draft Mechanics</h2>
            <div className="bg-gray-700 p-6 rounded-lg space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Auction System</h3>
                <p className="text-gray-300 mb-2">
                  This draft uses an auction-style format:
                </p>
                <ul className="list-disc list-inside text-gray-300 space-y-1">
                  <li>Owners take turns nominating players</li>
                  <li>All owners can bid on nominated players</li>
                  <li>Highest bidder gets the player</li>
                  <li>If no one bids, nominator gets player for $1</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Budget Rules</h3>
                <p className="text-gray-300 mb-2">Important budget considerations:</p>
                <ul className="list-disc list-inside text-gray-300 space-y-1">
                  <li>Minimum bid is $1 per player</li>
                  <li>Max bid = Remaining Budget - Empty Slots + 1</li>
                  <li>Must have $1 for each remaining roster spot</li>
                  <li>Cannot go over budget</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Player Valuations */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">💰 Player Valuations</h2>
            <div className="bg-gray-700 p-6 rounded-lg space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">How Values Are Calculated</h3>
                <p className="text-gray-300 mb-2">
                  The system uses a sophisticated Z-score algorithm:
                </p>
                <ul className="list-disc list-inside text-gray-300 space-y-1">
                  <li>Compares each player's stats across all scoring categories</li>
                  <li>Calculates standard deviations from the mean</li>
                  <li>Applies position scarcity adjustments (e.g., catchers are scarce)</li>
                  <li>Converts to dollar values based on league budget</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Scoring Categories</h3>
                <p className="text-gray-300 mb-2">Default categories (configurable):</p>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <p className="text-white font-semibold">Hitters:</p>
                    <ul className="text-gray-300 text-sm">
                      <li>• Home Runs</li>
                      <li>• Runs</li>
                      <li>• RBI</li>
                      <li>• Stolen Bases</li>
                      <li>• Batting Average</li>
                      <li>• OPS</li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-white font-semibold">Pitchers:</p>
                    <ul className="text-gray-300 text-sm">
                      <li>• Wins</li>
                      <li>• Saves</li>
                      <li>• Strikeouts</li>
                      <li>• ERA (lower is better)</li>
                      <li>• WHIP (lower is better)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Positions */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">🎯 Roster Positions</h2>
            <div className="bg-gray-700 p-6 rounded-lg">
              <p className="text-gray-300 mb-3">Standard roster configuration (23 players):</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="bg-gray-800 p-3 rounded text-center">
                  <span className="position-badge position-C">C</span>
                  <p className="text-white mt-1">2 Catchers</p>
                </div>
                <div className="bg-gray-800 p-3 rounded text-center">
                  <span className="position-badge position-1B">1B</span>
                  <p className="text-white mt-1">1 First Base</p>
                </div>
                <div className="bg-gray-800 p-3 rounded text-center">
                  <span className="position-badge position-2B">2B</span>
                  <p className="text-white mt-1">1 Second Base</p>
                </div>
                <div className="bg-gray-800 p-3 rounded text-center">
                  <span className="position-badge position-3B">3B</span>
                  <p className="text-white mt-1">1 Third Base</p>
                </div>
                <div className="bg-gray-800 p-3 rounded text-center">
                  <span className="position-badge position-SS">SS</span>
                  <p className="text-white mt-1">1 Shortstop</p>
                </div>
                <div className="bg-gray-800 p-3 rounded text-center">
                  <span className="position-badge position-OF">OF</span>
                  <p className="text-white mt-1">5 Outfielders</p>
                </div>
                <div className="bg-gray-800 p-3 rounded text-center">
                  <span className="position-badge position-UT">UT</span>
                  <p className="text-white mt-1">1 Utility</p>
                </div>
                <div className="bg-gray-800 p-3 rounded text-center">
                  <span className="position-badge position-P">P</span>
                  <p className="text-white mt-1">9 Pitchers</p>
                </div>
                <div className="bg-gray-800 p-3 rounded text-center">
                  <span className="text-xs bg-gray-600 px-2 py-1 rounded-full text-white">
                    1B/3B
                  </span>
                  <p className="text-white mt-1">1 Corner IF</p>
                </div>
                <div className="bg-gray-800 p-3 rounded text-center">
                  <span className="text-xs bg-gray-600 px-2 py-1 rounded-full text-white">
                    2B/SS
                  </span>
                  <p className="text-white mt-1">1 Middle IF</p>
                </div>
              </div>
            </div>
          </section>

          {/* Keeper League */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">🔄 Keeper League</h2>
            <div className="bg-gray-700 p-6 rounded-lg space-y-3">
              <p className="text-gray-300">
                Keeper leagues allow you to keep players from previous seasons:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-1">
                <li>Players can be kept for up to 3 years</li>
                <li>Add keepers before starting the draft</li>
                <li>Keeper cost is what you paid last year</li>
                <li>Keepers count toward your roster and budget</li>
              </ul>
            </div>
          </section>

          {/* Tips */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">💡 Draft Strategy Tips</h2>
            <div className="bg-gray-700 p-6 rounded-lg">
              <ul className="space-y-3 text-gray-300">
                <li>
                  <span className="font-semibold text-white">Budget Management:</span> Don't spend
                  all your money early. Save budget for later rounds when values emerge.
                </li>
                <li>
                  <span className="font-semibold text-white">Position Scarcity:</span> Draft
                  catchers and elite closers early - they're harder to find later.
                </li>
                <li>
                  <span className="font-semibold text-white">Value Hunting:</span> Look for
                  players being nominated below their suggested value.
                </li>
                <li>
                  <span className="font-semibold text-white">Roster Balance:</span> Make sure you
                  have money left to fill all positions.
                </li>
                <li>
                  <span className="font-semibold text-white">Nominations:</span> Nominate players
                  you don't want to make others spend their budget.
                </li>
              </ul>
            </div>
          </section>

          {/* Technical Info */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">⚙️ Technical Information</h2>
            <div className="bg-gray-700 p-6 rounded-lg space-y-3">
              <div>
                <p className="text-white font-semibold">Data Source:</p>
                <p className="text-gray-300">
                  Player statistics sourced from MLB Stats API (official MLB data)
                </p>
              </div>
              <div>
                <p className="text-white font-semibold">Real-Time Updates:</p>
                <p className="text-gray-300">
                  Draft board updates in real-time using Socket.io for all participants
                </p>
              </div>
              <div>
                <p className="text-white font-semibold">Technology:</p>
                <p className="text-gray-300">
                  Built with Next.js, TypeScript, Express, MongoDB, and Socket.io
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
