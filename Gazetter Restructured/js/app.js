var map;
var currentCountryCode = '';
var currentCapital = '';
var countryBorder = null;
var allCountryBorders = null;
var allCountries = [];
var searchResults = [];
var selectedSearchIndex = -1;

var visitedCountries = [];
var countryMarkers = L.layerGroup();
var maxMarkers = 50;

var streets = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
    attribution: "Tiles &copy; Esri"
});

var satellite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    attribution: "Tiles &copy; Esri"
});

var basemaps = {
  "Streets": streets,
  "Satellite": satellite
};

var demographicsBtn = L.easyButton("fa-users fa-xl", function (btn, map) {
  console.log("Demographics button clicked");
  loadCountryData();
  $("#demographicsModal").modal("show");
});

var weatherBtn = L.easyButton("fa-cloud fa-xl", function (btn, map) {
  console.log("Weather button clicked");
  loadWeatherData();
  $("#weatherModal").modal("show");
});

var currencyBtn = L.easyButton("fa-coins fa-xl", function (btn, map) {
  console.log("Currency button clicked");
  loadCurrencyData();
  $("#currencyModal").modal("show");
});

var newsBtn = L.easyButton("fa-newspaper fa-xl", function (btn, map) {
  console.log("News button clicked");
  loadNewsData();
  $("#newsModal").modal("show");
});

var wikipediaBtn = L.easyButton("fa-wikipedia-w fa-xl", function (btn, map) {
  console.log("Wikipedia button clicked");
  loadWikipediaData();
  $("#wikipediaModal").modal("show");
});

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = function() {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

$(document).ready(function () {
  console.log("Document ready - initializing map");
  
  map = L.map("map", {
    layers: [streets]
  }).setView([54.5, -4], 6);

  var layerControl = L.control.layers(basemaps, {
    "Visited Countries": countryMarkers
  }).addTo(map);

  countryMarkers.addTo(map);

  demographicsBtn.addTo(map);
  weatherBtn.addTo(map);
  currencyBtn.addTo(map);
  newsBtn.addTo(map);
  wikipediaBtn.addTo(map);

  console.log("Loading countries...");
  loadCountries();
  
  console.log("Loading all country borders for click detection...");
  loadAllCountryBorders();

  $('#countrySelect').change(function() {
    var countryCode = $(this).val();
    console.log("Country selected:", countryCode);
    if (countryCode) {
      selectCountry(countryCode);
    }
  });

  setupSearchHandlers();

  map.on('click', function(e) {
    console.log("Map clicked at:", e.latlng);
    hideSearchResults();
    detectClickedCountry(e.latlng, e.latlng);
  });

  $('.modal').on('shown.bs.modal', function() {
    $(this).removeAttr('aria-hidden');
  });

  $('.modal').on('hidden.bs.modal', function() {
    $(this).attr('aria-hidden', 'true');
  });

  $('.modal').on('hide.bs.modal', function() {
    var focusedElement = $(this).find(':focus');
    if (focusedElement.length) {
      focusedElement.blur();
    }
  });

  $(document).click(function(e) {
    if (!$(e.target).closest('#searchContainer').length) {
      hideSearchResults();
    }
  });
});

function addCountryMarker(countryCode, countryName, latlng) {
  console.log("Adding marker for:", countryCode, "at", latlng);
  
  var existingIndex = visitedCountries.findIndex(function(country) {
    return country.code === countryCode;
  });
  
  if (existingIndex !== -1) {
    console.log("Country already visited, updating position");
    var existing = visitedCountries[existingIndex];
    countryMarkers.removeLayer(existing.marker);
    visitedCountries.splice(existingIndex, 1);
  }
  
  if (visitedCountries.length >= maxMarkers) {
    console.log("Maximum markers reached, removing oldest");
    var oldest = visitedCountries.shift();
    countryMarkers.removeLayer(oldest.marker);
  }
  
  var countryIcon = L.divIcon({
    className: 'country-marker',
    html: '<div class="marker-inner">' + countryCode + '</div>',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
  
  var marker = L.marker(latlng, { 
    icon: countryIcon,
    title: countryName
  });
  
  marker.bindTooltip(countryName, {
    permanent: false,
    direction: 'top',
    offset: [0, -10],
    className: 'country-tooltip'
  });
  
  marker.on('click', function() {
    console.log("Marker clicked for country:", countryCode);
    $('#countrySelect').val(countryCode);
    selectCountry(countryCode);
  });
  
  marker.addTo(countryMarkers);
  
  visitedCountries.push({
    code: countryCode,
    name: countryName,
    latlng: latlng,
    marker: marker,
    timestamp: Date.now()
  });
  
  console.log("Total markers:", visitedCountries.length);
}

function getCountryCenter(countryCode) {
  if (!allCountryBorders || !allCountryBorders.features) {
    return null;
  }
  
  for (var i = 0; i < allCountryBorders.features.length; i++) {
    var feature = allCountryBorders.features[i];
    if (feature.properties && feature.properties['ISO3166-1-Alpha-2'] === countryCode) {
      try {
        var geoJsonLayer = L.geoJSON(feature);
        var bounds = geoJsonLayer.getBounds();
        return bounds.getCenter();
      } catch (error) {
        console.log("Error getting center for:", countryCode);
        return null;
      }
    }
  }
  return null;
}

function setupSearchHandlers() {
  const searchInput = $('#countrySearch');
  const debouncedSearch = debounce(performSearch, 300);
  
  searchInput.on('input', function() {
    const query = $(this).val().trim();
    if (query.length > 0) {
      debouncedSearch(query);
    } else {
      hideSearchResults();
    }
  });

  searchInput.on('keydown', function(e) {
    if ($('#searchResults').is(':visible')) {
      switch(e.keyCode) {
        case 38:
          e.preventDefault();
          navigateSearchResults(-1);
          break;
        case 40:
          e.preventDefault();
          navigateSearchResults(1);
          break;
        case 13:
          e.preventDefault();
          selectHighlightedResult();
          break;
        case 27:
          hideSearchResults();
          break;
      }
    }
  });

  searchInput.on('focus', function() {
    const query = $(this).val().trim();
    if (query.length > 0 && searchResults.length > 0) {
      showSearchResults();
    }
  });
}

function performSearch(query) {
  console.log("Searching for:", query);
  
  if (!allCountries || allCountries.length === 0) {
    console.log("Countries not loaded yet");
    return;
  }
  
  const lowerQuery = query.toLowerCase();
  searchResults = allCountries.filter(country => {
    return country.name.toLowerCase().includes(lowerQuery) ||
           country.code.toLowerCase().includes(lowerQuery);
  });
  
  console.log("Search results:", searchResults.length);
  displaySearchResults();
}

function displaySearchResults() {
  const resultsContainer = $('#searchResults');
  selectedSearchIndex = -1;
  
  if (searchResults.length === 0) {
    resultsContainer.html('<div class="search-no-results">No countries found</div>');
  } else {
    let html = '';
    searchResults.slice(0, 8).forEach((country, index) => {
      html += `
        <div class="search-result-item" data-index="${index}" data-code="${country.code}">
          <span class="search-result-code">${country.code}</span>
          <span class="search-result-name">${country.name}</span>
        </div>
      `;
    });
    
    if (searchResults.length > 8) {
      html += `<div class="search-no-results">${searchResults.length - 8} more countries...</div>`;
    }
    
    resultsContainer.html(html);
    
    $('.search-result-item').click(function() {
      const countryCode = $(this).data('code');
      selectCountryFromSearch(countryCode);
    });
  }
  
  showSearchResults();
}

function navigateSearchResults(direction) {
  const maxIndex = Math.min(searchResults.length - 1, 7);
  
  if (direction === 1) {
    selectedSearchIndex = selectedSearchIndex < maxIndex ? selectedSearchIndex + 1 : 0;
  } else {
    selectedSearchIndex = selectedSearchIndex > 0 ? selectedSearchIndex - 1 : maxIndex;
  }
  
  $('.search-result-item').removeClass('highlighted');
  $(`.search-result-item[data-index="${selectedSearchIndex}"]`).addClass('highlighted');
}

function selectHighlightedResult() {
  if (selectedSearchIndex >= 0 && selectedSearchIndex < searchResults.length) {
    const country = searchResults[selectedSearchIndex];
    selectCountryFromSearch(country.code);
  }
}

function selectCountryFromSearch(countryCode) {
  console.log("Country selected from search:", countryCode);
  
  $('#countrySearch').val('');
  hideSearchResults();
  
  $('#countrySelect').val(countryCode);
  
  var center = getCountryCenter(countryCode);
  if (center) {
    selectCountry(countryCode, center);
  } else {
    selectCountry(countryCode);
  }
}

function selectCountry(countryCode, markerPosition) {
  console.log("Selecting country:", countryCode);
  loadCountryBorder(countryCode);
  
  var countryName = getCountryName(countryCode);
  
  if (markerPosition) {
    addCountryMarker(countryCode, countryName, markerPosition);
  } else {
    var center = getCountryCenter(countryCode);
    if (center) {
      addCountryMarker(countryCode, countryName, center);
    }
  }
}

function getCountryName(countryCode) {
  var country = allCountries.find(function(c) {
    return c.code === countryCode;
  });
  return country ? country.name : countryCode;
}

function showSearchResults() {
  $('#searchResults').addClass('show');
}

function hideSearchResults() {
  $('#searchResults').removeClass('show');
  selectedSearchIndex = -1;
}

function loadAllCountryBorders() {
  $.ajax({
    url: 'countryBorders.geo.json',
    type: 'GET',
    dataType: 'json',
    success: function(data) {
      console.log("All country borders loaded for click detection");
      allCountryBorders = data;
    },
    error: function(xhr, status, error) {
      console.error("Failed to load country borders for click detection");
      console.error("Status:", status);
      console.error("Error:", error);
    }
  });
}

function detectClickedCountry(latlng, clickPosition) {
  if (!allCountryBorders || !allCountryBorders.features) {
    console.log("Country borders not loaded yet for click detection");
    return;
  }

  console.log("Detecting country at coordinates:", latlng);
  
  var sortedFeatures = allCountryBorders.features.slice().sort(function(a, b) {
    var areaA = getBoundingBoxArea(a.geometry);
    var areaB = getBoundingBoxArea(b.geometry);
    return areaA - areaB;
  });
  
  for (var i = 0; i < sortedFeatures.length; i++) {
    var feature = sortedFeatures[i];
    
    if (feature.properties && feature.properties['ISO3166-1-Alpha-2']) {
      var countryCode = feature.properties['ISO3166-1-Alpha-2'];
      
      if (countryCode === '-99' || !countryCode) {
        continue;
      }
      
      try {
        if (isPointInCountry(latlng, feature.geometry)) {
          console.log("Clicked country detected:", countryCode);
          
          $('#countrySelect').val(countryCode);
          selectCountry(countryCode, clickPosition);
          
          var countryName = feature.properties['name'] || countryCode;
          console.log("Country selected via map click:", countryName);
          return;
        }
      } catch (error) {
        console.log("Error checking country:", countryCode, error);
        continue;
      }
    }
  }
  
  console.log("No country detected at click location");
}

function isPointInCountry(latlng, geometry) {
  if (geometry.type === 'Polygon') {
    return isPointInPolygon(latlng, geometry.coordinates);
  } else if (geometry.type === 'MultiPolygon') {
    for (var i = 0; i < geometry.coordinates.length; i++) {
      if (isPointInPolygon(latlng, geometry.coordinates[i])) {
        return true;
      }
    }
    return false;
  }
  return false;
}

function isPointInPolygon(latlng, polygonCoords) {
  var coords = polygonCoords[0];
  
  if (!coords || coords.length < 3) {
    return false;
  }
  
  var x = latlng.lng;
  var y = latlng.lat;
  var inside = false;
  
  for (var i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    var xi = coords[i][0];
    var yi = coords[i][1];
    var xj = coords[j][0];
    var yj = coords[j][1];
    
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
}

function getBoundingBoxArea(geometry) {
  var bounds = { minLat: 90, maxLat: -90, minLng: 180, maxLng: -180 };
  
  function updateBounds(coords) {
    if (Array.isArray(coords[0])) {
      coords.forEach(updateBounds);
    } else {
      var lng = coords[0];
      var lat = coords[1];
      bounds.minLat = Math.min(bounds.minLat, lat);
      bounds.maxLat = Math.max(bounds.maxLat, lat);
      bounds.minLng = Math.min(bounds.minLng, lng);
      bounds.maxLng = Math.max(bounds.maxLng, lng);
    }
  }
  
  if (geometry.type === 'Polygon') {
    updateBounds(geometry.coordinates[0]);
  } else if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach(function(polygon) {
      updateBounds(polygon[0]);
    });
  }
  
  return (bounds.maxLat - bounds.minLat) * (bounds.maxLng - bounds.minLng);
}

function loadCountries() {
  console.log("Calling getCountries.php");
  
  $.ajax({
    url: 'php/getCountries.php',
    type: 'GET',
    dataType: 'json',
    success: function(data) {
      console.log("Countries loaded successfully:", data);
      allCountries = data;
      
      $('#countrySelect').empty().append('<option value="">Select a country...</option>');
      
      if (Array.isArray(data)) {
        data.forEach(function(country) {
          $('#countrySelect').append(
            '<option value="' + country.code + '">' + country.name + '</option>'
          );
        });
        console.log("Added", data.length, "countries to dropdown");
      } else {
        console.error("Expected array but got:", typeof data);
      }
    },
    error: function(xhr, status, error) {
      console.error("Failed to load countries");
      console.error("Status:", status);
      console.error("Error:", error);
      console.error("Response:", xhr.responseText);
      alert('Failed to load countries. Check console for details.');
    }
  });
}

function loadCountryBorder(countryCode) {
  console.log("Loading border for country:", countryCode);
  currentCountryCode = countryCode;
  
  if (countryBorder) {
    map.removeLayer(countryBorder);
  }
  
  $.ajax({
    url: 'php/getCountryBorder.php',
    type: 'GET',
    data: { country: countryCode },
    dataType: 'json',
    success: function(data) {
      console.log("Border data received:", data);
      
      if (data && data.geometry) {
        countryBorder = L.geoJSON(data, {
          style: {
            color: "#2980b9",
            weight: 2,
            fillOpacity: 0.1
          }
        }).addTo(map);
        
        map.fitBounds(countryBorder.getBounds());
        console.log("Border added and map fitted");
      } else {
        console.error("Invalid border data:", data);
      }
    },
    error: function(xhr, status, error) {
      console.error("Failed to load country border");
      console.error("Status:", status);
      console.error("Error:", error);
      console.error("Response:", xhr.responseText);
      alert('Failed to load country border. Check console for details.');
    }
  });
}

function loadCountryData() {
  console.log("Loading country data for:", currentCountryCode);
  
  if (!currentCountryCode) {
    $('#population').text('Select a country first');
    $('#area').text('Select a country first');
    $('#capital').text('Select a country first');
    $('#region').text('Select a country first');
    $('#capitalWiki').text('Select a country first');
    return;
  }
  
  $.ajax({
    url: 'php/getCountryInfo.php',
    type: 'GET',
    data: { country: currentCountryCode },
    dataType: 'json',
    success: function(data) {
      console.log("Country info received:", data);
      $('#population').text(data.population || 'N/A');
      $('#area').text(data.area || 'N/A');
      $('#capital').text(data.capital || 'N/A');
      $('#region').text(data.region || 'N/A');
      
      currentCapital = data.capital || '';
      
      if (currentCapital && currentCapital !== 'N/A') {
        var capitalWikiUrl = 'https://en.wikipedia.org/wiki/' + encodeURIComponent(currentCapital);
        $('#capitalWiki').html('<a href="' + capitalWikiUrl + '" target="_blank" class="text-decoration-none">Wikipedia ↗</a>');
      } else {
        $('#capitalWiki').text('N/A');
      }
    },
    error: function(xhr, status, error) {
      console.error("Failed to load country info");
      console.error("Status:", status);
      console.error("Error:", error);
      console.error("Response:", xhr.responseText);
      $('#population').text('Error loading data');
      $('#area').text('Error loading data');
      $('#capital').text('Error loading data');
      $('#region').text('Error loading data');
      $('#capitalWiki').text('Error loading data');
    }
  });
}

function loadWeatherData() {
  console.log("Loading weather data for:", currentCountryCode);
  
  if (!currentCountryCode) {
    $('#temperature').text('Select a country first');
    $('#condition').text('Select a country first');
    $('#humidity').text('Select a country first');
    return;
  }
  
  $.ajax({
    url: 'php/getWeather.php',
    type: 'GET',
    data: { country: currentCountryCode },
    dataType: 'json',
    success: function(data) {
      console.log("Weather data received:", data);
      $('#temperature').text(data.temperature || 'N/A');
      $('#condition').text(data.condition || 'N/A');
      $('#humidity').text(data.humidity || 'N/A');
    },
    error: function(xhr, status, error) {
      console.error("Failed to load weather data");
      console.error("Status:", status);
      console.error("Error:", error);
      console.error("Response:", xhr.responseText);
      $('#temperature').text('Error loading data');
      $('#condition').text('Error loading data');
      $('#humidity').text('Error loading data');
    }
  });
}

function loadCurrencyData() {
  console.log("Loading currency data for:", currentCountryCode);
  
  if (!currentCountryCode) {
    $('#currencyName').text('Select a country first');
    $('#currencyCode').text('Select a country first');
    $('#exchangeRate').text('Select a country first');
    return;
  }
  
  $.ajax({
    url: 'php/getCurrency.php',
    type: 'GET',
    data: { country: currentCountryCode },
    dataType: 'json',
    success: function(data) {
      console.log("Currency data received:", data);
      $('#currencyName').text(data.name || 'N/A');
      $('#currencyCode').text(data.code || 'N/A');
      $('#exchangeRate').text(data.rate || 'N/A');
    },
    error: function(xhr, status, error) {
      console.error("Failed to load currency data");
      console.error("Status:", status);
      console.error("Error:", error);
      console.error("Response:", xhr.responseText);
      $('#currencyName').text('Error loading data');
      $('#currencyCode').text('Error loading data');
      $('#exchangeRate').text('Error loading data');
    }
  });
}

function loadNewsData() {
  console.log("Loading news data for:", currentCountryCode);
  
  if (!currentCountryCode) {
    $('#newsContent').html('<p class="text-center">Select a country first</p>');
    return;
  }
  
  $('#newsContent').html('<div class="text-center"><i class="fa-solid fa-spinner fa-spin fa-2x text-success mb-3"></i><p>Loading latest news...</p></div>');
  
  $.ajax({
    url: 'php/getNews.php',
    type: 'GET',
    data: { country: currentCountryCode },
    dataType: 'json',
    success: function(data) {
      console.log("News data received:", data);
      
      if (data && data.articles && data.articles.length > 0) {
        var newsHtml = '';
        data.articles.forEach(function(article, index) {
          if (index < 5) {
            newsHtml += '<div class="mb-3 pb-3 border-bottom">';
            newsHtml += '<h6 class="fw-bold">' + (article.title || 'No title') + '</h6>';
            newsHtml += '<p class="small text-muted mb-2">' + (article.source || 'Unknown source') + '</p>';
            newsHtml += '<p class="mb-2">' + (article.description || 'No description available') + '</p>';
            if (article.url) {
              newsHtml += '<a href="' + article.url + '" target="_blank" class="btn btn-sm btn-outline-success">Read More</a>';
            }
            newsHtml += '</div>';
          }
        });
        $('#newsContent').html(newsHtml);
      } else {
        $('#newsContent').html('<p class="text-center">No recent news available for this country</p>');
      }
    },
    error: function(xhr, status, error) {
      console.error("Failed to load news data");
      console.error("Status:", status);
      console.error("Error:", error);
      console.error("Response:", xhr.responseText);
      $('#newsContent').html('<p class="text-center text-danger">Error loading news data</p>');
    }
  });
}

function loadWikipediaData() {
  console.log("Loading Wikipedia data for:", currentCountryCode);
  
  if (!currentCountryCode) {
    $('#wikipediaContent').html('<p class="text-center">Select a country first</p>');
    return;
  }
  
  $('#wikipediaContent').html('<div class="text-center"><i class="fa-solid fa-spinner fa-spin fa-2x text-success mb-3"></i><p>Loading Wikipedia information...</p></div>');
  
  $.ajax({
    url: 'php/getWikipedia.php',
    type: 'GET',
    data: { country: currentCountryCode },
    dataType: 'json',
    success: function(data) {
      console.log("Wikipedia data received:", data);
      
      var wikiHtml = '';
      
      if (data.extract) {
        wikiHtml += '<div class="mb-3">';
        wikiHtml += '<h6 class="fw-bold">About ' + (data.title || 'this country') + '</h6>';
        wikiHtml += '<p>' + data.extract + '</p>';
        if (data.url) {
          wikiHtml += '<a href="' + data.url + '" target="_blank" class="btn btn-sm btn-outline-success">Read Full Article</a>';
        }
        wikiHtml += '</div>';
      }
      
      if (data.images && data.images.length > 0) {
        wikiHtml += '<div class="mb-3">';
        wikiHtml += '<h6 class="fw-bold">Images</h6>';
        wikiHtml += '<div class="row">';
        data.images.forEach(function(image, index) {
          if (index < 4) {
            wikiHtml += '<div class="col-6 mb-2">';
            wikiHtml += '<img src="' + image.url + '" class="img-fluid rounded" alt="' + (image.caption || 'Country image') + '" style="height: 100px; object-fit: cover; width: 100%;">';
            wikiHtml += '</div>';
          }
        });
        wikiHtml += '</div>';
        wikiHtml += '</div>';
      }
      
      if (wikiHtml) {
        $('#wikipediaContent').html(wikiHtml);
      } else {
        $('#wikipediaContent').html('<p class="text-center">No Wikipedia information available for this country</p>');
      }
    },
    error: function(xhr, status, error) {
      console.error("Failed to load Wikipedia data");
      console.error("Status:", status);
      console.error("Error:", error);
      console.error("Response:", xhr.responseText);
      $('#wikipediaContent').html('<p class="text-center text-danger">Error loading Wikipedia data</p>');
    }
  });
}