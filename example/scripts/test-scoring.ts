import http from 'http';

const BASE_URL = 'http://localhost:4000';

function request(path: string, method: string = 'GET', body?: any): Promise<any>  {
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

async function testScoringSystem() {
  console.log('\n🧪 Testing Scoring and Valuation System\n');
  console.log('='.repeat(60));

  // 1. Create a test league
  console.log('\n1. Creating test league...');
  const leagueRes = await request('/api/leagues', 'POST', {
    name: 'Valuation Test League',
    commissioner: 'Test Commissioner',
    season: 2025,
    numOwners: 12,
    budgetPerOwner: 260,
    rosterSize: 23,
    owners: ['Owner 1', 'Owner 2', 'Owner 3', 'Owner 4', 'Owner 5', 'Owner 6',
             'Owner 7', 'Owner 8', 'Owner 9', 'Owner 10', 'Owner 11', 'Owner 12'],
  });
  
  if (!leagueRes.data.success) {
    console.error('❌ Failed to create league');
    return;
  }
  
  const leagueId = leagueRes.data.data._id;
  console.log(`✅ Created league: ${leagueId}`);

  // 2. Get valuations
  console.log('\n2. Fetching player valuations...');
  const valuationsRes = await request(`/api/leagues/${leagueId}/valuations`);
  
  if (!valuationsRes.data.success) {
    console.error('❌ Failed to get valuations');
    return;
  }

  console.log(`✅ Retrieved ${valuationsRes.data.data.length} player valuations`);

  // 3. Analyze valuations
  console.log('\n3. Analyzing valuations...\n');
  
  const players = valuationsRes.data.data;
  
  // Get top 10 overall
  const topPlayers = players
    .filter((p: any) => p.suggestedValue && p.suggestedValue > 0)
    .sort((a: any, b: any) => b.suggestedValue - a.suggestedValue)
    .slice(0, 10);
  
  console.log('📊 Top 10 Players by Value:');
  topPlayers.forEach((p: any, i: number) => {
    const val = p.suggestedValue.toFixed(1);
    const zScore = p.totalZScore.toFixed(2);
    console.log(`   ${i + 1}. ${p.playerName.padEnd(25)} $${val.padStart(5)} (Z-Score: ${zScore})`);
  });

  // Get top pitchers - note: we need to fetch player details to determine if pitcher
  console.log('\n⚾ Top 10 by Z-Score:');
  const topByZScore = [...players]
    .sort((a: any, b: any) => b.totalZScore - a.totalZScore)
    .slice(0, 10);
  topByZScore.forEach((p: any, i: number) => {
    const val = p.suggestedValue.toFixed(1);
    const zScore = p.totalZScore.toFixed(2);
    console.log(`   ${i + 1}. ${p.playerName.padEnd(25)} $${val.padStart(5)} (Z-Score: ${zScore})`);
  });

  // Value distribution
  const valueRanges = {
    '0-5': 0,
    '6-10': 0,
    '11-20': 0,
    '21-30': 0,
    '31+': 0,
  };

  players.forEach((p: any) => {
    if (!p.suggestedValue || p.suggestedValue <= 0) return;
    const val = p.suggestedValue;
    if (val <= 5) valueRanges['0-5']++;
    else if (val <= 10) valueRanges['6-10']++;
    else if (val <= 20) valueRanges['11-20']++;
    else if (val <= 30) valueRanges['21-30']++;
    else valueRanges['31+']++;
  });

  console.log('\n💰 Value Distribution:');
  Object.entries(valueRanges).forEach(([range, count]) => {
    console.log(`   $${range.padEnd(6)}: ${count} players`);
  });

  // Summary stats
  const totalBudget = 12 * 260; // 12 owners * $260
  const totalValue = players
    .filter((p: any) => p.suggestedValue && p.suggestedValue > 0)
    .reduce((sum: number, p: any) => sum + p.suggestedValue, 0);
  
  console.log('\n📈 Summary Statistics:');
  console.log(`   Total league budget:  $${totalBudget}`);
  console.log(`   Total player value:   $${totalValue.toFixed(0)}`);
  console.log(`   Value/Budget ratio:   ${(totalValue / totalBudget).toFixed(2)}`);
  console.log(`   Players with value:   ${players.filter((p: any) => p.suggestedValue && p.suggestedValue > 0).length}`);
  console.log(`   Average top 10 value: $${(topPlayers.reduce((s: number, p: any) => s + p.suggestedValue, 0) / Math.max(1, topPlayers.length)).toFixed(1)}`);
  console.log(`   Average Z-score:      ${(players.reduce((s: number, p: any) => s + p.totalZScore, 0) / Math.max(1, players.length)).toFixed(3)}`);

  console.log('\n' + '='.repeat(60));
  console.log('✅ Scoring system test complete\n');
}

testScoringSystem().catch(console.error);
