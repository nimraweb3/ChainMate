for (let i = 0; i < 60; i++) {
  try {
    const a = await fetch('http://127.0.0.1:3001/api/health');
    const b = await fetch('http://127.0.0.1:5173');
    if (a.ok && b.ok) process.exit(0);
  } catch {}
  await new Promise((r) => setTimeout(r, 1000));
}
throw Error('Local services did not become ready within 60 seconds.');
