'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function CreateLeague() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    commissioner: '',
    season: 2025,
    numOwners: 12,
    budgetPerOwner: 260,
    rosterSize: 23,
    owners: [''],
  });

  const handleOwnerChange = (index: number, value: string) => {
    const newOwners = [...formData.owners];
    newOwners[index] = value;
    setFormData({ ...formData, owners: newOwners });
  };

  const addOwner = () => {
    if (formData.owners.length < formData.numOwners) {
      setFormData({ ...formData, owners: [...formData.owners, ''] });
    }
  };

  const removeOwner = (index: number) => {
    const newOwners = formData.owners.filter((_, i) => i !== index);
    setFormData({ ...formData, owners: newOwners });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Filter out empty owner names
      const validOwners = formData.owners.filter(o => o.trim() !== '');

      if (validOwners.length === 0) {
        alert('Please add at least one owner');
        setLoading(false);
        return;
      }

      const response = await fetch('http://localhost:4000/api/leagues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          owners: validOwners,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert('League created successfully!');
        router.push(`/draft/${data.data._id}`);
      } else {
        alert('Error creating league: ' + data.message);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error creating league');
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
          <h1 className="text-4xl font-bold text-white mb-2">Create New League</h1>
          <p className="text-gray-400 mb-8">Set up your fantasy baseball league with custom settings</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  League Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder="My Fantasy League"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Commissioner Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.commissioner}
                  onChange={(e) => setFormData({ ...formData, commissioner: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder="Your Name"
                />
              </div>
            </div>

            {/* League Settings */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Season
                </label>
                <input
                  type="number"
                  value={formData.season}
                  onChange={(e) => setFormData({ ...formData, season: Number(e.target.value) })}
                  className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Number of Owners
                </label>
                <input
                  type="number"
                  min="2"
                  max="20"
                  value={formData.numOwners}
                  onChange={(e) => setFormData({ ...formData, numOwners: Number(e.target.value) })}
                  className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Roster Size
                </label>
                <input
                  type="number"
                  min="15"
                  max="30"
                  value={formData.rosterSize}
                  onChange={(e) => setFormData({ ...formData, rosterSize: Number(e.target.value) })}
                  className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Budget per Owner ($)
              </label>
              <input
                type="number"
                min="100"
                max="500"
                value={formData.budgetPerOwner}
                onChange={(e) => setFormData({ ...formData, budgetPerOwner: Number(e.target.value) })}
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
              <p className="text-gray-400 text-sm mt-1">Standard is $260</p>
            </div>

            {/* Owners */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="block text-sm font-semibold text-gray-300">
                  Owner Names
                </label>
                <button
                  type="button"
                  onClick={addOwner}
                  disabled={formData.owners.length >= formData.numOwners}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                  + Add Owner
                </button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {formData.owners.map((owner, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={owner}
                      onChange={(e) => handleOwnerChange(index, e.target.value)}
                      className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                      placeholder={`Owner ${index + 1}`}
                    />
                    {formData.owners.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeOwner(index)}
                        className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Submit */}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Creating League...' : 'Create League'}
              </button>
              <Link
                href="/"
                className="px-6 py-3 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-blue-900 border border-blue-700 rounded-lg p-6">
          <h3 className="text-lg font-bold text-white mb-2">ℹ️ League Setup Tips</h3>
          <ul className="text-blue-100 text-sm space-y-1">
            <li>• Standard configuration: 12 owners, $260 budget, 23 roster spots</li>
            <li>• You can add keeper players after creating the league</li>
            <li>• Player valuations will be calculated based on your scoring settings</li>
            <li>• Default scoring: HR, R, RBI, SB, AVG, OPS (hitters) | W, SV, K, ERA, WHIP (pitchers)</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
