import fs from 'fs';

// Poor man's dotenv since it might not be installed in the root node_modules
const envContent = fs.readFileSync('.env.local', 'utf8');
const apiKey = envContent.split('\n').find(l => l.includes('APIFY_API_KEY')).split('=')[1].trim();

console.log("Key loaded:", apiKey.slice(0, 5) + "...");

async function testLinkedIn() {
  const nombreEmpresa = "Telepizza";
  const web = "telepizza.es";
  
  console.log("Testing LinkedIn X-Ray...");
  
  const query = `site:linkedin.com/in "Fundador" OR "Propietario" OR "CEO" OR "Founder" OR "Owner" "${nombreEmpresa}"`;
  
  const runRes = await fetch(
    `https://api.apify.com/v2/acts/apify~google-search-scraper/runs?token=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queries: query,
        maxPagesPerQuery: 1,
        resultsPerPage: 1,
        countryCode: "es",
      }),
    }
  );
  
  if (!runRes.ok) {
    console.error("Failed to start run");
    return;
  }
  
  const runData = await runRes.json();
  const runId = runData.data?.id;
  console.log("Run started:", runId);
  
  let status = 'RUNNING';
  while (status === 'RUNNING' || status === 'READY') {
    await new Promise(r => setTimeout(r, 4000));
    const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${apiKey}`);
    status = (await statusRes.json()).data?.status ?? 'FAILED';
    console.log("Status:", status);
  }
  
  if (status === 'SUCCEEDED') {
    const dataRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${apiKey}`);
    const items = await dataRes.json();
    console.log("Results:");
    if (items.length > 0 && items[0].organicResults && items[0].organicResults.length > 0) {
      console.log(items[0].organicResults[0]);
    } else {
      console.log("No organic results found");
    }
  }
}

testLinkedIn().catch(console.error);
