// Google Places API (New & Legacy) Serverless Handler for Solar Lead Discovery
// Implements strict circular radius, multi-keyword parallel matrix, deduplication by place_id,
// relevance scoring, and detailed diagnostic logs.

function calculateHaversineDistanceMeters(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999999;
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Phase 8: Lead Relevance Score (Do NOT over-filter nearby businesses)
function calculateRelevance(place, matchedQuery, distanceMeters) {
  let score = 0;
  const name = (place.displayName?.text || place.name || '').toLowerCase();
  const types = (place.types || []).map(t => String(t).toLowerCase()).join(' ');
  const primaryType = (place.primaryType || '').toLowerCase();
  const query = (matchedQuery || '').toLowerCase();

  // 1. Distance Proximity Score (Max 40 points)
  if (distanceMeters <= 500) score += 40;
  else if (distanceMeters <= 1500) score += 30;
  else if (distanceMeters <= 3000) score += 20;
  else if (distanceMeters <= 5000) score += 10;
  else score += 5;

  // 2. Keyword & Name Match Score (Max 35 points)
  if (name.includes('solar') || name.includes('urja') || name.includes('sun')) score += 35;
  else if (name.includes('renewable') || name.includes('photovoltaic') || name.includes('energy') || name.includes('power')) score += 25;
  else if (name.includes('electric') || name.includes('inverter') || name.includes('battery') || name.includes('engineering')) score += 18;
  else if (query.includes('solar') || query.includes('epc')) score += 12;

  // 3. Category / Business Types Match Score (Max 25 points)
  if (types.includes('solar') || primaryType.includes('solar')) score += 25;
  else if (types.includes('contractor') || types.includes('electrician') || types.includes('electronics_store') || types.includes('home_goods_store')) score += 18;
  else if (types.includes('store') || types.includes('establishment') || types.includes('point_of_interest')) score += 10;

  let tier = 'HIGH RELEVANCE';
  if (score < 40) tier = 'LOW RELEVANCE';
  else if (score < 65) tier = 'MEDIUM RELEVANCE';

  // Determine user-friendly category & type
  let category = 'Solar Energy Company';
  let type = 'epc';

  if (query.includes('epc') || name.includes('epc') || name.includes('engineering') || name.includes('solutions')) {
    category = 'Solar EPC Contractor & Installer';
    type = 'epc';
  } else if (query.includes('dealer') || query.includes('distributor') || name.includes('dealer') || name.includes('distributor') || name.includes('modules')) {
    category = 'Authorized Solar Module Distributor';
    type = 'dealer';
  } else if (query.includes('inverter') || query.includes('battery') || query.includes('shop') || name.includes('inverter') || name.includes('battery') || name.includes('cable') || name.includes('hardware')) {
    category = 'Solar Inverter & Equipment Shop';
    type = 'shop';
  } else if (query.includes('rooftop') || query.includes('installer') || name.includes('rooftop') || name.includes('installer')) {
    category = 'Rooftop Solar EPC & Installer';
    type = 'installer';
  }

  return { score, tier, category, type };
}

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const startTime = Date.now();

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const radiusMeters = Number(body.radiusMeters) || 3000; // default 3 km circular bounds
    const userAccuracy = Number(body.accuracy) || 15;
    const clientKey = (body.apiKey || '').trim();

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        success: false,
        error: 'Valid numeric latitude and longitude coordinates are required.'
      });
    }

    // Google API Key precedence: Server env -> Client override
    const apiKey =
      process.env.GOOGLE_PLACES_API_KEY ||
      process.env.VITE_GOOGLE_PLACES_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      clientKey;

    // Configurable Multi-Keyword Solar Matrix (Phase 4)
    const keywords = Array.isArray(body.keywords) && body.keywords.length > 0
      ? body.keywords
      : [
          'solar EPC company',
          'solar installer',
          'solar dealer',
          'solar panel shop',
          'solar inverter equipment',
          'rooftop solar installer',
          'solar energy company',
          'renewable energy supplier'
        ];

    // Diagnostics Tracking (Phase 7 & 24)
    const diagnostics = {
      searchCenter: { lat: latitude, lng: longitude },
      gpsAccuracy: userAccuracy,
      searchRadiusMeters: radiusMeters,
      queriesExecuted: keywords,
      googleApiStatus: 'NOT_CONFIGURED',
      googleApiType: 'None',
      apiLatencyMs: 0,
      rawPlacesReceived: 0,
      resultsAfterDeduplication: 0,
      resultsAfterFiltering: 0,
      discardedList: [],
      timestamp: new Date().toLocaleTimeString()
    };

    const aggregatedPlaces = new Map(); // Primary key: place_id

    // 1. If Google API Key is present, attempt Google Places API (New)
    if (apiKey && apiKey.length > 10) {
      diagnostics.googleApiType = 'Places API (New) v1/places:searchText';

      const fieldMask = [
        'places.id',
        'places.displayName',
        'places.formattedAddress',
        'places.location',
        'places.rating',
        'places.userRatingCount',
        'places.nationalPhoneNumber',
        'places.internationalPhoneNumber',
        'places.websiteUri',
        'places.googleMapsUri',
        'places.businessStatus',
        'places.regularOpeningHours',
        'places.primaryType',
        'places.types',
        'places.editorialSummary'
      ].join(',');

      let apiCallsSucceeded = 0;
      let lastErrorMessage = '';

      // Execute queries across matrix in parallel
      const searchPromises = keywords.map(async (kw) => {
        try {
          const endpoint = 'https://places.googleapis.com/v1/places:searchText';
          const payload = {
            textQuery: kw,
            locationRestriction: {
              circle: {
                center: {
                  latitude: latitude,
                  longitude: longitude
                },
                radius: Math.min(radiusMeters, 50000) // max 50km
              }
            },
            maxResultCount: 20
          };

          const gRes = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
              'X-Goog-FieldMask': fieldMask
            },
            body: JSON.stringify(payload)
          });

          if (gRes.ok) {
            const data = await gRes.json();
            apiCallsSucceeded++;
            if (Array.isArray(data.places)) {
              for (const p of data.places) {
                diagnostics.rawPlacesReceived++;
                if (p.id) {
                  if (!aggregatedPlaces.has(p.id)) {
                    aggregatedPlaces.set(p.id, { place: p, query: kw, source: 'Places API (New)' });
                  } else {
                    diagnostics.discardedList.push({
                      name: p.displayName?.text || p.id,
                      reason: `Duplicate place_id: ${p.id}`
                    });
                  }
                }
              }
            }
          } else {
            const errData = await gRes.json().catch(() => ({}));
            lastErrorMessage = errData.error?.message || `HTTP ${gRes.status} ${gRes.statusText}`;
          }
        } catch (callErr) {
          lastErrorMessage = callErr.message;
        }
      });

      await Promise.all(searchPromises);

      // Also execute places:searchNearby for point_of_interest / establishment
      try {
        const nearbyRes = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': fieldMask
          },
          body: JSON.stringify({
            includedTypes: ['establishment'],
            locationRestriction: {
              circle: {
                center: { latitude, longitude },
                radius: Math.min(radiusMeters, 50000)
              }
            },
            maxResultCount: 20,
            rankPreference: 'DISTANCE'
          })
        });

        if (nearbyRes.ok) {
          const nbData = await nearbyRes.json();
          if (Array.isArray(nbData.places)) {
            for (const p of nbData.places) {
              diagnostics.rawPlacesReceived++;
              if (p.id && !aggregatedPlaces.has(p.id)) {
                aggregatedPlaces.set(p.id, { place: p, query: 'searchNearby:establishment', source: 'Places API (New)' });
              }
            }
          }
        }
      } catch (e) {
        // Continue
      }

      // Check Google API Status
      if (apiCallsSucceeded > 0) {
        diagnostics.googleApiStatus = `CONNECTED (200 OK across ${apiCallsSucceeded} queries)`;
      } else if (lastErrorMessage) {
        diagnostics.googleApiStatus = `ERROR: ${lastErrorMessage}`;
      }

      // If Places API (New) returned 0 or had permissions error, attempt Legacy Places NearbySearch as fallback
      if (aggregatedPlaces.size === 0 && lastErrorMessage.includes('API has not been used')) {
        diagnostics.googleApiType = 'Fallback to Places API (Legacy) NearbySearch';
        try {
          const legacyUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=${radiusMeters}&keyword=solar&key=${apiKey}`;
          const legRes = await fetch(legacyUrl);
          if (legRes.ok) {
            const legData = await legRes.json();
            if (Array.isArray(legData.results)) {
              diagnostics.googleApiStatus = `CONNECTED via Legacy API (${legData.status})`;
              for (const p of legData.results) {
                if (p.place_id && !aggregatedPlaces.has(p.place_id)) {
                  aggregatedPlaces.set(p.place_id, {
                    place: {
                      id: p.place_id,
                      displayName: { text: p.name },
                      formattedAddress: p.vicinity,
                      location: { latitude: p.geometry?.location?.lat, longitude: p.geometry?.location?.lng },
                      rating: p.rating,
                      userRatingCount: p.user_ratings_total,
                      businessStatus: p.business_status,
                      googleMapsUri: `https://www.google.com/maps/place/?q=place_id:${p.place_id}`
                    },
                    query: 'legacy:solar',
                    source: 'Places API (Legacy)'
                  });
                }
              }
            }
          }
        } catch (legacyErr) {
          console.warn('Legacy Places API error:', legacyErr.message);
        }
      }
    } else {
      diagnostics.googleApiStatus = 'MISSING_API_KEY (Enter GCP Key in Diagnostics or set GOOGLE_PLACES_API_KEY)';
    }

    diagnostics.resultsAfterDeduplication = aggregatedPlaces.size;

    // Process & Filter Places strictly by distance and extract schema
    const finalLeads = [];

    for (const [placeId, { place, query, source }] of aggregatedPlaces.entries()) {
      const pLat = place.location?.latitude;
      const pLon = place.location?.longitude;

      if (!pLat || !pLon) {
        diagnostics.discardedList.push({
          name: place.displayName?.text || placeId,
          reason: 'Missing valid latitude/longitude coordinates from Google'
        });
        continue;
      }

      const distMeters = calculateHaversineDistanceMeters(latitude, longitude, pLat, pLon);

      // Strict Circular Radius Enforcement
      if (distMeters > radiusMeters) {
        diagnostics.discardedList.push({
          name: place.displayName?.text || placeId,
          reason: `Outside radius: ${Math.round(distMeters)}m away (max: ${radiusMeters}m)`
        });
        continue;
      }

      // Check Business Status (Filter permanently closed)
      if (place.businessStatus === 'CLOSED_PERMANENTLY') {
        diagnostics.discardedList.push({
          name: place.displayName?.text || placeId,
          reason: 'Business is Permanently Closed on Google Maps'
        });
        continue;
      }

      // Phase 8: Calculate Lead Relevance (Do not over-filter)
      const { score, tier, category, type } = calculateRelevance(place, query, distMeters);

      const phone = place.nationalPhoneNumber || place.internationalPhoneNumber || '';
      const mapsUri =
        place.googleMapsUri ||
        `https://www.google.com/maps/place/?q=place_id:${placeId}`;

      finalLeads.push({
        id: placeId,
        google_place_id: placeId,
        name: place.displayName?.text || 'Solar Business',
        category: category,
        type: type,
        address: place.formattedAddress || 'Local Address',
        city: place.formattedAddress?.split(',').slice(-3, -2)[0]?.trim() || 'Local Area',
        lat: Number(pLat.toFixed(6)),
        lon: Number(pLon.toFixed(6)),
        distanceMeters: Math.round(distMeters),
        distanceKm: Number((distMeters / 1000).toFixed(2)),
        phone: phone,
        website: place.websiteUri || null,
        googleMapsUri: mapsUri,
        rating: place.rating || null,
        reviewsCount: place.userRatingCount || 0,
        businessStatus: place.businessStatus || 'OPERATIONAL',
        isOpen: place.regularOpeningHours?.openNow ?? true,
        relevanceScore: score,
        relevanceTier: tier,
        source: source || 'Google Places API',
        verified: true
      });
    }

    // STRICT SORTING BY DISTANCE: Nearest first (#1 is the entity right next to the user!)
    finalLeads.sort((a, b) => a.distanceMeters - b.distanceMeters);

    diagnostics.resultsAfterFiltering = finalLeads.length;
    diagnostics.apiLatencyMs = Date.now() - startTime;

    return res.status(200).json({
      success: true,
      provider: diagnostics.googleApiStatus.startsWith('CONNECTED') ? 'Google Places API' : 'Direct Geolocation Intelligence',
      center: { latitude, longitude },
      radiusMeters,
      count: finalLeads.length,
      leads: finalLeads,
      diagnostics: diagnostics
    });
  } catch (error) {
    console.error('places-nearby fatal error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      diagnostics: {
        googleApiStatus: `FATAL_SERVER_ERROR: ${error.message}`,
        latencyMs: Date.now() - startTime
      }
    });
  }
}
