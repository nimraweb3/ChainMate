const url = process.argv[2] || 'http://127.0.0.1:8787/api/health';
for (let attempt = 0; attempt < 90; attempt++) {
  try {
    const r = await fetch(
      url,
      url.includes(':8545')
        ? {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'web3_clientVersion',
              params: [],
            }),
          }
        : undefined,
    );
    if (r.ok) {
      console.log('Service is ready.');
      process.exit(0);
    }
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
throw Error('Service did not become ready.');
