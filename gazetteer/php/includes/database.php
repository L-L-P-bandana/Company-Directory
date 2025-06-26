<?php
// ===================================================================
// GAZETTEER PHP DATA ACCESS LAYER (AKA - SQL Shortcut City) 
// ===================================================================

// ===================================================================
// 1. DATABASE CONNECTION CLASS
// ===================================================================
class Database {
    private static $instance = null;
    private $pdo;
    
    private function __construct() {
        $host = 'localhost';
        $dbname = 'gazetteer';
        $username = 'gazetteer_app';
        $password = 'secure_password_here';
        
        try {
            $this->pdo = new PDO(
                "mysql:host=$host;dbname=$dbname;charset=utf8mb4",
                $username,
                $password,
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false
                ]
            );
        } catch (PDOException $e) {
            die("Database connection failed: " . $e->getMessage());
        }
    }
    
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    public function getConnection() {
        return $this->pdo;
    }
}

// ===================================================================
// 2. COUNTRY DATA ACCESS OBJECT (DAO)
// ===================================================================
class CountryDAO {
    private static $pdo;
    
    private static function getPDO() {
        if (!self::$pdo) {
            self::$pdo = Database::getInstance()->getConnection();
        }
        return self::$pdo;
    }
    
    /**
     * Get country by ISO code (2 or 3 letter)
     */
    public static function getByCode($code) {
        $pdo = self::getPDO();
        
        $sql = "SELECT * FROM country_details WHERE iso_code_2 = ? OR iso_code_3 = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$code, $code]);
        
        return $stmt->fetch();
    }
    
    /**
     * Search countries by name
     */
    public static function searchByName($name) {
        $pdo = self::getPDO();
        
        $sql = "SELECT * FROM country_details 
                WHERE name_common LIKE ? OR name_official LIKE ?
                ORDER BY name_common LIMIT 10";
        $searchTerm = "%$name%";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$searchTerm, $searchTerm]);
        
        return $stmt->fetchAll();
    }
    
    /**
     * Get all countries (for dropdown/autocomplete)
     */
    public static function getAll() {
        $pdo = self::getPDO();
        
        $sql = "SELECT iso_code_2, iso_code_3, name_common, capital, population 
                FROM countries ORDER BY name_common";
        $stmt = $pdo->query($sql);
        
        return $stmt->fetchAll();
    }
    
    /**
     * Get countries by region
     */
    public static function getByRegion($region) {
        $pdo = self::getPDO();
        
        $sql = "SELECT * FROM country_details WHERE region = ? ORDER BY name_common";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$region]);
        
        return $stmt->fetchAll();
    }
    
    /**
     * Insert or update country data from REST Countries API
     */
    public static function upsertCountry($data) {
        $pdo = self::getPDO();
        
        $sql = "INSERT INTO countries (
                    iso_code_2, iso_code_3, name_common, name_official, capital,
                    population, area_km2, latitude, longitude, region, subregion,
                    timezone, flag_svg, flag_png
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    name_common = VALUES(name_common),
                    name_official = VALUES(name_official),
                    capital = VALUES(capital),
                    population = VALUES(population),
                    area_km2 = VALUES(area_km2),
                    latitude = VALUES(latitude),
                    longitude = VALUES(longitude),
                    region = VALUES(region),
                    subregion = VALUES(subregion),
                    timezone = VALUES(timezone),
                    flag_svg = VALUES(flag_svg),
                    flag_png = VALUES(flag_png),
                    updated_at = NOW()";
        
        $stmt = $pdo->prepare($sql);
        return $stmt->execute([
            $data['iso_code_2'], $data['iso_code_3'], $data['name_common'],
            $data['name_official'], $data['capital'], $data['population'],
            $data['area_km2'], $data['latitude'], $data['longitude'],
            $data['region'], $data['subregion'], $data['timezone'],
            $data['flag_svg'], $data['flag_png']
        ]);
    }
    
    /**
     * Get country ID by ISO code helper method
     */
    public static function getIdByCode($code) {
        $pdo = self::getPDO();
        
        $sql = "SELECT id FROM countries WHERE iso_code_2 = ? OR iso_code_3 = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$code, $code]);
        
        $result = $stmt->fetch();
        return $result ? $result['id'] : null;
    }
}

// ===================================================================
// 3. WEATHER DATA ACCESS OBJECT
// ===================================================================
class WeatherDAO {
    private static $pdo;
    
    private static function getPDO() {
        if (!self::$pdo) {
            self::$pdo = Database::getInstance()->getConnection();
        }
        return self::$pdo;
    }
    
    /**
     * Get current weather for a country
     */
    public static function getCurrentWeather($countryCode) {
        $pdo = self::getPDO();
        
        $sql = "SELECT wd.* FROM weather_data wd
                JOIN countries c ON wd.country_id = c.id
                WHERE (c.iso_code_2 = ? OR c.iso_code_3 = ?)
                AND wd.data_timestamp >= DATE_SUB(NOW(), INTERVAL 10 MINUTE)
                ORDER BY wd.data_timestamp DESC LIMIT 1";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$countryCode, $countryCode]);
        
        return $stmt->fetch();
    }
    
    /**
     * Save weather data from OpenWeather API
     */
    public static function saveWeatherData($countryCode, $weatherData) {
        $pdo = self::getPDO();
        $countryId = CountryDAO::getIdByCode($countryCode);
        
        if (!$countryId) return false;
        
        // Delete old weather data for this country (keep only latest)
        $deleteSql = "DELETE FROM weather_data WHERE country_id = ?";
        $deleteStmt = $pdo->prepare($deleteSql);
        $deleteStmt->execute([$countryId]);
        
        // Insert new weather data
        $sql = "INSERT INTO weather_data (
                    country_id, city_name, latitude, longitude, temperature,
                    feels_like, humidity, pressure, wind_speed, wind_direction,
                    weather_condition, weather_description, weather_icon,
                    visibility, sunrise, sunset, data_timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())";
        
        $stmt = $pdo->prepare($sql);
        return $stmt->execute([
            $countryId, $weatherData['city_name'], $weatherData['latitude'],
            $weatherData['longitude'], $weatherData['temperature'],
            $weatherData['feels_like'], $weatherData['humidity'],
            $weatherData['pressure'], $weatherData['wind_speed'],
            $weatherData['wind_direction'], $weatherData['weather_condition'],
            $weatherData['weather_description'], $weatherData['weather_icon'],
            $weatherData['visibility'], $weatherData['sunrise'], $weatherData['sunset']
        ]);
    }
    
    /**
     * Get weather forecast for a country
     */
    public static function getForecast($countryCode) {
        $pdo = self::getPDO();
        
        $sql = "SELECT wf.* FROM weather_forecast wf
                JOIN countries c ON wf.country_id = c.id
                WHERE (c.iso_code_2 = ? OR c.iso_code_3 = ?)
                AND wf.forecast_date >= CURDATE()
                ORDER BY wf.forecast_date, wf.forecast_time LIMIT 40";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$countryCode, $countryCode]);
        
        return $stmt->fetchAll();
    }
    
    /**
     * Save weather forecast data
     */
    public static function saveForecast($countryCode, $forecastData) {
        $pdo = self::getPDO();
        $countryId = CountryDAO::getIdByCode($countryCode);
        
        if (!$countryId) return false;
        
        // Clear old forecast data
        $deleteSql = "DELETE FROM weather_forecast WHERE country_id = ?";
        $deleteStmt = $pdo->prepare($deleteSql);
        $deleteStmt->execute([$countryId]);
        
        // Insert new forecast data
        $sql = "INSERT INTO weather_forecast (
                    country_id, city_name, forecast_date, forecast_time,
                    temperature, min_temperature, max_temperature, humidity,
                    weather_condition, weather_description, weather_icon
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        
        $stmt = $pdo->prepare($sql);
        
        foreach ($forecastData as $forecast) {
            $stmt->execute([
                $countryId, $forecast['city_name'], $forecast['forecast_date'],
                $forecast['forecast_time'], $forecast['temperature'],
                $forecast['min_temperature'], $forecast['max_temperature'],
                $forecast['humidity'], $forecast['weather_condition'],
                $forecast['weather_description'], $forecast['weather_icon']
            ]);
        }
        
        return true;
    }
}

// ===================================================================
// 4. EXCHANGE RATE DATA ACCESS OBJECT
// ===================================================================
class ExchangeRateDAO {
    private static $pdo;
    
    private static function getPDO() {
        if (!self::$pdo) {
            self::$pdo = Database::getInstance()->getConnection();
        }
        return self::$pdo;
    }
    
    /**
     * Get exchange rate for a specific currency
     */
    public static function getRate($currencyCode, $baseCurrency = 'USD') {
        $pdo = self::getPDO();
        
        $sql = "SELECT * FROM exchange_rates 
                WHERE base_currency = ? AND target_currency = ?
                AND rate_date = CURDATE()
                ORDER BY created_at DESC LIMIT 1";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$baseCurrency, $currencyCode]);
        
        return $stmt->fetch();
    }
    
    /**
     * Get all current exchange rates
     */
    public static function getAllRates($baseCurrency = 'USD') {
        $pdo = self::getPDO();
        
        $sql = "SELECT target_currency, rate FROM exchange_rates 
                WHERE base_currency = ? AND rate_date = CURDATE()
                ORDER BY target_currency";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$baseCurrency]);
        
        $rates = [];
        while ($row = $stmt->fetch()) {
            $rates[$row['target_currency']] = $row['rate'];
        }
        
        return $rates;
    }
    
    /**
     * Save exchange rates from Open Exchange Rates API
     */
    public static function saveRates($ratesData, $baseCurrency = 'USD') {
        $pdo = self::getPDO();
        
        // Clear today's rates first
        $deleteSql = "DELETE FROM exchange_rates 
                      WHERE base_currency = ? AND rate_date = CURDATE()";
        $deleteStmt = $pdo->prepare($deleteSql);
        $deleteStmt->execute([$baseCurrency]);
        
        // Insert new rates
        $sql = "INSERT INTO exchange_rates (base_currency, target_currency, rate, rate_date)
                VALUES (?, ?, ?, CURDATE())";
        $stmt = $pdo->prepare($sql);
        
        foreach ($ratesData as $currency => $rate) {
            $stmt->execute([$baseCurrency, $currency, $rate]);
        }
        
        return true;
    }
    
    /**
     * Get exchange rate with fallback to API if not cached
     */
    public static function getRateWithFallback($currencyCode) {
        // Try to get from database first
        $rate = self::getRate($currencyCode);
        
        if ($rate && $rate['rate_date'] == date('Y-m-d')) {
            return $rate;
        }
        
        // If not found or old, fetch from API and cache
        // This calls existing exchange rate API PHP file
        return null; 
    }
}

// ===================================================================
// 5. CACHE DATA ACCESS OBJECT
// ===================================================================
class CacheDAO {
    private static $pdo;
    
    private static function getPDO() {
        if (!self::$pdo) {
            self::$pdo = Database::getInstance()->getConnection();
        }
        return self::$pdo;
    }
    
    /**
     * Get cached data by key
     */
    public static function get($key) {
        $pdo = self::getPDO();
        
        $sql = "SELECT cache_data FROM system_cache 
                WHERE cache_key = ? AND expires_at > NOW()";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$key]);
        
        $result = $stmt->fetch();
        return $result ? json_decode($result['cache_data'], true) : null;
    }
    
    /**
     * Set cached data with expiration
     */
    public static function set($key, $data, $ttlMinutes = 60) {
        $pdo = self::getPDO();
        
        $expiresAt = date('Y-m-d H:i:s', time() + ($ttlMinutes * 60));
        
        $sql = "INSERT INTO system_cache (cache_key, cache_data, expires_at)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    cache_data = VALUES(cache_data),
                    expires_at = VALUES(expires_at),
                    updated_at = NOW()";
        
        $stmt = $pdo->prepare($sql);
        return $stmt->execute([$key, json_encode($data), $expiresAt]);
    }
    
    /**
     * Delete cached data
     */
    public static function delete($key) {
        $pdo = self::getPDO();
        
        $sql = "DELETE FROM system_cache WHERE cache_key = ?";
        $stmt = $pdo->prepare($sql);
        return $stmt->execute([$key]);
    }
    
    /**
     * Clear expired cache entries
     */
    public static function clearExpired() {
        $pdo = self::getPDO();
        
        $sql = "DELETE FROM system_cache WHERE expires_at < NOW()";
        return $pdo->exec($sql);
    }
}

// ===================================================================
// 6. USER SEARCH TRACKING DAO
// ===================================================================
class SearchDAO {
    private static $pdo;
    
    private static function getPDO() {
        if (!self::$pdo) {
            self::$pdo = Database::getInstance()->getConnection();
        }
        return self::$pdo;
    }
    
    /**
     * Log user search
     */
    public static function logSearch($searchTerm, $countryId = null, $searchType = 'name') {
        $pdo = self::getPDO();
        
        $ipAddress = $_SERVER['REMOTE_ADDR'] ?? null;
        $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? null;
        
        $sql = "INSERT INTO user_searches 
                (ip_address, search_term, country_id, search_type, user_agent)
                VALUES (?, ?, ?, ?, ?)";
        
        $stmt = $pdo->prepare($sql);
        return $stmt->execute([$ipAddress, $searchTerm, $countryId, $searchType, $userAgent]);
    }
    
    /**
     * Get popular searches
     */
    public static function getPopularSearches($limit = 10) {
        $pdo = self::getPDO();
        
        $sql = "SELECT search_term, COUNT(*) as search_count
                FROM user_searches 
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                GROUP BY search_term
                ORDER BY search_count DESC
                LIMIT ?";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$limit]);
        
        return $stmt->fetchAll();
    }
}

// ===================================================================
// 7. EXAMPLE USAGE OF THE DATA ACCESS LAYER
// ===================================================================

/*
// How I Will Use These:

// Get country information
$country = CountryDAO::getByCode('GB');
echo json_encode($country);

// Get weather data (from cache or API)
$weather = WeatherDAO::getCurrentWeather('GB');
if (!$weather) {
    // Call OpenWeather API and save to database
    // WeatherDAO::saveWeatherData('GB', $apiWeatherData);
}

// Get exchange rates
$rates = ExchangeRateDAO::getAllRates();
$gbpRate = ExchangeRateDAO::getRate('GBP');

// Use caching
$cachedData = CacheDAO::get('country_list');
if (!$cachedData) {
    $cachedData = CountryDAO::getAll();
    CacheDAO::set('country_list', $cachedData, 1440); // Cache for 24 hours
}

// Log user searches
SearchDAO::logSearch('United Kingdom', CountryDAO::getIdByCode('GB'));
*/

?>