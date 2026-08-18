// data-seed.js — Pete & Elise Italy Honeymoon
// Hardcoded from confirmed data. Loads once on first visit.

(async function () {
  if (localStorage.getItem('data-seeded-v3')) return;

  await TripDB.open();

  const STAYS = [
    {
      propertyTitle: 'Home in Rome',
      host: 'Bianca',
      platform: 'Airbnb',
      city: 'Rome',
      address: 'Via Francesco Crispi, 20, Rome, Lazio 00187, Italy',
      checkIn: 'Mon, Aug 24',
      checkInTime: '3:00 PM',
      checkOut: 'Wed, Aug 26',
      checkOutTime: '11:00 AM',
      confirmation: '2519510602',
      guests: '2',
      cost: '710.30',
      url: 'https://www.airbnb.com/trips/v1/1738767372406607005/ro/RESERVATION2_CHECKIN/HMH298NMT5',
      addedAt: '2026-08-14T02:31:07.629Z',
    },
    {
      propertyTitle: 'Home in Positano Hosted by Gennaro',
      host: 'Gennaro',
      platform: 'Airbnb',
      city: 'Positano',
      address: 'Viale Pasitea, 127, Positano',
      checkIn: 'Wed, Aug 26',
      checkInTime: '3:00 PM',
      checkOut: 'Mon, Aug 31',
      checkOutTime: '11:00 AM',
      confirmation: 'HM8T4PJQZA',
      guests: '2',
      cost: '6271.22',
      url: 'https://www.airbnb.com/trips/v1/1735200333465127193/ro/RESERVATION2_CHECKIN/HM8T4PJQZA',
      addedAt: '2026-08-14T02:31:41.729Z',
    },
    {
      propertyTitle: 'Home in Taormina',
      host: 'Hotel Villa Paradiso',
      platform: 'Expedia',
      city: 'Taormina',
      address: 'Via Roma 2, 98039 Taormina (ME), Italy',
      checkIn: 'Mon, Aug 31',
      checkInTime: '3:00 PM',
      checkOut: 'Sat, Sep 5',
      checkOutTime: '11:00 AM',
      confirmation: '2519510602',
      guests: '',
      cost: '4741.59',
      url: 'https://www.hotelvillaparadisotaormina.com/en/index',
      addedAt: '2026-08-14T02:31:46.154Z',
    },
    {
      propertyTitle: 'Home in Florence Hosted by HouseFlo',
      host: 'HouseFlo',
      platform: 'Airbnb',
      city: 'Florence',
      address: 'Via dei Pandolfini, 20, Florence',
      checkIn: 'Sat, Sep 5',
      checkInTime: '3:00 PM',
      checkOut: 'Tue, Sep 8',
      checkOutTime: '11:00 AM',
      confirmation: 'HMP5A82SFX',
      guests: '2',
      cost: '976.37',
      url: 'https://www.airbnb.com/trips/v1/1743518921077833871/ro/RESERVATION2_CHECKIN/HMP5A82SFX',
      addedAt: '2026-08-14T02:31:48.839Z',
    },
  ];

  const TRANSPORT = [
    {
      type: 'Flight', typeIcon: '✈️',
      carrier: 'ITA Airways', flightNo: '',
      from: 'Catania', to: 'Naples', fromCode: 'CTA', toCode: 'NAP',
      date: 'Aug 31, 2026', departTime: '11:00am',
      arrivalDate: 'Mon, Aug 31', arriveTime: '12:00pm',
      duration: '1h', confirmation: 'ALS78O', cost: '462.75',
      passengers: '2', seatClass: 'Economy',
      addedAt: '2026-08-15T00:20:30.228Z',
    },
    {
      type: 'Flight', typeIcon: '✈️',
      carrier: '', flightNo: '',
      from: 'Florence', to: 'Catania', fromCode: 'FLR', toCode: 'CTA',
      date: 'Sep 5, 2026', departTime: '11:30am',
      arrivalDate: 'Sat, Sep 5', arriveTime: '1:10pm',
      duration: '1h 40m', confirmation: 'Y87T2P', cost: '423.00',
      passengers: '2', seatClass: 'Economy',
      addedAt: '2026-08-15T00:20:32.600Z',
    },
    {
      type: 'Flight', typeIcon: '✈️',
      carrier: 'ITA Airways', flightNo: '',
      from: 'Rome', to: 'Florence', fromCode: 'FCO', toCode: 'FLR',
      date: 'Sep 8, 2026', departTime: '6:25am',
      arrivalDate: 'Tue, Sep 8', arriveTime: '7:15am',
      duration: '', confirmation: 'ALLOSL', cost: '466.20',
      passengers: '2', seatClass: 'Business',
      addedAt: '2026-08-15T00:20:35.088Z',
    },
    {
      type: 'Transfer', typeIcon: '🚕',
      carrier: 'Welcome', flightNo: '',
      from: 'Naples Central Train Station', to: 'Positano Airbnb',
      fromCode: '', toCode: '',
      date: 'Wed, Aug 26', departTime: '2:10 PM',
      arrivalDate: 'Wed, Aug 26', arriveTime: '3:33 PM',
      duration: '', confirmation: 'TRE-7EB8-XG33-YGRY-H', cost: '212.76',
      passengers: '2', seatClass: '',
      addedAt: '2026-08-15T00:43:43.108Z',
    },
  ];

  for (const stay of STAYS) {
    try { await TripDB.add('stays', stay); } catch(e) {}
  }
  for (const t of TRANSPORT) {
    try { await TripDB.add('transport', t); } catch(e) {}
  }

  localStorage.setItem('data-seeded-v3', '1');
  console.log('✅ Pete & Elise trip data loaded.');

  // Reload once so all pages render with the new data
  setTimeout(() => window.location.reload(), 500);
})();
