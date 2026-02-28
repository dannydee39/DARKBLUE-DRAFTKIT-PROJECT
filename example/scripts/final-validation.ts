import http from 'http';

const BASE_URL = 'http://localhost:4000';

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

async function finalValidation() {
  console.log('\n🎯 Final End-to-End Validation\n');
  console.log('='.repeat(70));
  
  let passedTests = 0;
  let totalTests = 0;
  
  // Test 1: Health Check
  totalTests++;
  console.log('\n1️⃣  Testing API Health...');
  try {
    const res = await request('/api/health');
    if (res.status === 200 && res.data.success) {
      console.log('   ✅ API is healthy');
      passedTests++;
    } else {
      console.log('   ❌ Health check failed');
    }
  } catch (e) {
    console.log('   ❌ Error:', e);
  }
  
  // Test 2: Players with filters
  totalTests++;
  console.log('\n2️⃣  Testing Player Filtering...');
  try {
    const res = await request('/api/players?position=P&available=true&limit=5');
    if (res.status === 200 && res.data.success && res.data.data.length > 0) {
      console.log(`   ✅ Found ${res.data.data.length} available pitchers`);
      passedTests++;
    } else {
      console.log('   ❌ Player filtering failed');
    }
  } catch (e) {
    console.log('   ❌ Error:', e);
  }
  
  // Test 3: Create League
  totalTests++;
  console.log('\n3️⃣  Creating Test League...');
  let leagueId: string;
  try {
    const res = await request('/api/leagues', 'POST', {
      name: 'Final Validation League',
      commissioner: 'Test Admin',
      season: 2025,
      numOwners: 10,
      budgetPerOwner: 260,
      rosterSize: 23,
      owners: ['Owner A', 'Owner B', 'Owner C', 'Owner D', 'Owner E',
               'Owner F', 'Owner G', 'Owner H', 'Owner I', 'Owner J'],
    });
    if (res.status === 201 && res.data.success) {
      leagueId = res.data.data._id;
      console.log(`   ✅ League created: ${leagueId}`);
      passedTests++;
    } else {
      console.log('   ❌ League creation failed');
      return;
    }
  } catch (e) {
    console.log('   ❌ Error:', e);
    return;
  }
  
  // Test 4: Get League Statistics
  totalTests++;
  console.log('\n4️⃣  Testing League Statistics...');
  try {
    const res = await request(`/api/leagues/${leagueId}/statistics`);
    if (res.status === 200 && res.data.success) {
      console.log('   ✅ League statistics:');
      console.log(`      - Draft Status: ${res.data.data.draftStatus}`);
      console.log(`      - Total Budget: $${res.data.data.financial.totalBudget}`);
      console.log(`      - Owners: ${res.data.data.owners.length}`);
      passedTests++;
    } else {
      console.log('   ❌ Statistics failed');
    }
  } catch (e) {
    console.log('   ❌ Error:', e);
  }
  
  // Test 5: Calculate Valuations
  totalTests++;
  console.log('\n5️⃣  Calculating Player Valuations...');
  try {
    const res = await request(`/api/leagues/${leagueId}/valuations`);
    if (res.status === 200 && res.data.success) {
      const topPlayer = res.data.data[0];
      console.log('   ✅ Valuations calculated');
      console.log(`      - Top Player: ${topPlayer.playerName} ($${topPlayer.suggestedValue})`);
      passedTests++;
    } else {
      console.log('   ❌ Valuations failed');
    }
  } catch (e) {
    console.log('   ❌ Error:', e);
  }
  
  // Test 6: Start Draft
  totalTests++;
  console.log('\n6️⃣  Starting Draft...');
  try {
    const res = await request(`/api/leagues/${leagueId}/start-draft`, 'POST');
    if (res.status === 200 && res.data.success) {
      console.log(`   ✅ Draft started, nominator: ${res.data.data.currentNominator}`);
      passedTests++;
    } else {
      console.log('   ❌ Start draft failed');
    }
  } catch (e) {
    console.log('   ❌ Error:', e);
  }
  
  // Test 7: Nominate Player
  totalTests++;
  console.log('\n7️⃣  Nominating Player...');
  try {
    // Get an available player
    const playersRes = await request('/api/players?available=true&limit=1');
    const player = playersRes.data.data[0];
    
    const res = await request('/api/draft/nominate', 'POST', {
      leagueId,
      playerId: player._id,
      ownerName: 'Owner A',
      initialBid: 10,
    });
    if (res.status === 200 && res.data.success) {
      console.log(`   ✅ Player nominated: ${player.name} for $10`);
      passedTests++;
    } else {
      console.log('   ❌ Nomination failed');
    }
  } catch (e) {
    console.log('   ❌ Error:', e);
  }
  
  // Test 8: Place Bid
  totalTests++;
  console.log('\n8️⃣  Placing Bid...');
  try {
    const res = await request('/api/draft/bid', 'POST', {
      leagueId,
      ownerName: 'Owner B',
      amount: 15,
    });
    if (res.status === 200 && res.data.success) {
      console.log('   ✅ Bid placed: $15');
      passedTests++;
    } else {
      console.log('   ❌ Bid failed');
    }
  } catch (e) {
    console.log('   ❌ Error:', e);
  }
  
  // Test 9: Complete Auction
  totalTests++;
  console.log('\n9️⃣  Completing Auction...');
  try {
    const res = await request('/api/draft/complete', 'POST', {
      leagueId,
    });
    if (res.status === 200 && res.data.success) {
      console.log('   ✅ Auction completed');
      passedTests++;
    } else {
      console.log('   ❌ Complete auction failed');
    }
  } catch (e) {
    console.log('   ❌ Error:', e);
  }
  
  // Test 10: Get League Statistics After Draft Event
  totalTests++;
  console.log('\n🔟 Checking Updated League Statistics...');
  try {
    const res = await request(`/api/leagues/${leagueId}/statistics`);
    if (res.status === 200 && res.data.success) {
      console.log('   ✅ Updated statistics:');
      console.log(`      - Players Drafted: ${res.data.data.progress.playersDrafted}`);
      console.log(`      - Total Spent: $${res.data.data.financial.totalSpent}`);
      console.log(`      - Avg Player Cost: $${res.data.data.financial.avgPlayerCost}`);
      passedTests++;
    } else {
      console.log('   ❌ Statistics failed');
    }
  } catch (e) {
    console.log('   ❌ Error:', e);
  }
  
  // Test 11: Get Owner Roster
  totalTests++;
  console.log('\n1️⃣1️⃣  Checking Owner Roster...');
  try {
    const res = await request(`/api/leagues/${leagueId}/roster/Owner%20B`);
    if (res.status === 200 && res.data.success) {
      console.log('   ✅ Owner B roster:');
      console.log(`      - Players: ${res.data.data.roster.length}`);
      console.log(`      - Remaining Budget: $${res.data.data.remainingBudget}`);
      console.log(`      - Empty Slots: ${res.data.data.emptySlots}`);
      passedTests++;
    } else {
      console.log('   ❌ Roster fetch failed');
    }
  } catch (e) {
    console.log('   ❌ Error:', e);
  }
  
  // Test 12: Compare Players
  totalTests++;
  console.log('\n1️⃣2️⃣  Comparing Players...');
  try {
    const playersRes = await request('/api/players?available=true&limit=3');
    const playerIds = playersRes.data.data.map((p: any) => p._id);
    
    const res = await request('/api/players/compare', 'POST', { playerIds });
    if (res.status === 200 && res.data.success) {
      console.log(`   ✅ Comparison generated for ${res.data.data.length} players`);
      passedTests++;
    } else {
      console.log('   ❌ Comparison failed');
    }
  } catch (e) {
    console.log('   ❌ Error:', e);
  }
  
  // Test 13: Draft History
  totalTests++;
  console.log('\n1️⃣3️⃣  Checking Draft History...');
  try {
    const res = await request(`/api/draft/history/${leagueId}`);
    if (res.status === 200 && res.data.success) {
      console.log(`   ✅ Draft history: ${res.data.data.length} events logged`);
      passedTests++;
    } else {
      console.log('   ❌ History fetch failed');
    }
  } catch (e) {
    console.log('   ❌ Error:', e);
  }
  
  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('\n📊 FINAL VALIDATION SUMMARY\n');
  const percentage = ((passedTests / totalTests) * 100).toFixed(1);
  console.log(`✅ Tests Passed:      ${passedTests}/${totalTests}`);
  console.log(`📈 Success Rate:      ${percentage}%`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 ALL TESTS PASSED! Application is fully functional!\n');
  } else {
    console.log(`\n⚠️  ${totalTests - passedTests} tests failed. Please review output above.\n`);
  }
  
  console.log('='.repeat(70) + '\n');
}

finalValidation().catch(console.error);
