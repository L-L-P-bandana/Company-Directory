// ===================================================================
// GAZETTEER APPLICATION - JS
// ===================================================================

// Global Variables & State Management
var map, currentCountryCode = '', countryBorder = null, allCountryBorders = null, allCountries = [];
var visitedCountries = [], maxMarkers = 50;
var currentCurrencyData = null, globalExchangeRates = null;
var newsData = [], newsLoaded = 0, maxNewsArticles = 10;
var appInitialized = false;

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
  setupCurrencyConverter();
  
  // Auto-detect user location and highlight their country
  detectUserLocation();
  
  // Event listeners
  $('#countrySelect').change(function() {
    var code = $(this).val();
    if (code) selectCountry(code);
  });
  
  map.on('click', function(e) {
    detectClickedCountry(e.latlng, e.latlng);
  });
  
  setupModalAccessibilityFix();
  
  // Hide pre-loader after short delay to ensure map is rendered
  setTimeout(hidePreLoader, 1500);
});

function setupModalAccessibilityFix() {
  $('.modal').on('hide.bs.modal', function(e) {
    var modal = this;
    var focusedElement = document.activeElement;
    
    if (modal.contains(focusedElement)) {
      e.preventDefault();
      focusedElement.blur();
      
      setTimeout(function() {
        if ($('#countrySelect').length && $('#countrySelect').is(':visible')) {
          $('#countrySelect')[0].focus();
        } else {
          document.body.focus();
        }
        
        var modalInstance = bootstrap.Modal.getInstance(modal);
        if (modalInstance) {
          $(modal).off('hide.bs.modal');
          modalInstance.hide();
          
          setTimeout(function() {
            $(modal).on('hide.bs.modal', arguments.callee);
          }, 100);
        }
      }, 10);
    }
  });
  
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'aria-hidden') {
        var target = mutation.target;
        var ariaHidden = target.getAttribute('aria-hidden');
        var focusedElement = document.activeElement;
        
        if (ariaHidden === 'true' && target.classList.contains('modal')) {
          if (target.contains(focusedElement)) {
            focusedElement.blur();
            if ($('#countrySelect').length) {
              $('#countrySelect')[0].focus();
            } else {
              document.body.focus();
            }
          }
        }
      }
    });
  });
  
  $('.modal').each(function() {
    observer.observe(this, {
      attributes: true,
      attributeFilter: ['aria-hidden']
    });
  });
}

function hidePreLoader() {
  $('#pre-load').fadeOut(800, function() {
    $(this).remove();
    appInitialized = true;
  });
}

// ===================================================================
// CURRENCY CONVERTER SYSTEM
// ===================================================================

/**
 * Initialize global currency converter functionality
 */
function setupCurrencyConverter() {
  loadGlobalExchangeRates();
  
  // Debounced conversion function
  const debouncedConvert = debounce(performConversion, 500);
  
  // Event bindings for real-time conversion
  $('#fromAmount').on('input', debouncedConvert);
  $('#fromCurrency, #toCurrency').on('change', performConversion);
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
        showConversionError('Exchange rates unavailable');
        return;
      }
      
      globalExchangeRates = data;
      populateCurrencySelectors(data.currencies);
      hideConversionError();
    },
    error: function() {
      showConversionError('Failed to load exchange rates');
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
  
  // Set default currencies
  $('#fromCurrency').val('USD');
  $('#toCurrency').val('EUR');
  
  // If current country selected, set FROM to that country's currency
  if (currentCountryCode && currentCurrencyData) {
    $('#fromCurrency').val(currentCurrencyData.code);
  }
  
  // Trigger initial conversion
  performConversion();
}

/**
 * Perform live currency conversion
 */
function performConversion() {
  var amount = parseFloat($('#fromAmount').val()) || 0;
  var fromCode = $('#fromCurrency').val();
  var toCode = $('#toCurrency').val();
  
  // Clear previous results
  $('#toAmount').val('');
  $('#conversionRate').addClass('d-none');
  
  // Validation
  if (!amount || amount <= 0) {
    showConversionError('Please enter a valid amount');
    return;
  }
  
  if (!fromCode || !toCode) {
    showConversionError('Please select both currencies');
    return;
  }
  
  if (!globalExchangeRates || !globalExchangeRates.rates) {
    showConversionError('Exchange rates not available');
    return;
  }
  
  try {
    var fromRate = globalExchangeRates.rates[fromCode] || 1;
    var toRate = globalExchangeRates.rates[toCode] || 1;
    
    // Convert via USD as base currency
    var usdAmount = fromCode === 'USD' ? amount : amount / fromRate;
    var result = toCode === 'USD' ? usdAmount : usdAmount * toRate;
    
    // Calculate exchange rate (1 FROM = X TO)
    var exchangeRate = fromCode === 'USD' ? toRate : toRate / fromRate;
    
    // Get currency symbols and names
    var fromCurrency = globalExchangeRates.currencies.find(c => c.code === fromCode);
    var toCurrency = globalExchangeRates.currencies.find(c => c.code === toCode);
    var toSymbol = toCurrency ? toCurrency.symbol : toCode;
    
    // Display result
    $('#toAmount').val(`${toSymbol}${result.toFixed(2)}`);
    
    // Display exchange rate
    $('#rateDisplay').text(`1 ${fromCode} = ${exchangeRate.toFixed(4)} ${toCode}`);
    $('#conversionRate').removeClass('d-none');
    
    hideConversionError();
    
  } catch (error) {
    showConversionError('Conversion failed');
  }
}

/**
 * Show conversion error message
 */
function showConversionError(message) {
  $('#errorMessage').text(message);
  $('#conversionError').removeClass('d-none');
  $('#conversionRate').addClass('d-none');
}

/**
 * Hide conversion error message
 */
function hideConversionError() {
  $('#conversionError').addClass('d-none');
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
    $('#capitalCity, #continent, #languages, #currency, #isoAlpha2, #isoAlpha3, #population, #areaInSqKm, #postalCodeFormat')
      .text('Select a country first');
    return;
  }
  
  $.ajax({
    url: 'php/getCountryInfo.php', 
    data: {country: currentCountryCode}, 
    dataType: 'json',
    success: function(data) {
      $('#capitalCity').text(data.capital || 'N/A');
      $('#continent').text(data.continent || 'N/A');
      $('#languages').text(data.languages || 'N/A');
      $('#currency').text(data.currency || 'N/A');
      $('#isoAlpha2').text(data.isoAlpha2 || 'N/A');
      $('#isoAlpha3').text(data.isoAlpha3 || 'N/A');
      $('#population').text(data.population || 'N/A');
      $('#areaInSqKm').text(data.area || 'N/A');
      $('#postalCodeFormat').text(data.postalCodeFormat || 'N/A');
    }
  });
}

/**
 * Load currency data and update converter
 */
function loadCurrencyData() {
  if (!currentCountryCode) {
    showConversionError('Select a country first');
    return;
  }
  
  $.ajax({
    url: 'php/getCurrency.php', 
    data: {country: currentCountryCode}, 
    dataType: 'json',
    success: function(data) {
      currentCurrencyData = data;
      
      // Update converter with country currency
      if (globalExchangeRates && globalExchangeRates.currencies && data.code) {
        $('#fromCurrency').val(data.code);
        performConversion();
      }
    },
    error: function() {
      showConversionError('Failed to load country currency data');
    }
  });
}

/**
 * Load weather data for country capital
 */
function loadWeatherData() {
  if (!currentCountryCode) {
    $('#todayConditions, #todayMaxTemp, #todayMinTemp, #day1Date, #day1MaxTemp, #day1MinTemp, #day2Date, #day2MaxTemp, #day2MinTemp, #lastUpdated')
      .text('Select a country first');
    return;
  }
  
  $.ajax({
    url: 'php/getWeather.php', 
    data: {country: currentCountryCode}, 
    dataType: 'json',
    success: function(data) {
      if (data.forecast && data.forecast.length >= 3) {
        var forecast = data.forecast;
        
        // Today's weather
        $('#todayConditions').text(forecast[0].condition || 'N/A');
        $('#todayIcon').attr('src', forecast[0].icon || '');
        $('#todayMaxTemp').text(forecast[0].maxTemp || '--');
        $('#todayMinTemp').text(forecast[0].minTemp || '--');
        
        // Day 1 forecast
        $('#day1Date').text(forecast[1].date || 'Tomorrow');
        $('#day1Icon').attr('src', forecast[1].icon || '');
        $('#day1MaxTemp').text(forecast[1].maxTemp || '--');
        $('#day1MinTemp').text(forecast[1].minTemp || '--');
        
        // Day 2 forecast
        $('#day2Date').text(forecast[2].date || 'Day After');
        $('#day2Icon').attr('src', forecast[2].icon || '');
        $('#day2MaxTemp').text(forecast[2].maxTemp || '--');
        $('#day2MinTemp').text(forecast[2].minTemp || '--');
        
        // Update modal title with location
        $('#weatherModalLabel').text(`Weather - ${data.location || 'Unknown'}`);
        
        // Last updated
        $('#lastUpdated').text(data.lastUpdated || 'Unknown');
      } else {
        // Fallback for single day data
        $('#todayConditions').text(data.condition || 'N/A');
        $('#todayMaxTemp').text(data.temperature || '--');
        $('#todayMinTemp').text('--');
        $('#day1Date, #day2Date').text('N/A');
        $('#lastUpdated').text('Now');
      }
    },
    error: function() {
      $('#todayConditions, #day1Date, #day2Date').text('Weather data unavailable');
      $('#todayMaxTemp, #todayMinTemp, #day1MaxTemp, #day1MinTemp, #day2MaxTemp, #day2MinTemp').text('--');
      $('#lastUpdated').text('Error');
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
  
  // Reset news state
  newsData = [];
  newsLoaded = 0;
  $('#newsContainer').addClass('d-none');
  $('#newsContent').removeClass('d-none').html(`
    <div class="text-center py-4">
      <i class="fa-solid fa-spinner fa-spin fa-2x text-danger mb-3"></i>
      <p>Loading latest news...</p>
    </div>
  `);
  
  $.ajax({
    url: 'php/getNews.php', 
    data: {country: currentCountryCode}, 
    dataType: 'json',
    success: function(data) {
      if (data?.articles?.length) {
        newsData = data.articles;
        $('#newsContent').addClass('d-none');
        $('#newsContainer').removeClass('d-none');
        loadInitialNews();
      } else {
        $('#newsContent').html(`
          <div class="text-center py-4">
            <i class="fa-solid fa-newspaper fa-2x text-muted mb-3"></i>
            <p>No recent news available for this country</p>
          </div>
        `);
      }
    },
    error: function(xhr, status, error) {
      $('#newsContent').html(`
        <div class="text-center py-4 text-danger">
          <i class="fa-solid fa-exclamation-triangle fa-2x mb-3"></i>
          <p>Failed to load news data</p>
        </div>
      `);
    }
  });
}

/**
 * Load initial 5 news articles
 */
function loadInitialNews() {
  const articlesToShow = Math.min(5, newsData.length);
  const initialArticles = newsData.slice(0, articlesToShow);
  
  // Clear container
  $('#scrollableNews').empty();
  
  // Load all initial articles into scrollable container
  initialArticles.forEach(article => {
    $('#scrollableNews').append(createNewsCard(article));
  });
  
  newsLoaded = articlesToShow;
  
  // Show/hide view more button
  if (newsData.length > 5) {
    $('#viewMoreContainer').removeClass('d-none');
    $('#viewMoreBtn').off('click').on('click', loadMoreNews);
  } else {
    $('#viewMoreContainer').addClass('d-none');
  }
}

/**
 * Load additional 5 news articles
 */
function loadMoreNews() {
  const remainingArticles = newsData.slice(newsLoaded, newsLoaded + 5);
  
  remainingArticles.forEach(article => {
    $('#scrollableNews').append(createNewsCard(article));
  });
  
  newsLoaded += remainingArticles.length;
  
  // Hide view more button after loading second batch
  $('#viewMoreContainer').addClass('d-none');
  
  // Smooth scroll to new content
  $('#scrollableNews').animate({
    scrollTop: $('#scrollableNews')[0].scrollHeight
  }, 300);
}

/**
 * Create a news article card
 */
function createNewsCard(article) {
  const defaultImage = 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22200%22 viewBox=%220 0 300 200%22%3E%3Crect width=%22300%22 height=%22200%22 fill=%22%23e9ecef%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%236c757d%22%3ENo Image%3C/text%3E%3C/svg%3E';
  
  const imageUrl = article.urlToImage || defaultImage;
  const title = article.title || 'No title available';
  const description = article.description || 'No description available';
  const source = article.source?.name || 'Unknown source';
  const publishedAt = article.publishedAt ? formatNewsDate(article.publishedAt) : '';
  const url = article.url || '#';
  
  return `
    <div class="col-12 mb-3">
      <div class="card h-100 shadow-sm">
        <div class="row g-0">
          <div class="col-md-4">
            <img src="${imageUrl}" class="img-fluid rounded-start h-100" 
                 style="object-fit: cover; min-height: 120px;" 
                 alt="Article image"
                 onerror="this.src='${defaultImage}'">
          </div>
          <div class="col-md-8">
            <div class="card-body">
              <h6 class="card-title mb-2">
                <a href="${url}" target="_blank" class="text-decoration-none text-dark fw-bold news-card-link">
                  ${title}
                </a>
              </h6>
              <p class="card-text small text-muted mb-2">
                <i class="fa-solid fa-building me-1"></i>${source}
                ${publishedAt ? `<span class="ms-2"><i class="fa-solid fa-clock me-1"></i>${publishedAt}</span>` : ''}
              </p>
              <p class="card-text">${description}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Format news article date
 */
function formatNewsDate(dateString) {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) {
      return 'Just now';
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    }
  } catch (error) {
    return '';
  }
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
        var countryName = data.country || 'Unknown Country';
        var currentYear = new Date().getFullYear();
        $('#holidaysModalLabel').html(`<i class="fa-solid fa-calendar fa-xl me-2"></i>Public Holidays - ${countryName} - ${currentYear}`);
        
        var html = '<div class="list-group">';
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
              <span class="badge bg-secondary rounded-pill">${formattedDate}</span>
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
    },
    error: function() {
      $('#holidaysContent').html(`
        <p class="text-center text-danger">
          <i class="fa-solid fa-exclamation-triangle me-2"></i>
          Failed to load holiday data
        </p>
      `);
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
 * Point-in-polygon algorithm (This is for click detection, I looked up ray casting algorithm and translated it to js)
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
 * Calculate bounding box for geometry (searched up how to calculate a bounding box and plugged in my own usecase and coordinates)
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
    
    // Automatically select and highlight the country (use country center, not user location)
    selectCountry(countryCode);
    
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
  // Center map on user's general area without precise location marker
  map.setView([userLocation.lat, userLocation.lng], 6);
  
  // Show notification without revealing precise coordinates
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