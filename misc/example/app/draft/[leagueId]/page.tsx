'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { io, Socket } from 'socket.io-client';

interface Player {
  _id: string;
  name: string;
  team: string;
  positions: string[];
  isPitcher: boolean;
  calculatedValue?: number;
  hitterStats?: any;
  pitcherStats?: any;
}

interface Owner {
  name: string;
  budget: number;
  remainingBudget: number;
  roster: any[];
  emptySlots: number;
  maxBid: number;
}

interface League {
  _id: string;
  name: string;
  season: number;
  draftStatus: string;
  currentNominator?: string;
  currentAuction?: {
    playerId: string;
    playerName: string;
    nominatedBy: string;
    currentBid: number;
    currentBidder: string;
  };
  owners: Owner[];
  numOwners: number;
  budgetPerOwner: number;
}

let socket: Socket | null = null;

export default function DraftPage() {
  const params = useParams();
  const leagueId = params.leagueId as string;

  const [league, setLeague] = useState<League | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [bidAmount, setBidAmount] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentOwner, setCurrentOwner] = useState('');
  const [ownerNameInput, setOwnerNameInput] = useState('');
  const [isOwnerValid, setIsOwnerValid] = useState(false);
  const [view, setView] = useState<'draft' | 'players' | 'rosters'>('draft');

  useEffect(() => {
    fetchLeague();
    fetchPlayers();
    setupSocket();

    // Load saved owner name from localStorage
    const savedOwner = localStorage.getItem(`draft-owner-${leagueId}`);
    if (savedOwner) {
      setOwnerNameInput(savedOwner);
    }

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [leagueId]);

  // Validate owner name
  useEffect(() => {
    if (league && ownerNameInput) {
      const ownerExists = league.owners.some(
        owner => owner.name.toLowerCase() === ownerNameInput.toLowerCase()
      );
      setIsOwnerValid(ownerExists);
      if (ownerExists) {
        setCurrentOwner(ownerNameInput);
        // Save to localStorage
        localStorage.setItem(`draft-owner-${leagueId}`, ownerNameInput);
      } else {
        setCurrentOwner('');
      }
    } else {
      setIsOwnerValid(false);
      setCurrentOwner('');
    }
  }, [ownerNameInput, league, leagueId]);

  const setupSocket = () => {
    socket = io('http://localhost:4000');

    socket.on('connect', () => {
      console.log('Connected to socket server');
      socket?.emit('draft:join', leagueId);
    });

    socket.on('draft:update', (updatedLeague: League) => {
      setLeague(updatedLeague);
    });

    socket.on('draft:player-nominated', (data: any) => {
      console.log('Player nominated:', data);
    });

    socket.on('draft:new-bid', (data: any) => {
      console.log('New bid:', data);
    });

    socket.on('draft:player-drafted', (data: any) => {
      console.log('Player drafted:', data);
      // Refresh players list
      fetchPlayers();
    });

    socket.on('draft:error', (error: string) => {
      alert('Error: ' + error);
    });
  };

  const fetchLeague = async () => {
    try {
      const response = await fetch(`http://localhost:4000/api/leagues/${leagueId}`);
      const data = await response.json();
      if (data.success) {
        setLeague(data.data);
      }
    } catch (error) {
      console.error('Error fetching league:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlayers = async () => {
    try {
      const params = new URLSearchParams({
        available: 'true',
        sortBy: 'calculatedValue',
        order: 'desc',
        limit: '200',
      });

      const response = await fetch(`http://localhost:4000/api/players?${params}`);
      const data = await response.json();
      if (data.success) {
        setPlayers(data.data);
      }
    } catch (error) {
      console.error('Error fetching players:', error);
    }
  };

  const startDraft = async () => {
    try {
      const response = await fetch(`http://localhost:4000/api/leagues/${leagueId}/start-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (data.success) {
        setLeague(data.data);
      }
    } catch (error) {
      console.error('Error starting draft:', error);
    }
  };

  const nominatePlayer = () => {
    if (!selectedPlayer) {
      alert('⚠️ Please select a player first');
      return;
    }
    
    if (!currentOwner) {
      alert('⚠️ Please enter your owner name first');
      return;
    }

    if (!isOwnerValid) {
      alert('⚠️ Owner name not found in this league. Check the spelling or select from the list.');
      return;
    }

    if (!socket) {
      alert('⚠️ Socket not connected. Please refresh the page.');
      return;
    }

    if (bidAmount < 1) {
      alert('⚠️ Initial bid must be at least $1');
      return;
    }

    socket.emit('draft:nominate', {
      leagueId,
      playerId: selectedPlayer._id,
      ownerName: currentOwner,
      initialBid: bidAmount,
    });

    setSelectedPlayer(null);
    setBidAmount(1);
  };

  const placeBid = () => {
    if (!currentOwner) {
      alert('⚠️ Please enter your owner name first');
      return;
    }

    if (!isOwnerValid) {
      alert('⚠️ Owner name not found in this league');
      return;
    }

    if (!league?.currentAuction) {
      alert('⚠️ No active auction');
      return;
    }

    if (bidAmount <= league.currentAuction.currentBid) {
      alert(`⚠️ Your bid must be higher than the current bid of $${league.currentAuction.currentBid}`);
      return;
    }

    if (!socket) {
      alert('⚠️ Socket not connected. Please refresh the page.');
      return;
    }

    socket.emit('draft:bid', {
      leagueId,
      ownerName: currentOwner,
      amount: bidAmount,
    });
  };

  const completeAuction = () => {
    if (!socket) {
      alert('Socket not connected');
      return;
    }

    socket.emit('draft:complete', { leagueId });
  };

  const filteredPlayers = players.filter((player) => {
    const matchesSearch = player.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPosition = !positionFilter || player.positions.includes(positionFilter);
    return matchesSearch && matchesPosition;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-600 border-t-blue-500"></div>
          <p className="text-gray-400 mt-4">Loading draft...</p>
        </div>
      </div>
    );
  }

  if (!league) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 text-xl">League not found</p>
          <Link href="/" className="text-blue-400 hover:text-blue-300 mt-4 inline-block">
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gray-800 rounded-lg shadow-xl p-4 mb-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-white">{league.name}</h1>
              <p className="text-gray-400">Season {league.season}</p>
            </div>
            <div className="flex items-center gap-4">
              <span
                className={`px-4 py-2 rounded-full font-semibold ${
                  league.draftStatus === 'completed'
                    ? 'bg-green-500 text-white'
                    : league.draftStatus === 'in-progress'
                    ? 'bg-yellow-500 text-gray-900'
                    : 'bg-gray-500 text-white'
                }`}
              >
                {league.draftStatus.toUpperCase().replace('-', ' ')}
              </span>
              {league.draftStatus === 'not-started' && (
                <button
                  onClick={startDraft}
                  className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700"
                >
                  Start Draft
                </button>
              )}
              <Link href="/" className="text-blue-400 hover:text-blue-300">
                Exit
              </Link>
            </div>
          </div>
        </div>

        {/* Owner Identity Section - Always Visible */}
        {league.draftStatus === 'in-progress' && (
          <div className="bg-gradient-to-r from-blue-900 to-blue-800 rounded-lg shadow-xl p-6 mb-4 border-2 border-blue-600">
            <div className="flex items-center gap-6">
              <div className="flex-1">
                <label className="block text-blue-200 font-semibold mb-2 text-sm">
                  👤 YOUR OWNER NAME
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={ownerNameInput}
                    onChange={(e) => setOwnerNameInput(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-900 text-white rounded-lg border-2 border-gray-700 focus:border-blue-400 focus:outline-none text-lg font-medium"
                    placeholder="Type your owner name..."
                    list="owner-suggestions"
                  />
                  <datalist id="owner-suggestions">
                    {league.owners.map(owner => (
                      <option key={owner.name} value={owner.name} />
                    ))}
                  </datalist>
                </div>
              </div>
              
              <div className="flex-shrink-0">
                {ownerNameInput ? (
                  isOwnerValid ? (
                    <div className="bg-green-600 text-white px-6 py-3 rounded-lg flex items-center gap-2">
                      <span className="text-2xl">✓</span>
                      <div>
                        <div className="font-bold">VERIFIED</div>
                        <div className="text-green-200 text-sm">
                          {league.owners.find(o => o.name.toLowerCase() === ownerNameInput.toLowerCase())?.remainingBudget 
                            ? `$${league.owners.find(o => o.name.toLowerCase() === ownerNameInput.toLowerCase())?.remainingBudget} budget`
                            : ''}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-red-600 text-white px-6 py-3 rounded-lg flex items-center gap-2">
                      <span className="text-2xl">✗</span>
                      <div>
                        <div className="font-bold">NOT FOUND</div>
                        <div className="text-red-200 text-sm">Check spelling</div>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="bg-gray-700 text-gray-300 px-6 py-3 rounded-lg">
                    <div className="font-bold">NOT SIGNED IN</div>
                    <div className="text-gray-400 text-sm">Enter name above</div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Valid Owners List */}
            {!isOwnerValid && ownerNameInput && (
              <div className="mt-4 p-4 bg-gray-900 rounded-lg">
                <p className="text-gray-300 text-sm mb-2">Valid owner names in this league:</p>
                <div className="flex flex-wrap gap-2">
                  {league.owners.map(owner => (
                    <button
                      key={owner.name}
                      onClick={() => setOwnerNameInput(owner.name)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-full text-sm"
                    >
                      {owner.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Current Nominator Info */}
            {league.currentNominator && (
              <div className="mt-4 p-3 bg-yellow-900/40 border border-yellow-600 rounded-lg">
                <p className="text-yellow-200 text-center">
                  <span className="font-bold">🎯 Current Turn:</span> {league.currentNominator}
                  {currentOwner && currentOwner === league.currentNominator && (
                    <span className="ml-2 px-2 py-1 bg-yellow-600 text-white rounded text-sm font-bold">IT'S YOUR TURN!</span>
                  )}
                </p>
              </div>
            )}
          </div>
        )}

        {/* View Tabs */}
        <div className="bg-gray-800 rounded-lg shadow-xl mb-4">
          <div className="flex border-b border-gray-700">
            <button
              onClick={() => setView('draft')}
              className={`px-6 py-3 font-semibold ${
                view === 'draft'
                  ? 'text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Draft Board
            </button>
            <button
              onClick={() => setView('players')}
              className={`px-6 py-3 font-semibold ${
                view === 'players'
                  ? 'text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Available Players
            </button>
            <button
              onClick={() => setView('rosters')}
              className={`px-6 py-3 font-semibold ${
                view === 'rosters'
                  ? 'text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Rosters
            </button>
          </div>
        </div>

        {/* Draft Board View */}
        {view === 'draft' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Current Auction */}
            <div className="lg:col-span-2 bg-gray-800 rounded-lg shadow-xl p-6">
              <h2 className="text-2xl font-bold text-white mb-4">🔨 Current Auction</h2>

              {league.currentAuction ? (
                <div className="bg-gradient-to-br from-yellow-600 to-yellow-700 p-6 rounded-lg border-4 border-yellow-500">
                  <div className="text-center">
                    <div className="bg-yellow-800 rounded-lg p-3 mb-4">
                      <h3 className="text-3xl font-bold text-white mb-1">
                        {league.currentAuction.playerName}
                      </h3>
                      <p className="text-yellow-100 text-sm">
                        Nominated by <span className="font-bold">{league.currentAuction.nominatedBy}</span>
                      </p>
                    </div>
                    
                    <div className="bg-white rounded-lg p-6 mb-4">
                      <p className="text-gray-600 text-sm mb-1">CURRENT BID</p>
                      <div className="text-6xl font-bold text-gray-900 mb-2">
                        ${league.currentAuction.currentBid}
                      </div>
                      <p className="text-gray-700 font-semibold">
                        by <span className="text-blue-600">{league.currentAuction.currentBidder}</span>
                      </p>
                    </div>

                    {!isOwnerValid ? (
                      <div className="bg-yellow-800 rounded-lg p-4">
                        <p className="text-yellow-100">🔒 Sign in above to place bids</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="bg-yellow-800 rounded-lg p-3">
                          <label className="block text-yellow-100 text-sm font-semibold mb-2">
                            YOUR BID (minimum: ${league.currentAuction.currentBid + 1})
                          </label>
                          <input
                            type="number"
                            value={bidAmount}
                            onChange={(e) => setBidAmount(Number(e.target.value))}
                            min={league.currentAuction.currentBid + 1}
                            className="w-full px-4 py-3 bg-white text-gray-900 rounded-lg font-bold text-3xl text-center focus:outline-none focus:ring-4 focus:ring-yellow-300"
                            placeholder={`$${league.currentAuction.currentBid + 1}`}
                          />
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setBidAmount(league.currentAuction!.currentBid + 1);
                              placeBid();
                            }}
                            disabled={bidAmount <= league.currentAuction.currentBid}
                            className="flex-1 px-6 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
                          >
                            💰 Place Bid
                          </button>
                          {currentOwner === league.currentAuction.currentBidder && (
                            <button
                              onClick={completeAuction}
                              className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
                              title="Complete auction - you have the winning bid"
                            >
                              ✓ Sold!
                            </button>
                          )}
                        </div>
                        
                        {/* Quick bid buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => setBidAmount(league.currentAuction!.currentBid + 1)}
                            className="flex-1 px-3 py-2 bg-yellow-800 text-yellow-100 text-sm rounded hover:bg-yellow-700"
                          >
                            +$1
                          </button>
                          <button
                            onClick={() => setBidAmount(league.currentAuction!.currentBid + 5)}
                            className="flex-1 px-3 py-2 bg-yellow-800 text-yellow-100 text-sm rounded hover:bg-yellow-700"
                          >
                            +$5
                          </button>
                          <button
                            onClick={() => setBidAmount(league.currentAuction!.currentBid + 10)}
                            className="flex-1 px-3 py-2 bg-yellow-800 text-yellow-100 text-sm rounded hover:bg-yellow-700"
                          >
                            +$10
                          </button>
                        </div>

                        {/* Budget info */}
                        {currentOwner && league.owners.find(o => o.name === currentOwner) && (
                          <div className="bg-yellow-800 rounded-lg p-3 text-yellow-100 text-sm">
                            <p>Your Remaining Budget: <span className="font-bold">
                              ${league.owners.find(o => o.name === currentOwner)?.remainingBudget}
                            </span></p>
                            <p>Max Bid: <span className="font-bold">
                              ${league.owners.find(o => o.name === currentOwner)?.maxBid}
                            </span></p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  {league.draftStatus === 'not-started' ? (
                    <>
                      <div className="text-6xl mb-4">🏁</div>
                      <p className="text-gray-400 text-xl mb-2">Draft Not Started</p>
                      <p className="text-gray-500">Click "Start Draft" above to begin</p>
                    </>
                  ) : league.draftStatus === 'completed' ? (
                    <>
                      <div className="text-6xl mb-4">🏆</div>
                      <p className="text-gray-400 text-xl mb-2">Draft Completed!</p>
                      <p className="text-gray-500">Check the Rosters tab to see final teams</p>
                    </>
                  ) : (
                    <>
                      <div className="text-6xl mb-4">⏳</div>
                      <p className="text-gray-400 text-xl mb-3">Waiting for nomination...</p>
                      {league.currentNominator && (
                        <div className="inline-block bg-blue-900 px-6 py-3 rounded-lg">
                          <p className="text-blue-200 text-sm">Current Nominator</p>
                          <p className="text-white font-bold text-xl">{league.currentNominator}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Quick Nominate */}
            <div className="bg-gray-800 rounded-lg shadow-xl p-6">
              <h2 className="text-2xl font-bold text-white mb-4">📝 Nominate Player</h2>

              {!isOwnerValid ? (
                <div className="text-center py-8">
                  <div className="text-5xl mb-4">🔒</div>
                  <p className="text-gray-400 text-lg mb-2">Sign in to participate</p>
                  <p className="text-gray-500 text-sm">Enter your owner name above</p>
                </div>
              ) : league.draftStatus !== 'in-progress' ? (
                <div className="text-center py-8">
                  <div className="text-5xl mb-4">⏳</div>
                  <p className="text-gray-400 text-lg">
                    {league.draftStatus === 'not-started' 
                      ? 'Start the draft to begin'
                      : 'Draft completed!'}
                  </p>
                </div>
              ) : league.currentAuction ? (
                <div className="text-center py-8">
                  <div className="text-5xl mb-4">⏱️</div>
                  <p className="text-gray-400 text-lg">Auction in progress</p>
                  <p className="text-gray-500 text-sm mt-2">Complete the current auction first</p>
                </div>
              ) : currentOwner !== league.currentNominator ? (
                <div className="text-center py-8">
                  <div className="text-5xl mb-4">⌛</div>
                  <p className="text-gray-400 text-lg mb-2">Not your turn</p>
                  <p className="text-yellow-400 font-semibold">{league.currentNominator}'s turn</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-yellow-900/40 border-2 border-yellow-600 rounded-lg p-4 text-center">
                    <p className="text-yellow-200 font-bold text-lg">🎯 IT'S YOUR TURN!</p>
                    <p className="text-yellow-300 text-sm mt-1">Select a player and set initial bid</p>
                  </div>

                  {selectedPlayer ? (
                    <div className="bg-gradient-to-br from-blue-700 to-blue-800 p-5 rounded-lg border-2 border-blue-500">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="text-white font-bold text-xl">{selectedPlayer.name}</p>
                          <p className="text-blue-200 text-sm">{selectedPlayer.team}</p>
                        </div>
                        <button
                          onClick={() => setSelectedPlayer(null)}
                          className="text-white hover:text-red-400 text-2xl"
                          title="Clear selection"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="flex gap-2 mb-3">
                        {selectedPlayer.positions.map((pos) => (
                          <span
                            key={pos}
                            className="px-2 py-1 bg-blue-900 text-blue-200 rounded text-xs font-semibold"
                          >
                            {pos}
                          </span>
                        ))}
                      </div>
                      <p className="text-green-300 font-bold text-lg">
                        💰 Suggested Value: ${selectedPlayer.calculatedValue || '?'}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-gray-700 p-6 rounded-lg border-2 border-dashed border-gray-500 text-center">
                      <p className="text-gray-300 mb-2">No player selected</p>
                      <p className="text-gray-500 text-sm">👇 Click a player below or go to "Available Players" tab</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-white font-semibold mb-2">Initial Bid ($)</label>
                    <input
                      type="number"
                      value={bidAmount}
                      onChange={(e) => setBidAmount(Number(e.target.value))}
                      min={1}
                      className="w-full px-4 py-3 bg-gray-700 text-white text-xl font-bold rounded-lg border-2 border-gray-600 focus:border-blue-500 focus:outline-none text-center"
                      placeholder="Enter bid..."
                    />
                  </div>

                  <button
                    onClick={nominatePlayer}
                    disabled={!selectedPlayer}
                    className="w-full px-6 py-4 bg-green-600 text-white font-bold text-lg rounded-lg hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                  >
                    {selectedPlayer ? `🔨 Nominate ${selectedPlayer.name}` : '⚠️ Select a player first'}
                  </button>

                  {/* Quick Player Search in Nomination Panel */}
                  <div className="border-t-2 border-gray-700 pt-4">
                    <label className="block text-white font-semibold mb-2 text-sm">🔍 Quick Search</label>
                    <input
                      type="text"
                      placeholder="Search players..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-sm mb-2"
                    />
                    <div className="max-h-60 overflow-y-auto space-y-1">
                      {filteredPlayers.slice(0, 10).map((player) => (
                        <button
                          key={player._id}
                          onClick={() => {
                            setSelectedPlayer(player);
                            setSearchTerm('');
                          }}
                          className="w-full text-left bg-gray-700 hover:bg-gray-600 p-3 rounded-lg transition-colors"
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-white font-semibold text-sm">{player.name}</p>
                              <p className="text-gray-400 text-xs">{player.team} • {player.positions.join(', ')}</p>
                            </div>
                            <span className="text-green-400 font-bold text-sm">
                              ${player.calculatedValue || '?'}
                            </span>
                          </div>
                        </button>
                      ))}
                      {searchTerm && filteredPlayers.length === 0 && (
                        <p className="text-gray-500 text-sm text-center py-4">No players found</p>
                      )}
                      {!searchTerm && (
                        <p className="text-gray-500 text-xs text-center py-2">Type to search players</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Available Players View */}
        {view === 'players' && (
          <div className="bg-gray-800 rounded-lg shadow-xl p-6">
            <h2 className="text-2xl font-bold text-white mb-4">Available Players</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <input
                type="text"
                placeholder="Search players..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
              />

              <select
                value={positionFilter}
                onChange={(e) => setPositionFilter(e.target.value)}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
              >
                <option value="">All Positions</option>
                <option value="C">C</option>
                <option value="1B">1B</option>
                <option value="2B">2B</option>
                <option value="3B">3B</option>
                <option value="SS">SS</option>
                <option value="OF">OF</option>
                <option value="P">P</option>
              </select>

              <div className="text-white text-center py-2">
                {filteredPlayers.length} players
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto">
              {filteredPlayers.map((player) => (
                <div
                  key={player._id}
                  onClick={() => setSelectedPlayer(player)}
                  className={`bg-gray-700 p-4 rounded-lg cursor-pointer hover:bg-gray-600 transition-colors border-2 ${
                    selectedPlayer?._id === player._id
                      ? 'border-blue-500'
                      : 'border-transparent'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-white font-bold">{player.name}</p>
                      <p className="text-gray-400 text-sm">{player.team}</p>
                    </div>
                    <span className="text-green-400 font-bold text-lg">
                      ${player.calculatedValue || '?'}
                    </span>
                  </div>
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
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rosters View */}
        {view === 'rosters' && (
          <div className="bg-gray-800 rounded-lg shadow-xl p-6">
            <h2 className="text-2xl font-bold text-white mb-4">Team Rosters</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {league.owners.map((owner) => (
                <div key={owner.name} className="bg-gray-700 p-4 rounded-lg">
                  <h3 className="text-xl font-bold text-white mb-2">{owner.name}</h3>
                  <div className="text-sm text-gray-300 mb-3">
                    <p>Budget: ${owner.remainingBudget} / ${owner.budget}</p>
                    <p>Slots: {owner.emptySlots} empty</p>
                    <p>Max Bid: ${owner.maxBid}</p>
                  </div>
                  <div className="space-y-1">
                    {owner.roster.map((player, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between text-sm bg-gray-800 p-2 rounded"
                      >
                        <span className="text-white">{player.playerName}</span>
                        <span className="text-green-400">${player.costDrafted}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
