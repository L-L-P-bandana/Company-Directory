/* ========================================================================== */
/* GAZETTEER JS
/* ========================================================================== */

// Prevent multiple executions
if (typeof window.gazeteerAppLoaded === 'undefined') {
window.gazeteerAppLoaded = true;

/* APP CONFIG */
const APP_CONFIG = {
    API_BASE_URL: 'php/api.php',
    ENDPOINTS: {
        COUNTRIES: 'countries',
        COUNTRY_DETAIL: 'country',
        SEARCH: 'search',
        WEATHER: 'weather',
        EXCHANGE_RATES: 'rates'
    },
    MAP_DEFAULT_VIEW: [20, 0],
    MAP_DEFAULT_ZOOM: 2,
    MAP_MAX_ZOOM: 18,
    MAP_MIN_ZOOM: 1,
    TILE_LAYER: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    TILE_ATTRIBUTION: '© OpenStreetMap contributors',
    SEARCH_DELAY: 300,
    CACHE_DURATION: 300000,
    DEBOUNCE_DELAY: 250,
    MOBILE_BREAKPOINT: 768,
    MODAL_ANIMATION_SPEED: 300
};

/* DEBUG UTILITIES (where used in troubleshooting, left here as reference but I can remove if needed) */
const log = {
    info: (msg, data = '') => console.log(`🔵 ${msg}`, data),
    success: (msg, data = '') => console.log(`✅ ${msg}`, data),
    warning: (msg, data = '') => console.log(`⚠️ ${msg}`, data),
    error: (msg, data = '') => console.log(`❌ ${msg}`, data),
    time: (label) => console.time(`⏱️ ${label}`),
    timeEnd: (label) => console.timeEnd(`⏱️ ${label}`)
};

/* GLOBAL VARIABLES */
let map, markersLayer, currentCountryData = null, searchTimeout;
let apiCache = new Map(), allCountries = [], exchangeRates = {};
let appInitialized = false, countryService;
let countryBordersLayer = null;
let highlightedCountryLayer = null;
let countryBordersData = null;

// Make functions globally accessible for HTML onclick events
window.viewCountryDetails = viewCountryDetails;

/* UTILITY FUNCTIONS */
function formatNumber(num) {
    if (!num) return 'N/A';
    return parseInt(num).toLocaleString();
}

function formatCurrency(amount, currency = 'USD') {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency
    }).format(amount);
}

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

/* LOADING STATE MANAGEMENT */
function toggleLoading(show, subtle = false, message = 'Loading...') {
    if (show) {
        if (subtle) {
            $('body').css('cursor', 'wait');
            $('.modal-title').addClass('loading');
        } else {
            $('#loadingSpinner').show();
            $('.loading-text').text(message);
        }
    } else {
        $('#loadingSpinner, #preloader, .loading-spinner').hide().fadeOut(300);
        $('body').css('cursor', 'default');
        $('.modal-title').removeClass('loading');
        $('#preloader, #loadingSpinner').css('display', 'none');
    }
}

function showSubtleLoading() { toggleLoading(true, true); }
function hideSubtleLoading() { toggleLoading(false, true); }
function hideLoadingState() { 
    log.info('Hiding loading state');
    toggleLoading(false);
    log.success('Loading hidden');
}

function showErrorState(message) {
    log.error('Error state:', message);
    hideLoadingState();
    $('#loadingSpinner').html(`
        <div class="error-state">
            <h4>Error</h4>
            <p>${message}</p>
            <button class="btn btn-primary" onclick="location.reload()">Retry</button>
        </div>
    `).show();
}

/* COUNTRY SERVICE */
class CountryService {
    constructor() {
        this.baseUrl = APP_CONFIG.API_BASE_URL;
        this.countries = [];
        this.cache = new Map();
        log.success('Country Service initialized');
    }

    // API call methodology
    async apiCall(endpoint, errorMsg = 'API call failed') {
        try {
            const response = await fetch(`${this.baseUrl}?request=${endpoint}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            
            const result = await response.json();
            if (result.status === 'success') return result;
            throw new Error(result.error || errorMsg);
        } catch (error) {
            log.error(errorMsg, error);
            throw error;
        }
    }

    async getCountryData() {
        log.time('Get Country Data');
        try {
            const result = await this.apiCall(APP_CONFIG.ENDPOINTS.COUNTRIES, 'Failed to fetch countries');
            const countries = result.data.map(country => ({
                name: country.name_common,
                code: country.iso_code_2,
                code3: country.iso_code_3,
                capital: country.capital,
                population: country.population,
                region: country.region,
                subregion: country.subregion,
                flag: country.flag_png,
                coordinates: { lat: null, lng: null }
            }));
            
            log.success(`Loaded ${result.count} countries`);
            log.timeEnd('Get Country Data');
            return countries;
        } catch (error) {
            log.timeEnd('Get Country Data');
            throw error;
        }
    }

    async getCountryDetails(countryCode) {
        const result = await this.apiCall(`${APP_CONFIG.ENDPOINTS.COUNTRY_DETAIL}/${countryCode}`, `Failed to get details for ${countryCode}`);
        return result.data;
    }

    async searchCountries(query) {
        const result = await this.apiCall(`${APP_CONFIG.ENDPOINTS.SEARCH}/${encodeURIComponent(query)}`, `Search failed for "${query}"`);
        return result.data;
    }

    async getWeatherData(countryCode) {
        const result = await this.apiCall(`${APP_CONFIG.ENDPOINTS.WEATHER}/${countryCode}`, `Failed to get weather for ${countryCode}`);
        return result.data;
    }

    async getExchangeRates(baseCurrency = 'USD') {
        const result = await this.apiCall(`${APP_CONFIG.ENDPOINTS.EXCHANGE_RATES}/${baseCurrency}`, `Failed to get exchange rates for ${baseCurrency}`);
        return result.rates;
    }

    async fetchCountries() {
        log.info('Fetching countries from API...');
        this.countries = await this.getCountryData();
        return this.countries;
    }

    async getCountryByCode(countryCode) {
        if (!this.countries || this.countries.length === 0) {
            await this.fetchCountries();
        }
        
        const code = countryCode.toUpperCase();
        const country = this.countries.find(country => 
            country.code === code || country.code3 === code
        );
        
        if (country) log.success(`Found country: ${country.name}`);
        else log.warning(`Country not found: ${code}`);
        
        return country;
    }

    // Reverse geocoding for map clicks
    async tryReverseGeocode(lat, lng) {
        try {
            log.info(`Reverse geocoding: ${lat}, ${lng}`);
            const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
            
            if (response.ok) {
                const data = await response.json();
                const countryCode = data.countryCode;
                
                if (countryCode) {
                    const country = await this.getCountryByCode(countryCode);
                    if (country) {
                        log.success(`Reverse geocoding found: ${country.name}`);
                        return country;
                    }
                }
            }
            
            log.warning('Reverse geocoding failed');
            return null;
        } catch (error) {
            log.error('Reverse geocoding error:', error);
            return null;
        }
    }

    async findNearestCountry(lat, lng) {
        if (!this.countries || this.countries.length === 0) {
            await this.fetchCountries();
        }
        
        log.info('Using fallback nearest country detection');
        return this.countries.length > 0 ? this.countries[0] : null;
    }
}

async function loadCountryBorders() {
    try {
        log.info('Loading country borders...');
        
        const response = await fetch('data/countryBorders.geo.json');
        if (!response.ok) {
            throw new Error(`Failed to load borders: ${response.status}`);
        }
        
        countryBordersData = await response.json();
        
        countryBordersLayer = L.geoJSON(countryBordersData, {
            style: {
                fillColor: 'transparent',
                weight: 0,
                opacity: 0,
                fillOpacity: 0
            }
        });
        
        log.success('Country borders loaded successfully');
        return true;
    } catch (error) {
        log.error('Failed to load country borders:', error);
        return false;
    }
}

function highlightCountryBorder(countryCode) {
    try {
        console.log('Trying to highlight country:', countryCode);
        
        if (highlightedCountryLayer) {
            map.removeLayer(highlightedCountryLayer);
            highlightedCountryLayer = null;
        }
        
        if (!countryBordersData || !countryCode) {
            console.log('No border data or country code');
            return;
        }
        
        console.log('Looking in', countryBordersData.features.length, 'features');
        
        // First tries exact ISO code matches
        let countryFeature = countryBordersData.features.find(feature => {
            const props = feature.properties;
            
            return props['ISO3166-1-Alpha-2'] === countryCode || 
                   props['ISO3166-1-Alpha-3'] === countryCode ||
                   props['ISO3166-1-Alpha-2'] === countryCode.toUpperCase() ||
                   props['ISO3166-1-Alpha-3'] === countryCode.toUpperCase();
        });
        
        // Fallbacks for the countries that I couldn't grab bu ISO 
        if (!countryFeature) {
            const countryNames = {
                'FR': 'France',
                'FRA': 'France',
                'NO': 'Norway',
                'NOR': 'Norway'
            };
            
            const targetName = countryNames[countryCode.toUpperCase()];
            
            if (targetName) {
                countryFeature = countryBordersData.features.find(feature => 
                    feature.properties.name === targetName
                );
                
                if (countryFeature) {
                    console.log(`Found ${targetName} by name fallback (broken ISO codes)`);
                }
            }
        }
        
        if (!countryFeature) {
            console.log(`No border found for country: ${countryCode}`);
            return;
        }
        
        console.log('Found feature:', countryFeature.properties);
        
        highlightedCountryLayer = L.geoJSON(countryFeature, {
            style: {
                fillColor: '#3498db',
                weight: 3,
                opacity: 0.8,
                color: '#2980b9',
                fillOpacity: 0.2,
                className: 'highlighted-country-border'
            }
        }).addTo(map);
        
        setTimeout(() => {
            if (highlightedCountryLayer && highlightedCountryLayer._path) {
                highlightedCountryLayer._path.classList.add('country-border-highlight');
                console.log('Added highlight class');
            }
        }, 100);
        
        log.success(`Highlighted border for ${countryCode}`);
        
    } catch (error) {
        console.error('Failed to highlight country border:', error);
    }
}

/* MAP FUNCTIONS */
function initializeMap() {
    try {
        log.time('Map Init');
        
        // Fix Leaflet icon paths
        if (typeof L !== 'undefined') {
            delete L.Icon.Default.prototype._getIconUrl;
            L.Icon.Default.mergeOptions({
                iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
                iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            });
            log.success('Leaflet icons fixed');
        }

        // Create map
        map = L.map('map').setView(APP_CONFIG.MAP_DEFAULT_VIEW, APP_CONFIG.MAP_DEFAULT_ZOOM);
        
        L.tileLayer(APP_CONFIG.TILE_LAYER, {
            attribution: APP_CONFIG.TILE_ATTRIBUTION,
            maxZoom: APP_CONFIG.MAP_MAX_ZOOM,
            minZoom: APP_CONFIG.MAP_MIN_ZOOM
        }).addTo(map);

        markersLayer = L.layerGroup().addTo(map);

        // Map click handler
        map.on('click', async function(e) {
            const { lat, lng } = e.latlng;
            log.info(`Map clicked: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);

            showSubtleLoading();

            try {
                // Try reverse geocoding first, fallback to nearest
                let country = await countryService.tryReverseGeocode(lat, lng);
                if (!country) country = await countryService.findNearestCountry(lat, lng);

                if (country) {
                    markersLayer.clearLayers();
                    
                    const marker = L.marker([lat, lng]).addTo(markersLayer);
                    marker.bindPopup(`
                        <strong>${country.name}</strong><br>
                        Clicked: ${lat.toFixed(4)}, ${lng.toFixed(4)}<br>
                        <button class="btn btn-sm btn-primary" onclick="viewCountryDetails('${country.code}')">
                            View Details
                        </button>
                    `).openPopup();

                    highlightCountryBorder(country.code);

                    await viewCountryDetails(country.code);
                } else {
                    log.warning('No country found for clicked location');
                    showToast('No country found at this location', 'info');
                }
            } catch (error) {
                log.error('Map click failed:', error);
                showToast('Failed to identify country', 'error');
            } finally {
                hideSubtleLoading();
            }
        });

        log.timeEnd('Map Init');
        log.success('Map initialized');
        return true;
    } catch (error) {
        log.error('Map init failed:', error);
        showErrorState('Map failed to initialize. Please refresh.');
        return false;
    }
}

/* API FUNCTIONS */
async function fetchCountries() {
    try {
        log.time('Fetch Countries');
        const countries = await countryService.fetchCountries();
        
        if (countries && countries.length > 0) {
            allCountries = countries;
            populateCountrySelect(countries);
            log.timeEnd('Fetch Countries');
            log.success(`Loaded ${countries.length} countries`);
            return countries;
        } else {
            throw new Error('No countries returned');
        }
    } catch (error) {
        log.error('Failed to fetch countries:', error);
        log.timeEnd('Fetch Countries');
        throw new Error('Failed to load country data');
    }
}

async function fetchCountryDetails(isoCode) {
    try {
        log.time('Fetch Country Details');
        
        // Check cache
        const cacheKey = `country_${isoCode}`;
        if (apiCache.has(cacheKey)) {
            log.success('Using cached country details');
            log.timeEnd('Fetch Country Details');
            return apiCache.get(cacheKey);
        }

        const response = await fetch(`${APP_CONFIG.API_BASE_URL}?request=${APP_CONFIG.ENDPOINTS.COUNTRY_DETAIL}/${isoCode}`);
        
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        
        const result = await response.json();
        
        if (result.status === 'success' && result.data) {
            apiCache.set(cacheKey, result);
            log.timeEnd('Fetch Country Details');
            log.success(`Country details fetched: ${result.data.basic_info?.name_common}`);
            return result;
        } else {
            log.warning(`No details found: ${isoCode}`);
            return null;
        }
    } catch (error) {
        log.error('Failed to fetch country details:', error);
        log.timeEnd('Fetch Country Details');
        return null;
    }
}

async function fetchExchangeRates(baseCurrency = 'USD') {
    try {
        log.time('Fetch Exchange Rates');
        
        const cacheKey = `rates_${baseCurrency}`;
        if (apiCache.has(cacheKey)) {
            exchangeRates = apiCache.get(cacheKey);
            log.success('Using cached exchange rates');
            log.timeEnd('Fetch Exchange Rates');
            return exchangeRates;
        }

        const rates = await countryService.getExchangeRates(baseCurrency);
        
        if (rates) {
            exchangeRates = rates;
            apiCache.set(cacheKey, rates);
            log.timeEnd('Fetch Exchange Rates');
            log.success('Exchange rates fetched');
            return rates;
        } else {
            log.warning('Exchange rates API error');
            log.timeEnd('Fetch Exchange Rates');
            return {};
        }
    } catch (error) {
        log.error('Failed to fetch exchange rates:', error);
        log.timeEnd('Fetch Exchange Rates');
        return {};
    }
}

/* UI FUNCTIONS */
function populateCountrySelect(countries) {
    const $select = $('#countrySelect');
    $select.empty().append('<option value="">Select a country...</option>');
    
    countries.forEach(country => {
        $select.append(`<option value="${country.code}">${country.name}</option>`);
    });
}

async function viewCountryDetails(countryCode) {
    try {
        showSubtleLoading();
        
        const countryResponse = await fetchCountryDetails(countryCode);
        
        if (!countryResponse || !countryResponse.data) {
            throw new Error('Country details not found');
        }
        
        // Extract API response structure
        const countryData = countryResponse.data;
        const basicInfo = countryData.basic_info || {};
        const geography = countryData.geography || {};
        const flags = countryData.flags || {};
        const weather = countryData.weather || {};
        const currencies = countryData.currencies || [];
        const languages = countryData.languages || [];
        
        // Store flattened data for compatibility
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
        
        // Populate the modal
        $('#countryName').text(basicInfo.name_common || 'Unknown');
        $('#countryCode').text(basicInfo.iso_code_2 || '');
        
        const flagUrl = flags.png || flags.svg || `https://flagcdn.com/w320/${(basicInfo.iso_code_2 || '').toLowerCase()}.png`;
        $('#countryFlag').attr('src', flagUrl).attr('alt', `${basicInfo.name_common} flag`);
        
        // Overview tab
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
        
        // Wikipedia links
        const countryName = basicInfo.name_common || basicInfo.name_official || 'Unknown';
        const wikipediaCountryUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(countryName.replace(/ /g, '_'))}`;
        const capitalName = basicInfo.capital;
        const wikipediaCapitalUrl = capitalName ? `https://en.wikipedia.org/wiki/${encodeURIComponent(capitalName.replace(/ /g, '_'))}` : null;

        $('#countryWikipedia').html(`
            <a href="${wikipediaCountryUrl}" target="_blank" rel="noopener noreferrer" class="wikipedia-link">
                📖 ${countryName}
            </a>
            ${wikipediaCapitalUrl ? `<br><a href="${wikipediaCapitalUrl}" target="_blank" rel="noopener noreferrer" class="wikipedia-link capital-wiki">📍 ${capitalName}</a>` : ''}
        `);
        
        // Populate data immediately
        populateWeatherData(weather);
        populateLanguageData(languages);
        
        hideSubtleLoading();
        $('#countryModal').modal('show');
        
        // Load currency data in background
        loadCurrencyDataQuietly(currentCountryData);
        
    } catch (error) {
        log.error('Failed to load country details:', error);
        hideSubtleLoading();
        showToast('Failed to load country details', 'error');
    }
}

function populateWeatherData(weather) {
    try {
        if (weather && weather.temperature !== null && weather.temperature !== undefined) {
            const temp = Math.round(weather.temperature);
            const feelsLike = Math.round(weather.feels_like);
            
            // Main weather display
            $('#weatherTemp').html(`
                <span class="display-4 fw-bold text-primary">${temp}°C</span>
                <small class="text-muted d-block">Feels like ${feelsLike}°C</small>
            `);
            
            const description = weather.description || 'N/A';
            $('#weatherDesc').html(`
                <span class="fs-5 text-capitalize">${description}</span>
                ${weather.condition ? `<br><small class="text-muted">${weather.condition}</small>` : ''}
            `);
            
            // Weather icon
            if (weather.icon) {
                $('#weatherIcon').attr('src', `https://openweathermap.org/img/w/${weather.icon}.png`)
                    .attr('alt', description)
                    .css({
                        'width': '64px',
                        'height': '64px',
                        'filter': 'drop-shadow(2px 2px 4px rgba(0,0,0,0.3))'
                    }).show();
            } else {
                $('#weatherIcon').hide();
            }
            
            // Weather details
            const weatherDetails = [
                { id: 'weatherFeelsLike', icon: '🌡️', value: `${feelsLike}°C`, label: 'Feels Like' },
                { id: 'weatherHumidity', icon: '💧', value: `${weather.humidity}%`, label: 'Humidity' },
                { id: 'weatherPressure', icon: '📊', value: weather.pressure, label: 'Pressure (hPa)' },
                { id: 'weatherWindSpeed', icon: '💨', value: `${weather.wind_speed} m/s`, label: 'Wind Speed' }
            ];
            
            weatherDetails.forEach(detail => {
                $(`#${detail.id}`).html(`
                    <i>${detail.icon}</i>
                    <strong>${detail.value}</strong>
                    <small class="text-muted d-block">${detail.label}</small>
                `);
            });
            
            // Wind direction handling - needed to distinguish null from valid 0° readings as this was preventing capture 
            const windDir = weather.wind_direction;
            let windDirectionText = 'N/A';
            let windDegreeText = 'Direction';
            
            // Check for actual values vs null - 0° is valid (North direction)
            if (windDir !== null && windDir !== undefined) {
                const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
                const index = Math.round(windDir / 22.5) % 16;
                windDirectionText = directions[index];
                windDegreeText = `${windDir}°`;
            }
            
            $('#weatherWindDir').html(`
                <i>🧭</i>
                <strong>${windDirectionText}</strong>
                <small class="text-muted d-block">${windDegreeText}</small>
            `);
            
            // Visibility handling - convert to readable format and handle nulls properly
            const visibility = weather.visibility;
            let visibilityText = 'N/A';
            
            // Check for actual values - 0m visibility being valid
            if (visibility !== null && visibility !== undefined) {
                // Convert meters to kilometers
                if (visibility >= 1000) {
                    visibilityText = `${(visibility / 1000).toFixed(1)} km`;
                } else {
                    visibilityText = `${visibility} m`;
                }
            }
            
            $('#weatherVisibility').html(`
                <i>👁️</i>
                <strong>${visibilityText}</strong>
                <small class="text-muted d-block">Visibility</small>
            `);
            
            log.success('Weather data populated');
        } else {
            // No weather data
            $('#weatherTemp').html(`
                <span class="text-muted text-center d-block">
                    <i class="fs-1 d-block mb-2">🌍</i>
                    <span class="fs-5">Weather data not available</span>
                </span>
            `);
            $('#weatherDesc').html('<span class="text-muted">No weather information</span>');
            
            const noDataHtml = `<i class="text-muted">❓</i><strong class="text-muted">N/A</strong><small class="text-muted d-block">No Data</small>`;
            ['weatherFeelsLike', 'weatherHumidity', 'weatherPressure', 'weatherWindSpeed', 'weatherWindDir', 'weatherVisibility'].forEach(id => {
                $(`#${id}`).html(noDataHtml);
            });
            $('#weatherIcon').hide();
            
            log.warning('No weather data available');
        }
    } catch (error) {
        log.error('Failed to populate weather data:', error);
        $('#weatherTemp').html('<span class="text-danger">Error loading weather</span>');
        $('#weatherDesc').html('<span class="text-danger">Weather data unavailable</span>');
    }
}

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
                            <div>${isOfficial}</div>
                        </div>
                    </div>
                `;
            });
            log.success(`Populated ${languages.length} languages`);
        } else {
            languagesHtml = '<p class="text-muted mb-0">Language information not available</p>';
            log.warning('No language data available');
        }
        
        $('#languagesList').html(languagesHtml);
    } catch (error) {
        log.error('Failed to populate language data:', error);
        $('#languagesList').html('<p class="text-danger">Language data unavailable</p>');
    }
}

async function loadCurrencyDataQuietly(countryData) {
    try {
        // Display country currency info
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
            log.success(`Populated ${countryData.currencies.length} currencies`);
        } else {
            currencyHtml = '<p class="text-muted mb-0">Currency information not available</p>';
        }
        $('#currencyDetails').html(currencyHtml);
        
        // Load exchange rates
        await fetchExchangeRates();
        
        // Populate currency selectors
        const $fromSelect = $('#fromCurrency');
        const $toSelect = $('#toCurrency');
        
        $fromSelect.empty();
        $toSelect.empty();
        
        // Common currencies
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
        
        // Add country's currencies first
        if (countryData.currencies && countryData.currencies.length > 0) {
            countryData.currencies.forEach(currency => {
                $fromSelect.append(`<option value="${currency.code}">${currency.code} - ${currency.name}</option>`);
                $toSelect.append(`<option value="${currency.code}">${currency.code} - ${currency.name}</option>`);
            });
            
            $fromSelect.append('<option disabled>──────────</option>');
            $toSelect.append('<option disabled>──────────</option>');
        }
        
        // Add common currencies
        commonCurrencies.forEach(currency => {
            $fromSelect.append(`<option value="${currency.code}">${currency.code} - ${currency.name}</option>`);
            $toSelect.append(`<option value="${currency.code}">${currency.code} - ${currency.name}</option>`);
        });
        
        // Add other available currencies
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
        
        // Set smart defaults (always reset when viewing new country)
        const countryCurrencies = countryData.currencies || [];
        let defaultFromCurrency = 'USD';
        let defaultToCurrency = 'EUR';
        
        if (countryCurrencies.length > 0) {
            defaultFromCurrency = countryCurrencies[0].code;
            defaultToCurrency = countryCurrencies[0].code !== 'USD' ? 'USD' : 'EUR';
        }
        
        // Reset converter to new country's currency with amount 1
        $('#fromAmount').val('1');
        $('#toAmount').val('');
        $fromSelect.val(defaultFromCurrency);
        $toSelect.val(defaultToCurrency);
        
        setupCurrencyConverter();
        
        // Trigger initial conversion calculation for the new country
        $('#fromAmount').trigger('input');
        
        log.success('Currency data loaded and converter reset');
        
    } catch (error) {
        log.error('Failed to load currency data:', error);
        $('#currencyDetails').html('<p class="text-danger">Currency data unavailable</p>');
    }
}

function showToast(message, type = 'info') {
    const toastId = 'toast-' + Date.now();
    const toastClass = type === 'error' ? 'alert-danger' : 'alert-info';
    
    const toastHtml = `
        <div id="${toastId}" class="alert ${toastClass} alert-dismissible fade show position-fixed toast-notification-positioned">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    $('body').append(toastHtml);
    
    setTimeout(() => {
        $(`#${toastId}`).fadeOut(() => $(`#${toastId}`).remove());
    }, 3000);
}

function setupCurrencyConverter() {
    $('#fromAmount, #fromCurrency, #toCurrency').off('input change').on('input change', function() {
        const fromAmount = parseFloat($('#fromAmount').val()) || 0;
        const fromCurrency = $('#fromCurrency').val();
        const toCurrency = $('#toCurrency').val();
        
        if (fromAmount && fromCurrency && toCurrency && exchangeRates) {
            let convertedAmount, rate;
            
            // If same currency, return 1:1 ratio
            if (fromCurrency === toCurrency) {
                convertedAmount = fromAmount;
                rate = 1;
            } 
            // If fromCurrency is USD (base currency)
            else if (fromCurrency === 'USD') {
                rate = exchangeRates[toCurrency] || 1;
                convertedAmount = fromAmount * rate;
            }
            // If toCurrency is USD (converting TO base currency)
            else if (toCurrency === 'USD') {
                const fromRate = exchangeRates[fromCurrency] || 1;
                rate = 1 / fromRate;
                convertedAmount = fromAmount * rate;
            }
            // Cross-currency conversion (neither is USD)
            else {
                const fromRate = exchangeRates[fromCurrency] || 1;
                const toRate = exchangeRates[toCurrency] || 1;
                // Convert from -> USD -> to
                rate = toRate / fromRate;
                convertedAmount = fromAmount * rate;
            }
            
            $('#toAmount').val(convertedAmount.toFixed(2));
            $('#rateInfo').html(`<small class="text-muted">1 ${fromCurrency} = ${rate.toFixed(4)} ${toCurrency}</small>`);
        }
    });
    
    $('#swapCurrencies').off('click').on('click', function() {
        const fromCurrency = $('#fromCurrency').val();
        const toCurrency = $('#toCurrency').val();
        const fromAmount = $('#fromAmount').val();
        const toAmount = $('#toAmount').val();
        
        // Swap the currencies
        $('#fromCurrency').val(toCurrency);
        $('#toCurrency').val(fromCurrency);
        
        // Swap the amounts too for better UX
        $('#fromAmount').val(toAmount);
        
        // Recalculate with new values
        $('#fromAmount').trigger('input');
    });
}

/* SEARCH FUNCTIONS */
async function performSearch(query) {
    if (!query || query.length < 1) {
        hideSearchSuggestions();
        return;
    }
    
    try {
        if (query.length >= 2) {
            const results = await countryService.searchCountries(query);
            displaySearchResults(results);
        }
        
        showSearchSuggestions(query);
        
    } catch (error) {
        log.error('Search failed:', error);
        $('#searchResults').html('<p class="text-danger">Search failed. Please try again.</p>');
    }
}

function showSearchSuggestions(query) {
    if (!query || query.length < 1) {
        hideSearchSuggestions();
        return;
    }
    
    const suggestions = allCountries.filter(country => 
        country.name.toLowerCase().includes(query.toLowerCase()) ||
        (country.capital && country.capital.toLowerCase().includes(query.toLowerCase())) ||
        country.code.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 8);
    
    if (suggestions.length === 0) {
        hideSearchSuggestions();
        return;
    }
    
    const suggestionsHtml = suggestions.map(country => `
        <div class="search-suggestion-item p-2" data-country-code="${country.code}">
            <div class="d-flex align-items-center">
                <img src="${country.flag}" alt="${country.name} flag" class="me-2 search-suggestion-flag">
                <div class="flex-grow-1">
                    <div class="fw-bold small">${country.name}</div>
                    <div class="text-muted" style="font-size: 0.75rem;">${country.capital || 'N/A'} • ${country.region}</div>
                </div>
                <small class="text-muted">${country.code}</small>
            </div>
        </div>
    `).join('');
    
    let $dropdown = $('#searchSuggestions');
    if ($dropdown.length === 0) {
        $dropdown = $(`<div id="searchSuggestions" class="search-suggestions-dropdown position-absolute bg-white border rounded shadow-sm search-suggestions-dropdown-positioned"></div>`);
        $('.search-container').css('position', 'relative').append($dropdown);
    }
    
    $dropdown.html(suggestionsHtml).show();
    
    $('.search-suggestion-item').off('click').on('click', function() {
        const countryCode = $(this).data('country-code');
        $('#searchInput').val('');
        hideSearchSuggestions();
        viewCountryDetails(countryCode);
    });
}

function hideSearchSuggestions() {
    $('#searchSuggestions').hide();
}

function setupEnhancedSearch() {
    const $searchInput = $('#searchInput');
    const debouncedSearch = debounce(performSearch, 200);
    
    $searchInput.off('input focus blur keypress keydown').on({
        'input': function() {
            const query = $(this).val().trim();
            debouncedSearch(query);
        },
        'focus': function() {
            const query = $(this).val().trim();
            if (query) showSearchSuggestions(query);
        },
        'blur': function() {
            setTimeout(() => hideSearchSuggestions(), 200);
        },
        'keypress': function(e) {
            if (e.which === 13) { // Enter
                const query = $(this).val().trim();
                if (query && query.length >= 2) {
                    hideSearchSuggestions();
                    $('#searchModal').modal('show');
                    performSearch(query);
                }
            }
        },
        'keydown': function(e) {
            if (e.which === 27) hideSearchSuggestions(); // Escape
        }
    });
}

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
                     class="search-result-flag me-3 search-result-flag-image">
                <div class="search-result-info flex-grow-1">
                    <div class="search-result-name fw-bold">${country.name_common || country.name}</div>
                    <div class="search-result-details text-muted small">
                        ${country.capital || 'N/A'} • ${country.region || 'N/A'}
                        ${country.population ? ` • ${formatNumber(country.population)}` : ''}
                    </div>
                </div>
                <div class="search-result-arrow"><i class="text-muted">→</i></div>
            </div>
        </div>
    `).join('');
    
    $container.html(resultsHtml);
    
    $('.search-result-item').off('click').on('click', function() {
        const isoCode = $(this).data('iso');
        $('#searchModal').modal('hide');
        viewCountryDetails(isoCode);
    });
    
    log.success(`Displayed ${results.length} search results`);
}

/* EVENT HANDLERS */
function setupEventHandlers() {
    log.info('Setting up event handlers');
    
    // Country select dropdown
    $('#countrySelect').off('change').on('change', function() {
        const countryCode = $(this).val();
        if (countryCode) viewCountryDetails(countryCode);
    });
    
    // Enhanced search
    setupEnhancedSearch();
    
    // Search button
    $('#searchBtn').off('click').on('click', function() {
        const query = $('#searchInput').val().trim();
        if (query) {
            hideSearchSuggestions();
            $('#searchModal').modal('show');
            performSearch(query);
        }
    });
    
    // View on map button
    $('#viewOnMapBtn').off('click').on('click', function() {
        if (currentCountryData && currentCountryData.latitude && currentCountryData.longitude) {
            markersLayer.clearLayers();
            
            const marker = L.marker([currentCountryData.latitude, currentCountryData.longitude]).addTo(markersLayer);
            marker.bindPopup(`
                <strong>${currentCountryData.name_common}</strong><br>
                ${currentCountryData.capital ? `Capital: ${currentCountryData.capital}<br>` : ''}
                Coordinates: ${currentCountryData.latitude.toFixed(4)}, ${currentCountryData.longitude.toFixed(4)}
            `).openPopup();
            
            map.setView([currentCountryData.latitude, currentCountryData.longitude], 6);
            $('#countryModal').modal('hide');
            
            log.success(`Zoomed to ${currentCountryData.name_common} on map`);
            showToast(`Showing ${currentCountryData.name_common} on map`, 'info');
        } else {
            log.warning('No coordinates available');
            showToast('Location coordinates not available', 'error');
        }
    });
    
    log.success('Event handlers set up');
}

function setupAccessibility() {
    log.info('Setting up accessibility');
    
    $('.modal').on('shown.bs.modal', function() {
        $(this).removeAttr('aria-hidden');
        $(this).find('.btn-close').blur();
    });
    
    $('.modal').on('hide.bs.modal', function() {
        if (document.activeElement) document.activeElement.blur();
    });
    
    log.success('Accessibility set up');
}

function getUserLocation() {
    log.info('Getting user location');
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                
                log.success(`User location: ${lat}, ${lng}`);
                
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
                
                log.success('User location marker added');
            },
            function(error) {
                log.warning('Geolocation failed:', error.message);
            }
        );
    } else {
        log.warning('Geolocation not supported');
    }
}

/* APP INITIALIZATION */
async function initializeApp() {
    if (appInitialized) {
        log.warning('App already initialized');
        return;
    }
    
    try {
        log.time('App Init');
        log.info('Starting app initialization...');
        
        countryService = new CountryService();
        
        // Modal accessibility
        $('.modal').on('shown.bs.modal', function() {
            $(this).removeAttr('aria-hidden');
        });
        
        const mapInitialized = initializeMap();
        if (!mapInitialized) throw new Error('Map initialization failed');
        
        await loadCountryBorders();
        
        await fetchCountries();
        await fetchExchangeRates();
        
        setupEventHandlers();
        setupAccessibility();
        getUserLocation();
        
        appInitialized = true;
        log.timeEnd('App Init');
        log.success('🎉 App initialized successfully!');
        
        hideLoadingState();
        
    } catch (error) {
        log.error('App initialization failed:', error);
        showErrorState('Failed to initialize application. Please refresh.');
    }
}

/* DOCUMENT READY */
if (typeof $ !== 'undefined') {
    $(document).ready(function() {
        log.info('jQuery ready');
        
        $('.modal').on('shown.bs.modal', function() {
            $(this).find('[aria-hidden="true"]').removeAttr('aria-hidden');
        });

        $('.modal').on('hide.bs.modal', function() {
            if (document.activeElement) {
                document.activeElement.blur();
                log.info('Blurred active element');
            }
        });

        initializeApp();
    });
} else {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            log.info('DOM ready');
            initializeApp();
        });
    } else {
        log.info('DOM already ready');
        initializeApp();
    }
}

/* ERROR HANDLING */
window.addEventListener('error', function(event) {
    log.error('Global error:', event.error);
    
    // Skip icon errors
    if (event.error && event.error.message && 
        event.error.message.includes('marker-icon')) {
        return;
    }
});

window.addEventListener('unhandledrejection', function(event) {
    log.error('Unhandled promise rejection:', event.reason);
});

/* APP METADATA */
const APP_INFO = {
    name: 'Gazetteer - World Country Explorer',
    version: '1.0.0',
    description: 'Mobile-first country information app',
    technologies: ['HTML5', 'CSS3', 'JavaScript', 'jQuery', 'Bootstrap', 'Leaflet.js'],
    features: [
        'Interactive world map',
        'Country search and discovery',
        'Real-time weather data',
        'Currency converter',
        'ARIA accessibility',
        'Local PHP API integration',
        'Mobile-responsive design',
        'Error handling'
    ]
};

log.success('Gazetteer App Loaded:', APP_INFO);

// Global exports
window.viewCountryDetails = viewCountryDetails;
window.hideSearchSuggestions = hideSearchSuggestions;

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

}