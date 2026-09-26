import { useState, useEffect, useRef, useCallback } from 'react';

// Haversine distance in meters
function haversineMeters(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Reverse Geocoding helper with detailed street/locality extraction
async function reverseGeocodeHighAccuracy(lat, lon) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
      {
        headers: { Accept: 'application/json' },
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
    // Network or timeout fallback
  }

  return {
    success: false,
    streetAddress: `${lat.toFixed(6)}° N, ${lon.toFixed(6)}° E`,
    city: 'Local Area',
    state: 'Gujarat',
    fullAddress: `${lat.toFixed(6)}, ${lon.toFixed(6)}`
  };
}

export function useHighAccuracyLocation({
  initialCoords = { lat: 23.0225, lon: 72.5714 },
  movementThresholdMeters = 35, // Trigger search update only when user moved > 35m
  autoStartWatch = true
} = {}) {
  const [coords, setCoords] = useState(initialCoords);
  const [accuracy, setAccuracy] = useState(null); // accuracy in meters
  const [streetAddress, setStreetAddress] = useState('Detecting exact street location...');
  const [city, setCity] = useState('Ahmedabad');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isGpsActive, setIsGpsActive] = useState(false);
  const [source, setSource] = useState('default'); // 'device_gps' | 'manual_pin' | 'default'
  const [lastUpdated, setLastUpdated] = useState(null);
  const [movementDistance, setMovementDistance] = useState(0);

  // References to track previous coordinates and watch ID
  const lastSearchCoordsRef = useRef(initialCoords);
  const watchIdRef = useRef(null);
  const isMountedRef = useRef(true);

  // On location update callback (optional consumer listener)
  const onSignificantMoveRef = useRef(null);
  const setOnSignificantMove = useCallback((callback) => {
    onSignificantMoveRef.current = callback;
  }, []);

  const handlePositionUpdate = useCallback(async (pos) => {
    if (!isMountedRef.current) return;
    const lat = Number(pos.coords.latitude.toFixed(6));
    const lon = Number(pos.coords.longitude.toFixed(6));
    const accMeters = pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null;

    const distFromLast = haversineMeters(
      lastSearchCoordsRef.current.lat,
      lastSearchCoordsRef.current.lon,
      lat,
      lon
    );

    setCoords({ lat, lon });
    setAccuracy(accMeters);
    setIsGpsActive(true);
    setSource('device_gps');
    setLoading(false);
    setError(null);
    setLastUpdated(new Date());
    setMovementDistance(Math.round(distFromLast));

    // Check if movement threshold is exceeded
    if (distFromLast >= movementThresholdMeters) {
      lastSearchCoordsRef.current = { lat, lon };
      if (onSignificantMoveRef.current) {
        onSignificantMoveRef.current({ lat, lon, accuracy: accMeters, distanceMoved: Math.round(distFromLast) });
      }
    }

    // Reverse geocode to get street address
    const geo = await reverseGeocodeHighAccuracy(lat, lon);
    if (isMountedRef.current) {
      setStreetAddress(geo.streetAddress);
      if (geo.city) setCity(geo.city);
    }
  }, [movementThresholdMeters]);

  const handlePositionError = useCallback((err) => {
    if (!isMountedRef.current) return;
    setLoading(false);
    let userMessage = 'Unable to access your live location.';
    let errCode = 'UNKNOWN';

    switch (err.code) {
      case 1: // PERMISSION_DENIED
        errCode = 'PERMISSION_DENIED';
        userMessage = 'Location access was denied. Please allow location in your browser or enter your area manually.';
        break;
      case 2: // POSITION_UNAVAILABLE
        errCode = 'POSITION_UNAVAILABLE';
        userMessage = 'Live GPS signal unavailable on this device. You can pick your spot manually.';
        break;
      case 3: // TIMEOUT
        errCode = 'TIMEOUT';
        userMessage = 'GPS request timed out. Please retry or pick your area manually.';
        break;
      default:
        userMessage = err.message || userMessage;
    }

    setError({ code: errCode, message: userMessage });
    setIsGpsActive(false);
  }, []);

  // One-time explicit acquire
  const acquireLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError({
        code: 'NOT_SUPPORTED',
        message: 'Device Geolocation API is not supported by this browser.'
      });
      return;
    }

    setLoading(true);
    setError(null);

    const geoOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(handlePositionUpdate, handlePositionError, geoOptions);
  }, [handlePositionUpdate, handlePositionError]);

  // Start continuous live tracking via watchPosition
  const startWatchingLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    setLoading(true);
    const geoOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        handlePositionUpdate,
        handlePositionError,
        geoOptions
      );
    } catch (e) {
      console.warn('watchPosition failed to initialize:', e);
    }
  }, [handlePositionUpdate, handlePositionError]);

  const stopWatchingLocation = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  // Set manual coordinates / spot
  const setManualLocation = useCallback(async ({ lat, lon, customAddress = null, customCity = null }) => {
    stopWatchingLocation();
    const cleanLat = Number(Number(lat).toFixed(6));
    const cleanLon = Number(Number(lon).toFixed(6));

    setCoords({ lat: cleanLat, lon: cleanLon });
    setAccuracy(5); // Manual spot is calibrated to ±5m
    setIsGpsActive(true);
    setSource('manual_pin');
    setError(null);
    setLastUpdated(new Date());
    lastSearchCoordsRef.current = { lat: cleanLat, lon: cleanLon };

    if (customAddress) {
      setStreetAddress(customAddress);
      if (customCity) setCity(customCity);
    } else {
      const geo = await reverseGeocodeHighAccuracy(cleanLat, cleanLon);
      if (isMountedRef.current) {
        setStreetAddress(geo.streetAddress);
        if (geo.city) setCity(geo.city);
      }
    }
  }, [stopWatchingLocation]);

  // Lifecycle
  useEffect(() => {
    isMountedRef.current = true;
    if (autoStartWatch) {
      startWatchingLocation();
    } else {
      acquireLocation();
    }

    return () => {
      isMountedRef.current = false;
      stopWatchingLocation();
    };
  }, [autoStartWatch, startWatchingLocation, acquireLocation, stopWatchingLocation]);

  return {
    coords,
    accuracy,
    isLowAccuracy: accuracy !== null && accuracy > 100,
    streetAddress,
    city,
    loading,
    error,
    isGpsActive,
    source,
    lastUpdated,
    movementDistance,
    acquireLocation,
    startWatchingLocation,
    stopWatchingLocation,
    setManualLocation,
    setOnSignificantMove
  };
}
