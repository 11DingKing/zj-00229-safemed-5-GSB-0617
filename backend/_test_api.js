const http = require('http');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, data: data.slice(0, 500) }); }
      });
    }).on('error', reject);
  });
}

async function main() {
  const tests = [
    { name: '字典接口', url: 'http://localhost:3002/api/dict' },
    { name: '预案列表', url: 'http://localhost:3002/api/plans' },
    { name: '预案匹配(violence)', url: 'http://localhost:3002/api/plans/match?type=violence&hospital=市第一人民医院&department=急诊科' },
    { name: '高发统计', url: 'http://localhost:3002/api/stats/high-risk' },
    { name: '复盘(1)', url: 'http://localhost:3002/api/reviews/1' },
    { name: '事件列表', url: 'http://localhost:3002/api/incidents' },
  ];

  for (const t of tests) {
    try {
      const r = await fetchJson(t.url);
      console.log(`\n=== ${t.name} (${t.url}) ===`);
      console.log('Status:', r.status);
      const d = r.data;
      if (typeof d === 'string') { console.log(d); continue; }
      if (d.types) console.log('types:', d.types?.length, 'statuses:', d.statuses?.length);
      if (d.list) console.log('list count:', d.list.length);
      if (d.matches) {
        console.log('matches count:', d.matches.length);
        d.matches.forEach(m => console.log('  -', m.plan_no, m.title?.slice(0, 30), 'score:', m.score, 'reasons:', m.match_reasons?.join(',')));
      }
      if (d.risk_tip) console.log('risk_tip:', d.risk_tip);
      if (d.summary) console.log('summary:', JSON.stringify(d.summary));
      if (d.high_risk_hospitals) {
        console.log('high_risk_hospitals:', d.high_risk_hospitals.map(h => `${h.hospital}(${h.count})`).join(','));
        console.log('high_risk_departments:', d.high_risk_departments.map(d => `${d.hospital}${d.department}(${d.count})`).join(','));
      }
      if (d.incident_no) console.log('incident:', d.incident_no, d.review ? 'has review' : 'no review');
      if (d.summary_text || d.qualitative) console.log('review exists:', !!d.summary);
    } catch (e) {
      console.log(`${t.name} ERROR:`, e.message);
    }
  }
}
main();
