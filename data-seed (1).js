// data-seed.js — auto-generated 8/17/2026, 11:59:31 PM
// Loads your trip data into IndexedDB on any device.

(async function() {
  if (localStorage.getItem('data-seeded-v2')) return;

  await TripDB.open();

  const DATA = {
  "stays": [],
  "transport": [],
  "costs-manual": [],
  "itinerary": []
};

  for (const [store, records] of Object.entries(DATA)) {
    for (const record of records) {
      try { await TripDB.add(store, record); } catch(e) {}
    }
  }

  localStorage.setItem('data-seeded-v2', '1');
  console.log('✅ Trip data seeded.');
  // Reload so all pages pick up the new data
  if (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/')) {
    window.location.reload();
  }
})();
