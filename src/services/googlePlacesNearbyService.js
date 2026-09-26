// Google Places API (New) Client Service
// Dispatches queries to `/api/places-nearby` with configurable radius and multi-keyword solar matrix.

const GCP_KEY_STORAGE_KEY = 'sunvine_gcp_places_api_key';

export const DEFAULT_SOLAR_KEYWORDS = [
  'solar panel dealer',
  'solar EPC contractor',
  'solar inverter shop',
  'solar energy equipment supplier',
  'solar company',
  'rooftop solar installer'
];

export function getSavedGooglePlacesApiKey() {
  return localStorage.getItem(GCP_KEY_STORAGE_KEY) || '';
}

export function saveGooglePlacesApiKey(key) {
  if (!key) {
    localStorage.removeItem(GCP_KEY_STORAGE_KEY);
  } else {
    localStorage.setItem(GCP_KEY_STORAGE_KEY, key.trim());
  }
}

export async function fetchGooglePlacesNearby({
  latitude,
  longitude,
  radiusMeters = 3000,
  keywords = DEFAULT_SOLAR_KEYWORDS,
  apiKey = null
}) {
  const effectiveKey = apiKey || getSavedGooglePlacesApiKey();

  try {
    const res = await fetch('/api/places-nearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        latitude,
        longitude,
        radiusMeters,
        keywords,
        apiKey: effectiveKey
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.leads)) {
        return {
          success: true,
          provider: data.provider,
          count: data.count,
          leads: data.leads
        };
      }
    }
  } catch (err) {
    console.warn('places-nearby API call failed:', err.message);
  }

  return {
    success: false,
    provider: 'Offline / Network Error',
    count: 0,
    leads: []
  };
}
