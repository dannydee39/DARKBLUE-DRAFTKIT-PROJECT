import http from 'http';
import https from 'https';

const BASE_URL = 'http://localhost:4000';
let testLeagueId: string;
let testPlayerId: string;

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  data?: any;
}

const results: TestResult[] = [];

function request(path: string, method: string = 'GET', body?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`✅ ${name}`);
  } catch (error) {
    results.push({ 
      name, 
      passed: false, 
      error: error instanceof Error ? error.message : String(error) 
    });
    console.error(`❌ ${name}: ${error}`);
  }
}

async function runTests() {
  console.log('\n🧪 Starting API Tests\n');
  console.log('='.repeat(60));

  // 1. Health Check
  await test('Health Check', async () => {
    const res = await request('/api/health');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.data.success) throw new Error('Health check failed');
  });

  // 2. Get Players
  await test('Get All Players', async () => {
    const res = await request('/api/players');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.data.success) throw new Error('Failed to fetch players');
    if (!Array.isArray(res.data.data)) throw new Error('Players data is not an array');
    if (res.data.data.length === 0) throw new Error('No players found');
    testPlayerId = res.data.data[0]._id;
    console.log(`   → Found ${res.data.data.length} players`);
  });

  // 3. Get Players by Position
  await test('Get Players by Position (P)', async () => {
    const res = await request('/api/players?position=P');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.data.success) throw new Error('Failed to fetch pitchers');
    console.log(`   → Found ${res.data.data.length} pitchers`);
  });

  // 4. Get Single Player
  await test('Get Single Player', async () => {
    const res = await request(`/api/players/${testPlayerId}`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.data.success) throw new Error('Failed to fetch player');
    console.log(`   → Player: ${res.data.data.name}`);
  });

  // 5. Get Available Players
  await test('Get Available Players', async () => {
    const res = await request('/api/players?available=true');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.data.success) throw new Error('Failed to fetch available players');
    console.log(`   → Found ${res.data.data.length} available players`);
  });

  // 6. Create League
  await test('Create League', async () => {
    const leagueData = {
      name: 'Test League ' + Date.now(),
      commissioner: 'Test Commissioner',
      season: 2025,
      numOwners: 3,
      budgetPerOwner: 260,
      rosterSize: 23,
      owners: ['Owner 1', 'Owner 2', 'Owner 3'],
    };
    const res = await request('/api/leagues', 'POST', leagueData);
    if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
    if (!res.data.success) throw new Error('Failed to create league');
    testLeagueId = res.data.data._id;
    console.log(`   → Created league: ${res.data.data._id}`);
  });

  // 7. Get All Leagues
  await test('Get All Leagues', async () => {
    const res = await request('/api/leagues');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.data.success) throw new Error('Failed to fetch leagues');
    console.log(`   → Found ${res.data.data.length} leagues`);
  });

  // 8. Get Single League
  await test('Get Single League', async () => {
    const res = await request(`/api/leagues/${testLeagueId}`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.data.success) throw new Error('Failed to fetch league');
    console.log(`   → League: ${res.data.data.name}`);
  });

  // 9. Get Player Valuations
  await test('Get Player Valuations', async () => {
    const res = await request(`/api/leagues/${testLeagueId}/valuations`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.data.success) throw new Error('Failed to get valuations');
    console.log(`   → Calculated valuations for players`);
  });

  // 10. Start Draft
  await test('Start Draft', async () => {
    const res = await request(`/api/leagues/${testLeagueId}/start-draft`, 'POST');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.data.success) throw new Error('Failed to start draft');
    console.log(`   → Draft started, first nominator: ${res.data.data.currentNominator}`);
  });

  // 11. Nominate Player
  await test('Nominate Player for Draft', async () => {
    // Get first available player
    const playersRes = await request('/api/players?available=true&limit=1');
    if (!playersRes.data.success || playersRes.data.data.length === 0) {
      throw new Error('No available players found');
    }
    const availablePlayer = playersRes.data.data[0];
    
    const res = await request('/api/draft/nominate', 'POST', {
      leagueId: testLeagueId,
      playerId: availablePlayer._id,
      ownerName: 'Owner 1',
      initialBid: 5,
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.data.success) throw new Error('Failed to nominate player');
    console.log(`   → Player nominated at $5`);
  });

  // 12. Place Bid
  await test('Place Bid', async () => {
    const res = await request('/api/draft/bid', 'POST', {
      leagueId: testLeagueId,
      ownerName: 'Owner 2',
      amount: 10,
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.data.success) throw new Error('Failed to place bid');
    console.log(`   → Bid placed at $10`);
  });

  // 13. Complete Auction
  await test('Complete Auction', async () => {
    const res = await request('/api/draft/complete', 'POST', {
      leagueId: testLeagueId,
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.data.success) throw new Error('Failed to complete auction');
    console.log(`   → Auction completed`);
  });

  // 14. Get Draft History
  await test('Get Draft History', async () => {
    const res = await request(`/api/draft/history/${testLeagueId}`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.data.success) throw new Error('Failed to get draft history');
    console.log(`   → Found ${res.data.data.length} draft events`);
  });

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test Summary\n');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);

  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.name}: ${r.error}`);
    });
  }

  console.log('\n' + '='.repeat(60) + '\n');
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(console.error);
