// seed-data.js — writes Rome Airbnb data directly to IndexedDB
// Loaded by seed.html. Run once, then you can delete seed.html.

(async function () {
  await TripDB.open();

  const existing = await TripDB.getAll('stays');
  if (existing.some(s => s.confirmation === 'HMH298NMT5')) {
    document.getElementById('msg').textContent = '✅ Rome stay already saved — redirecting…';
    setTimeout(() => window.location.href = 'stays.html', 1500);
    return;
  }

  await TripDB.add('stays', {
    propertyTitle: 'The Terrace Luxury',
    host:          'Bianca',
    platform:      'Airbnb',
    city:          'Rome',
    address:       'Via Francesco Crispi, 20, Rome, Lazio 00187, Italy',
    checkIn:       'Mon, Aug 24',
    checkInTime:   '3:00 PM',
    checkOut:      'Wed, Aug 26',
    checkOutTime:  '11:00 AM',
    confirmation:  'HMH298NMT5',
    guests:        '2',
    cost:          '710.30',
    cancellation:  'Cancel before 3:00 PM on August 17 for a partial refund. After that, this reservation is non-refundable.',
    addedAt:       new Date().toISOString(),
  });

  document.getElementById('msg').textContent = '✅ Rome stay saved! Redirecting…';
  setTimeout(() => window.location.href = 'stays.html', 1500);
})();
