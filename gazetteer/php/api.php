<?php
// ===================================================================
// GAZETTEER API
// ===================================================================

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Database configuration
$config = [
    'host' => 'localhost',
    'dbname' => 'u215315340_Gazetteer',
    'username' => 'u215315340_Gazetteerllp',
    'password' => 'Rainbowunicorn1!!'
];

// Connect to database
try {
    $pdo = new PDO(
        "mysql:host={$config['host']};dbname={$config['dbname']};charset=utf8mb4",
        $config['username'],
        $config['password'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false
        ]
    );
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

// Get the request path
$request = $_GET['request'] ?? '';
$parts = explode('/', trim($request, '/'));
$endpoint = $parts[0] ?? '';

// Route the request
switch ($endpoint) {
    case 'countries':
        handleCountriesList($pdo);
        break;
        
    case 'country':
        $countryCode = $parts[1] ?? '';
        handleCountryDetails($pdo, $countryCode);
        break;
        
    case 'search':
        $query = $parts[1] ?? $_GET['q'] ?? '';
        handleCountrySearch($pdo, $query);
        break;
        
    case 'weather':
        $countryCode = $parts[1] ?? '';
        handleWeatherData($pdo, $countryCode);
        break;
        
    case 'rates':
        $baseCurrency = $parts[1] ?? 'USD';
        handleExchangeRates($pdo, $baseCurrency);
        break;
        
    case 'status':
        handleSystemStatus($pdo);
        break;
        
    default:
        handleApiInfo();
        break;
}

// ===================================================================
// API ENDPOINT HANDLERS
// ===================================================================

/**
 * GET /api/countries - List all countries
 */
function handleCountriesList($pdo) {
    try {
        $stmt = $pdo->query("
            SELECT iso_code_2, iso_code_3, name_common, capital, 
                   population, region, subregion, flag_png
            FROM countries 
            ORDER BY name_common
        ");
        
        $countries = $stmt->fetchAll();
        
        echo json_encode([
            'status' => 'success',
            'count' => count($countries),
            'data' => $countries
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch countries']);
    }
}

/**
 * GET /api/country/{code} - Get country info
 */
function handleCountryDetails($pdo, $countryCode) {
    if (empty($countryCode)) {
        http_response_code(400);
        echo json_encode(['error' => 'Country code required']);
        return;
    }
    
    try {
        // Get country info with weather inc wind direction and visibility
        $stmt = $pdo->prepare("
            SELECT 
                c.*,
                wd.temperature,
                wd.feels_like,
                wd.humidity,
                wd.pressure,
                wd.wind_speed,
                wd.wind_direction,
                wd.visibility,
                wd.weather_condition,
                wd.weather_description,
                wd.weather_icon,
                wd.data_timestamp as weather_updated
            FROM countries c
            LEFT JOIN weather_data wd ON c.id = wd.country_id
            WHERE c.iso_code_2 = ? OR c.iso_code_3 = ?
        ");
        
        $stmt->execute([$countryCode, $countryCode]);
        $country = $stmt->fetch();
        
        if (!$country) {
            http_response_code(404);
            echo json_encode(['error' => 'Country not found']);
            return;
        }
        
        // Get currencies for this country
        $currStmt = $pdo->prepare("
            SELECT curr.code, curr.name, curr.symbol,
                   er.rate, er.rate_date
            FROM currencies curr
            JOIN country_currencies cc ON curr.id = cc.currency_id
            JOIN countries c ON cc.country_id = c.id
            LEFT JOIN exchange_rates er ON curr.code = er.target_currency 
                AND er.rate_date = CURDATE()
            WHERE c.iso_code_2 = ? OR c.iso_code_3 = ?
        ");
        
        $currStmt->execute([$countryCode, $countryCode]);
        $currencies = $currStmt->fetchAll();
        
        // Get languages for this country
        $langStmt = $pdo->prepare("
            SELECT l.code, l.name, cl.is_official
            FROM languages l
            JOIN country_languages cl ON l.id = cl.language_id
            JOIN countries c ON cl.country_id = c.id
            WHERE c.iso_code_2 = ? OR c.iso_code_3 = ?
        ");
        
        $langStmt->execute([$countryCode, $countryCode]);
        $languages = $langStmt->fetchAll();
        
        // Format response with proper null handling for weather fields (null handling helps with preventing N/A's in visibility and wind direction fields due to preventing inadequate data capture resulting in "unidentified" being ported through.)
        $response = [
            'status' => 'success',
            'data' => [
                'basic_info' => [
                    'iso_code_2' => $country['iso_code_2'],
                    'iso_code_3' => $country['iso_code_3'],
                    'name_common' => $country['name_common'],
                    'name_official' => $country['name_official'],
                    'capital' => $country['capital'],
                    'population' => (int)$country['population'],
                    'area_km2' => (float)$country['area_km2'],
                    'region' => $country['region'],
                    'subregion' => $country['subregion'],
                    'timezone' => $country['timezone']
                ],
                'geography' => [
                    'latitude' => (float)$country['latitude'],
                    'longitude' => (float)$country['longitude'],
                    'coordinates' => [(float)$country['latitude'], (float)$country['longitude']]
                ],
                'flags' => [
                    'svg' => $country['flag_svg'],
                    'png' => $country['flag_png']
                ],
                'weather' => $country['temperature'] ? [
                    'temperature' => (float)$country['temperature'],
                    'feels_like' => (float)$country['feels_like'],
                    'humidity' => (int)$country['humidity'],
                    'pressure' => (int)$country['pressure'],
                    'wind_speed' => (float)$country['wind_speed'],
                    // Check for null before casting to preserve valid 0 values
                    'wind_direction' => $country['wind_direction'] !== null ? (int)$country['wind_direction'] : null,
                    'visibility' => $country['visibility'] !== null ? (int)$country['visibility'] : null,
                    'condition' => $country['weather_condition'],
                    'description' => $country['weather_description'],
                    'icon' => $country['weather_icon'],
                    'updated' => $country['weather_updated']
                ] : null,
                'currencies' => $currencies,
                'languages' => $languages
            ]
        ];
        
        echo json_encode($response, JSON_PRETTY_PRINT);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch country details']);
    }
}

/**
 * GET /api/search/{query} - Search countries by name
 */
function handleCountrySearch($pdo, $query) {
    if (empty($query)) {
        http_response_code(400);
        echo json_encode(['error' => 'Search query required']);
        return;
    }
    
    try {
        $stmt = $pdo->prepare("
            SELECT iso_code_2, iso_code_3, name_common, name_official, 
                   capital, population, region, flag_png
            FROM countries 
            WHERE name_common LIKE ? 
               OR name_official LIKE ?
               OR capital LIKE ?
            ORDER BY 
                CASE 
                    WHEN name_common LIKE ? THEN 1
                    WHEN name_official LIKE ? THEN 2  
                    WHEN capital LIKE ? THEN 3
                    ELSE 4
                END,
                name_common
            LIMIT 20
        ");
        
        $searchTerm = "%$query%";
        $exactTerm = "$query%";
        
        $stmt->execute([
            $searchTerm, $searchTerm, $searchTerm,
            $exactTerm, $exactTerm, $exactTerm
        ]);
        
        $results = $stmt->fetchAll();
        
        echo json_encode([
            'status' => 'success',
            'query' => $query,
            'count' => count($results),
            'data' => $results
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Search failed']);
    }
}

/**
 * GET /api/weather/{countryCode} - Get weather for country
 */
function handleWeatherData($pdo, $countryCode) {
    if (empty($countryCode)) {
        http_response_code(400);
        echo json_encode(['error' => 'Country code required']);
        return;
    }
    
    try {
        $stmt = $pdo->prepare("
            SELECT c.name_common, c.capital, wd.*
            FROM weather_data wd
            JOIN countries c ON wd.country_id = c.id
            WHERE c.iso_code_2 = ? OR c.iso_code_3 = ?
            ORDER BY wd.data_timestamp DESC
            LIMIT 1
        ");
        
        $stmt->execute([$countryCode, $countryCode]);
        $weather = $stmt->fetch();
        
        if (!$weather) {
            http_response_code(404);
            echo json_encode(['error' => 'Weather data not found']);
            return;
        }
        
        echo json_encode([
            'status' => 'success',
            'data' => [
                'country' => $weather['name_common'],
                'city' => $weather['city_name'],
                'coordinates' => [(float)$weather['latitude'], (float)$weather['longitude']],
                'temperature' => (float)$weather['temperature'],
                'feels_like' => (float)$weather['feels_like'],
                'humidity' => (int)$weather['humidity'],
                'pressure' => (int)$weather['pressure'],
                'wind_speed' => (float)$weather['wind_speed'],
                // Preserve null values instead of casting to 0
                'wind_direction' => $weather['wind_direction'] !== null ? (int)$weather['wind_direction'] : null,
                'condition' => $weather['weather_condition'],
                'description' => $weather['weather_description'],
                'icon' => $weather['weather_icon'],
                'visibility' => $weather['visibility'] !== null ? (int)$weather['visibility'] : null,
                'sunrise' => $weather['sunrise'],
                'sunset' => $weather['sunset'],
                'timestamp' => $weather['data_timestamp']
            ]
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch weather data']);
    }
}

/**
 * GET /api/rates/{baseCurrency} - Get exchange rates
 */
function handleExchangeRates($pdo, $baseCurrency = 'USD') {
    try {
        $stmt = $pdo->prepare("
            SELECT target_currency, rate, rate_date
            FROM exchange_rates 
            WHERE base_currency = ? AND rate_date = CURDATE()
            ORDER BY target_currency
        ");
        
        $stmt->execute([$baseCurrency]);
        $rates = $stmt->fetchAll();
        
        if (empty($rates)) {
            // Try yesterday's rates if today's aren't available
            $stmt = $pdo->prepare("
                SELECT target_currency, rate, rate_date
                FROM exchange_rates 
                WHERE base_currency = ? 
                ORDER BY rate_date DESC, target_currency
                LIMIT 200
            ");
            
            $stmt->execute([$baseCurrency]);
            $rates = $stmt->fetchAll();
        }
        
        // Format as key-value pairs
        $formatted_rates = [];
        foreach ($rates as $rate) {
            $formatted_rates[$rate['target_currency']] = (float)$rate['rate'];
        }
        
        echo json_encode([
            'status' => 'success',
            'base_currency' => $baseCurrency,
            'date' => $rates[0]['rate_date'] ?? date('Y-m-d'),
            'rates' => $formatted_rates
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch exchange rates']);
    }
}

/**
 * GET /api/status - System status and statistics
 */
function handleSystemStatus($pdo) {
    try {
        $stats = [];
        
        // Count records in each table
        $tables = ['countries', 'currencies', 'languages', 'weather_data', 'exchange_rates'];
        foreach ($tables as $table) {
            $stmt = $pdo->query("SELECT COUNT(*) FROM $table");
            $stats[$table] = (int)$stmt->fetchColumn();
        }
        
        // Get latest updates
        $weatherStmt = $pdo->query("SELECT MAX(data_timestamp) FROM weather_data");
        $ratesStmt = $pdo->query("SELECT MAX(rate_date) FROM exchange_rates");
        
        echo json_encode([
            'status' => 'success',
            'system' => 'Gazetteer API',
            'version' => '1.0',
            'database_stats' => $stats,
            'last_weather_update' => $weatherStmt->fetchColumn(),
            'last_rates_update' => $ratesStmt->fetchColumn(),
            'endpoints' => [
                '/api/countries' => 'List all countries',
                '/api/country/{code}' => 'Get country details',
                '/api/search/{query}' => 'Search countries',
                '/api/weather/{code}' => 'Get weather data',
                '/api/rates/{currency}' => 'Get exchange rates',
                '/api/status' => 'System status'
            ]
        ], JSON_PRETTY_PRINT);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch system status']);
    }
}

/**
 * Default API information
 */
function handleApiInfo() {
    echo json_encode([
        'name' => 'Gazetteer API',
        'version' => '1.0',
        'description' => 'Lightning-fast geographical information API',
        'documentation' => '/api/status',
        'endpoints' => [
            'GET /api/countries' => 'List all countries',
            'GET /api/country/{code}' => 'Get complete country information',
            'GET /api/search/{query}' => 'Search countries by name',
            'GET /api/weather/{code}' => 'Get current weather data',
            'GET /api/rates/{currency}' => 'Get exchange rates (default: USD)',
            'GET /api/status' => 'API status and statistics'
        ],
        'examples' => [
            '/api/country/GB' => 'Get UK information',
            '/api/search/United' => 'Search for "United"',
            '/api/weather/US' => 'Get US weather',
            '/api/rates/EUR' => 'Get EUR exchange rates'
        ]
    ], JSON_PRETTY_PRINT);
}
?>