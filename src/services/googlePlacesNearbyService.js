// Google Places API (New) Client Service
// Manages API dispatching, race-condition safety, caching, and diagnostics.

const GCP_KEY_STORAGE_KEY = 'sunvine_gcp_places_api_key';

// Phase 4: Production Solar Query Matrix
export const PRODUCTION_SOLAR_KEYWORD_MATRIX = {
  epc: [
    'solar EPC company',
    'solar installer',
    'solar installation',
    'rooftop solar installer',
    'solar power company'
  ],
  dealers: [
    'solar panel dealer',
    'solar distributor',
    'solar panel distributor',
    'solar module dealer'
  ],
  shops: [
    'solar inverter shop',
    'solar battery',
    'solar equipment supplier',
    'solar shop'
  ],
  broader: [
    'renewable energy company',
    'photovoltaic solar solutions'
  ]
};

export const DEFAULT_ACTIVE_QUERIES = [
  'solar EPC company',
  'solar installer',
  'solar panel dealer',
  'solar inverter shop',
  'solar energy equipment supplier',
  'rooftop solar installer',
  'solar distributor',
  'renewable energy company'
];

export function getSavedGooglePlacesApiKey() {
  return localStorage.getItem(GCP_KEY_STORAGE_KEY) || '';
}

export function saveGooglePlacesApiKey(key) {
  if (!key || key.trim().length === 0) {
    localStorage.removeItem(GCP_KEY_STORAGE_KEY);
  } else {
    localStorage.setItem(GCP_KEY_STORAGE_KEY, key.trim());
  }
}

// Request Race-Condition Guard (Phase 28)
let activeRequestId = 0;
let activeAbortController = null;

// Search Cache Map (Phase 18)
const searchCache = new Map();

function getCacheKey(lat, lon, radius, keywords) {
  const roundLat = Number(lat).toFixed(4);
  const roundLon = Number(lon).toFixed(4);
  const kwHash = (keywords || []).sort().join('|');
  return `${roundLat}_${roundLon}_${radius}_${kwHash}`;
}

export async function fetchGooglePlacesNearby({
  latitude,
  longitude,
  radiusMeters = 5000,
  keywords = DEFAULT_ACTIVE_QUERIES,
  accuracy = 10,
  forceRefresh = false,
  apiKey = null
}) {
  const currentRequestId = ++activeRequestId;

  // Cancel any prior in-flight search
  if (activeAbortController) {
    activeAbortController.abort();
  }
  activeAbortController = new AbortController();

  const cacheKey = getCacheKey(latitude, longitude, radiusMeters, keywords);

  // Check cache freshness unless forced refresh
  if (!forceRefresh && searchCache.has(cacheKey)) {
    const cached = searchCache.get(cacheKey);
    const ageSeconds = (Date.now() - cached.timestamp) / 1000;
    if (ageSeconds < 180) { // 3-minute cache
      return {
        ...cached.data,
        isFromCache: true,
        cacheAgeSeconds: Math.round(ageSeconds)
      };
    }
  }

  const effectiveKey = apiKey || getSavedGooglePlacesApiKey();

  try {
    const res = await fetch('/api/places-nearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      signal: activeAbortController.signal,
      body: JSON.stringify({
        latitude,
        longitude,
        radiusMeters,
        keywords,
        accuracy,
        apiKey: effectiveKey
      })
    });

    // Check if a newer request was dispatched while this was in-flight (Phase 28 Race Condition Guard)
    if (currentRequestId !== activeRequestId) {
      console.warn(`[Race Guard] Discarding response from older request #${currentRequestId} (Current: #${activeRequestId})`);
      return { superseded: true };
    }

    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.leads)) {
        // Save to cache
        searchCache.set(cacheKey, {
          timestamp: Date.now(),
          data: data
        });

        return {
          success: true,
          provider: data.provider,
          count: data.count,
          leads: data.leads,
          diagnostics: data.diagnostics || null,
          isFromCache: false
        };
      }
    } else {
      const errJson = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errJson.error || `HTTP ${res.status}: ${res.statusText}`,
        diagnostics: errJson.diagnostics || null,
        leads: []
      };
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      return { superseded: true };
    }
    console.warn('places-nearby API call failed:', err.message);
  }

  return {
    success: false,
    provider: 'Error / Network Timeout',
    count: 0,
    leads: [],
    diagnostics: null
  };
}
