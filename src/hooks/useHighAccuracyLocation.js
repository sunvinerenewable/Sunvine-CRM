import { useState, useEffect, useCallback } from 'react';

// Reverse Geocoding helper with detailed street/locality extraction
async function reverseGeocodeHighAccuracy(lat, lon) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
      {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const street = addr.road || addr.suburb || addr.neighbourhood || addr.industrial || addr.commercial || '';
      const locality = addr.suburb || addr.city_district || '';
      const city = addr.city || addr.town || addr.village || addr.county || 'Gujarat';
      const state = addr.state || 'Gujarat';

      const parts = [street, locality, city].filter(Boolean);
      const formatted = parts.length > 0 ? parts.join(', ') : data.display_name?.split(',').slice(0, 3).join(',') || `${lat.toFixed(6)}, ${lon.toFixed(6)}`;

      return {
        success: true,
        streetAddress: formatted,
        city: city,
        state: state,
        fullAddress: data.display_name || formatted
      };
    }
  } catch (err) {
    // Fallback on network timeout
  }

  return {
    success: false,
    streetAddress: `Coordinates: ${lat.toFixed(6)}, ${lon.toFixed(6)}`,
    city: 'Local Area',
    state: 'Gujarat',
    fullAddress: `${lat.toFixed(6)}, ${lon.toFixed(6)}`
  };
}

export function useHighAccuracyLocation(initialCoords = { lat: 23.0225, lon: 72.5714 }) {
  const [coords, setCoords] = useState(initialCoords);
  const [accuracy, setAccuracy] = useState(null); // accuracy in meters
  const [streetAddress, setStreetAddress] = useState('Detecting exact street location...');
  const [city, setCity] = useState('Ahmedabad');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isGpsActive, setIsGpsActive] = useState(false);
  const [source, setSource] = useState('default'); // 'device_gps' | 'manual_pin' | 'default'

  // Device-level High-Accuracy Geolocation Request
  const acquireLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError({
        code: 'NOT_SUPPORTED',
        message: 'Device Geolocation API is not supported by your browser.'
      });
      return;
    }

    setLoading(true);
    setError(null);

    const geoOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lon = Number(pos.coords.longitude.toFixed(6));
        const accMeters = pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null;

        setCoords({ lat, lon });
        setAccuracy(accMeters);
        setIsGpsActive(true);
        setSource('device_gps');
        setLoading(false);

        // Fetch street address via reverse geocode
        const geoResult = await reverseGeocodeHighAccuracy(lat, lon);
        setStreetAddress(geoResult.streetAddress);
        if (geoResult.city) setCity(geoResult.city);
      },
      (err) => {
        setLoading(false);
        let userMessage = 'Unable to retrieve your location.';
        let errCode = 'UNKNOWN';

        switch (err.code) {
          case 1: // PERMISSION_DENIED
            errCode = 'PERMISSION_DENIED';
            userMessage = 'Location permission was denied. Please allow GPS access in your browser or pick your spot manually.';
            break;
          case 2: // POSITION_UNAVAILABLE
            errCode = 'POSITION_UNAVAILABLE';
            userMessage = 'High accuracy GPS signal unavailable. Please use the manual location pin below.';
            break;
          case 3: // TIMEOUT
            errCode = 'TIMEOUT';
            userMessage = 'Location request timed out. Retrying or manual pinpoint recommended.';
            break;
          default:
            userMessage = err.message || userMessage;
        }

        setError({ code: errCode, message: userMessage });
        setIsGpsActive(false);
      },
      geoOptions
    );
  }, []);

  // Set location manually (via map pin or area search)
  const setManualLocation = useCallback(async ({ lat, lon, customAddress = null, customCity = null }) => {
    const cleanLat = Number(Number(lat).toFixed(6));
    const cleanLon = Number(Number(lon).toFixed(6));

    setCoords({ lat: cleanLat, lon: cleanLon });
    setAccuracy(5); // manual pin has 5m virtual accuracy
    setIsGpsActive(true);
    setSource('manual_pin');
    setError(null);

    if (customAddress) {
      setStreetAddress(customAddress);
      if (customCity) setCity(customCity);
    } else {
      const geoResult = await reverseGeocodeHighAccuracy(cleanLat, cleanLon);
      setStreetAddress(geoResult.streetAddress);
      if (geoResult.city) setCity(geoResult.city);
    }
  }, []);

  return {
    coords,
    accuracy,
    streetAddress,
    city,
    loading,
    error,
    isGpsActive,
    source,
    acquireLocation,
    setManualLocation
  };
}
