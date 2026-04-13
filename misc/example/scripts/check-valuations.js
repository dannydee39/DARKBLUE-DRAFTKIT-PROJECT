const http = require('http');

const leagueId = '6985607fd24b508cd158a711';

http.get(`http://localhost:4000/api/leagues/${leagueId}/valuations`, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    const data = JSON.parse(body);
    const players = data.data;
    const positiveValues = players.filter(p => p.calculatedValue && p.calculatedValue > 0);
    
    console.log(`Total players: ${players.length}`);
    console.log(`Players with positive values: ${positiveValues.length}`);
    
    if (positiveValues.length > 0) {
      const top5 = positiveValues
        .sort((a, b) => b.calculatedValue - a.calculatedValue)
        .slice(0, 5);
      
      console.log('\nTop 5:');
      top5.forEach((p, i) => {
        console.log(`${i + 1}. ${p.name}: $${p.calculatedValue.toFixed(1)}`);
      });
    }
  });
}).on('error', console.error);
