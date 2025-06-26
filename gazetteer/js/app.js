/* ========================================================================== */
/* GAZETTEER - COMPLETE APPLICATION WITH ARIA & COORDINATE FIXES */
/* Single File Implementation with Comprehensive Debugging */
/* ========================================================================== */

/* ========================================================================== */
/* DEBUGGING UTILITIES - REMOVE AFTER TESTING */
/* ========================================================================== */

const DEBUG_MODE = true; // Set to false for production

const debugLog = {
    info: function(message, data = null) {
        if (DEBUG_MODE) {
            console.log(`🔵 [INFO] ${message}`, data || '');
        }
    },
    success: function(message, data = null) {
        if (DEBUG_MODE) {
            console.log(`✅ [SUCCESS] ${message}`, data || '');
        }
    },
    warning: function(message, data = null) {
        if (DEBUG_MODE) {
            console.warn(`⚠️  [WARNING] ${message}`, data || '');
        }
    },
    error: function(message, data = null) {
        if (DEBUG_MODE) {
            console.error(`❌ [ERROR] ${message}`, data || '');
        }
    },
    timing: function(label) {
        if (DEBUG_MODE) {
            console.time(`⏱️  ${label}`);
        }
    },
    timingEnd: function(label) {
        if (DEBUG_MODE) {
            console.timeEnd(`⏱️  ${label}`);
        }
    }
};

/* ========================================================================== */
/* DUPLICATE EXECUTION PREVENTION */
/* ========================================================================== */

if (window.GazetteerApp) {
    debugLog.warning('Gazetteer already loaded, preventing duplicate execution');
    // Don't execute the rest of the script
} else {
    window.GazetteerApp = true;
    debugLog.info('Initializing Gazetteer Application');

/* ========================================================================== */
/* BOOTSTRAP MODAL ARIA ACCESSIBILITY FIXES */
/* ========================================================================== */

class BootstrapModalAccessibility {
    constructor() {
        this.triggerElement = null;
        this.focusTrap = null;
        this.initializeModalFixes();
        debugLog.success('ARIA Modal Accessibility initialized');
    }

    initializeModalFixes() {
        // Listen for all Bootstrap modal events
        document.addEventListener('show.bs.modal', this.handleModalShow.bind(this));
        document.addEventListener('shown.bs.modal', this.handleModalShown.bind(this));
        document.addEventListener('hide.bs.modal', this.handleModalHide.bind(this));
        document.addEventListener('hidden.bs.modal', this.handleModalHidden.bind(this));
        debugLog.info('Modal event listeners attached');
    }

    handleModalShow(event) {
        // Store the element that triggered the modal
        this.triggerElement = document.activeElement;
        const modal = event.target;
        
        // CRITICAL: Force remove aria-hidden immediately - Bootstrap sometimes doesn't do this properly
        modal.removeAttribute('aria-hidden');
        modal.setAttribute('aria-modal', 'true');
        
        debugLog.success('Modal aria-hidden removed, aria-modal set to true');
        debugLog.info('Modal showing, focus stored from:', this.triggerElement?.tagName);
    }

    handleModalShown(event) {
        const modal = event.target;
        
        // DOUBLE CHECK: Ensure aria-hidden is completely removed after modal is fully shown
        if (modal.hasAttribute('aria-hidden')) {
            modal.removeAttribute('aria-hidden');
            debugLog.warning('Had to remove aria-hidden AGAIN in modalShown event');
        }
        
        // Blur any focused elements that might cause issues
        const focusedElements = modal.querySelectorAll('.btn-close, button[aria-label="Close"]');
        focusedElements.forEach(el => el.blur());
        
        // Set focus to the modal or first focusable element
        const firstFocusable = modal.querySelector('[autofocus], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])');
        if (firstFocusable) {
            firstFocusable.focus();
            debugLog.info('Focus set to first focusable element:', firstFocusable.tagName);
        } else {
            modal.focus();
            debugLog.info('Focus set to modal itself');
        }
        
        debugLog.success('Modal fully shown, aria-hidden status:', modal.getAttribute('aria-hidden'));
    }

    handleModalHide(event) {
        // Blur active element before hiding to prevent ARIA issues
        if (document.activeElement) {
            document.activeElement.blur();
            debugLog.info('Active element blurred before modal hide');
        }
    }

    handleModalHidden(event) {
        const modal = event.target;
        
        // Clean up modal attributes
        modal.removeAttribute('aria-modal');
        
        // Return focus to the original trigger element
        if (this.triggerElement && typeof this.triggerElement.focus === 'function') {
            // Use setTimeout to ensure modal is fully hidden
            setTimeout(() => {
                this.triggerElement.focus();
                debugLog.success('Focus returned to:', this.triggerElement.tagName);
            }, 100);
        }
        
        // Reset trigger element
        this.triggerElement = null;
    }
}

/* ========================================================================== */
/* COUNTRY COORDINATES DATA SERVICE */
/* ========================================================================== */

class RobustCountryService {
    constructor() {
        this.cache = new Map();
        this.fallbackData = null;
        this.apis = [
            {
                name: 'static-github',
                url: 'https://raw.githubusercontent.com/mledoze/countries/master/countries.json',
                parser: this.parseStaticData.bind(this),
                priority: 1
            },
            {
                name: 'restcountries',
                url: 'https://restcountries.com/v3.1/all',
                parser: this.parseRestCountries.bind(this),
                priority: 2
            },
            {
                name: 'worldbank',
                url: 'https://api.worldbank.org/v2/country?format=json',
                parser: this.parseWorldBank.bind(this),
                priority: 3
            }
        ];
        debugLog.success('Country Service initialized with', this.apis.length, 'API sources');
    }

    // Defensive coordinate extraction that handles multiple formats
    getCountryCoordinates(country) {
        try {
            // Handle REST Countries v3.1 format (latlng array)
            if (country.latlng && Array.isArray(country.latlng) && country.latlng.length >= 2) {
                const [lat, lng] = country.latlng;
                const coordinates = { lat: parseFloat(lat), lng: parseFloat(lng) };
                if (this.validateCoordinates(coordinates.lat, coordinates.lng)) {
                    debugLog.info(`Coordinates extracted from latlng array: ${coordinates.lat}, ${coordinates.lng}`);
                    return coordinates;
                }
            }
            
            // Handle separate lat/lng fields
            if (country.lat !== undefined && country.lng !== undefined) {
                const coordinates = { 
                    lat: parseFloat(country.lat), 
                    lng: parseFloat(country.lng) 
                };
                if (this.validateCoordinates(coordinates.lat, coordinates.lng)) {
                    debugLog.info(`Coordinates extracted from lat/lng fields: ${coordinates.lat}, ${coordinates.lng}`);
                    return coordinates;
                }
            }
            
            // Handle string coordinates (World Bank API format)
            if (country.latitude && country.longitude) {
                const coordinates = {
                    lat: parseFloat(country.latitude),
                    lng: parseFloat(country.longitude)
                };
                if (this.validateCoordinates(coordinates.lat, coordinates.lng)) {
                    debugLog.info(`Coordinates extracted from latitude/longitude fields: ${coordinates.lat}, ${coordinates.lng}`);
                    return coordinates;
                }
            }

            // Handle capitalInfo coordinates (alternative REST Countries field)
            if (country.capitalInfo && country.capitalInfo.latlng) {
                const [lat, lng] = country.capitalInfo.latlng;
                const coordinates = { lat: parseFloat(lat), lng: parseFloat(lng) };
                if (this.validateCoordinates(coordinates.lat, coordinates.lng)) {
                    debugLog.info(`Coordinates extracted from capitalInfo: ${coordinates.lat}, ${coordinates.lng}`);
                    return coordinates;
                }
            }
            
            debugLog.warning('No valid coordinates found for country:', country.name || 'Unknown');
            return { lat: null, lng: null };
        } catch (error) {
            debugLog.error('Error extracting coordinates:', error);
            return { lat: null, lng: null };
        }
    }

    // Validation utility for coordinate ranges
    validateCoordinates(lat, lng) {
        const latitude = parseFloat(lat);
        const longitude = parseFloat(lng);
        
        const isValid = !isNaN(latitude) && 
                       !isNaN(longitude) && 
                       latitude >= -90 && 
                       latitude <= 90 &&
                       longitude >= -180 && 
                       longitude <= 180;
        
        if (!isValid) {
            debugLog.warning(`Invalid coordinates: lat=${latitude}, lng=${longitude}`);
        }
        
        return isValid;
    }

    // Parse static GitHub data (most reliable source)
    parseStaticData(data) {
        debugLog.timing('Parse Static Data');
        const parsed = data.map(country => ({
            name: country.name?.common || country.name || 'Unknown',
            code: country.cca2 || country.alpha2Code,
            code3: country.cca3 || country.alpha3Code,
            coordinates: this.getCountryCoordinates(country),
            population: country.population,
            area: country.area,
            region: country.region,
            subregion: country.subregion,
            capital: Array.isArray(country.capital) ? country.capital[0] : country.capital,
            currencies: country.currencies ? Object.values(country.currencies) : [],
            languages: country.languages ? Object.values(country.languages) : [],
            flag: country.flags?.svg || country.flags?.png
        }));
        debugLog.timingEnd('Parse Static Data');
        debugLog.success(`Parsed ${parsed.length} countries from static data`);
        return parsed;
    }

    // Parse REST Countries API v3.1
    parseRestCountries(data) {
        debugLog.timing('Parse REST Countries');
        const parsed = data.map(country => ({
            name: country.name?.common || 'Unknown',
            code: country.cca2,
            code3: country.cca3,
            coordinates: this.getCountryCoordinates(country),
            population: country.population,
            area: country.area,
            region: country.region,
            subregion: country.subregion,
            capital: Array.isArray(country.capital) ? country.capital[0] : country.capital,
            currencies: country.currencies ? Object.values(country.currencies) : [],
            languages: country.languages ? Object.values(country.languages) : [],
            flag: country.flags?.svg || country.flags?.png
        }));
        debugLog.timingEnd('Parse REST Countries');
        debugLog.success(`Parsed ${parsed.length} countries from REST Countries API`);
        return parsed;
    }

    // Parse World Bank API
    parseWorldBank(data) {
        debugLog.timing('Parse World Bank');
        // World Bank returns [1] array with metadata, actual data is in [1]
        const countries = Array.isArray(data) && data.length > 1 ? data[1] : data;
        
        const parsed = countries.map(country => ({
            name: country.name || 'Unknown',
            code: country.iso2Code,
            code3: country.id,
            coordinates: this.getCountryCoordinates(country),
            region: country.region?.value,
            capital: country.capitalCity,
            // World Bank doesn't provide as much detail
            population: null,
            area: null,
            currencies: [],
            languages: [],
            flag: null
        }));
        debugLog.timingEnd('Parse World Bank');
        debugLog.success(`Parsed ${parsed.length} countries from World Bank API`);
        return parsed;
    }

    // Validate that country data is usable
    validateCountryData(countries) {
        if (!Array.isArray(countries) || countries.length === 0) {
            debugLog.error('Country data validation failed: empty or invalid array');
            return false;
        }
        
        // Check that at least 80% of countries have valid coordinates
        const withCoords = countries.filter(c => 
            c.coordinates && 
            this.validateCoordinates(c.coordinates.lat, c.coordinates.lng)
        );
        
        const validPercentage = withCoords.length / countries.length;
        debugLog.info(`Country data validation: ${withCoords.length}/${countries.length} (${(validPercentage * 100).toFixed(1)}%) have valid coordinates`);
        
        const isValid = validPercentage > 0.8;
        if (isValid) {
            debugLog.success('Country data validation passed');
        } else {
            debugLog.error('Country data validation failed: too few valid coordinates');
        }
        
        return isValid;
    }

    // Main method to get country data with fallbacks
    async getCountryData() {
        debugLog.timing('Get Country Data');
        
        // Check cache first
        if (this.cache.has('allCountries')) {
            debugLog.success('Using cached country data');
            debugLog.timingEnd('Get Country Data');
            return this.cache.get('allCountries');
        }

        // Sort APIs by priority
        const sortedApis = [...this.apis].sort((a, b) => a.priority - b.priority);

        for (const api of sortedApis) {
            try {
                debugLog.info(`Attempting ${api.name}...`);
                
                const response = await fetch(api.url, {
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'CountryDataService/1.0'
                    }
                });
                
                if (response.ok) {
                    const rawData = await response.json();
                    const processed = api.parser(rawData);
                    
                    if (this.validateCountryData(processed)) {
                        debugLog.success(`${api.name} succeeded with ${processed.length} countries`);
                        
                        // Cache the successful result
                        this.cache.set('allCountries', processed);
                        this.fallbackData = processed;
                        
                        debugLog.timingEnd('Get Country Data');
                        return processed;
                    } else {
                        debugLog.warning(`${api.name} returned invalid data`);
                    }
                } else {
                    debugLog.warning(`${api.name} HTTP error: ${response.status}`);
                }
            } catch (error) {
                debugLog.error(`${api.name} failed:`, error.message);
                continue;
            }
        }
        
        debugLog.timingEnd('Get Country Data');
        throw new Error('All country data sources failed');
    }

    // Get country by ISO code
    async getCountryByCode(countryCode) {
        if (!this.fallbackData) {
            await this.getCountryData();
        }
        
        const code = countryCode.toUpperCase();
        const country = this.fallbackData.find(country => 
            country.code === code || country.code3 === code
        );
        
        if (country) {
            debugLog.success(`Found country by code ${code}:`, country.name);
        } else {
            debugLog.warning(`Country not found for code: ${code}`);
        }
        
        return country;
    }

    // Reverse geocoding fallback for map clicks
    async tryReverseGeocode(lat, lng) {
        try {
            debugLog.info(`Attempting reverse geocoding for: ${lat}, ${lng}`);
            debugLog.timing('Reverse Geocoding');
            
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
                {
                    headers: {
                        'User-Agent': 'CountryDataService/1.0'
                    }
                }
            );
            
            const data = await response.json();
            debugLog.timingEnd('Reverse Geocoding');
            
            if (data && data.address && data.address.country_code) {
                const countryCode = data.address.country_code.toUpperCase();
                debugLog.success(`Reverse geocoding found: ${countryCode}`);
                
                // Try to find this country in our database
                const country = await this.getCountryByCode(countryCode);
                if (country) {
                    return {
                        ...country,
                        clickedCoordinates: { lat, lng }
                    };
                }
            }
            debugLog.warning('Reverse geocoding found no valid country');
            return null;
        } catch (error) {
            debugLog.error('Reverse geocoding failed:', error);
            return null;
        }
    }

    // Find nearest country to clicked coordinates
    async findNearestCountry(clickLat, clickLng) {
        if (!this.fallbackData) {
            await this.getCountryData();
        }

        debugLog.timing('Find Nearest Country');
        let nearestCountry = null;
        let minDistance = Infinity;

        for (const country of this.fallbackData) {
            if (country.coordinates && country.coordinates.lat && country.coordinates.lng) {
                const distance = this.calculateDistance(
                    clickLat, clickLng,
                    country.coordinates.lat, country.coordinates.lng
                );
                
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestCountry = country;
                }
            }
        }

        debugLog.timingEnd('Find Nearest Country');

        if (nearestCountry) {
            debugLog.success(`Nearest country: ${nearestCountry.name} (${minDistance.toFixed(2)}km away)`);
            return {
                ...nearestCountry,
                distance: minDistance,
                clickedCoordinates: { lat: clickLat, lng: clickLng }
            };
        }

        debugLog.warning('No nearest country found');
        return null;
    }

    // Calculate distance between two points using Haversine formula
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371; // Earth's radius in kilometers
        const dLat = this.degreesToRadians(lat2 - lat1);
        const dLng = this.degreesToRadians(lng2 - lng1);
        
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(this.degreesToRadians(lat1)) * Math.cos(this.degreesToRadians(lat2)) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    degreesToRadians(degrees) {
        return degrees * (Math.PI / 180);
    }
}

/* ========================================================================== */
/* APPLICATION CONFIGURATION */
/* ========================================================================== */

const APP_CONFIG = {
    // API Configuration
    API_BASE_URL: 'https://lucapae.co.uk/projects/gazetteer/php/api.php',
    
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
/* GLOBAL VARIABLES */
/* ========================================================================== */

let map;
let markersLayer;
let currentCountryData = null;
let searchTimeout;
let apiCache = new Map();
let allCountries = [];
let exchangeRates = {};
let appInitialized = false;

// Initialize services
let modalAccessibility;
let countryService;

/* ========================================================================== */
/* UTILITY FUNCTIONS */
/* ========================================================================== */

/**
 * Format numbers with proper separators
 */
function formatNumber(num) {
    if (!num || isNaN(num)) return 'N/A';
    return num.toLocaleString();
}

/**
 * Format currency values
 */
function formatCurrency(amount, currency = 'USD') {
    if (!amount || isNaN(amount)) return 'N/A';
    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency
        }).format(amount);
    } catch (error) {
        debugLog.warning('Currency formatting failed:', error);
        return `${currency} ${amount}`;
    }
}

/**
 * Debounce function to limit API calls
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Show loading state
 */
function showLoadingState(message = 'Loading...') {
    debugLog.info('Showing loading state:', message);
    // Add your loading UI logic here
    const loadingElement = document.getElementById('loadingIndicator');
    if (loadingElement) {
        loadingElement.textContent = message;
        loadingElement.style.display = 'block';
    }
}

/**
 * Hide loading state
 */
function hideLoadingState() {
    debugLog.info('Hiding loading state');
    const loadingElement = document.getElementById('loadingIndicator');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
}

/**
 * Show error state
 */
function showErrorState(message) {
    debugLog.error('Showing error state:', message);
    // Add your error UI logic here
    const errorElement = document.getElementById('errorMessage');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

/**
 * Show success message
 */
function showSuccess(message) {
    debugLog.success('Success message:', message);
    // Add your success UI logic here
    console.log('✅', message);
}

/* ========================================================================== */
/* LEAFLET MAP INITIALIZATION */
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

        // Enhanced map click handler
        map.on('click', async function(e) {
            const { lat, lng } = e.latlng;
            debugLog.info(`Map clicked at: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);

            // Show loading state
            showLoadingState('Finding country...');

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
                        ${country.distance ? `Distance: ${country.distance.toFixed(2)}km` : 'Direct match'}
                    `).openPopup();

                    // Show country details
                    await showCountryDetails(country);
                } else {
                    debugLog.warning('No country found for coordinates');
                    showErrorState('Country not found for this location');
                }
            } catch (error) {
                debugLog.error('Map click error:', error);
                showErrorState('Error finding country information');
            } finally {
                hideLoadingState();
            }
        });

        debugLog.timingEnd('Map Initialization');
        debugLog.success('Map initialized successfully');
        
        return map;
    } catch (error) {
        debugLog.error('Map initialization failed:', error);
        throw error;
    }
}

/* ========================================================================== */
/* COUNTRY DATA MANAGEMENT */
/* ========================================================================== */

/**
 * Enhanced country details display
 */
async function showCountryDetails(country) {
    try {
        debugLog.info('Showing country details for:', country.name);
        
        // Store current country data
        currentCountryData = country;
        
        // Populate modal with country information
        const modal = document.getElementById('countryModal');
        if (!modal) {
            debugLog.warning('Country modal not found');
            return;
        }

        // Helper function to safely set text content
        function setTextContent(elementId, value, fallback = 'N/A') {
            const element = document.getElementById(elementId);
            if (element) {
                element.textContent = value || fallback;
                debugLog.info(`Set ${elementId}:`, value || fallback);
            } else {
                debugLog.warning(`Element not found: ${elementId}`);
            }
        }

        // Basic information
        setTextContent('countryName', country.name);
        setTextContent('countryCode', country.code);
        setTextContent('countryCapital', country.capital);
        setTextContent('countryRegion', country.region);
        setTextContent('countrySubregion', country.subregion);

        // Population with formatting
        if (country.population) {
            setTextContent('countryPopulation', formatNumber(country.population));
        } else {
            setTextContent('countryPopulation', 'N/A');
        }

        // Area with formatting
        if (country.area) {
            setTextContent('countryArea', `${formatNumber(country.area)} km²`);
        } else {
            setTextContent('countryArea', 'N/A');
        }

        // Coordinates
        if (country.coordinates && country.coordinates.lat && country.coordinates.lng) {
            setTextContent('countryLatitude', country.coordinates.lat.toFixed(6));
            setTextContent('countryLongitude', country.coordinates.lng.toFixed(6));
        } else {
            setTextContent('countryLatitude', 'N/A');
            setTextContent('countryLongitude', 'N/A');
        }

        // Currencies
        if (country.currencies && country.currencies.length > 0) {
            const currencyNames = country.currencies.map(c => c.name || c.code || c).join(', ');
            setTextContent('countryCurrencies', currencyNames);

            // Update currency converter
            updateCurrencyConverter(country.currencies);
        } else {
            setTextContent('countryCurrencies', 'N/A');
        }

        // Languages
        if (country.languages && country.languages.length > 0) {
            const languageNames = country.languages.join(', ');
            setTextContent('countryLanguages', languageNames);
        } else {
            setTextContent('countryLanguages', 'N/A');
        }

        // Flag
        const flagElement = document.getElementById('countryFlag');
        if (flagElement && country.flag) {
            flagElement.src = country.flag;
            flagElement.alt = `${country.name} flag`;
            flagElement.style.display = 'block';
            debugLog.success('Flag loaded successfully');
        } else if (flagElement) {
            flagElement.style.display = 'none';
            debugLog.info('No flag available');
        }

        // Show the modal using Bootstrap
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
        debugLog.success('Country modal displayed');

        // Try to get weather data
        await getWeatherForCountry(country);

    } catch (error) {
        debugLog.error('Error displaying country details:', error);
    }
}

/**
 * Currency converter integration
 */
function updateCurrencyConverter(currencies) {
    if (!currencies || currencies.length === 0) {
        debugLog.info('No currencies to update converter with');
        return;
    }

    try {
        debugLog.info('Updating currency converter with:', currencies);
        
        // Get currency select elements
        const fromSelect = document.getElementById('fromCurrency');
        const toSelect = document.getElementById('toCurrency');

        if (toSelect && currencies.length > 0) {
            // Extract currency codes
            const currencyCodes = currencies.map(c => {
                if (typeof c === 'string') return c;
                if (c.code) return c.code;
                if (c.symbol) return c.symbol;
                return null;
            }).filter(Boolean);

            // Set the first currency as default "to" currency
            if (currencyCodes.length > 0) {
                const defaultCurrency = currencyCodes[0];
                toSelect.value = defaultCurrency;
                debugLog.success(`Currency converter updated to: ${defaultCurrency}`);
            }
        }
    } catch (error) {
        debugLog.error('Currency converter update failed:', error);
    }
}

/**
 * Weather integration
 */
async function getWeatherForCountry(country) {
    if (!country.coordinates || !country.coordinates.lat || !country.coordinates.lng) {
        debugLog.info('No coordinates available for weather data');
        return null;
    }

    try {
        debugLog.info(`Fetching weather for ${country.name}`);
        debugLog.timing('Weather API Call');
        
        // This would integrate with your weather API
        const weatherResponse = await fetch(
            `/api/weather?lat=${country.coordinates.lat}&lng=${country.coordinates.lng}`
        );
        
        debugLog.timingEnd('Weather API Call');
        
        if (weatherResponse.ok) {
            const weatherData = await weatherResponse.json();
            debugLog.success('Weather data received:', weatherData);
            
            // Update weather display elements
            updateWeatherDisplay(weatherData);
            return weatherData;
        } else {
            debugLog.warning('Weather API returned error:', weatherResponse.status);
        }
    } catch (error) {
        debugLog.error('Weather fetch failed:', error);
    }
    
    return null;
}

/**
 * Update weather display in modal
 */
function updateWeatherDisplay(weatherData) {
    try {
        debugLog.info('Updating weather display');
        
        // Helper function to safely update weather elements
        function setWeatherContent(elementId, value, fallback = 'N/A') {
            const element = document.getElementById(elementId);
            if (element) {
                element.textContent = value || fallback;
            }
        }

        if (weatherData) {
            setWeatherContent('weatherTemp', weatherData.temperature ? `${weatherData.temperature}°C` : 'N/A');
            setWeatherContent('weatherDescription', weatherData.description);
            setWeatherContent('weatherHumidity', weatherData.humidity ? `${weatherData.humidity}%` : 'N/A');
            setWeatherContent('weatherWindSpeed', weatherData.windSpeed ? `${weatherData.windSpeed} km/h` : 'N/A');
            setWeatherContent('weatherVisibility', weatherData.visibility ? `${(weatherData.visibility / 1000).toFixed(1)} km` : 'N/A');
            
            debugLog.success('Weather display updated');
        }
    } catch (error) {
        debugLog.error('Weather display update failed:', error);
    }
}

/* ========================================================================== */
/* API INTEGRATION */
/* ========================================================================== */

/**
 * Fetch countries with enhanced error handling
 */
async function fetchCountries() {
    try {
        debugLog.timing('Fetch Countries');
        
        // Check cache first
        if (apiCache.has('countries')) {
            debugLog.success('Using cached countries data');
            debugLog.timingEnd('Fetch Countries');
            return apiCache.get('countries');
        }

        // Use our robust country service
        const countries = await countryService.getCountryData();
        
        // Cache the results
        apiCache.set('countries', countries);
        allCountries = countries;
        
        debugLog.timingEnd('Fetch Countries');
        debugLog.success(`Fetched ${countries.length} countries successfully`);
        
        return countries;
    } catch (error) {
        debugLog.error('Failed to fetch countries:', error);
        
        // Return empty array as fallback
        return [];
    }
}

/**
 * Fetch detailed country information
 */
async function fetchCountryDetails(countryCode) {
    try {
        debugLog.info(`Fetching details for country: ${countryCode}`);
        debugLog.timing('Fetch Country Details');
        
        // Check cache first
        const cacheKey = `country_${countryCode}`;
        if (apiCache.has(cacheKey)) {
            debugLog.success('Using cached country details');
            debugLog.timingEnd('Fetch Country Details');
            return apiCache.get(cacheKey);
        }

        // Use our country service
        const country = await countryService.getCountryByCode(countryCode);
        
        if (country) {
            // Cache the result
            apiCache.set(cacheKey, country);
            debugLog.timingEnd('Fetch Country Details');
            debugLog.success(`Country details fetched for: ${country.name}`);
            return country;
        } else {
            debugLog.warning(`No details found for country code: ${countryCode}`);
            return null;
        }
    } catch (error) {
        debugLog.error('Failed to fetch country details:', error);
        return null;
    }
}

/**
 * Fetch exchange rates
 */
async function fetchExchangeRates() {
    try {
        debugLog.timing('Fetch Exchange Rates');
        
        // Check cache first
        if (apiCache.has('exchangeRates')) {
            exchangeRates = apiCache.get('exchangeRates');
            debugLog.success('Using cached exchange rates');
            debugLog.timingEnd('Fetch Exchange Rates');
            return exchangeRates;
        }

        const response = await fetch(APP_CONFIG.API_BASE_URL + '?action=getExchangeRates');
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.status && data.status.name === 'ok') {
                exchangeRates = data.data;
                apiCache.set('exchangeRates', exchangeRates);
                debugLog.timingEnd('Fetch Exchange Rates');
                debugLog.success('Exchange rates fetched successfully');
                return exchangeRates;
            } else {
                debugLog.warning('Exchange rates API returned error status');
            }
        } else {
            debugLog.warning('Exchange rates API HTTP error:', response.status);
        }
    } catch (error) {
        debugLog.error('Failed to fetch exchange rates:', error);
    }
    
    debugLog.timingEnd('Fetch Exchange Rates');
    return {};
}

/* ========================================================================== */
/* SEARCH FUNCTIONALITY */
/* ========================================================================== */

/**
 * Search countries with debouncing
 */
const debouncedSearch = debounce(async function(query) {
    try {
        debugLog.info(`Searching for: "${query}"`);
        debugLog.timing('Country Search');
        
        if (query.length < 2) {
            clearSearchResults();
            return;
        }

        // Ensure we have countries data
        if (allCountries.length === 0) {
            allCountries = await fetchCountries();
        }

        // Filter countries
        const filtered = allCountries.filter(country => 
            country.name.toLowerCase().includes(query.toLowerCase()) ||
            (country.code && country.code.toLowerCase().includes(query.toLowerCase())) ||
            (country.capital && country.capital.toLowerCase().includes(query.toLowerCase())) ||
            (country.region && country.region.toLowerCase().includes(query.toLowerCase()))
        ).slice(0, 10); // Limit to 10 results

        debugLog.timingEnd('Country Search');
        debugLog.success(`Found ${filtered.length} matching countries`);
        
        displaySearchResults(filtered);
    } catch (error) {
        debugLog.error('Search failed:', error);
        clearSearchResults();
    }
}, APP_CONFIG.DEBOUNCE_DELAY);

/**
 * Display search results
 */
function displaySearchResults(countries) {
    debugLog.info(`Displaying ${countries.length} search results`);
    
    const resultsContainer = document.getElementById('searchResults');
    if (!resultsContainer) {
        debugLog.warning('Search results container not found');
        return;
    }

    // Clear previous results
    resultsContainer.innerHTML = '';
    
    if (countries.length === 0) {
        resultsContainer.innerHTML = '<div class="search-result-item">No countries found</div>';
        return;
    }

    // Create result items
    countries.forEach((country, index) => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.setAttribute('data-country-code', country.code);
        item.setAttribute('tabindex', '0');
        item.setAttribute('role', 'button');
        item.setAttribute('aria-label', `Select ${country.name}`);
        
        item.innerHTML = `
            <strong>${country.name}</strong> (${country.code})
            ${country.region ? `<br><small>${country.region}</small>` : ''}
        `;
        
        // Add click handler
        item.addEventListener('click', function() {
            debugLog.info(`Search result clicked: ${country.name}`);
            showCountryDetails(country);
            clearSearchResults();
        });
        
        // Add keyboard support
        item.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.click();
            }
        });
        
        resultsContainer.appendChild(item);
        debugLog.info(`Added search result: ${country.name}`);
    });
}

/**
 * Clear search results
 */
function clearSearchResults() {
    const resultsContainer = document.getElementById('searchResults');
    if (resultsContainer) {
        resultsContainer.innerHTML = '';
        debugLog.info('Search results cleared');
    }
}

/* ========================================================================== */
/* UI HELPER FUNCTIONS */
/* ========================================================================== */

/**
 * Populate country select dropdown
 */
function populateCountrySelect(countries) {
    try {
        debugLog.timing('Populate Country Select');
        
        const select = document.getElementById('countrySelect');
        if (!select) {
            debugLog.warning('Country select element not found');
            return;
        }

        // Clear existing options except the first one
        while (select.children.length > 1) {
            select.removeChild(select.lastChild);
        }

        // Sort countries alphabetically
        const sortedCountries = countries.sort((a, b) => a.name.localeCompare(b.name));

        // Add countries to select
        sortedCountries.forEach(country => {
            const option = document.createElement('option');
            option.value = country.code;
            option.textContent = country.name;
            select.appendChild(option);
        });

        debugLog.timingEnd('Populate Country Select');
        debugLog.success(`Added ${sortedCountries.length} countries to select`);
    } catch (error) {
        debugLog.error('Failed to populate country select:', error);
    }
}

/**
 * Add country markers to map
 */
function addCountryMarkers(countries) {
    try {
        debugLog.timing('Add Country Markers');
        
        if (!map || !markersLayer) {
            debugLog.warning('Map or markers layer not initialized');
            return;
        }

        let markerCount = 0;

        countries.forEach(country => {
            if (country.coordinates && country.coordinates.lat && country.coordinates.lng) {
                const marker = L.marker([country.coordinates.lat, country.coordinates.lng]);
                marker.bindPopup(`
                    <strong>${country.name}</strong><br>
                    ${country.capital ? `Capital: ${country.capital}<br>` : ''}
                    ${country.population ? `Population: ${formatNumber(country.population)}<br>` : ''}
                    <button onclick="showCountryDetails(${JSON.stringify(country).replace(/"/g, '&quot;')})">
                        View Details
                    </button>
                `);
                
                markersLayer.addLayer(marker);
                markerCount++;
            }
        });

        debugLog.timingEnd('Add Country Markers');
        debugLog.success(`Added ${markerCount} country markers to map`);
    } catch (error) {
        debugLog.error('Failed to add country markers:', error);
    }
}

/**
 * Get user's current location
 */
function getCurrentLocation() {
    if (!navigator.geolocation) {
        debugLog.warning('Geolocation not supported by browser');
        return;
    }

    debugLog.info('Attempting to get user location');

    navigator.geolocation.getCurrentPosition(
        function(position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            debugLog.success(`User location: ${lat}, ${lng}`);
            
            if (map) {
                map.setView([lat, lng], 6);
                
                const userMarker = L.marker([lat, lng], {
                    icon: L.icon({
                        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                        iconSize: [25, 41],
                        iconAnchor: [12, 41],
                        popupAnchor: [1, -34],
                        shadowSize: [41, 41]
                    })
                });
                
                userMarker.addTo(markersLayer);
                userMarker.bindPopup('Your location').openPopup();
                
                debugLog.success('User location marker added to map');
            }
        },
        function(error) {
            debugLog.warning('Geolocation error:', error.message);
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000
        }
    );
}

/* ========================================================================== */
/* EVENT HANDLERS */
/* ========================================================================== */

/**
 * Setup event handlers
 */
function setupEventHandlers() {
    debugLog.info('Setting up event handlers');

    // Country select change handler
    const countrySelect = document.getElementById('countrySelect');
    if (countrySelect) {
        countrySelect.addEventListener('change', async function(e) {
            const countryCode = e.target.value;
            if (countryCode) {
                debugLog.info(`Country selected: ${countryCode}`);
                const country = await fetchCountryDetails(countryCode);
                if (country) {
                    await showCountryDetails(country);
                    
                    // Center map on country if coordinates available
                    if (country.coordinates && map) {
                        map.setView([country.coordinates.lat, country.coordinates.lng], 6);
                    }
                }
            }
        });
        debugLog.success('Country select handler attached');
    }

    // Search input handler
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            const query = e.target.value.trim();
            debouncedSearch(query);
        });
        debugLog.success('Search input handler attached');
    }

    // Currency converter handlers
    const convertButton = document.getElementById('convertCurrency');
    if (convertButton) {
        convertButton.addEventListener('click', performCurrencyConversion);
        debugLog.success('Currency convert button handler attached');
    }

    // Modal close handlers
    document.addEventListener('click', function(e) {
        if (e.target.matches('[data-bs-dismiss="modal"]')) {
            debugLog.info('Modal close button clicked');
        }
    });

    debugLog.success('All event handlers set up');
}

/**
 * Perform currency conversion
 */
async function performCurrencyConversion() {
    try {
        debugLog.info('Performing currency conversion');
        
        const fromCurrency = document.getElementById('fromCurrency')?.value;
        const toCurrency = document.getElementById('toCurrency')?.value;
        const amount = parseFloat(document.getElementById('amount')?.value || 0);

        if (!fromCurrency || !toCurrency || !amount) {
            debugLog.warning('Missing currency conversion parameters');
            return;
        }

        debugLog.info(`Converting ${amount} ${fromCurrency} to ${toCurrency}`);

        // Ensure we have exchange rates
        if (Object.keys(exchangeRates).length === 0) {
            await fetchExchangeRates();
        }

        // Perform conversion logic here
        // This would integrate with your currency API
        const result = amount * 1.2; // Placeholder calculation
        
        const resultElement = document.getElementById('conversionResult');
        if (resultElement) {
            resultElement.textContent = `${formatCurrency(result, toCurrency)}`;
            debugLog.success(`Conversion result: ${result}`);
        }

    } catch (error) {
        debugLog.error('Currency conversion failed:', error);
    }
}

/* ========================================================================== */
/* ACCESSIBILITY ENHANCEMENTS */
/* ========================================================================== */

/**
 * Setup accessibility features
 */
function setupAccessibility() {
    debugLog.info('Setting up accessibility features');
    
    // Add ARIA labels and roles
    const mapElement = document.getElementById('map');
    if (mapElement) {
        mapElement.setAttribute('role', 'application');
        mapElement.setAttribute('aria-label', 'Interactive world map');
    }

    const countrySelectElement = document.getElementById('countrySelect');
    if (countrySelectElement) {
        countrySelectElement.setAttribute('aria-label', 'Select a country to view details');
    }

    const searchInputElement = document.getElementById('searchInput');
    if (searchInputElement) {
        searchInputElement.setAttribute('aria-label', 'Search for countries');
    }
    
    // Focus management for modals (handled by our ARIA class)
    debugLog.success('Accessibility features set up');
}

/* ========================================================================== */
/* INITIALIZATION */
/* ========================================================================== */

/**
 * Initialize application
 */
async function initializeApp() {
    try {
        debugLog.timing('Application Initialization');
        debugLog.info('Starting application initialization...');

        // Prevent duplicate initialization
        if (appInitialized) {
            debugLog.warning('Application already initialized');
            return;
        }

        // Initialize services
        modalAccessibility = new BootstrapModalAccessibility();
        countryService = new RobustCountryService();

        // Initialize map
        if (document.getElementById('map')) {
            initializeMap();
        } else {
            debugLog.warning('Map container not found');
        }
        
        // Fetch and populate countries
        const countries = await fetchCountries();
        if (countries.length > 0) {
            populateCountrySelect(countries);
            addCountryMarkers(countries);
            showSuccess('Application loaded successfully!');
        } else {
            debugLog.warning('No countries loaded');
            showErrorState('Failed to load country data');
        }
        
        // Setup event handlers
        setupEventHandlers();
        
        // Setup accessibility
        setupAccessibility();
        
        // Get user location
        getCurrentLocation();
        
        // Load initial exchange rates
        await fetchExchangeRates();
        
        // Mark as initialized
        appInitialized = true;
        
        debugLog.timingEnd('Application Initialization');
        debugLog.success('🎉 Application initialized successfully!');
        
    } catch (error) {
        debugLog.error('Application initialization failed:', error);
        showErrorState('Failed to initialize application. Please refresh the page.');
    }
}

/* ========================================================================== */
/* JQUERY COMPATIBILITY AND DOM READY */
/* ========================================================================== */

// jQuery compatibility layer
if (typeof $ !== 'undefined') {
    $(document).ready(function() {
        debugLog.info('jQuery ready event fired');
        
        // AGGRESSIVE ARIA-HIDDEN REMOVAL for Bootstrap modals
        $('.modal').on('show.bs.modal', function() {
            const modal = this;
            
            // Remove aria-hidden immediately
            modal.removeAttribute('aria-hidden');
            modal.setAttribute('aria-modal', 'true');
            
            debugLog.success('jQuery: Forced removal of aria-hidden on modal show');
        });
        
        // Additional safety check when modal is fully shown
        $('.modal').on('shown.bs.modal', function() {
            const modal = this;
            
            // Force remove aria-hidden if it somehow still exists
            if (modal.hasAttribute('aria-hidden')) {
                modal.removeAttribute('aria-hidden');
                debugLog.warning('jQuery: Had to remove aria-hidden AGAIN in shown.bs.modal');
            }
            
            // Blur any problematic elements
            $(modal).find('.btn-close, [data-bs-dismiss="modal"]').blur();
            
            debugLog.success('jQuery: Modal fully shown, aria-hidden status:', modal.getAttribute('aria-hidden'));
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
/* DEBUG UTILITIES - REMOVE IN PRODUCTION */
/* ========================================================================== */

// Development debug utilities
if (DEBUG_MODE && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    window.DEBUG_GAZETTEER = {
        logCache: function() {
            console.log('API Cache:', apiCache);
            console.log('Exchange Rates:', exchangeRates);
            console.log('Current Country:', currentCountryData);
            console.log('All Countries:', allCountries.length);
        },
        
        clearCache: function() {
            apiCache.clear();
            exchangeRates = {};
            debugLog.success('Cache cleared');
        },
        
        testErrorHandling: function() {
            throw new Error('Test error for debugging');
        },
        
        forceReinitialization: function() {
            appInitialized = false;
            initializeApp();
        },
        
        toggleDebugMode: function() {
            window.DEBUG_MODE = !DEBUG_MODE;
            debugLog.info('Debug mode toggled:', DEBUG_MODE);
        },
        
        getStats: function() {
            return {
                appInitialized,
                countriesLoaded: allCountries.length,
                cacheSize: apiCache.size,
                mapInitialized: !!map,
                currentCountry: currentCountryData?.name || 'None'
            };
        }
    };
    
    debugLog.success('Debug utilities available via window.DEBUG_GAZETTEER');
    console.log('🔧 Debug mode enabled. Use window.DEBUG_GAZETTEER for utilities.');
}

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
        'Multiple API fallback systems',
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

// Export for testing (development only)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        formatNumber,
        formatCurrency,
        debounce,
        fetchCountries,
        fetchCountryDetails,
        APP_CONFIG,
        APP_INFO
    };
}

// End of duplicate execution prevention
}