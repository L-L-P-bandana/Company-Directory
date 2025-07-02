// ===================================================================
// GAZETTEER APPLICATION - JS
// ===================================================================

// Global Variables & State Management
var map, currentCountryCode = '', countryBorder = null, allCountryBorders = null, allCountries = [];
var searchResults = [], selectedSearchIndex = -1, visitedCountries = [], maxMarkers = 50;
var currentCurrencyData = null, globalExchangeRates = null;

// ===================================================================
// LEAFLET MARKER GROUPS & CLUSTERING
// ===================================================================

// Country markers (visited locations)
var countryMarkers = L.layerGroup();

// Clustered POI groups with custom styling
var cityClusterGroup = L.markerClusterGroup({
  showCoverageOnHover: false, 
  zoomToBoundsOnClick: true, 
  maxClusterRadius: 50,
  iconCreateFunction: function(cluster) {
    var count = cluster.getChildCount();
    var size = count < 10 ? 'small' : count < 100 ? 'medium' : 'large';
    return new L.DivIcon({ 
      html: '<div><span>' + count + '</span></div>', 
      className: 'marker-cluster city-' + size, 
      iconSize: new L.Point(40, 40) 
    });
  }
});

var airportClusterGroup = L.markerClusterGroup({
  showCoverageOnHover: false, 
  zoomToBoundsOnClick: true, 
  maxClusterRadius: 50,
  iconCreateFunction: function(cluster) {
    var count = cluster.getChildCount();
    var size = count < 10 ? 'small' : count < 100 ? 'medium' : 'large';
    return new L.DivIcon({ 
      html: '<div><span>' + count + '</span></div>', 
      className: 'marker-cluster airport-' + size, 
      iconSize: new L.Point(40, 40) 
    });
  }
});

var railwayClusterGroup = L.markerClusterGroup({
  showCoverageOnHover: false, 
  zoomToBoundsOnClick: true, 
  maxClusterRadius: 50,
  iconCreateFunction: function(cluster) {
    var count = cluster.getChildCount();
    var size = count < 10 ? 'small' : count < 100 ? 'medium' : 'large';
    return new L.DivIcon({ 
      html: '<div><span>' + count + '</span></div>', 
      className: 'marker-cluster railway-' + size, 
      iconSize: new L.Point(40, 40) 
    });
  }
});

var portClusterGroup = L.markerClusterGroup({
  showCoverageOnHover: false, 
  zoomToBoundsOnClick: true, 
  maxClusterRadius: 50,
  iconCreateFunction: function(cluster) {
    var count = cluster.getChildCount();
    var size = count < 10 ? 'small' : count < 100 ? 'medium' : 'large';
    return new L.DivIcon({ 
      html: '<div><span>' + count + '</span></div>', 
      className: 'marker-cluster port-' + size, 
      iconSize: new L.Point(40, 40) 
    });
  }
});

// ===================================================================
// MAP TILE LAYERS
// ===================================================================

var streets = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
  attribution: "Tiles &copy; Esri"
});

var satellite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
  attribution: "Tiles &copy; Esri"
});

// ===================================================================
// LEAFLET EASY BUTTONS (Modal Triggers)
// ===================================================================

var demographicsBtn = L.easyButton("fa-users fa-xl", function() { 
  loadCountryData(); 
  $("#demographicsModal").modal("show"); 
});

var weatherBtn = L.easyButton("fa-cloud fa-xl", function() { 
  loadWeatherData(); 
  $("#weatherModal").modal("show"); 
});

var currencyBtn = L.easyButton("fa-coins fa-xl", function() { 
  loadCurrencyData(); 
  $("#currencyModal").modal("show"); 
});

var newsBtn = L.easyButton("fa-newspaper fa-xl", function() { 
  loadNewsData(); 
  $("#newsModal").modal("show"); 
});

var wikipediaBtn = L.easyButton("fa-wikipedia-w fa-xl", function() { 
  loadWikipediaData(); 
  $("#wikipediaModal").modal("show"); 
});

var holidaysBtn = L.easyButton("fa-calendar fa-xl", function() { 
  loadHolidaysData(); 
  $("#holidaysModal").modal("show"); 
});

// ===================================================================
// UTILITY FUNCTIONS
// ===================================================================

/**
 * Debounce function to curb API calls during search
 */
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// ===================================================================
// APP INITIALIZATION
// ===================================================================

$(document).ready(function() {
  
  // Initialize Leaflet map
  map = L.map("map", {layers: [streets]}).setView([54.5, -4], 6);
  
  // Add clustered layers to map
  map.addLayer(cityClusterGroup);
  map.addLayer(airportClusterGroup);
  map.addLayer(railwayClusterGroup);
  map.addLayer(portClusterGroup);
  
  // Layer control setup
  L.control.layers(
    {
      "Streets": streets, 
      "Satellite": satellite
    }, 
    {
      "Visited Countries": countryMarkers, 
      "Cities": cityClusterGroup, 
      "Airports": airportClusterGroup,
      "Railways": railwayClusterGroup,
      "Ports": portClusterGroup
    }
  ).addTo(map);
  
  // Add country markers layer
  countryMarkers.addTo(map);
  
  // Add easy buttons to map
  [demographicsBtn, weatherBtn, currencyBtn, newsBtn, wikipediaBtn, holidaysBtn]
    .forEach(btn => btn.addTo(map));
  
  // Load initial data
  loadCountries();
  loadAllCountryBorders();
  setupSearchHandlers();
  setupCurrencyConverter();
  
  // Auto-detect user location and highlight their country
  detectUserLocation();
  
  // Event listeners
  $('#countrySelect').change(function() {
    var code = $(this).val();
    if (code) selectCountry(code);
  });
  
  map.on('click', function(e) {
    hideSearchResults();
    detectClickedCountry(e.latlng, e.latlng);
  });
  
  $(document).click(function(e) {
    if (!$(e.target).closest('#searchContainer').length) {
      hideSearchResults();
    }
  });
});

// ===================================================================
// CURRENCY CONVERTER SYSTEM
// ===================================================================

/**
 * Initialize global currency converter functionality
 */
function setupCurrencyConverter() {
  loadGlobalExchangeRates();
  
  // Event bindings for real-time conversion
  $('#convertBtn, #convertAmount, #fromCurrency, #toCurrency')
    .on('click change input', performConversion);
  
  $('#fromCurrency').on('change', updateAmountSymbol);
}

/**
 * Load global exchange rates for currency converter
 */
function loadGlobalExchangeRates() {
  $.ajax({
    url: 'php/getCurrency.php',
    data: {action: 'getAllRates'},
    dataType: 'json',
    success: function(data) {
      if (data.error) {
        console.error('Exchange rate API error:', data.message);
        $('#convertResult').text('Exchange rates unavailable');
        return;
      }
      
      globalExchangeRates = data;
      populateCurrencySelectors(data.currencies);
    },
    error: function() {
      console.error('Failed to load exchange rates');
      $('#convertResult').text('Exchange rates unavailable');
    }
  });
}

/**
 * Populate currency dropdown selectors
 */
function populateCurrencySelectors(currencies) {
  var fromOptions = '<option value="">Select currency...</option>';
  var toOptions = '<option value="">Select currency...</option>';
  
  currencies.forEach(function(currency) {
    var option = `<option value="${currency.code}">${currency.name} (${currency.code}) ${currency.symbol}</option>`;
    fromOptions += option;
    toOptions += option;
  });
  
  $('#fromCurrency').html(fromOptions);
  $('#toCurrency').html(toOptions);
  
  // Set default TO currency to USD
  $('#toCurrency').val('USD');
  
  // If current country selected, set FROM to that country's currency
  if (currentCountryCode && currentCurrencyData) {
    $('#fromCurrency').val(currentCurrencyData.code);
    updateAmountSymbol();
  }
}

/**
 * Update amount field label with currency symbol
 */
function updateAmountSymbol() {
  var fromCode = $('#fromCurrency').val();
  if (fromCode && globalExchangeRates && globalExchangeRates.currencies) {
    var fromCurrency = globalExchangeRates.currencies.find(c => c.code === fromCode);
    if (fromCurrency) {
      $('#amountLabel').text(`Amount (${fromCode} - ${fromCurrency.symbol})`);
    }
  } else {
    $('#amountLabel').text('Amount');
  }
}

/**
 * Perform live currency conversion
 */
function performConversion() {
  var amount = parseFloat($('#convertAmount').val()) || 0;
  var fromCode = $('#fromCurrency').val();
  var toCode = $('#toCurrency').val();
  
  if (!amount || !fromCode || !toCode || !globalExchangeRates) {
    $('#convertResult').text('Enter valid amount and select currencies');
    return;
  }
  
  var fromRate = globalExchangeRates.rates[fromCode] || 1;
  var toRate = globalExchangeRates.rates[toCode] || 1;
  
  // Convert via USD as base currency
  var usdAmount = fromCode === 'USD' ? amount : amount / fromRate;
  var result = toCode === 'USD' ? usdAmount : usdAmount * toRate;
  
  var fromSymbol = globalExchangeRates.currencies.find(c => c.code === fromCode)?.symbol || fromCode;
  var toSymbol = globalExchangeRates.currencies.find(c => c.code === toCode)?.symbol || toCode;
  
  $('#convertResult').html(`${toSymbol}${result.toFixed(2)}`);
}

// ===================================================================
// MARKER MANAGEMENT SYSTEM
// ===================================================================

/**
 * Add country marker for visited locations
 */
function addCountryMarker(code, name, latlng) {
  // Remove existing marker for this country
  var existing = visitedCountries.findIndex(c => c.code === code);
  if (existing !== -1) {
    countryMarkers.removeLayer(visitedCountries[existing].marker);
    visitedCountries.splice(existing, 1);
  }
  
  // Maintain maximum marker limit
  if (visitedCountries.length >= maxMarkers) {
    var oldest = visitedCountries.shift();
    countryMarkers.removeLayer(oldest.marker);
  }
  
  // Create new marker with custom icon
  var marker = L.marker(latlng, { 
    icon: L.divIcon({
      className: 'country-marker',
      html: '<div class="marker-inner new-marker" data-country-code="' + code + '"></div>',
      iconSize: [48, 48], 
      iconAnchor: [24, 42], 
      popupAnchor: [0, -42]
    }),
    title: name, 
    zIndexOffset: 1000
  });
  
  // Bind tooltip and click handler
  marker.bindTooltip(name, {
    permanent: false, 
    direction: 'top', 
    offset: [0, -45], 
    className: 'country-tooltip'
  });
  
  marker.on('click', () => { 
    $('#countrySelect').val(code); 
    selectCountry(code); 
  });
  
  marker.addTo(countryMarkers);
  
  // Track visited country
  visitedCountries.push({
    code, 
    name, 
    latlng, 
    marker, 
    timestamp: Date.now()
  });
  
  // Remove pulse animation after 2 seconds
  setTimeout(() => {
    var el = marker.getElement();
    if (el) {
      var inner = el.querySelector('.marker-inner');
      if (inner) inner.classList.remove('new-marker');
    }
  }, 2000);
}

// ===================================================================
// POI DATA LOADING & MARKER CREATION (the little icons)
// ===================================================================

/**
 * Load cities and POI data for selected country
 */
function loadCitiesAndAirports(countryCode) {
  if (!countryCode) return;
  
  // Load cities
  $.ajax({
    url: 'php/getCities.php', 
    data: {country: countryCode}, 
    dataType: 'json',
    success: function(cities) { 
      if (cities?.length) addCityMarkers(cities); 
    }
  });
  
  // Load airports
  $.ajax({
    url: 'php/getAirports.php', 
    data: {country: countryCode}, 
    dataType: 'json',
    success: function(airports) { 
      if (airports?.length) addAirportMarkers(airports); 
    }
  });
  
  // Load railways
  $.ajax({
    url: 'php/getRailways.php', 
    data: {country: countryCode}, 
    dataType: 'json',
    success: function(railways) { 
      if (railways?.length) addRailwayMarkers(railways); 
    }
  });
  
  // Load ports
  $.ajax({
    url: 'php/getPorts.php', 
    data: {country: countryCode}, 
    dataType: 'json',
    success: function(ports) { 
      if (ports?.length) addPortMarkers(ports); 
    }
  });
}

/**
 * Add city markers to cluster group
 */
function addCityMarkers(cities) {
  cities.forEach(city => {
    var marker = L.marker([city.lat, city.lng], { 
      icon: L.divIcon({
        className: 'city-marker', 
        html: '<div class="poi-marker-inner city-marker-inner">🏙️</div>', 
        iconSize: [22, 22], 
        iconAnchor: [11, 11]
      })
    });
    
    var tooltip = city.name + 
      (city.population ? ' (Pop: ' + city.population.toLocaleString() + ')' : '') + 
      (city.admin1 ? ' - ' + city.admin1 : '');
    
    marker.bindTooltip(tooltip, {
      permanent: false, 
      direction: 'top', 
      className: 'city-tooltip'
    });
    
    cityClusterGroup.addLayer(marker);
  });
}

/**
 * Add airport markers to cluster group
 */
function addAirportMarkers(airports) {
  airports.forEach(airport => {
    var marker = L.marker([airport.lat, airport.lng], { 
      icon: L.divIcon({
        className: 'airport-marker', 
        html: '<div class="poi-marker-inner airport-marker-inner">✈️</div>', 
        iconSize: [22, 22], 
        iconAnchor: [11, 11]
      })
    });
    
    var tooltip = airport.name + 
      (airport.code ? ' (' + airport.code + ')' : '') + 
      (airport.admin1 ? ' - ' + airport.admin1 : '');
    
    marker.bindTooltip(tooltip, {
      permanent: false, 
      direction: 'top', 
      className: 'airport-tooltip'
    });
    
    airportClusterGroup.addLayer(marker);
  });
}

/**
 * Add railway markers to cluster group
 */
function addRailwayMarkers(railways) {
  railways.forEach(railway => {
    var marker = L.marker([railway.lat, railway.lng], { 
      icon: L.divIcon({
        className: 'railway-marker', 
        html: '<div class="poi-marker-inner railway-marker-inner">🚂</div>', 
        iconSize: [22, 22], 
        iconAnchor: [11, 11]
      })
    });
    
    var tooltip = railway.name + 
      (railway.type ? ' (' + railway.type + ')' : '') + 
      (railway.admin1 ? ' - ' + railway.admin1 : '');
    
    marker.bindTooltip(tooltip, {
      permanent: false, 
      direction: 'top', 
      className: 'railway-tooltip'
    });
    
    railwayClusterGroup.addLayer(marker);
  });
}

/**
 * Add port markers to cluster group
 */
function addPortMarkers(ports) {
  ports.forEach(port => {
    var marker = L.marker([port.lat, port.lng], { 
      icon: L.divIcon({
        className: 'port-marker', 
        html: '<div class="poi-marker-inner port-marker-inner">⚓</div>', 
        iconSize: [22, 22], 
        iconAnchor: [11, 11]
      })
    });
    
    var tooltip = port.name + 
      (port.type ? ' (' + port.type + ')' : '') + 
      (port.admin1 ? ' - ' + port.admin1 : '');
    
    marker.bindTooltip(tooltip, {
      permanent: false, 
      direction: 'top', 
      className: 'port-tooltip'
    });
    
    portClusterGroup.addLayer(marker);
  });
}

/**
 * Clear all POI markers for country switch
 */
function clearClustersForCountry() {
  cityClusterGroup.clearLayers();
  airportClusterGroup.clearLayers();
  railwayClusterGroup.clearLayers();
  portClusterGroup.clearLayers();
}

// ===================================================================
// SEARCH FUNCTIONALITY
// ===================================================================

/**
 * Setup search input handlers with keyboard navigation
 */
function setupSearchHandlers() {
  const searchInput = $('#countrySearch');
  const debouncedSearch = debounce(performSearch, 300);
  
  searchInput.on('input', function() {
    const query = $(this).val().trim();
    query.length > 0 ? debouncedSearch(query) : hideSearchResults();
  });

  searchInput.on('keydown', function(e) {
    if (!$('#searchResults').is(':visible')) return;
    
    switch(e.keyCode) {
      case 38: // Up arrow
        e.preventDefault(); 
        navigateSearchResults(-1); 
        break;
      case 40: // Down arrow
        e.preventDefault(); 
        navigateSearchResults(1); 
        break;
      case 13: // Enter
        e.preventDefault(); 
        selectHighlightedResult(); 
        break;
      case 27: // Escape
        hideSearchResults(); 
        break;
    }
  });

  searchInput.on('focus', function() {
    const query = $(this).val().trim();
    if (query.length > 0 && searchResults.length > 0) {
      showSearchResults();
    }
  });
}

/**
 * Search through countries
 */
function performSearch(query) {
  if (!allCountries?.length) return;
  
  const lowerQuery = query.toLowerCase();
  searchResults = allCountries.filter(country => 
    country.name.toLowerCase().includes(lowerQuery) || 
    country.code.toLowerCase().includes(lowerQuery)
  );
  
  displaySearchResults();
}

/**
 * Display search results
 */
function displaySearchResults() {
  const container = $('#searchResults');
  selectedSearchIndex = -1;
  
  if (searchResults.length === 0) {
    container.html('<div class="list-group-item text-center text-muted fst-italic">No countries found</div>');
  } else {
    let html = '';
    searchResults.slice(0, 8).forEach((country, index) => {
      html += `<div class="list-group-item list-group-item-action d-flex align-items-center gap-2 py-2 search-result-item" 
                    data-index="${index}" data-code="${country.code}">
        <span class="badge bg-secondary">${country.code}</span>
        <span class="search-result-name">${country.name}</span>
      </div>`;
    });
    
    if (searchResults.length > 8) {
      html += `<div class="list-group-item text-center text-muted fst-italic small">
                 ${searchResults.length - 8} more countries...
               </div>`;
    }
    
    container.html(html);
    
    $('.search-result-item').click(function() { 
      selectCountryFromSearch($(this).data('code')); 
    });
  }
  
  showSearchResults();
}

/**
 * Keyboard navigation on search reults
 */
function navigateSearchResults(direction) {
  const maxIndex = Math.min(searchResults.length - 1, 7);
  selectedSearchIndex = direction === 1 
    ? (selectedSearchIndex < maxIndex ? selectedSearchIndex + 1 : 0)
    : (selectedSearchIndex > 0 ? selectedSearchIndex - 1 : maxIndex);
  
  $('.search-result-item').removeClass('active');
  $(`.search-result-item[data-index="${selectedSearchIndex}"]`).addClass('active');
}

/**
 * Select highlighted search result
 */
function selectHighlightedResult() {
  if (selectedSearchIndex >= 0 && selectedSearchIndex < searchResults.length) {
    selectCountryFromSearch(searchResults[selectedSearchIndex].code);
  }
}

/**
 * Select country from search results
 */
function selectCountryFromSearch(countryCode) {
  $('#countrySearch').val('');
  hideSearchResults();
  $('#countrySelect').val(countryCode);
  
  var center = getCountryCenter(countryCode);
  selectCountry(countryCode, center);
}

/**
 * Show/hide search results
 */
function showSearchResults() { 
  $('#searchResults').removeClass('d-none'); 
}

function hideSearchResults() { 
  $('#searchResults').addClass('d-none'); 
  selectedSearchIndex = -1; 
}

// ===================================================================
// COUNTRY DETECTION & SELECTION
// ===================================================================

/**
 * Intense country code detection from GeoJSON properties (necessary as France and Norway where being stubborn)
 */
function getCountryCode(feature) {
  const isoProps = [
    'ISO3166-1-Alpha-2',  // Primary
    'ISO_A2',             // Alternative
    'iso_a2',             // Lowercase alternative
    'ISO2',               // Another common name
    'iso2'                // Lowercase
  ];
  
  for (const prop of isoProps) {
    const value = feature.properties?.[prop];
    if (value && value !== '-99' && value !== '' && value.length === 2) {
      return value.toUpperCase();
    }
  }
  
  // Fallback to name-based mapping
  return mapCountryNameToIso(feature.properties?.name);
}

/**
 * Map country names to ISO codes (for problematic entries)
 */
function mapCountryNameToIso(countryName) {
  if (!countryName) return null;
  
  const nameToIso = {
    'France': 'FR',
    'French Republic': 'FR',
    'Norway': 'NO',
    'Kingdom of Norway': 'NO',
    'United Kingdom': 'GB',
    'United States of America': 'US',
    'United States': 'US',
    'Germany': 'DE',
    'Federal Republic of Germany': 'DE'
  };
  
  return nameToIso[countryName] || null;
}

/**
 * Select and highlight a country
 */
function selectCountry(countryCode, markerPosition) {
  currentCountryCode = countryCode;
  loadCountryBorder(countryCode);
  
  var countryName = allCountries.find(c => c.code === countryCode)?.name || countryCode;
  var center = markerPosition || getCountryCenter(countryCode);
  
  if (center) {
    addCountryMarker(countryCode, countryName, center);
  }
  
  clearClustersForCountry();
  loadCitiesAndAirports(countryCode);
}

/**
 * Get center coordinates for a country
 */
function getCountryCenter(countryCode) {
  if (!allCountryBorders?.features) return null;
  
  for (var feature of allCountryBorders.features) {
    const featureCode = getCountryCode(feature);
    if (featureCode === countryCode) {
      try {
        return L.geoJSON(feature).getBounds().getCenter();
      } catch (error) {
        return null;
      }
    }
  }
  return null;
}

// ===================================================================
// DATA LOADING FUNCTIONS
// ===================================================================

/**
 * Load countries list for dropdown
 */
function loadCountries() {
  $.ajax({
    url: 'php/getCountries.php', 
    dataType: 'json',
    success: function(data) {
      allCountries = data;
      $('#countrySelect').html(
        '<option value="">Select a country...</option>' + 
        data.map(c => `<option value="${c.code}">${c.name}</option>`).join('')
      );
    }
  });
}

/**
 * Load country borders GeoJSON data
 */
function loadAllCountryBorders() {
  $.ajax({
    url: 'countryBorders.geo.json', 
    dataType: 'json', 
    success: data => allCountryBorders = data
  });
}

/**
 * Load and display country border on map
 */
function loadCountryBorder(countryCode) {
  if (countryBorder) {
    map.removeLayer(countryBorder);
  }
  
  $.ajax({
    url: 'php/getCountryBorder.php', 
    data: {country: countryCode}, 
    dataType: 'json',
    success: function(data) {
      if (data?.geometry) {
        countryBorder = L.geoJSON(data, {
          style: {
            color: "#2980b9", 
            weight: 2, 
            fillOpacity: 0.1
          }
        }).addTo(map);
        
        map.fitBounds(countryBorder.getBounds());
      }
    }
  });
}

// ===================================================================
// MODAL DATA LOADING FUNCTIONS
// ===================================================================

/**
 * Load country demographic data
 */
function loadCountryData() {
  if (!currentCountryCode) {
    $('#population, #area, #capital, #region, #capitalWiki')
      .text('Select a country first');
    return;
  }
  
  $.ajax({
    url: 'php/getCountryInfo.php', 
    data: {country: currentCountryCode}, 
    dataType: 'json',
    success: function(data) {
      $('#population').text(data.population || 'N/A');
      $('#area').text(data.area || 'N/A');
      $('#capital').text(data.capital || 'N/A');
      $('#region').text(data.region || 'N/A');
      
      if (data.capital && data.capital !== 'N/A') {
        $('#capitalWiki').html(
          `<a href="https://en.wikipedia.org/wiki/${encodeURIComponent(data.capital)}" 
             target="_blank" class="text-decoration-none">Wikipedia ↗</a>`
        );
      } else {
        $('#capitalWiki').text('N/A');
      }
    }
  });
}

/**
 * Load currency data and update converter
 */
function loadCurrencyData() {
  if (!currentCountryCode) {
    $('#currencyName, #currencyCode, #exchangeRate')
      .text('Select a country first');
    return;
  }
  
  $.ajax({
    url: 'php/getCurrency.php', 
    data: {country: currentCountryCode}, 
    dataType: 'json',
    success: function(data) {
      currentCurrencyData = data;
      $('#currencyName').text(data.name || 'N/A');
      $('#currencyCode').text(data.code || 'N/A');
      $('#exchangeRate').text(data.rate || 'N/A');
      
      // Update converter with country currency
      if (globalExchangeRates && globalExchangeRates.currencies) {
        $('#fromCurrency').val(data.code);
        updateAmountSymbol();
      }
      
      // Trigger conversion if both currencies selected
      if ($('#fromCurrency').val() && $('#toCurrency').val()) {
        performConversion();
      }
    }
  });
}

/**
 * Load weather data for country capital
 */
function loadWeatherData() {
  if (!currentCountryCode) {
    $('#temperature, #condition, #humidity, #feelsLike, #pressure, #windSpeed')
      .text('Select a country first');
    return;
  }
  
  $.ajax({
    url: 'php/getWeather.php', 
    data: {country: currentCountryCode}, 
    dataType: 'json',
    success: function(data) {
      $('#temperature').text(data.temperature || 'N/A');
      $('#condition').text(data.condition || 'N/A');
      $('#humidity').text(data.humidity || 'N/A');
      $('#feelsLike').text(data.feels_like || 'N/A');
      $('#pressure').text(data.pressure || 'N/A');
      $('#windSpeed').text(data.wind_speed || 'N/A');
    },
    error: function() {
      $('#temperature, #condition, #humidity, #feelsLike, #pressure, #windSpeed')
        .text('Weather data unavailable');
    }
  });
}

/**
 * Load news data with enhanced formatting
 */
function loadNewsData() {
  if (!currentCountryCode) {
    $('#newsContent').html('<p class="text-center">Select a country first</p>');
    return;
  }
  
  $('#newsContent').html(`
    <div class="text-center">
      <i class="fa-solid fa-spinner fa-spin fa-2x text-success mb-3"></i>
      <p>Loading latest news...</p>
    </div>
  `);
  
  $.ajax({
    url: 'php/getNews.php', 
    data: {country: currentCountryCode}, 
    dataType: 'json',
    success: function(data) {
      if (data?.articles?.length) {
        var html = data.articles.slice(0, 8).map(article => {
          var authorInfo = article.author ? 
            `<span class="text-muted"> • by ${article.author}</span>` : '';
          var timeInfo = article.publishedAt ? 
            `<span class="text-muted"> • ${article.publishedAt}</span>` : '';
          
          return `
            <div class="mb-3 pb-3 border-bottom">
              <h6 class="fw-bold mb-2">${article.title || 'No title'}</h6>
              <p class="small text-muted mb-2">
                <i class="fa-solid fa-newspaper me-1"></i>
                ${article.source || 'Unknown source'}${authorInfo}${timeInfo}
              </p>
              <p class="mb-2">${article.description || 'No description available'}</p>
              ${article.url ? `
                <a href="${article.url}" target="_blank" class="btn btn-sm btn-outline-success">
                  <i class="fa-solid fa-external-link me-1"></i>Read Full Article
                </a>
              ` : ''}
            </div>
          `;
        }).join('');
        
        $('#newsContent').html(html);
      } else {
        $('#newsContent').html(`
          <p class="text-center">
            <i class="fa-solid fa-newspaper me-2"></i>
            No recent news available for this country
          </p>
        `);
      }
    },
    error: function(xhr, status, error) {
      $('#newsContent').html(`
        <p class="text-center text-danger">
          <i class="fa-solid fa-exclamation-triangle me-2"></i>
          Failed to load news data
        </p>
      `);
    }
  });
}

/**
* Load Wikipedia data with lazy image loading (had to isolate the unsplash API to load only on modal click and independently of the remaining modal content as it was majorly bottlenecking everything it was synced with)
 */
function loadWikipediaData() {
  if (!currentCountryCode) {
    $('#wikipediaContent').html('<p class="text-center">Select a country first</p>');
    return;
  }
  
  $('#wikipediaContent').html(`
    <div class="text-center">
      <i class="fa-solid fa-spinner fa-spin fa-2x text-success mb-3"></i>
      <p>Loading Wikipedia information...</p>
    </div>
  `);
  
  // Load Wikipedia text immediately
  $.ajax({
    url: 'php/getWikipedia.php', 
    data: {country: currentCountryCode},
    dataType: 'json',
    success: function(data) {
      var html = '';
      
      // Add Wikipedia content
      if (data.extract) {
        html += `
          <div class="mb-3">
            <h6 class="fw-bold">About ${data.title || 'this country'}</h6>
            <p>${data.extract}</p>
            ${data.url ? `
              <a href="${data.url}" target="_blank" class="btn btn-sm btn-outline-success">
                Read Full Article
              </a>
            ` : ''}
          </div>
        `;
      }
      
      // Add images loading section
      html += `
        <div class="mb-3">
          <h6 class="fw-bold">Images</h6>
          <div id="imagesContainer">
            <div class="text-center py-3">
              <i class="fa-solid fa-spinner fa-spin fa-xl text-success mb-2"></i>
              <p class="small text-muted">Loading country images...</p>
            </div>
          </div>
        </div>
      `;
      
      $('#wikipediaContent').html(html || `
        <p class="text-center">No Wikipedia information available for this country</p>
      `);
      
      // Load images asynchronously
      loadCountryImages(currentCountryCode);
    },
    error: function() {
      $('#wikipediaContent').html(`
        <p class="text-center text-danger">
          <i class="fa-solid fa-exclamation-triangle me-2"></i>
          Failed to load Wikipedia data
        </p>
      `);
    }
  });
}

/**
 * Load country images separately
 */
function loadCountryImages(countryCode) {
  $.ajax({
    url: 'php/getWikipedia.php', 
    data: {country: countryCode, images: 'true'},
    dataType: 'json',
    success: function(data) {
      var imagesHtml = '';
      
      if (data.images?.length) {
        imagesHtml = '<div class="row">';
        
        data.images.forEach(img => {
          if (img.type === 'info_card') {
            imagesHtml += `
              <div class="col-12 mb-2">
                <div class="alert alert-info text-center">
                  <i class="fa-solid fa-info-circle me-1"></i>${img.caption}
                </div>
              </div>
            `;
          } else if (img.url) {
            imagesHtml += `
              <div class="col-6 mb-2">
                <img src="${img.url}" class="img-fluid rounded" 
                     alt="${img.caption || 'Country image'}" 
                     style="height: 100px; object-fit: cover; width: 100%;"
                     onerror="this.style.display='none';">
                ${img.caption ? `
                  <small class="text-muted d-block mt-1">${img.caption}</small>
                ` : ''}
              </div>
            `;
          }
        });
        
        imagesHtml += '</div>';
      } else {
        imagesHtml = `
          <div class="alert alert-info text-center">
            <i class="fa-solid fa-camera me-1"></i>
            Images temporarily unavailable for this country
          </div>
        `;
      }
      
      $('#imagesContainer').html(imagesHtml);
    },
    error: function() {
      $('#imagesContainer').html(`
        <div class="alert alert-warning text-center">
          <i class="fa-solid fa-exclamation-triangle me-1"></i>
          Failed to load images
        </div>
      `);
    }
  });
}

/**
 * Load public holidays data
 */
function loadHolidaysData() {
  if (!currentCountryCode) {
    $('#holidaysContent').html('<p class="text-center">Select a country first</p>');
    return;
  }
  
  $('#holidaysContent').html(`
    <div class="text-center">
      <i class="fa-solid fa-spinner fa-spin fa-2x text-success mb-3"></i>
      <p>Loading public holidays...</p>
    </div>
  `);
  
  $.ajax({
    url: 'php/getHolidays.php', 
    data: {country: currentCountryCode}, 
    dataType: 'json',
    success: function(data) {
      if (data?.holidays?.length) {
        var html = `
          <div class="mb-3">
            <h6 class="fw-bold">${data.country} - ${new Date().getFullYear()} Public Holidays</h6>
          </div>
        `;
        
        html += '<div class="list-group">';
        data.holidays.forEach(holiday => {
          var date = new Date(holiday.date + 'T00:00:00');
          var formattedDate = date.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
          });
          
          html += `
            <div class="list-group-item d-flex justify-content-between align-items-start">
              <div class="ms-2 me-auto">
                <div class="fw-bold">${holiday.name}</div>
                <small class="text-muted">${holiday.type}</small>
              </div>
              <span class="badge bg-success rounded-pill">${formattedDate}</span>
            </div>
          `;
        });
        html += '</div>';
        
        $('#holidaysContent').html(html);
      } else {
        $('#holidaysContent').html(`
          <p class="text-center">No holiday information available for this country</p>
        `);
      }
    }
  });
}

// ===================================================================
// MAP CLICK DETECTION & GEOSPATIAL FUNCTIONS
// ===================================================================

/**
 * Detect clicked country from map coordinates
 */
function detectClickedCountry(latlng, clickPosition) {
  if (!allCountryBorders?.features) return;
  
  // Sort by bounding box area (smallest first for accuracy)
  var sortedFeatures = allCountryBorders.features.slice().sort((a, b) => {
    return getBoundingBoxArea(a.geometry) - getBoundingBoxArea(b.geometry);
  });
  
  for (var feature of sortedFeatures) {
    var countryCode = getCountryCode(feature);
    if (countryCode) {
      try {
        if (isPointInCountry(latlng, feature.geometry)) {
          $('#countrySelect').val(countryCode);
          selectCountry(countryCode, clickPosition);
          return;
        }
      } catch (error) { 
        continue; 
      }
    }
  }
}

/**
 * Check if point is inside country geometry
 */
function isPointInCountry(latlng, geometry) {
  if (geometry.type === 'Polygon') {
    return isPointInPolygon(latlng, geometry.coordinates);
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some(coords => isPointInPolygon(latlng, coords));
  }
  return false;
}

/**
 * Point-in-polygon algorithm
 */
function isPointInPolygon(latlng, polygonCoords) {
  var coords = polygonCoords[0];
  if (!coords || coords.length < 3) return false;
  
  var x = latlng.lng, y = latlng.lat, inside = false;
  for (var i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    var xi = coords[i][0], yi = coords[i][1], xj = coords[j][0], yj = coords[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Calculate bounding box area for geometry
 */
function getBoundingBoxArea(geometry) {
  var bounds = {minLat: 90, maxLat: -90, minLng: 180, maxLng: -180};
  
  function updateBounds(coords) {
    if (Array.isArray(coords[0])) {
      coords.forEach(updateBounds);
    } else {
      bounds.minLat = Math.min(bounds.minLat, coords[1]);
      bounds.maxLat = Math.max(bounds.maxLat, coords[1]);
      bounds.minLng = Math.min(bounds.minLng, coords[0]);
      bounds.maxLng = Math.max(bounds.maxLng, coords[0]);
    }
  }
  
  if (geometry.type === 'Polygon') {
    updateBounds(geometry.coordinates[0]);
  } else if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach(p => updateBounds(p[0]));
  }
  
  return (bounds.maxLat - bounds.minLat) * (bounds.maxLng - bounds.minLng);
}

// ===================================================================
// AUTO-LOCATION DETECTION SYSTEM
// ===================================================================

/**
 * Detect user location and highlight their country
 */
function detectUserLocation() {
  if (!navigator.geolocation) {
    return;
  }
  
  navigator.geolocation.getCurrentPosition(
    function(position) {
      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;
      const userLocation = L.latLng(userLat, userLng);
      
      findUserCountry(userLocation);
    },
    function(error) {
      handleGeolocationError(error);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000 // 5 minutes
    }
  );
}

/**
 * Find which country the user is currently in
 */
function findUserCountry(userLocation) {
  const checkBorders = () => {
    if (!allCountryBorders?.features) {
      setTimeout(checkBorders, 500);
      return;
    }
    
    // Sort features by area (smallest first) for more accurate detection
    const sortedFeatures = allCountryBorders.features.slice().sort((a, b) => {
      return getBoundingBoxArea(a.geometry) - getBoundingBoxArea(b.geometry);
    });
    
    // Check each country to see if user location is inside
    for (const feature of sortedFeatures) {
      const countryCode = getCountryCode(feature);
      
      if (countryCode) {
        try {
          if (isPointInCountry(userLocation, feature.geometry)) {
            highlightUserCountry(countryCode, userLocation);
            return;
          }
        } catch (error) {
          continue;
        }
      }
    }
    
    showLocationNotFoundMessage(userLocation);
  };
  
  checkBorders();
}

/**
 * Highlight the user's detected country
 */
function highlightUserCountry(countryCode, userLocation) {
  const selectCountryWhenReady = () => {
    if (!allCountries?.length) {
      setTimeout(selectCountryWhenReady, 500);
      return;
    }
    
    // Set dropdown to detected country
    $('#countrySelect').val(countryCode);
    
    // Automatically select and highlight the country
    selectCountry(countryCode, userLocation);
    
    // Show notification
    showLocationDetectedMessage(countryCode);
  };
  
  selectCountryWhenReady();
}

/**
 * Show location detected notification
 */
function showLocationDetectedMessage(countryCode) {
  const countryName = allCountries.find(c => c.code === countryCode)?.name || countryCode;
  
  const notification = $(`
    <div class="alert alert-success alert-dismissible position-fixed" 
         style="top: 80px; left: 50%; transform: translateX(-50%); z-index: 2000; min-width: 300px;">
      <i class="fa-solid fa-location-dot me-2"></i>
      <strong>Location detected:</strong> ${countryName}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>
  `);
  
  $('body').append(notification);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    notification.fadeOut(500, () => notification.remove());
  }, 5000);
}

/**
 * Handle location not found scenario
 */
function showLocationNotFoundMessage(userLocation) {
  // Center map on user location
  map.setView([userLocation.lat, userLocation.lng], 8);
  
  // Add user location marker
  const userMarker = L.marker([userLocation.lat, userLocation.lng], {
    icon: L.divIcon({
      className: 'user-location-marker',
      html: `<div style="background: #ff4444; border: 3px solid #fff; border-radius: 50%; 
                        width: 20px; height: 20px; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    })
  }).addTo(map);
  
  userMarker.bindTooltip('Your location', {permanent: false, direction: 'top'});
  
  // Show notification
  const notification = $(`
    <div class="alert alert-info alert-dismissible position-fixed" 
         style="top: 80px; left: 50%; transform: translateX(-50%); z-index: 2000; min-width: 350px;">
      <i class="fa-solid fa-info-circle me-2"></i>
      <strong>Location detected</strong> but no country match found (possibly over water)
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>
  `);
  
  $('body').append(notification);
  
  setTimeout(() => {
    notification.fadeOut(500, () => notification.remove());
  }, 6000);
}

/**
 * Handle geolocation errors
 */
function handleGeolocationError(error) {
  let message = '';
  
  switch(error.code) {
    case error.PERMISSION_DENIED:
      message = 'Location access denied by user';
      break;
    case error.POSITION_UNAVAILABLE:
      message = 'Location information unavailable';
      break;
    case error.TIMEOUT:
      message = 'Location request timed out';
      break;
    default:
      message = 'Unknown location error';
      break;
  }
  
  const notification = $(`
    <div class="alert alert-warning alert-dismissible position-fixed" 
         style="top: 80px; left: 50%; transform: translateX(-50%); z-index: 2000; min-width: 300px;">
      <i class="fa-solid fa-exclamation-triangle me-2"></i>
      ${message}. Please select a country manually.
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>
  `);
  
  $('body').append(notification);
  
  setTimeout(() => {
    notification.fadeOut(500, () => notification.remove());
  }, 4000);
}