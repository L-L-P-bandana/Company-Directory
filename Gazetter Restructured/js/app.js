var map, currentCountryCode = '', countryBorder = null, allCountryBorders = null, allCountries = [];
var searchResults = [], selectedSearchIndex = -1, visitedCountries = [], maxMarkers = 50;
var currentCurrencyData = null;

// Marker groups
var countryMarkers = L.layerGroup();
var cityClusterGroup = L.markerClusterGroup({
  showCoverageOnHover: false, zoomToBoundsOnClick: true, maxClusterRadius: 50,
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
  showCoverageOnHover: false, zoomToBoundsOnClick: true, maxClusterRadius: 50,
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

// Tile layers
var streets = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {attribution: "Tiles &copy; Esri"});
var satellite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {attribution: "Tiles &copy; Esri"});

// Easy buttons
var demographicsBtn = L.easyButton("fa-users fa-xl", function() { loadCountryData(); $("#demographicsModal").modal("show"); });
var weatherBtn = L.easyButton("fa-cloud fa-xl", function() { loadWeatherData(); $("#weatherModal").modal("show"); });
var currencyBtn = L.easyButton("fa-coins fa-xl", function() { loadCurrencyData(); $("#currencyModal").modal("show"); });
var newsBtn = L.easyButton("fa-newspaper fa-xl", function() { loadNewsData(); $("#newsModal").modal("show"); });
var wikipediaBtn = L.easyButton("fa-wikipedia-w fa-xl", function() { loadWikipediaData(); $("#wikipediaModal").modal("show"); });

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

$(document).ready(function() {
  // Initialize map
  map = L.map("map", {layers: [streets]}).setView([54.5, -4], 6);
  map.addLayer(cityClusterGroup);
  map.addLayer(airportClusterGroup);
  
  L.control.layers(
    {"Streets": streets, "Satellite": satellite}, 
    {"Visited Countries": countryMarkers, "Cities": cityClusterGroup, "Airports": airportClusterGroup}
  ).addTo(map);
  
  countryMarkers.addTo(map);
  [demographicsBtn, weatherBtn, currencyBtn, newsBtn, wikipediaBtn].forEach(btn => btn.addTo(map));
  
  loadCountries();
  loadAllCountryBorders();
  setupSearchHandlers();
  setupCurrencyConverter();
  
  // Event handlers
  $('#countrySelect').change(function() {
    var code = $(this).val();
    if (code) selectCountry(code);
  });
  
  map.on('click', function(e) {
    hideSearchResults();
    detectClickedCountry(e.latlng, e.latlng);
  });
  
  $('.modal').on('shown.bs.modal', function() {
    $(this).find('.btn-close').off('blur.modal').on('blur.modal', function() {
      $(this).closest('.modal').removeAttr('aria-hidden');
    });
  }).on('hidden.bs.modal', function() {
    $(this).attr('aria-hidden', 'true');
  });
  
  $(document).click(function(e) {
    if (!$(e.target).closest('#searchContainer').length) hideSearchResults();
  });
});

// Currency Converter Setup
function setupCurrencyConverter() {
  $('#convertBtn, #convertAmount, #toCurrency').on('click change input', performConversion);
  $('#toCurrency').val('USD'); // Default to USD
}

function performConversion() {
  var amount = parseFloat($('#convertAmount').val()) || 0;
  var fromCode = $('#fromCurrency').val();
  var toCode = $('#toCurrency').val();
  
  if (!amount || !fromCode || !toCode || !currentCurrencyData) {
    $('#convertResult').text('Enter valid amount');
    return;
  }
  
  // Simple conversion using exchange rates (from country currency to USD, then to target)
  var fromRate = parseFloat(currentCurrencyData.rate) || 1;
  var toRate = getExchangeRate(toCode);
  
  var usdAmount = fromCode === 'USD' ? amount : amount / fromRate;
  var result = toCode === 'USD' ? usdAmount : usdAmount * toRate;
  
  $('#convertResult').text(result.toFixed(2) + ' ' + toCode);
}

function getExchangeRate(code) {
  var rates = {
    'USD': 1, 'EUR': 0.92, 'GBP': 0.79, 'JPY': 149.34, 'CAD': 1.36, 
    'AUD': 1.54, 'CHF': 0.88, 'CNY': 7.24
  };
  return rates[code] || 1;
}

// Marker management
function addCountryMarker(code, name, latlng) {
  var existing = visitedCountries.findIndex(c => c.code === code);
  if (existing !== -1) {
    countryMarkers.removeLayer(visitedCountries[existing].marker);
    visitedCountries.splice(existing, 1);
  }
  
  if (visitedCountries.length >= maxMarkers) {
    var oldest = visitedCountries.shift();
    countryMarkers.removeLayer(oldest.marker);
  }
  
  var marker = L.marker(latlng, { 
    icon: L.divIcon({
      className: 'country-marker',
      html: '<div class="marker-inner new-marker" data-country-code="' + code + '"></div>',
      iconSize: [48, 48], iconAnchor: [24, 42], popupAnchor: [0, -42]
    }),
    title: name, zIndexOffset: 1000
  });
  
  marker.bindTooltip(name, {permanent: false, direction: 'top', offset: [0, -45], className: 'country-tooltip'});
  marker.on('click', () => { $('#countrySelect').val(code); selectCountry(code); });
  marker.addTo(countryMarkers);
  
  visitedCountries.push({code, name, latlng, marker, timestamp: Date.now()});
  
  setTimeout(() => {
    var el = marker.getElement();
    if (el) {
      var inner = el.querySelector('.marker-inner');
      if (inner) inner.classList.remove('new-marker');
    }
  }, 2000);
}

// Data loading
function loadCitiesAndAirports(countryCode) {
  if (!countryCode) return;
  
  $.ajax({
    url: 'php/getCities.php', data: {country: countryCode}, dataType: 'json',
    success: function(cities) { if (cities?.length) addCityMarkers(cities); }
  });
  
  $.ajax({
    url: 'php/getAirports.php', data: {country: countryCode}, dataType: 'json',
    success: function(airports) { if (airports?.length) addAirportMarkers(airports); }
  });
}

function addCityMarkers(cities) {
  cities.forEach(city => {
    var marker = L.marker([city.lat, city.lng], { 
      icon: L.divIcon({className: 'city-marker', html: '<div class="city-marker-inner">🏙️</div>', iconSize: [22, 22], iconAnchor: [11, 11]})
    });
    var tooltip = city.name + (city.population ? ' (Pop: ' + city.population.toLocaleString() + ')' : '') + (city.admin1 ? ' - ' + city.admin1 : '');
    marker.bindTooltip(tooltip, {permanent: false, direction: 'top', className: 'city-tooltip'});
    cityClusterGroup.addLayer(marker);
  });
}

function addAirportMarkers(airports) {
  airports.forEach(airport => {
    var marker = L.marker([airport.lat, airport.lng], { 
      icon: L.divIcon({className: 'airport-marker', html: '<div class="airport-marker-inner">✈️</div>', iconSize: [22, 22], iconAnchor: [11, 11]})
    });
    var tooltip = airport.name + (airport.code ? ' (' + airport.code + ')' : '') + (airport.admin1 ? ' - ' + airport.admin1 : '');
    marker.bindTooltip(tooltip, {permanent: false, direction: 'top', className: 'airport-tooltip'});
    airportClusterGroup.addLayer(marker);
  });
}

function clearClustersForCountry() {
  cityClusterGroup.clearLayers();
  airportClusterGroup.clearLayers();
}

// Search functionality
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
      case 38: e.preventDefault(); navigateSearchResults(-1); break;
      case 40: e.preventDefault(); navigateSearchResults(1); break;
      case 13: e.preventDefault(); selectHighlightedResult(); break;
      case 27: hideSearchResults(); break;
    }
  });

  searchInput.on('focus', function() {
    const query = $(this).val().trim();
    if (query.length > 0 && searchResults.length > 0) showSearchResults();
  });
}

function performSearch(query) {
  if (!allCountries?.length) return;
  
  const lowerQuery = query.toLowerCase();
  searchResults = allCountries.filter(country => 
    country.name.toLowerCase().includes(lowerQuery) || country.code.toLowerCase().includes(lowerQuery)
  );
  displaySearchResults();
}

function displaySearchResults() {
  const container = $('#searchResults');
  selectedSearchIndex = -1;
  
  if (searchResults.length === 0) {
    container.html('<div class="p-3 text-center text-muted fst-italic">No countries found</div>');
  } else {
    let html = '';
    searchResults.slice(0, 8).forEach((country, index) => {
      html += `<div class="search-result-item" data-index="${index}" data-code="${country.code}">
        <span class="search-result-code">${country.code}</span>
        <span class="search-result-name">${country.name}</span></div>`;
    });
    if (searchResults.length > 8) {
      html += `<div class="p-3 text-center text-muted fst-italic">${searchResults.length - 8} more countries...</div>`;
    }
    container.html(html);
    $('.search-result-item').click(function() { selectCountryFromSearch($(this).data('code')); });
  }
  showSearchResults();
}

function navigateSearchResults(direction) {
  const maxIndex = Math.min(searchResults.length - 1, 7);
  selectedSearchIndex = direction === 1 
    ? (selectedSearchIndex < maxIndex ? selectedSearchIndex + 1 : 0)
    : (selectedSearchIndex > 0 ? selectedSearchIndex - 1 : maxIndex);
  
  $('.search-result-item').removeClass('highlighted');
  $(`.search-result-item[data-index="${selectedSearchIndex}"]`).addClass('highlighted');
}

function selectHighlightedResult() {
  if (selectedSearchIndex >= 0 && selectedSearchIndex < searchResults.length) {
    selectCountryFromSearch(searchResults[selectedSearchIndex].code);
  }
}

function selectCountryFromSearch(countryCode) {
  $('#countrySearch').val('');
  hideSearchResults();
  $('#countrySelect').val(countryCode);
  
  var center = getCountryCenter(countryCode);
  selectCountry(countryCode, center);
}

function showSearchResults() { $('#searchResults').addClass('show'); }
function hideSearchResults() { $('#searchResults').removeClass('show'); selectedSearchIndex = -1; }

// Country selection
function selectCountry(countryCode, markerPosition) {
  currentCountryCode = countryCode;
  loadCountryBorder(countryCode);
  
  var countryName = allCountries.find(c => c.code === countryCode)?.name || countryCode;
  var center = markerPosition || getCountryCenter(countryCode);
  if (center) addCountryMarker(countryCode, countryName, center);
  
  clearClustersForCountry();
  loadCitiesAndAirports(countryCode);
}

function getCountryCenter(countryCode) {
  if (!allCountryBorders?.features) return null;
  
  for (var feature of allCountryBorders.features) {
    if (feature.properties?.['ISO3166-1-Alpha-2'] === countryCode) {
      try {
        return L.geoJSON(feature).getBounds().getCenter();
      } catch (error) {
        return null;
      }
    }
  }
  return null;
}

// API loading functions
function loadCountries() {
  $.ajax({
    url: 'php/getCountries.php', dataType: 'json',
    success: function(data) {
      allCountries = data;
      $('#countrySelect').html('<option value="">Select a country...</option>' + 
        data.map(c => `<option value="${c.code}">${c.name}</option>`).join(''));
    }
  });
}

function loadAllCountryBorders() {
  $.ajax({url: 'countryBorders.geo.json', dataType: 'json', success: data => allCountryBorders = data});
}

function loadCountryBorder(countryCode) {
  if (countryBorder) map.removeLayer(countryBorder);
  
  $.ajax({
    url: 'php/getCountryBorder.php', data: {country: countryCode}, dataType: 'json',
    success: function(data) {
      if (data?.geometry) {
        countryBorder = L.geoJSON(data, {style: {color: "#2980b9", weight: 2, fillOpacity: 0.1}}).addTo(map);
        map.fitBounds(countryBorder.getBounds());
      }
    }
  });
}

function loadCountryData() {
  if (!currentCountryCode) {
    $('#population, #area, #capital, #region, #capitalWiki').text('Select a country first');
    return;
  }
  
  $.ajax({
    url: 'php/getCountryInfo.php', data: {country: currentCountryCode}, dataType: 'json',
    success: function(data) {
      $('#population').text(data.population || 'N/A');
      $('#area').text(data.area || 'N/A');
      $('#capital').text(data.capital || 'N/A');
      $('#region').text(data.region || 'N/A');
      
      if (data.capital && data.capital !== 'N/A') {
        $('#capitalWiki').html(`<a href="https://en.wikipedia.org/wiki/${encodeURIComponent(data.capital)}" target="_blank" class="text-decoration-none">Wikipedia ↗</a>`);
      } else {
        $('#capitalWiki').text('N/A');
      }
    }
  });
}

function loadCurrencyData() {
  if (!currentCountryCode) {
    $('#currencyName, #currencyCode, #exchangeRate').text('Select a country first');
    $('#fromCurrency').html('<option value="">Select a country first</option>');
    return;
  }
  
  $.ajax({
    url: 'php/getCurrency.php', data: {country: currentCountryCode}, dataType: 'json',
    success: function(data) {
      currentCurrencyData = data;
      $('#currencyName').text(data.name || 'N/A');
      $('#currencyCode').text(data.code || 'N/A');
      $('#exchangeRate').text(data.rate || 'N/A');
      
      // Update converter
      $('#fromCurrency').html(`<option value="${data.code}">${data.name} (${data.code})</option>`);
      $('#convertAmount').val('1');
      performConversion();
    }
  });
}

function loadWeatherData() {
  if (!currentCountryCode) {
    $('#temperature, #condition, #humidity').text('Select a country first');
    return;
  }
  
  $.ajax({
    url: 'php/getWeather.php', data: {country: currentCountryCode}, dataType: 'json',
    success: data => {
      $('#temperature').text(data.temperature || 'N/A');
      $('#condition').text(data.condition || 'N/A');
      $('#humidity').text(data.humidity || 'N/A');
    }
  });
}

function loadNewsData() {
  if (!currentCountryCode) {
    $('#newsContent').html('<p class="text-center">Select a country first</p>');
    return;
  }
  
  $('#newsContent').html('<div class="text-center"><i class="fa-solid fa-spinner fa-spin fa-2x text-success mb-3"></i><p>Loading latest news...</p></div>');
  
  $.ajax({
    url: 'php/getNews.php', data: {country: currentCountryCode}, dataType: 'json',
    success: function(data) {
      if (data?.articles?.length) {
        var html = data.articles.slice(0, 5).map(article => 
          `<div class="mb-3 pb-3 border-bottom">
            <h6 class="fw-bold">${article.title || 'No title'}</h6>
            <p class="small text-muted mb-2">${article.source || 'Unknown source'}</p>
            <p class="mb-2">${article.description || 'No description available'}</p>
            ${article.url ? `<a href="${article.url}" target="_blank" class="btn btn-sm btn-outline-success">Read More</a>` : ''}
          </div>`
        ).join('');
        $('#newsContent').html(html);
      } else {
        $('#newsContent').html('<p class="text-center">No recent news available for this country</p>');
      }
    }
  });
}

function loadWikipediaData() {
  if (!currentCountryCode) {
    $('#wikipediaContent').html('<p class="text-center">Select a country first</p>');
    return;
  }
  
  $('#wikipediaContent').html('<div class="text-center"><i class="fa-solid fa-spinner fa-spin fa-2x text-success mb-3"></i><p>Loading Wikipedia information...</p></div>');
  
  $.ajax({
    url: 'php/getWikipedia.php', data: {country: currentCountryCode}, dataType: 'json',
    success: function(data) {
      var html = '';
      
      if (data.extract) {
        html += `<div class="mb-3">
          <h6 class="fw-bold">About ${data.title || 'this country'}</h6>
          <p>${data.extract}</p>
          ${data.url ? `<a href="${data.url}" target="_blank" class="btn btn-sm btn-outline-success">Read Full Article</a>` : ''}
        </div>`;
      }
      
      if (data.images?.length) {
        html += `<div class="mb-3">
          <h6 class="fw-bold">Images</h6>
          <div class="row">
            ${data.images.slice(0, 4).map(img => 
              `<div class="col-6 mb-2">
                <img src="${img.url}" class="img-fluid rounded" alt="${img.caption || 'Country image'}" style="height: 100px; object-fit: cover; width: 100%;">
              </div>`
            ).join('')}
          </div>
        </div>`;
      }
      
      $('#wikipediaContent').html(html || '<p class="text-center">No Wikipedia information available for this country</p>');
    }
  });
}

// Map click detection (simplified)
function detectClickedCountry(latlng, clickPosition) {
  if (!allCountryBorders?.features) return;
  
  var sortedFeatures = allCountryBorders.features.slice().sort((a, b) => {
    return getBoundingBoxArea(a.geometry) - getBoundingBoxArea(b.geometry);
  });
  
  for (var feature of sortedFeatures) {
    var countryCode = feature.properties?.['ISO3166-1-Alpha-2'];
    if (countryCode && countryCode !== '-99') {
      try {
        if (isPointInCountry(latlng, feature.geometry)) {
          $('#countrySelect').val(countryCode);
          selectCountry(countryCode, clickPosition);
          return;
        }
      } catch (error) { continue; }
    }
  }
}

function isPointInCountry(latlng, geometry) {
  if (geometry.type === 'Polygon') return isPointInPolygon(latlng, geometry.coordinates);
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some(coords => isPointInPolygon(latlng, coords));
  }
  return false;
}

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
  
  if (geometry.type === 'Polygon') updateBounds(geometry.coordinates[0]);
  else if (geometry.type === 'MultiPolygon') geometry.coordinates.forEach(p => updateBounds(p[0]));
  
  return (bounds.maxLat - bounds.minLat) * (bounds.maxLng - bounds.minLng);
}