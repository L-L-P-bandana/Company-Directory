/* ========================================================================== */
/* GAZETTEER - WORLD COUNTRY EXPLORER APPLICATION */
/* Single Page Application with jQuery and Leaflet */
/* Fixed to use Local PHP API instead of external APIs */
/* ========================================================================== */

// Prevent duplicate execution
if (typeof window.gazeteerAppLoaded === 'undefined') {
window.gazeteerAppLoaded = true;

/* ========================================================================== */
/* APPLICATION CONFIGURATION */
/* ========================================================================== */

const APP_CONFIG = {
    // API Configuration - NOW USES LOCAL PHP API
    API_BASE_URL: 'php/api.php',  // Changed from external APIs to local PHP API
    
    // API Endpoints for local PHP API
    ENDPOINTS: {
        COUNTRIES: 'countries',           // GET ?request=countries
        COUNTRY_DETAIL: 'country',        // GET ?request=country/{code}
        SEARCH: 'search',                 // GET ?request=search/{query}
        WEATHER: 'weather',               // GET ?request=weather/{code}
        EXCHANGE_RATES: 'rates'           // GET ?request=rates/{currency}
    },
    
    // Map Configuration
    MAP_DEFAULT_VIEW: [20, 0],
    MAP_DEFAULT_ZOOM: 2,
    MAP_MAX_ZOOM: 18,
    MAP_MIN_ZOOM: 1,
    
    // Tile Layer Configuration
    TILE_LAYER: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    TILE_ATTRIBUTION: '© OpenStreetMap contributors',
    
    // Application Settings
    SEARCH_DELAY: 300,
    CACHE_DURATION: 300000, // 5 minutes
    DEBOUNCE_DELAY: 250,
    
    // UI Configuration
    MOBILE_BREAKPOINT: 768,
    MODAL_ANIMATION_SPEED: 300
};

/* ========================================================================== */
/* DEBUG UTILITIES */
/* ========================================================================== */

const debugLog = {
    info: (message, data = '') => console.log(`🔵 [INFO] ${message}`, data),
    success: (message, data = '') => console.log(`✅ [SUCCESS] ${message}`, data),
    warning: (message, data = '') => console.log(`⚠️  [WARNING] ${message}`, data),
    error: (message, data = '') => console.log(`❌ [ERROR] ${message}`, data),
    timing: (label) => console.time(`⏱️  ${label}`),
    timingEnd: (label) => console.timeEnd(`⏱️  ${label}`)
};

/* ========================================================================== */
/* GLOBAL FUNCTION ACCESS - Fix for map popup buttons */
/* ========================================================================== */

// Make viewCountryDetails globally accessible for HTML onclick events
window.viewCountryDetails = viewCountryDetails;

let map;
let markersLayer;
let currentCountryData = null;
let searchTimeout;
let apiCache = new Map();
let allCountries = [];
let exchangeRates = {};
let appInitialized = false;
let countryService;

/* ========================================================================== */
/* UTILITY FUNCTIONS */
/* ========================================================================== */

/**
 * Format numbers with commas
 */
function formatNumber(num) {
    if (!num) return 'N/A';
    return parseInt(num).toLocaleString();
}

/**
 * Format currency values
 */
function formatCurrency(amount, currency = 'USD') {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency
    }).format(amount);
}

/**
 * Debounce function for search
 */
function debounce(func, wait, immediate) {
    let timeout;
    return function executedFunction(...args) {
        const later = function() {
            timeout = null;
            if (!immediate) func(...args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func(...args);
    };
}

/**
 * Show/hide loading state - Subtle loading for better UX
 */
function showLoadingState(message = 'Loading...', subtle = false) {
    if (subtle) {
        // Subtle loading: just change cursor and maybe small indicator
        $('body').css('cursor', 'wait');
        $('.modal-title').addClass('loading');
    } else {
        // Full loading overlay (only for app initialization)
        $('#loadingSpinner').show();
        $('.loading-text').text(message);
    }
}

function hideLoadingState() {
    debugLog.info('🔧 [DEBUG] hideLoadingState() called');
    
    // Hide ALL possible loading elements
    $('#loadingSpinner').hide();
    $('#preloader').hide();
    $('.loading-spinner').hide();
    
    // Remove subtle loading indicators
    $('body').css('cursor', 'default');
    $('.modal-title').removeClass('loading');
    
    // Also try fadeOut for smoother transition
    $('#preloader').fadeOut(300);
    
    // Force hide with CSS as backup
    $('#preloader').css('display', 'none');
    $('#loadingSpinner').css('display', 'none');
    
    debugLog.success('All loading elements hidden');
}

/**
 * Show subtle loading for country interactions
 */
function showSubtleLoading() {
    $('body').css('cursor', 'wait');
    $('.modal-title').addClass('loading');
}

/**
 * Hide subtle loading
 */
function hideSubtleLoading() {
    $('body').css('cursor', 'default');
    $('.modal-title').removeClass('loading');
}

/**
 * Show error state
 */
function showErrorState(message) {
    debugLog.error('Showing error state:', message);
    hideLoadingState();
    
    // You can customize this to show a proper error UI
    $('#loadingSpinner').html(`
        <div class="error-state">
            <h4>Error</h4>
            <p>${message}</p>
            <button class="btn btn-primary" onclick="location.reload()">Retry</button>
        </div>
    `).show();
}

/* ========================================================================== */
/* COUNTRY SERVICE - UPDATED TO USE LOCAL PHP API */
/* ========================================================================== */

class CountryService {
    constructor() {
        this.baseUrl = APP_CONFIG.API_BASE_URL;
        this.countries = [];
        this.cache = new Map();
        debugLog.success('Country Service initialized with local PHP API');
    }

    // Fetch countries from LOCAL PHP API
    async getCountryData() {
        try {
            debugLog.timing('Get Country Data');
            debugLog.info('Fetching countries from local PHP API...');
            
            const response = await fetch(`${this.baseUrl}?request=${APP_CONFIG.ENDPOINTS.COUNTRIES}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.status === 'success' && result.data) {
                const countries = result.data.map(country => ({
                    name: country.name_common,
                    code: country.iso_code_2,
                    code3: country.iso_code_3,
                    capital: country.capital,
                    population: country.population,
                    region: country.region,
                    subregion: country.subregion,
                    flag: country.flag_png,
                    coordinates: { lat: null, lng: null } // Will be populated when needed
                }));
                
                debugLog.success(`Loaded ${result.count} countries from local API`);
                debugLog.timingEnd('Get Country Data');
                return countries;
            } else {
                throw new Error('Invalid API response format');
            }
            
        } catch (error) {
            debugLog.error('Failed to fetch countries from local API:', error);
            debugLog.timingEnd('Get Country Data');
            throw error;
        }
    }

    // Get detailed country information
    async getCountryDetails(countryCode) {
        try {
            const response = await fetch(`${this.baseUrl}?request=${APP_CONFIG.ENDPOINTS.COUNTRY_DETAIL}/${countryCode}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.status === 'success') {
                return result.data;
            } else {
                throw new Error(result.error || 'Failed to get country details');
            }
            
        } catch (error) {
            debugLog.error(`Failed to get details for ${countryCode}:`, error);
            throw error;
        }
    }

    // Search countries
    async searchCountries(query) {
        try {
            const response = await fetch(`${this.baseUrl}?request=${APP_CONFIG.ENDPOINTS.SEARCH}/${encodeURIComponent(query)}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.status === 'success') {
                return result.data;
            } else {
                throw new Error(result.error || 'Search failed');
            }
            
        } catch (error) {
            debugLog.error(`Search failed for "${query}":`, error);
            throw error;
        }
    }

    // Get weather data
    async getWeatherData(countryCode) {
        try {
            const response = await fetch(`${this.baseUrl}?request=${APP_CONFIG.ENDPOINTS.WEATHER}/${countryCode}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.status === 'success') {
                return result.data;
            } else {
                throw new Error(result.error || 'Weather data not available');
            }
            
        } catch (error) {
            debugLog.error(`Failed to get weather for ${countryCode}:`, error);
            throw error;
        }
    }

    // Get exchange rates
    async getExchangeRates(baseCurrency = 'USD') {
        try {
            const response = await fetch(`${this.baseUrl}?request=${APP_CONFIG.ENDPOINTS.EXCHANGE_RATES}/${baseCurrency}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.status === 'success') {
                return result.rates;
            } else {
                throw new Error(result.error || 'Exchange rates not available');
            }
            
        } catch (error) {
            debugLog.error(`Failed to get exchange rates for ${baseCurrency}:`, error);
            throw error;
        }
    }

    // Main method to fetch countries (replaces external API calls)
    async fetchCountries() {
        try {
            debugLog.info('Fetching countries from local PHP API...');
            this.countries = await this.getCountryData();
            return this.countries;
        } catch (error) {
            debugLog.error('Failed to fetch countries:', error);
            throw new Error('Failed to load country data from API');
        }
    }

    // Get country by code
    async getCountryByCode(countryCode) {
        if (!this.countries || this.countries.length === 0) {
            await this.fetchCountries();
        }
        
        const code = countryCode.toUpperCase();
        const country = this.countries.find(country => 
            country.code === code || country.code3 === code
        );
        
        if (country) {
            debugLog.success(`Found country by code ${code}:`, country.name);
        } else {
            debugLog.warning(`Country not found for code: ${code}`);
        }
        
        return country;
    }

    // Reverse geocoding using a simple API for map clicks
    async tryReverseGeocode(lat, lng) {
        try {
            debugLog.info(`Attempting reverse geocoding for: ${lat}, ${lng}`);
            
            // Use a simple reverse geocoding service
            const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
            
            if (response.ok) {
                const data = await response.json();
                const countryCode = data.countryCode;
                
                if (countryCode) {
                    const country = await this.getCountryByCode(countryCode);
                    if (country) {
                        debugLog.success(`Reverse geocoding found: ${country.name}`);
                        return country;
                    }
                }
            }
            
            debugLog.warning('Reverse geocoding failed or no country found');
            return null;
            
        } catch (error) {
            debugLog.error('Reverse geocoding error:', error);
            return null;
        }
    }

    // Find nearest country by coordinates (fallback)
    async findNearestCountry(lat, lng) {
        if (!this.countries || this.countries.length === 0) {
            await this.fetchCountries();
        }
        
        // This is a simplified approach - in a real app you'd use proper geographic calculations
        debugLog.info('Using fallback nearest country detection');
        
        // Return a default country or the first one as fallback
        if (this.countries.length > 0) {
            debugLog.warning('Returning fallback country for coordinates');
            return this.countries[0];
        }
        
        return null;
    }
}

/* ========================================================================== */
/* MAP INITIALIZATION */
/* ========================================================================== */

/**
 * Initialize Leaflet map with enhanced error handling
 */
function initializeMap() {
    try {
        debugLog.timing('Map Initialization');
        
        // Fix Leaflet icon paths (common issue)
        if (typeof L !== 'undefined') {
            delete L.Icon.Default.prototype._getIconUrl;
            L.Icon.Default.mergeOptions({
                iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
                iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            });
            debugLog.success('Leaflet icon paths fixed');
        }

        // Create map
        map = L.map('map').setView(APP_CONFIG.MAP_DEFAULT_VIEW, APP_CONFIG.MAP_DEFAULT_ZOOM);
        
        // Add tile layer
        L.tileLayer(APP_CONFIG.TILE_LAYER, {
            attribution: APP_CONFIG.TILE_ATTRIBUTION,
            maxZoom: APP_CONFIG.MAP_MAX_ZOOM,
            minZoom: APP_CONFIG.MAP_MIN_ZOOM
        }).addTo(map);

        // Initialize marker layer
        markersLayer = L.layerGroup().addTo(map);

        // Enhanced map click handler with subtle loading
        map.on('click', async function(e) {
            const { lat, lng } = e.latlng;
            debugLog.info(`Map clicked at: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);

            // Use subtle loading instead of full overlay
            showSubtleLoading();

            try {
                let country = null;

                // Try reverse geocoding first (most accurate for borders)
                country = await countryService.tryReverseGeocode(lat, lng);

                // Fallback to nearest country if reverse geocoding fails
                if (!country) {
                    country = await countryService.findNearestCountry(lat, lng);
                }

                if (country) {
                    // Add marker at clicked location
                    const marker = L.marker([lat, lng]).addTo(markersLayer);
                    marker.bindPopup(`
                        <strong>${country.name}</strong><br>
                        Clicked: ${lat.toFixed(4)}, ${lng.toFixed(4)}<br>
                        <button class="btn btn-sm btn-primary" onclick="viewCountryDetails('${country.code}')">
                            View Details
                        </button>
                    `).openPopup();

                    // Load country details
                    await viewCountryDetails(country.code);
                } else {
                    debugLog.warning('No country found for clicked location');
                    showToastNotification('No country found at this location', 'info');
                }
            } catch (error) {
                debugLog.error('Map click handling failed:', error);
                showToastNotification('Failed to identify country', 'error');
            } finally {
                hideSubtleLoading();
            }
        });

        debugLog.timingEnd('Map Initialization');
        debugLog.success('Map initialized successfully');
        return true;
    } catch (error) {
        debugLog.error('Map initialization failed:', error);
        showErrorState('Map failed to initialize. Please refresh the page.');
        return false;
    }
}

/* ========================================================================== */
/* API FUNCTIONS - UPDATED FOR LOCAL PHP API */
/* ========================================================================== */

/**
 * Fetch all countries from LOCAL API
 */
async function fetchCountries() {
    try {
        debugLog.timing('Fetch Countries');
        const countries = await countryService.fetchCountries();
        
        if (countries && countries.length > 0) {
            allCountries = countries;
            populateCountrySelect(countries);
            debugLog.timingEnd('Fetch Countries');
            debugLog.success(`Loaded ${countries.length} countries`);
            return countries;
        } else {
            throw new Error('No countries returned from API');
        }
    } catch (error) {
        debugLog.error('Failed to fetch countries:', error);
        debugLog.timingEnd('Fetch Countries');
        throw new Error('Failed to load country data');
    }
}

/**
 * Fetch country details by ISO code - FIXED FOR API RESPONSE STRUCTURE
 */
async function fetchCountryDetails(isoCode) {
    try {
        debugLog.timing('Fetch Country Details');
        
        // Check cache first
        const cacheKey = `country_${isoCode}`;
        if (apiCache.has(cacheKey)) {
            debugLog.success('Using cached country details');
            debugLog.timingEnd('Fetch Country Details');
            return apiCache.get(cacheKey);
        }

        const response = await fetch(`${APP_CONFIG.API_BASE_URL}?request=${APP_CONFIG.ENDPOINTS.COUNTRY_DETAIL}/${isoCode}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.status === 'success' && result.data) {
            // Cache the entire response
            apiCache.set(cacheKey, result);
            debugLog.timingEnd('Fetch Country Details');
            debugLog.success(`Country details fetched for: ${result.data.basic_info?.name_common}`);
            return result;
        } else {
            debugLog.warning(`No details found for country code: ${isoCode}`);
            return null;
        }
    } catch (error) {
        debugLog.error('Failed to fetch country details:', error);
        debugLog.timingEnd('Fetch Country Details');
        return null;
    }
}

/**
 * Fetch exchange rates from LOCAL API
 */
async function fetchExchangeRates(baseCurrency = 'USD') {
    try {
        debugLog.timing('Fetch Exchange Rates');
        
        // Check cache first
        const cacheKey = `rates_${baseCurrency}`;
        if (apiCache.has(cacheKey)) {
            exchangeRates = apiCache.get(cacheKey);
            debugLog.success('Using cached exchange rates');
            debugLog.timingEnd('Fetch Exchange Rates');
            return exchangeRates;
        }

        const rates = await countryService.getExchangeRates(baseCurrency);
        
        if (rates) {
            exchangeRates = rates;
            // Cache the result
            apiCache.set(cacheKey, rates);
            debugLog.timingEnd('Fetch Exchange Rates');
            debugLog.success('Exchange rates fetched successfully');
            return rates;
        } else {
            debugLog.warning('Exchange rates API returned error status');
            debugLog.timingEnd('Fetch Exchange Rates');
            return {};
        }
    } catch (error) {
        debugLog.error('Failed to fetch exchange rates:', error);
        debugLog.timingEnd('Fetch Exchange Rates');
        return {};
    }
}

/* ========================================================================== */
/* UI FUNCTIONS */
/* ========================================================================== */

/**
 * Populate country select dropdown
 */
function populateCountrySelect(countries) {
    const $select = $('#countrySelect');
    $select.empty().append('<option value="">Select a country...</option>');
    
    countries.forEach(country => {
        $select.append(`
            <option value="${country.code}">
                ${country.name}
            </option>
        `);
    });
}

/**
 * View country details in modal - FIXED DATA MAPPING
 */
async function viewCountryDetails(countryCode) {
    try {
        // Use subtle loading instead of full-screen overlay
        showSubtleLoading();
        
        // Fetch detailed country information
        const countryResponse = await fetchCountryDetails(countryCode);
        
        if (!countryResponse || !countryResponse.data) {
            throw new Error('Country details not found');
        }
        
        // Extract nested data structure from API response
        const countryData = countryResponse.data;
        const basicInfo = countryData.basic_info || {};
        const geography = countryData.geography || {};
        const flags = countryData.flags || {};
        const weather = countryData.weather || {};
        const currencies = countryData.currencies || [];
        const languages = countryData.languages || [];
        
        // Store for global use (flattened for compatibility)
        currentCountryData = {
            ...basicInfo,
            latitude: geography.latitude,
            longitude: geography.longitude,
            flag_png: flags.png,
            flag_svg: flags.svg,
            weather: weather,
            currencies: currencies,
            languages: languages
        };
        
        // Populate modal with country information - FIXED FIELD MAPPING
        $('#countryName').text(basicInfo.name_common || 'Unknown');
        $('#countryCode').text(basicInfo.iso_code_2 || '');
        
        // Fix flag image source
        const flagUrl = flags.png || flags.svg || `https://flagcdn.com/w320/${(basicInfo.iso_code_2 || '').toLowerCase()}.png`;
        $('#countryFlag').attr('src', flagUrl).attr('alt', `${basicInfo.name_common} flag`);
        
        // Overview tab - FIXED DATA MAPPING
        $('#countryPopulation').text(formatNumber(basicInfo.population));
        $('#countryArea').text(basicInfo.area_km2 ? `${formatNumber(basicInfo.area_km2)} km²` : 'N/A');
        $('#countryCapital').text(basicInfo.capital || 'N/A');
        $('#countryRegion').text(basicInfo.region || 'N/A');
        $('#countrySubregion').text(basicInfo.subregion || 'N/A');
        $('#countryCoords').text(
            geography.latitude && geography.longitude 
                ? `${geography.latitude.toFixed(4)}, ${geography.longitude.toFixed(4)}`
                : 'N/A'
        );
        
        // Populate weather data immediately if available
        populateWeatherData(weather);
        
        // Populate language data immediately
        populateLanguageData(languages);
        
        // Show modal immediately with all available data
        hideSubtleLoading();
        $('#countryModal').modal('show');
        
        // Load currency data in background (this is working)
        loadCurrencyDataQuietly(currentCountryData);
        
    } catch (error) {
        debugLog.error('Failed to load country details:', error);
        hideSubtleLoading();
        showToastNotification('Failed to load country details', 'error');
    }
}

/**
 * Populate weather data with ORGANIZED LAYOUT AND BETTER VISIBILITY
 */
function populateWeatherData(weather) {
    try {
        if (weather && weather.temperature !== null && weather.temperature !== undefined) {
            // Temperature with better formatting
            const temp = Math.round(weather.temperature);
            const feelsLike = Math.round(weather.feels_like);
            
            // Main weather display (temperature and description)
            $('#weatherTemp').html(`
                <span class="display-4 fw-bold text-primary">${temp}°C</span>
                <small class="text-muted d-block">Feels like ${feelsLike}°C</small>
            `);
            
            // Weather description with proper capitalization
            const description = weather.description || 'N/A';
            $('#weatherDesc').html(`
                <span class="fs-5 text-capitalize">${description}</span>
                ${weather.condition ? `<br><small class="text-muted">${weather.condition}</small>` : ''}
            `);
            
            // Weather icon with better styling
            if (weather.icon) {
                $('#weatherIcon').attr('src', `https://openweathermap.org/img/w/${weather.icon}.png`)
                    .attr('alt', description)
                    .attr('title', description)
                    .css({
                        'width': '64px',
                        'height': '64px',
                        'filter': 'drop-shadow(2px 2px 4px rgba(0,0,0,0.3))'
                    })
                    .show();
            } else {
                $('#weatherIcon').hide();
            }
            
            // Organized weather details in grid layout
            $('#weatherFeelsLike').html(`
                <i>🌡️</i>
                <strong>${feelsLike}°C</strong>
                <small class="text-muted d-block">Feels Like</small>
            `);
            
            $('#weatherHumidity').html(`
                <i>💧</i>
                <strong>${weather.humidity}%</strong>
                <small class="text-muted d-block">Humidity</small>
            `);
            
            $('#weatherPressure').html(`
                <i>📊</i>
                <strong>${weather.pressure}</strong>
                <small class="text-muted d-block">Pressure (hPa)</small>
            `);
            
            // Wind with direction indicator
            const windSpeed = weather.wind_speed;
            const windDir = weather.wind_direction;
            let windDirectionText = 'N/A';
            
            if (windDir !== null && windDir !== undefined) {
                const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
                const index = Math.round(windDir / 22.5) % 16;
                windDirectionText = directions[index];
            }
            
            $('#weatherWindSpeed').html(`
                <i>💨</i>
                <strong>${windSpeed} m/s</strong>
                <small class="text-muted d-block">Wind Speed</small>
            `);
            
            $('#weatherWindDir').html(`
                <i>🧭</i>
                <strong>${windDirectionText}</strong>
                <small class="text-muted d-block">${windDir ? `${windDir}°` : 'Direction'}</small>
            `);
            
            // Visibility with better formatting
            const visibility = weather.visibility;
            $('#weatherVisibility').html(`
                <i>👁️</i>
                <strong>${visibility ? `${(visibility / 1000).toFixed(1)} km` : 'N/A'}</strong>
                <small class="text-muted d-block">Visibility</small>
            `);
            
            debugLog.success('Weather data populated with organized layout');
        } else {
            // Enhanced "no data" display
            $('#weatherTemp').html(`
                <span class="text-muted text-center d-block">
                    <i class="fs-1 d-block mb-2">🌍</i>
                    <span class="fs-5">Weather data not available</span>
                </span>
            `);
            $('#weatherDesc').html('<span class="text-muted">No weather information</span>');
            
            // Set consistent "no data" styling for all details
            const noDataHtml = `
                <i class="text-muted">❓</i>
                <strong class="text-muted">N/A</strong>
                <small class="text-muted d-block">No Data</small>
            `;
            
            $('#weatherFeelsLike').html(noDataHtml);
            $('#weatherHumidity').html(noDataHtml);
            $('#weatherPressure').html(noDataHtml);
            $('#weatherWindSpeed').html(noDataHtml);
            $('#weatherWindDir').html(noDataHtml);
            $('#weatherVisibility').html(noDataHtml);
            $('#weatherIcon').hide();
            
            debugLog.warning('No weather data available in API response');
        }
    } catch (error) {
        debugLog.error('Failed to populate weather data:', error);
        $('#weatherTemp').html('<span class="text-danger">Error loading weather</span>');
        $('#weatherDesc').html('<span class="text-danger">Weather data unavailable</span>');
    }
}

/**
 * Populate language data with IMPROVED STYLING AND LAYOUT
 */
function populateLanguageData(languages) {
    try {
        let languagesHtml = '';
        
        if (languages && languages.length > 0) {
            languages.forEach((language, index) => {
                const isOfficial = language.is_official ? ' <span class="badge bg-primary ms-2">Official</span>' : '';
                languagesHtml += `
                    <div class="language-item">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <strong>${language.name}</strong>
                                ${language.code ? `<span class="text-muted ms-2">(${language.code})</span>` : ''}
                            </div>
                            <div>
                                ${isOfficial}
                            </div>
                        </div>
                    </div>
                `;
            });
            debugLog.success(`Populated ${languages.length} languages`);
        } else {
            languagesHtml = '<p class="text-muted mb-0">Language information not available</p>';
            debugLog.warning('No language data available in API response');
        }
        
        $('#languagesList').html(languagesHtml);
    } catch (error) {
        debugLog.error('Failed to populate language data:', error);
        $('#languagesList').html('<p class="text-danger">Language data unavailable</p>');
    }
}

/**
 * Load currency data with IMPROVED STYLING AND VISIBILITY
 */
async function loadCurrencyDataQuietly(countryData) {
    try {
        // Display country currency info with better styling
        let currencyHtml = '';
        if (countryData.currencies && countryData.currencies.length > 0) {
            countryData.currencies.forEach(currency => {
                currencyHtml += `
                    <div class="currency-item">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <strong>${currency.code}</strong> - ${currency.name}
                                ${currency.symbol ? `<span class="text-muted ms-2">(${currency.symbol})</span>` : ''}
                            </div>
                            ${currency.rate ? `<div class="text-end"><small class="text-muted">Rate: ${currency.rate}</small></div>` : ''}
                        </div>
                    </div>
                `;
            });
            debugLog.success(`Populated ${countryData.currencies.length} currencies`);
        } else {
            currencyHtml = '<p class="text-muted mb-0">Currency information not available</p>';
        }
        $('#currencyDetails').html(currencyHtml);
        
        // Load exchange rates for converter
        await fetchExchangeRates();
        
        // Populate currency selectors with better options
        const $fromSelect = $('#fromCurrency');
        const $toSelect = $('#toCurrency');
        
        $fromSelect.empty();
        $toSelect.empty();
        
        // Add common currencies first with full names
        const commonCurrencies = [
            { code: 'USD', name: 'US Dollar' },
            { code: 'EUR', name: 'Euro' },
            { code: 'GBP', name: 'British Pound' },
            { code: 'JPY', name: 'Japanese Yen' },
            { code: 'CAD', name: 'Canadian Dollar' },
            { code: 'AUD', name: 'Australian Dollar' },
            { code: 'CHF', name: 'Swiss Franc' },
            { code: 'CNY', name: 'Chinese Yuan' }
        ];
        
        // Add country's currencies first if available
        if (countryData.currencies && countryData.currencies.length > 0) {
            countryData.currencies.forEach(currency => {
                $fromSelect.append(`<option value="${currency.code}">${currency.code} - ${currency.name}</option>`);
                $toSelect.append(`<option value="${currency.code}">${currency.code} - ${currency.name}</option>`);
            });
            
            // Add separator
            $fromSelect.append('<option disabled>──────────</option>');
            $toSelect.append('<option disabled>──────────</option>');
        }
        
        // Add common currencies
        commonCurrencies.forEach(currency => {
            $fromSelect.append(`<option value="${currency.code}">${currency.code} - ${currency.name}</option>`);
            $toSelect.append(`<option value="${currency.code}">${currency.code} - ${currency.name}</option>`);
        });
        
        // Add other available currencies from exchange rates
        const addedCodes = new Set([
            ...commonCurrencies.map(c => c.code),
            ...(countryData.currencies || []).map(c => c.code)
        ]);
        
        const otherCurrencies = Object.keys(exchangeRates)
            .filter(code => !addedCodes.has(code))
            .sort();
            
        if (otherCurrencies.length > 0) {
            $fromSelect.append('<option disabled>──────────</option>');
            $toSelect.append('<option disabled>──────────</option>');
            
            otherCurrencies.forEach(currency => {
                $fromSelect.append(`<option value="${currency}">${currency}</option>`);
                $toSelect.append(`<option value="${currency}">${currency}</option>`);
            });
        }
        
        // Set smart default values
        const countryCurrencies = countryData.currencies || [];
        let defaultFromCurrency = 'USD';
        let defaultToCurrency = 'EUR';
        
        if (countryCurrencies.length > 0) {
            defaultFromCurrency = countryCurrencies[0].code;
            defaultToCurrency = countryCurrencies[0].code !== 'USD' ? 'USD' : 'EUR';
        }
        
        $fromSelect.val(defaultFromCurrency);
        $toSelect.val(defaultToCurrency);
        
        // Set up currency converter
        setupCurrencyConverter();
        
        debugLog.success('Currency data loaded with improved styling');
        
    } catch (error) {
        debugLog.error('Failed to load currency data:', error);
        $('#currencyDetails').html('<p class="text-danger">Currency data unavailable</p>');
    }
}

/**
 * Show toast notification for better error handling
 */
function showToastNotification(message, type = 'info') {
    const toastId = 'toast-' + Date.now();
    const toastClass = type === 'error' ? 'alert-danger' : 'alert-info';
    
    const toastHtml = `
        <div id="${toastId}" class="alert ${toastClass} alert-dismissible fade show position-fixed" 
             style="top: 20px; right: 20px; z-index: 9999; min-width: 300px;">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    $('body').append(toastHtml);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        $(`#${toastId}`).fadeOut(() => {
            $(`#${toastId}`).remove();
        });
    }, 3000);
}

/**
 * Setup currency converter functionality
 */
function setupCurrencyConverter() {
    $('#fromAmount, #fromCurrency, #toCurrency').off('input change').on('input change', function() {
        const fromAmount = parseFloat($('#fromAmount').val()) || 0;
        const fromCurrency = $('#fromCurrency').val();
        const toCurrency = $('#toCurrency').val();
        
        if (fromAmount && fromCurrency && toCurrency && exchangeRates) {
            const rate = exchangeRates[toCurrency] || 1;
            const convertedAmount = fromAmount * rate;
            $('#toAmount').val(convertedAmount.toFixed(2));
            $('#rateInfo').html(`<small class="text-muted">1 ${fromCurrency} = ${rate.toFixed(4)} ${toCurrency}</small>`);
        }
    });
    
    $('#swapCurrencies').off('click').on('click', function() {
        const fromCurrency = $('#fromCurrency').val();
        const toCurrency = $('#toCurrency').val();
        
        $('#fromCurrency').val(toCurrency);
        $('#toCurrency').val(fromCurrency);
        
        // Trigger conversion
        $('#fromAmount').trigger('input');
    });
}

/**
 * Search functionality with LIVE AUTOCOMPLETE
 */
async function performSearch(query) {
    if (!query || query.length < 1) {
        hideSearchSuggestions();
        return;
    }
    
    try {
        if (query.length >= 2) {
            // Full search for modal
            const results = await countryService.searchCountries(query);
            displaySearchResults(results);
        }
        
        // Live autocomplete for search input
        showSearchSuggestions(query);
        
    } catch (error) {
        debugLog.error('Search failed:', error);
        $('#searchResults').html('<p class="text-danger">Search failed. Please try again.</p>');
    }
}

/**
 * Show live search suggestions dropdown
 */
function showSearchSuggestions(query) {
    if (!query || query.length < 1) {
        hideSearchSuggestions();
        return;
    }
    
    // Filter countries from loaded data
    const suggestions = allCountries.filter(country => 
        country.name.toLowerCase().includes(query.toLowerCase()) ||
        (country.capital && country.capital.toLowerCase().includes(query.toLowerCase())) ||
        country.code.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 8); // Limit to 8 suggestions
    
    if (suggestions.length === 0) {
        hideSearchSuggestions();
        return;
    }
    
    const suggestionsHtml = suggestions.map(country => `
        <div class="search-suggestion-item p-2" data-country-code="${country.code}">
            <div class="d-flex align-items-center">
                <img src="${country.flag}" alt="${country.name} flag" 
                     class="me-2" style="width: 24px; height: 18px; object-fit: cover; border-radius: 2px;">
                <div class="flex-grow-1">
                    <div class="fw-bold small">${country.name}</div>
                    <div class="text-muted" style="font-size: 0.75rem;">${country.capital || 'N/A'} • ${country.region}</div>
                </div>
                <small class="text-muted">${country.code}</small>
            </div>
        </div>
    `).join('');
    
    // Create or update suggestions dropdown
    let $dropdown = $('#searchSuggestions');
    if ($dropdown.length === 0) {
        $dropdown = $(`
            <div id="searchSuggestions" class="search-suggestions-dropdown position-absolute bg-white border rounded shadow-sm" 
                 style="top: 100%; left: 0; right: 0; z-index: 1000; max-height: 300px; overflow-y: auto;">
            </div>
        `);
        $('.search-container').css('position', 'relative').append($dropdown);
    }
    
    $dropdown.html(suggestionsHtml).show();
    
    // Add click handlers
    $('.search-suggestion-item').off('click').on('click', function() {
        const countryCode = $(this).data('country-code');
        $('#searchInput').val(''); // Clear search
        hideSearchSuggestions();
        viewCountryDetails(countryCode);
    });
}

/**
 * Hide search suggestions dropdown
 */
function hideSearchSuggestions() {
    $('#searchSuggestions').hide();
}

/**
 * Enhanced search input handling with autocomplete
 */
function setupEnhancedSearch() {
    const $searchInput = $('#searchInput');
    const debouncedSearch = debounce(performSearch, 200); // Faster for autocomplete
    
    // Input event for live suggestions
    $searchInput.off('input').on('input', function() {
        const query = $(this).val().trim();
        debouncedSearch(query);
    });
    
    // Focus event
    $searchInput.off('focus').on('focus', function() {
        const query = $(this).val().trim();
        if (query) {
            showSearchSuggestions(query);
        }
    });
    
    // Blur event with delay to allow clicking suggestions
    $searchInput.off('blur').on('blur', function() {
        setTimeout(() => {
            hideSearchSuggestions();
        }, 200);
    });
    
    // Enter key to open search modal
    $searchInput.off('keypress').on('keypress', function(e) {
        if (e.which === 13) { // Enter key
            const query = $(this).val().trim();
            if (query && query.length >= 2) {
                hideSearchSuggestions();
                $('#searchModal').modal('show');
                performSearch(query);
            }
        }
    });
    
    // Escape key to hide suggestions
    $searchInput.off('keydown').on('keydown', function(e) {
        if (e.which === 27) { // Escape key
            hideSearchSuggestions();
        }
    });
}

/**
 * Display search results - FIXED FOR API RESPONSE STRUCTURE
 */
function displaySearchResults(results) {
    const $container = $('#searchResults');
    
    if (!results || results.length === 0) {
        $container.html('<p class="text-muted">No countries found</p>');
        return;
    }
    
    const resultsHtml = results.map(country => `
        <div class="search-result-item p-3 border-bottom" data-iso="${country.iso_code_2 || country.code}">
            <div class="d-flex align-items-center">
                <img src="${country.flag_png || country.flag || `https://flagcdn.com/w40/${(country.iso_code_2 || country.code || '').toLowerCase()}.png`}" 
                     alt="${country.name_common || country.name} flag" 
                     class="search-result-flag me-3" 
                     style="width: 40px; height: 30px; object-fit: cover; border-radius: 4px;">
                <div class="search-result-info flex-grow-1">
                    <div class="search-result-name fw-bold">${country.name_common || country.name}</div>
                    <div class="search-result-details text-muted small">
                        ${country.capital || 'N/A'} • ${country.region || 'N/A'}
                        ${country.population ? ` • ${formatNumber(country.population)}` : ''}
                    </div>
                </div>
                <div class="search-result-arrow">
                    <i class="text-muted">→</i>
                </div>
            </div>
        </div>
    `).join('');
    
    $container.html(resultsHtml);
    
    // Add click handlers to search results
    $('.search-result-item').off('click').on('click', function() {
        const isoCode = $(this).data('iso');
        $('#searchModal').modal('hide');
        viewCountryDetails(isoCode);
    });
    
    debugLog.success(`Displayed ${results.length} search results`);
}

/* ========================================================================== */
/* EVENT HANDLERS */
/* ========================================================================== */

/**
 * Set up all event handlers - UPDATED WITH ENHANCED SEARCH
 */
function setupEventHandlers() {
    debugLog.info('Setting up event handlers');
    
    // Country select dropdown
    $('#countrySelect').off('change').on('change', function() {
        const countryCode = $(this).val();
        if (countryCode) {
            viewCountryDetails(countryCode);
        }
    });
    debugLog.success('Country select handler attached');
    
    // Enhanced search functionality with autocomplete
    setupEnhancedSearch();
    
    // Search button for modal
    $('#searchBtn').off('click').on('click', function() {
        const query = $('#searchInput').val().trim();
        if (query) {
            hideSearchSuggestions();
            $('#searchModal').modal('show');
            performSearch(query);
        }
    });
    debugLog.success('Enhanced search with autocomplete attached');
    
    // FIXED: View on Map button functionality
    $('#viewOnMapBtn').off('click').on('click', function() {
        if (currentCountryData && currentCountryData.latitude && currentCountryData.longitude) {
            // Clear existing markers
            markersLayer.clearLayers();
            
            // Add marker for the country
            const marker = L.marker([currentCountryData.latitude, currentCountryData.longitude]).addTo(markersLayer);
            marker.bindPopup(`
                <strong>${currentCountryData.name_common}</strong><br>
                ${currentCountryData.capital ? `Capital: ${currentCountryData.capital}<br>` : ''}
                Coordinates: ${currentCountryData.latitude.toFixed(4)}, ${currentCountryData.longitude.toFixed(4)}
            `).openPopup();
            
            // Zoom to the country location
            map.setView([currentCountryData.latitude, currentCountryData.longitude], 6);
            
            // Close the modal
            $('#countryModal').modal('hide');
            
            debugLog.success(`Zoomed to ${currentCountryData.name_common} on map`);
            showToastNotification(`Showing ${currentCountryData.name_common} on map`, 'info');
        } else {
            debugLog.warning('No coordinates available for current country');
            showToastNotification('Location coordinates not available', 'error');
        }
    });
    
    debugLog.success('All event handlers set up');
}

/**
 * Set up accessibility features
 */
function setupAccessibility() {
    debugLog.info('Setting up accessibility features');
    
    // ARIA modal accessibility
    $('#countryModal, #searchModal').on('shown.bs.modal', function() {
        $(this).removeAttr('aria-hidden');
        $(this).find('.btn-close').blur();
    });
    
    $('#countryModal, #searchModal').on('hide.bs.modal', function() {
        if (document.activeElement) {
            document.activeElement.blur();
        }
    });
    
    debugLog.success('Accessibility features set up');
}

/**
 * Get user location
 */
function getUserLocation() {
    debugLog.info('Attempting to get user location');
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                
                debugLog.success(`User location: ${lat}, ${lng}`);
                
                // Add user location marker
                const userMarker = L.marker([lat, lng], {
                    icon: L.icon({
                        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
                        iconSize: [25, 41],
                        iconAnchor: [12, 41],
                        popupAnchor: [1, -34],
                        className: 'user-location-marker'
                    })
                }).addTo(markersLayer);
                
                userMarker.bindPopup('Your Location').openPopup();
                map.setView([lat, lng], 8);
                
                debugLog.success('User location marker added to map');
            },
            function(error) {
                debugLog.warning('Geolocation failed:', error.message);
            }
        );
    } else {
        debugLog.warning('Geolocation not supported');
    }
}

/* ========================================================================== */
/* APPLICATION INITIALIZATION */
/* ========================================================================== */

/* ========================================================================== */
/* INITIALIZATION AND CSS INJECTION */
/* ========================================================================== */

/**
 * Inject enhanced styling for better visibility and layout
 */
function injectSubtleLoadingStyles() {
    const styles = `
        <style id="subtle-loading-styles">
        /* Subtle loading indicators */
        .modal-title.loading::after {
            content: '';
            display: inline-block;
            width: 16px;
            height: 16px;
            margin-left: 10px;
            border: 2px solid #f3f3f3;
            border-top: 2px solid #007bff;
            border-radius: 50%;
            animation: subtle-spin 1s linear infinite;
            vertical-align: middle;
        }

        @keyframes subtle-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        /* Toast notifications */
        .alert.position-fixed {
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            border: none;
        }

        /* Search suggestions dropdown */
        .search-suggestions-dropdown {
            border: 1px solid #dee2e6 !important;
            border-top: none !important;
            border-radius: 0 0 0.375rem 0.375rem !important;
            background: white !important;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1) !important;
        }

        .search-suggestion-item {
            cursor: pointer;
            border-bottom: 1px solid #f8f9fa;
            transition: background-color 0.15s ease;
        }

        .search-suggestion-item:hover {
            background-color: #f8f9fa !important;
        }

        .search-suggestion-item:last-child {
            border-bottom: none;
        }

        /* Search container positioning */
        .search-container {
            position: relative;
        }

        /* Enhanced search input */
        .search-input:focus + .search-btn {
            border-color: #86b7fe;
        }

        /* Search result improvements */
        .search-result-item {
            cursor: pointer;
            transition: background-color 0.2s ease;
        }

        .search-result-item:hover {
            background-color: #f8f9fa;
        }

        /* WEATHER DISPLAY IMPROVEMENTS */
        .weather-container {
            color: #333 !important;
        }

        .weather-header {
            display: flex;
            align-items: center;
            gap: 1rem;
            margin-bottom: 1.5rem;
            padding: 1rem;
            background: linear-gradient(135deg, #e3f2fd, #f8f9fa);
            border-radius: 0.5rem;
            border: 1px solid #e0e0e0;
        }

        .weather-main .display-4 {
            color: #1976d2 !important;
            font-weight: 700;
            margin: 0;
            line-height: 1;
        }

        .weather-main .text-muted {
            color: #666 !important;
            font-size: 0.9rem;
        }

        .weather-desc .fs-5 {
            color: #333 !important;
            font-weight: 500;
            margin: 0;
        }

        .weather-details {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-top: 1rem;
        }

        .weather-detail {
            background: #f8f9fa;
            padding: 0.75rem;
            border-radius: 0.375rem;
            border: 1px solid #e9ecef;
            text-align: center;
            transition: transform 0.2s ease;
        }

        .weather-detail:hover {
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .weather-detail strong {
            color: #333 !important;
            font-size: 1.1rem;
            display: block;
            margin: 0.25rem 0;
        }

        .weather-detail .text-muted {
            color: #666 !important;
            font-size: 0.8rem;
        }

        .weather-detail i {
            font-style: normal;
            font-size: 1.3em;
            display: block;
            margin-bottom: 0.25rem;
        }

        /* CURRENCY STYLING IMPROVEMENTS */
        .currency-container {
            color: #333 !important;
        }

        .currency-info {
            background: #f8f9fa;
            padding: 1rem;
            border-radius: 0.5rem;
            border: 1px solid #e0e0e0;
            margin-bottom: 1.5rem;
        }

        .currency-info h6 {
            color: #333 !important;
            font-weight: 600;
            margin-bottom: 0.75rem;
        }

        .currency-item {
            color: #333 !important;
            padding: 0.5rem 0;
            border-bottom: 1px solid #e9ecef;
        }

        .currency-item:last-child {
            border-bottom: none;
        }

        .currency-item strong {
            color: #1976d2 !important;
        }

        .currency-item .text-muted {
            color: #666 !important;
        }

        .currency-converter {
            background: #ffffff;
            padding: 1rem;
            border-radius: 0.5rem;
            border: 1px solid #e0e0e0;
        }

        .currency-converter h6 {
            color: #333 !important;
            font-weight: 600;
            margin-bottom: 1rem;
        }

        /* CURRENCY DROPDOWN SIZING FIX */
        .currency-converter .form-select {
            min-width: 120px !important;
            width: auto !important;
            flex: 0 0 120px !important;
        }

        .currency-converter .input-group {
            display: flex !important;
            align-items: center !important;
        }

        .currency-converter .form-control {
            flex: 1 1 auto !important;
            min-width: 0 !important;
        }

        .rate-info {
            color: #666 !important;
            text-align: center;
            margin-top: 0.5rem;
        }

        /* LANGUAGE STYLING IMPROVEMENTS */
        .languages-container {
            color: #333 !important;
        }

        .languages-container h6 {
            color: #333 !important;
            font-weight: 600;
            margin-bottom: 1rem;
        }

        .language-item {
            background: #f8f9fa;
            padding: 0.75rem;
            border-radius: 0.375rem;
            border: 1px solid #e9ecef;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .language-item strong {
            color: #333 !important;
        }

        .language-item .text-muted {
            color: #666 !important;
        }

        .badge.bg-primary {
            background-color: #1976d2 !important;
        }

        /* MODAL TEXT IMPROVEMENTS */
        .modal-body {
            color: #333 !important;
        }

        .modal-body .text-muted {
            color: #666 !important;
        }

        .modal-body p {
            color: #333 !important;
        }

        /* INFO GRID IMPROVEMENTS */
        .info-card .info-value {
            color: #333 !important;
            font-weight: 600;
        }

        .info-card .info-label {
            color: #666 !important;
        }

        /* GENERAL TEXT CONTRAST FIXES */
        .text-danger {
            color: #dc3545 !important;
        }

        .text-success {
            color: #198754 !important;
        }

        .text-primary {
            color: #1976d2 !important;
        }
        </style>
    `;
    
    // Only inject if not already present
    if (!$('#subtle-loading-styles').length) {
        $('head').append(styles);
    }
}

/**
 * Initialize the application
 */
async function initializeApp() {
    if (appInitialized) {
        debugLog.warning('App already initialized, skipping');
        return;
    }
    
    try {
        debugLog.timing('Application Initialization');
        debugLog.info('Starting application initialization...');
        
        // Inject CSS styles for subtle loading
        injectSubtleLoadingStyles();
        
        // Initialize country service
        countryService = new CountryService();
        
        // Set up modal accessibility
        debugLog.info('Modal event listeners attached');
        $('#countryModal, #searchModal').on('shown.bs.modal', function() {
            $(this).removeAttr('aria-hidden');
        });
        debugLog.success('ARIA Modal Accessibility initialized');
        
        // Initialize map
        const mapInitialized = initializeMap();
        if (!mapInitialized) {
            throw new Error('Map initialization failed');
        }
        
        // Fetch initial data
        await fetchCountries();
        
        // Fetch exchange rates
        await fetchExchangeRates();
        
        // Set up event handlers
        setupEventHandlers();
        
        // Set up accessibility
        setupAccessibility();
        
        // Get user location
        getUserLocation();
        
        appInitialized = true;
        debugLog.timingEnd('Application Initialization');
        debugLog.success('🎉 Application initialized successfully!');
        
        // Hide loading spinner
        hideLoadingState();
        
    } catch (error) {
        debugLog.error('Application initialization failed:', error);
        showErrorState('Failed to initialize application. Please refresh the page.');
    }
}

/* ========================================================================== */
/* DOCUMENT READY */
/* ========================================================================== */

// Use jQuery if available, otherwise use vanilla JS
if (typeof $ !== 'undefined') {
    $(document).ready(function() {
        debugLog.info('jQuery ready event fired');
        
        // Clean up modals on show
        $('.modal').on('shown.bs.modal', function() {
            $(this).find('[aria-hidden="true"]').removeAttr('aria-hidden');
        });

        // Clean up on modal hide
        $('.modal').on('hide.bs.modal', function() {
            // Blur active element before hiding
            if (document.activeElement) {
                document.activeElement.blur();
                debugLog.info('jQuery: Blurred active element before modal hide');
            }
        });

        // Initialize app after jQuery is ready
        initializeApp();
    });
} else {
    // Vanilla JavaScript DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            debugLog.info('DOM ready event fired');
            initializeApp();
        });
    } else {
        debugLog.info('DOM already ready');
        initializeApp();
    }
}

/* ========================================================================== */
/* ERROR HANDLING AND DEBUGGING */
/* ========================================================================== */

// Global error handler
window.addEventListener('error', function(event) {
    debugLog.error('Global error caught:', event.error);
    
    // Don't show errors for missing icons (common and harmless)
    if (event.error && event.error.message && 
        event.error.message.includes('marker-icon')) {
        return;
    }
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', function(event) {
    debugLog.error('Unhandled promise rejection:', event.reason);
});

/* ========================================================================== */
/* APPLICATION METADATA */
/* ========================================================================== */

const APP_INFO = {
    name: 'Gazetteer - World Country Explorer',
    version: '1.0.0',
    author: 'IT Career Switch Student',
    description: 'Mobile-first responsive country information application with ARIA fixes',
    technologies: ['HTML5', 'CSS3', 'JavaScript', 'jQuery', 'Bootstrap', 'Leaflet.js'],
    features: [
        'Interactive world map with enhanced click handling',
        'Country search and discovery with debouncing',
        'Real-time weather data integration',
        'Currency converter with country-specific defaults',
        'ARIA accessibility compliance',
        'Robust coordinate data handling',
        'Local PHP API integration',
        'Mobile-responsive design',
        'Comprehensive error handling',
        'Development debugging utilities'
    ],
    fixes: [
        'Bootstrap modal ARIA accessibility issues resolved',
        'Country coordinate undefined errors fixed',
        'Leaflet marker icon 404 errors eliminated',
        'Focus management for screen readers',
        'Defensive API data parsing',
        'Reverse geocoding for accurate country detection'
    ]
};

debugLog.success('Gazetteer Application Loaded:', APP_INFO);

// Make functions globally accessible for HTML onclick events
window.viewCountryDetails = viewCountryDetails;
window.hideSearchSuggestions = hideSearchSuggestions;

// Export for testing (development only)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        formatNumber,
        formatCurrency,
        debounce,
        fetchCountries,
        fetchCountryDetails,
        viewCountryDetails,
        APP_CONFIG,
        APP_INFO
    };
}

// End of duplicate execution prevention
}
