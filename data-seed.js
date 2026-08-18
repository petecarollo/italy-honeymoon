// data-seed.js — auto-generated 8/17/2026, 11:55:15 PM
// Loads your trip data into IndexedDB on any device.
// This file is auto-run when you visit the site.

(async function() {
  if (localStorage.getItem('data-seeded-v2')) return;  // already loaded

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
})();
