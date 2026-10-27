(() => {
  const openButton = document.querySelector('#open-address-map');
  const panel = document.querySelector('#address-map-panel');
  const canvas = document.querySelector('#delivery-map');
  const status = document.querySelector('#address-map-status');
  const preview = document.querySelector('#address-map-preview');
  const useButton = document.querySelector('#use-map-location');
  const currentButton = document.querySelector('#use-current-location');
  if (!openButton || !panel || !canvas) return;

  const defaultCenter = { lat: 12.9116, lng: 77.6476 };
  let map = null;
  let marker = null;
  let selectedResult = null;
  let selectedPoint = null;
  let mapsPromise = null;
  let mapsLoadAttempt = 0;
  let lookupSequence = 0;

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle('is-error', isError);
  }

  function showMapFallback(message) {
    let fallback = document.querySelector('#delivery-map-fallback');
    if (!fallback) {
      fallback = document.createElement('div');
      fallback.id = 'delivery-map-fallback';
      fallback.className = 'delivery-map-fallback';
      canvas.append(fallback);
    }
    fallback.textContent = message;
  }

  function hideMapFallback() {
    document.querySelector('#delivery-map-fallback')?.remove();
  }

  function selectedLabel() {
    const properties = selectedResult?.properties || {};
    return properties.address_line1 || properties.suburb || properties.city ||
      properties.formatted || selectedResult?.formatted_address || '';
  }

  function setClosedButtonLabel() {
    const label = selectedLabel();
    const shortLabel = label.length > 42 ? `${label.slice(0, 39)}…` : label;
    openButton.textContent = label ? `📍 ${shortLabel}` : '⌖ Select location on map';
    openButton.title = label ? `Selected location: ${label}. Click to change.` : 'Select your delivery location on the map.';
    openButton.setAttribute('aria-label', label ? 'Selected delivery location: ' + label + '. Click to change location.' : 'Select location on map');
  }

  window.gm_authFailure = () => {
    setStatus('Google Maps could not authorize this page. Check the Maps JavaScript API key and allowed referrers.', true);
    preview.textContent = 'Map unavailable. Open this page on an allowed localhost or HTTPS address.';
    useButton.disabled = true;
    showMapFallback('Google Maps could not authorize this page. Check the key restrictions and try localhost or an allowed HTTPS address.');
  };

  function loadGoogleMaps() {
    if (window.google?.maps?.Map) return Promise.resolve(window.google.maps);
    if (mapsPromise) return mapsPromise;
    const key = window.AABHA_GOOGLE_MAPS_KEY || '';
    if (!key) return Promise.reject(new Error('Google Maps key is missing. Set AABHA_GOOGLE_MAPS_KEY in config.js for the hosted site or config.local.js for local development.'));

    mapsPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const callbackName = `__aabhaGoogleMapsReady${++mapsLoadAttempt}`;
      const params = new URLSearchParams({ key, v: 'weekly', loading: 'async', callback: callbackName });
      let settled = false;
      let timeoutId;

      const cleanup = removeScript => {
        clearTimeout(timeoutId);
        delete window[callbackName];
        script.onerror = null;
        if (removeScript) script.remove();
      };
      const fail = message => {
        if (settled) return;
        settled = true;
        cleanup(true);
        mapsPromise = null;
        reject(new Error(message));
      };

      script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
      script.async = true;
      script.dataset.aabhaGoogleMaps = 'true';
      window[callbackName] = () => {
        if (settled) return;
        if (!window.google?.maps?.Map) {
          fail('Google Maps responded without its map library. Check that Maps JavaScript API is enabled for this key.');
          return;
        }
        settled = true;
        cleanup(false);
        resolve(window.google.maps);
      };
      script.onerror = () => fail('Google Maps could not be loaded. Check the API key, allowed referrers, and Maps JavaScript API.');
      timeoutId = window.setTimeout(() => {
        fail('Google Maps is taking too long to respond. Check your connection, then close and reopen the map to retry.');
      }, 15000);
      document.head.append(script);
    });
    return mapsPromise;
  }

  function savedPoint() {
    const raw = document.querySelector('#delivery-coordinates').value;
    const parts = raw.split(',').map(Number);
    if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
      return { lat: parts[0], lng: parts[1] };
    }
    return null;
  }

  function initializeMap(MapClass) {
    if (map) return;
    const existingPoint = savedPoint();
    canvas.replaceChildren();
    map = new MapClass(canvas, {
      center: existingPoint || defaultCenter,
      zoom: existingPoint ? 16 : 12,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      clickableIcons: false,
      gestureHandling: 'greedy'
    });
    map.addListener('click', event => {
      if (event.latLng) reverseGeocode(event.latLng);
    });
    if (existingPoint) {
      marker = new google.maps.Marker({ map, position: existingPoint, draggable: true, title: 'Delivery location' });
      marker.addListener('dragend', event => event.latLng && reverseGeocode(event.latLng));
      selectedPoint = existingPoint;
      const existingAddress = document.querySelector('#delivery-map-address').value;
      if (existingAddress) {
        selectedResult = { formatted_address: existingAddress, properties: { formatted: existingAddress } };
        preview.textContent = existingAddress;
        useButton.disabled = false;
      }
    }
  }

  function normalizeGeoapifyResult(result) {
    const p = result.properties || result;
    const components = [];
    const add = (type, value, shortValue = value) => {
      if (value) components.push({ types: [type], long_name: String(value), short_name: String(shortValue || value) });
    };
    add('street_number', p.housenumber);
    add('route', p.street);
    add('sublocality_level_1', p.suburb || p.district || p.neighbourhood || p.city_district);
    add('locality', p.city || p.town || p.village || p.municipality);
    add('administrative_area_level_2', p.county);
    add('administrative_area_level_1', p.state);
    add('postal_code', p.postcode);
    add('country', p.country, p.country_code?.toUpperCase() || p.country);
    const formatted = p.formatted || [p.address_line1, p.address_line2, p.city, p.state, p.postcode, p.country].filter(Boolean).join(', ');
    return { formatted_address: formatted, address_components: components, properties: p };
  }

  async function reverseGeocode(point) {
    const requestId = ++lookupSequence;
    selectedPoint = { lat: point.lat(), lng: point.lng() };
    selectedResult = null;
    useButton.disabled = true;
    if (!marker) {
      marker = new google.maps.Marker({ map, position: point, draggable: true, title: 'Delivery location' });
      marker.addListener('dragend', event => event.latLng && reverseGeocode(event.latLng));
    } else {
      marker.setPosition(point);
    }
    setStatus('Finding the complete address and PIN code…');
    preview.textContent = 'Looking up this location…';
    try {
      const apiKey = window.AABHA_GEOAPIFY_KEY || '';
      if (!apiKey) throw new Error('Address lookup key is missing from config.js.');
      const params = new URLSearchParams({
        lat: String(selectedPoint.lat),
        lon: String(selectedPoint.lng),
        format: 'json',
        lang: 'en',
        limit: '3',
        apiKey
      });
      const response = await fetch(`https://api.geoapify.com/v1/geocode/reverse?${params}`);
      if (!response.ok) throw new Error(`Address lookup failed (${response.status}).`);
      const payload = await response.json();
      if (requestId !== lookupSequence) return;
      const raw = (payload.results || []).find(item => (item.properties || item).postcode) || (payload.results || [])[0];
      if (!raw) throw new Error('No address found for this pin. Try a nearby point.');
      const normalized = normalizeGeoapifyResult(raw);
      const countryCode = normalized.properties.country_code?.toLowerCase();
      if (countryCode && countryCode !== 'in') throw new Error('Please choose a delivery location in India.');
      selectedResult = normalized;
      preview.textContent = normalized.formatted_address;
      const hasPincode = Boolean(normalized.properties.postcode);
      setStatus(hasPincode ? 'Address and PIN code found and filled into the form.' : 'Address filled. Enter the PIN code if it was not found.');
      useButton.disabled = false;
      fillAddress(false);
    } catch (error) {
      if (requestId !== lookupSequence) return;
      preview.textContent = error.message || 'Could not find the address for this point.';
      setStatus(error.message || 'Address lookup failed. Try again.', true);
    }
  }

  function component(result, type) {
    const item = result.address_components?.find(addressPart => addressPart.types.includes(type));
    return item ? item.long_name : '';
  }

  function fillAddress(closePanel = true) {
    if (!selectedResult || !selectedPoint) return;
    const formatted = selectedResult.formatted_address || '';
    const houseNumber = component(selectedResult, 'street_number');
    const route = component(selectedResult, 'route');
    const house = [houseNumber, route].filter(Boolean).join(' ');
    const area = component(selectedResult, 'sublocality_level_1') || route || formatted;
    const city = component(selectedResult, 'locality') || component(selectedResult, 'administrative_area_level_2');
    const stateName = component(selectedResult, 'administrative_area_level_1');
    const pincode = component(selectedResult, 'postal_code');

    document.querySelector('#delivery-address-search').value = formatted;
    document.querySelector('#delivery-map-address').value = formatted;
    if (house) document.querySelector('#delivery-house').value = house;
    document.querySelector('#delivery-area').value = area;
    document.querySelector('#delivery-city').value = city;
    document.querySelector('#delivery-state').value = stateName;
    document.querySelector('#delivery-pincode').value = pincode;
    document.querySelector('#delivery-coordinates').value = `${selectedPoint.lat.toFixed(6)}, ${selectedPoint.lng.toFixed(6)}`;
    document.querySelector('#address-suggestions').hidden = true;
    document.querySelector('#delivery-address-search').setAttribute('aria-expanded', 'false');
    document.querySelector('#address-feedback').textContent = pincode
      ? 'Map address and PIN code filled. Check the house details, then save.'
      : 'Map address filled. Enter the 6-digit PIN code if it was not found.';
    if (closePanel) {
      panel.hidden = true;
      openButton.setAttribute('aria-expanded', 'false');
      setClosedButtonLabel();
    }
  }

  openButton.addEventListener('click', async () => {
    const shouldOpen = panel.hidden;
    panel.hidden = !shouldOpen;
    openButton.setAttribute('aria-expanded', String(shouldOpen));
    if (!shouldOpen) {
      setClosedButtonLabel();
      return;
    }
    openButton.textContent = '⌖ Hide map';
    openButton.setAttribute('aria-label', 'Hide map');
    setStatus('Loading Google Maps…');
    showMapFallback('Loading Google Maps…');
    try {
      const library = await loadGoogleMaps();
      initializeMap(library.Map);
      hideMapFallback();
      if (selectedPoint) map.setCenter(selectedPoint);
      setStatus('Tap the map or drag the pin to choose a delivery location.');
    } catch (error) {
      setStatus(error.message || 'Google Maps could not be loaded.', true);
      showMapFallback(error.message || 'Google Maps could not be loaded. Check the API key and Maps JavaScript API.');
    }
  });

  useButton.addEventListener('click', () => fillAddress(true));

  currentButton.addEventListener('click', () => {
    if (!navigator.geolocation) {
      setStatus('Current location is not available in this browser. Pin a location on the map instead.', true);
      return;
    }
    setStatus('Requesting permission to use your current location…');
    navigator.geolocation.getCurrentPosition(position => {
      const point = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
      map.setCenter(point);
      map.setZoom(16);
      reverseGeocode(point);
    }, error => {
      const message = error.code === error.PERMISSION_DENIED
        ? 'Location permission was not granted. You can still pin a location on the map.'
        : 'Could not get your current location. Pin a location on the map instead.';
      setStatus(message, true);
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  });

  const deliveryOverlay = document.querySelector('#checkout-overlay');
  if (deliveryOverlay) {
    new MutationObserver(() => {
      if (deliveryOverlay.classList.contains('open')) loadGoogleMaps().catch(() => {});
    }).observe(deliveryOverlay, { attributes: true, attributeFilter: ['class'] });
  }
})();
