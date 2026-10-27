(() => {
  const openButton = document.querySelector('#open-address-map');
  const panel = document.querySelector('#address-map-panel');
  const canvas = document.querySelector('#delivery-map');
  const status = document.querySelector('#address-map-status');
  const preview = document.querySelector('#address-map-preview');
  const useButton = document.querySelector('#use-map-location');
  const currentButton = document.querySelector('#use-current-location');
  if (!openButton || !panel || !canvas) return;

  const defaultCenter = [12.9116, 77.6476];
  const photonEndpoint = 'https://photon.komoot.io';
  let map = null;
  let marker = null;
  let selectedResult = null;
  let selectedPoint = null;
  let leafletPromise = null;
  let lookupSequence = 0;
  let lookupTimer = null;
  let lookupController = null;

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

  function loadLeaflet() {
    if (window.L?.map) return Promise.resolve(window.L);
    if (leafletPromise) return leafletPromise;

    leafletPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      let settled = false;
      let timeoutId;
      const finish = (error, leaflet) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        script.onload = null;
        script.onerror = null;
        if (error) {
          script.remove();
          leafletPromise = null;
          reject(error);
        } else {
          resolve(leaflet);
        }
      };

      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
      script.crossOrigin = 'anonymous';
      script.async = true;
      script.onload = () => window.L?.map
        ? finish(null, window.L)
        : finish(new Error('The open-source map library did not finish loading. Check your connection and try again.'));
      script.onerror = () => finish(new Error('The open-source map library could not be loaded. Check your connection and try again.'));
      timeoutId = window.setTimeout(() => finish(new Error('The open-source map is taking too long to load. Check your connection and reopen the map to retry.')), 12000);
      document.head.append(script);
    });
    return leafletPromise;
  }

  function savedPoint() {
    const raw = document.querySelector('#delivery-coordinates').value;
    const parts = raw.split(',').map(Number);
    if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
      return { lat: parts[0], lng: parts[1] };
    }
    return null;
  }

  function normalizePhotonFeature(feature) {
    const properties = feature.properties || {};
    const [lng, lat] = feature.geometry?.coordinates || [];
    const city = properties.city || properties.town || properties.village || properties.municipality || properties.locality || '';
    const area = properties.suburb || properties.district || properties.neighbourhood || properties.city_district || properties.quarter || '';
    const street = [properties.housenumber, properties.street].filter(Boolean).join(' ');
    const parts = [street, properties.name, area, city, properties.state, properties.postcode, properties.country]
      .filter(Boolean)
      .filter((value, index, values) => values.indexOf(value) === index);
    const formatted = parts.join(', ');
    const addressComponents = [];
    const add = (type, value) => {
      if (value) addressComponents.push({ types: [type], long_name: String(value) });
    };
    add('street_number', properties.housenumber);
    add('route', properties.street);
    add('sublocality_level_1', area);
    add('locality', city);
    add('administrative_area_level_2', properties.county);
    add('administrative_area_level_1', properties.state);
    add('postal_code', properties.postcode);
    add('country', properties.country);

    return {
      ...feature,
      formatted_address: formatted,
      address_components: addressComponents,
      properties: {
        ...properties,
        formatted,
        address_line1: street || properties.name || area || city,
        address_line2: area,
        suburb: area,
        city,
        lat,
        lon: lng,
        country_code: properties.countrycode
      }
    };
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
    openButton.setAttribute('aria-label', label ? `Selected delivery location: ${label}. Click to change location.` : 'Select location on map');
  }

  function placeMarker(point) {
    if (!marker) {
      marker = window.L.marker(point, { draggable: true, title: 'Delivery location' }).addTo(map);
      marker.on('dragend', () => reverseGeocode(marker.getLatLng()));
    } else {
      marker.setLatLng(point);
    }
  }

  function initializeMap(L) {
    if (map) return;
    const existingPoint = savedPoint();
    const center = existingPoint ? [existingPoint.lat, existingPoint.lng] : defaultCenter;
    canvas.replaceChildren();
    map = L.map(canvas, { scrollWheelZoom: true }).setView(center, existingPoint ? 16 : 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> · <a href="https://www.openstreetmap.org/fixthemap">Report a map issue</a> · Geocoding by <a href="https://photon.komoot.io/">Photon</a>'
    }).addTo(map);
    map.on('click', event => reverseGeocode(event.latlng));

    if (existingPoint) {
      selectedPoint = existingPoint;
      placeMarker([existingPoint.lat, existingPoint.lng]);
      const existingAddress = document.querySelector('#delivery-map-address').value;
      if (existingAddress) {
        selectedResult = { formatted_address: existingAddress, properties: { formatted: existingAddress } };
        preview.textContent = existingAddress;
        useButton.disabled = false;
      }
    }
  }

  async function reverseGeocode(point) {
    const lat = Number(point.lat);
    const lng = Number(point.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    selectedPoint = { lat, lng };
    selectedResult = null;
    useButton.disabled = true;
    placeMarker([lat, lng]);
    ['#delivery-address-search', '#delivery-map-address', '#delivery-area', '#delivery-city', '#delivery-state', '#delivery-pincode', '#delivery-coordinates']
      .forEach(selector => { document.querySelector(selector).value = ''; });
    setStatus('Finding the address and PIN code…');
    preview.textContent = 'Looking up this location…';

    const requestId = ++lookupSequence;
    window.clearTimeout(lookupTimer);
    lookupController?.abort();
    lookupTimer = window.setTimeout(async () => {
      lookupController = new AbortController();
      try {
        const params = new URLSearchParams({ lat: String(lat), lon: String(lng), lang: 'en' });
        const response = await fetch(`${photonEndpoint}/reverse?${params}`, { signal: lookupController.signal });
        if (!response.ok) throw new Error(`Address lookup failed (${response.status}).`);
        const payload = await response.json();
        if (requestId !== lookupSequence) return;
        const feature = (payload.features || []).find(item => item.properties?.countrycode?.toLowerCase() === 'in') || (payload.features || [])[0];
        if (!feature) throw new Error('No address found for this pin. Try a nearby point.');
        const normalized = normalizePhotonFeature(feature);
        const countryCode = normalized.properties.country_code?.toLowerCase();
        if (countryCode && countryCode !== 'in') throw new Error('Please choose a delivery location in India.');
        selectedResult = normalized;
        preview.textContent = normalized.formatted_address || 'Address found for this location.';
        const hasPincode = Boolean(normalized.properties.postcode);
        setStatus(hasPincode ? 'Address and PIN code found. Review the filled address, then confirm.' : 'Address found. Enter the PIN code if it is unavailable for this location.');
        useButton.disabled = false;
        fillAddress(false);
      } catch (error) {
        if (error.name === 'AbortError' || requestId !== lookupSequence) return;
        preview.textContent = error.message || 'Could not find the address for this point.';
        setStatus(error.message || 'Address lookup failed. Try again.', true);
        useButton.disabled = false;
      }
    }, 450);
  }

  function component(result, type) {
    const item = result.address_components?.find(addressPart => addressPart.types.includes(type));
    return item ? item.long_name : '';
  }

  function fillAddress(closePanel = true) {
    if (!selectedPoint) return;
    if (!selectedResult) {
      document.querySelector('#delivery-coordinates').value = `${selectedPoint.lat.toFixed(6)}, ${selectedPoint.lng.toFixed(6)}`;
      document.querySelector('#address-feedback').textContent = 'Map pin saved. Enter the street address and PIN code manually if lookup is unavailable.';
      if (closePanel) {
        panel.hidden = true;
        openButton.setAttribute('aria-expanded', 'false');
        setClosedButtonLabel();
      }
      return;
    }
    const formatted = selectedResult.formatted_address || selectedResult.properties?.formatted || '';
    const houseNumber = component(selectedResult, 'street_number');
    const route = component(selectedResult, 'route');
    const house = [houseNumber, route].filter(Boolean).join(' ');
    const area = component(selectedResult, 'sublocality_level_1') || route || formatted;
    const city = component(selectedResult, 'locality') || component(selectedResult, 'administrative_area_level_2');
    const stateName = component(selectedResult, 'administrative_area_level_1');
    const pincode = component(selectedResult, 'postal_code') || document.querySelector('#delivery-pincode').value;

    document.querySelector('#delivery-address-search').value = formatted;
    document.querySelector('#delivery-map-address').value = formatted;
    if (house) document.querySelector('#delivery-house').value = house;
    if (area) document.querySelector('#delivery-area').value = area;
    if (city) document.querySelector('#delivery-city').value = city;
    if (stateName) document.querySelector('#delivery-state').value = stateName;
    if (pincode) document.querySelector('#delivery-pincode').value = pincode;
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
    setStatus('Loading OpenStreetMap…');
    showMapFallback('Loading the open-source map…');
    try {
      const L = await loadLeaflet();
      initializeMap(L);
      hideMapFallback();
      if (selectedPoint) map.setView([selectedPoint.lat, selectedPoint.lng], 16);
      window.requestAnimationFrame(() => map.invalidateSize());
      setStatus('Tap the map or drag the pin to choose a delivery location.');
    } catch (error) {
      setStatus(error.message || 'The map could not be loaded.', true);
      showMapFallback(error.message || 'The map could not be loaded. Check your connection and try again.');
    }
  });

  useButton.addEventListener('click', () => fillAddress(true));

  currentButton.addEventListener('click', () => {
    if (!map) {
      setStatus('The map is still loading. Please try again in a moment.', true);
      return;
    }
    if (!navigator.geolocation) {
      setStatus('Current location is not available in this browser. Pin a location on the map instead.', true);
      return;
    }
    setStatus('Requesting permission to use your current location…');
    navigator.geolocation.getCurrentPosition(position => {
      const point = { lat: position.coords.latitude, lng: position.coords.longitude };
      map.setView([point.lat, point.lng], 16);
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
      if (deliveryOverlay.classList.contains('open')) loadLeaflet().catch(() => {});
    }).observe(deliveryOverlay, { attributes: true, attributeFilter: ['class'] });
  }
})();
