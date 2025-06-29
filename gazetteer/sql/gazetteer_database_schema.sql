-- ===================================================================
--  MySQL database - geographical information system 
-- ===================================================================


-- ===================================================================
-- 1. COUNTRIES TABLE (Primary geographical data)
-- ===================================================================
CREATE TABLE countries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    iso_code_2 CHAR(2) NOT NULL UNIQUE COMMENT 'ISO 3166-1 alpha-2 code (GB, US, etc)',
    iso_code_3 CHAR(3) NOT NULL UNIQUE COMMENT 'ISO 3166-1 alpha-3 code (GBR, USA, etc)', 
    name_common VARCHAR(100) NOT NULL COMMENT 'Common country name',
    name_official VARCHAR(200) NOT NULL COMMENT 'Official country name',
    capital VARCHAR(100) COMMENT 'Capital city name',
    population BIGINT UNSIGNED COMMENT 'Current population',
    area_km2 DECIMAL(12,2) COMMENT 'Area in km2',
    latitude DECIMAL(10,6) COMMENT 'Country center latitude',
    longitude DECIMAL(11,6) COMMENT 'Country center longitude',
    region VARCHAR(50) COMMENT 'Geographic region (Europe, Asia, etc)',
    subregion VARCHAR(50) COMMENT 'Geographic subregion',
    timezone VARCHAR(100) COMMENT 'Primary timezone',
    flag_svg TEXT COMMENT 'SVG flag data URL',
    flag_png VARCHAR(500) COMMENT 'PNG flag image URL',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes for performance
    INDEX idx_iso2 (iso_code_2),
    INDEX idx_iso3 (iso_code_3),
    INDEX idx_name (name_common),
    INDEX idx_region (region),
    INDEX idx_coordinates (latitude, longitude)
);

-- ===================================================================
-- 2. CURRENCIES TABLE (Currency information)
-- ===================================================================
CREATE TABLE currencies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code CHAR(3) NOT NULL UNIQUE COMMENT 'ISO 4217 currency code (USD, GBP, etc)',
    name VARCHAR(100) NOT NULL COMMENT 'Currency name',
    symbol VARCHAR(10) COMMENT 'Currency symbol ($, £, €, etc)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_code (code)
);

-- ===================================================================
-- 3. COUNTRY_CURRENCIES TABLE (M-2-M relationship)
-- ===================================================================
CREATE TABLE country_currencies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    country_id INT NOT NULL,
    currency_id INT NOT NULL,
    is_primary BOOLEAN DEFAULT TRUE COMMENT 'Is this the primary currency?',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE CASCADE,
    FOREIGN KEY (currency_id) REFERENCES currencies(id) ON DELETE CASCADE,
    UNIQUE KEY unique_country_currency (country_id, currency_id),
    INDEX idx_country (country_id),
    INDEX idx_currency (currency_id)
);

-- ===================================================================
-- 4. LANGUAGES TABLE (Language information)
-- ===================================================================
CREATE TABLE languages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code CHAR(3) NOT NULL UNIQUE COMMENT 'ISO 639-3 language code',
    name VARCHAR(100) NOT NULL COMMENT 'Language name',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_code (code)
);

-- ===================================================================
-- 5. COUNTRY_LANGUAGES TABLE (M-2-M relationship)
-- ===================================================================
CREATE TABLE country_languages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    country_id INT NOT NULL,
    language_id INT NOT NULL,
    is_official BOOLEAN DEFAULT FALSE COMMENT 'Is this an official language?',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE CASCADE,
    FOREIGN KEY (language_id) REFERENCES languages(id) ON DELETE CASCADE,
    UNIQUE KEY unique_country_language (country_id, language_id),
    INDEX idx_country (country_id),
    INDEX idx_language (language_id)
);

-- ===================================================================
-- 6. EXCHANGE_RATES TABLE (Currency exchange rates cache)
-- ===================================================================
CREATE TABLE exchange_rates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    base_currency CHAR(3) NOT NULL DEFAULT 'USD' COMMENT 'Base currency for rates',
    target_currency CHAR(3) NOT NULL COMMENT 'Target currency',
    rate DECIMAL(15,6) NOT NULL COMMENT 'Exchange rate (base to target)',
    rate_date DATE NOT NULL COMMENT 'Date of the exchange rate',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_currency_date (base_currency, target_currency, rate_date),
    INDEX idx_currencies (base_currency, target_currency),
    INDEX idx_date (rate_date),
    INDEX idx_target (target_currency)
);

-- ===================================================================
-- 7. WEATHER_DATA TABLE (Weather information cache)
-- ===================================================================
CREATE TABLE weather_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    country_id INT NOT NULL,
    city_name VARCHAR(100) NOT NULL COMMENT 'City name (usually capital)',
    latitude DECIMAL(8,6) NOT NULL,
    longitude DECIMAL(9,6) NOT NULL,
    temperature DECIMAL(4,1) COMMENT 'Temperature in C',
    feels_like DECIMAL(4,1) COMMENT 'Feels like temperature',
    humidity TINYINT UNSIGNED COMMENT 'Humidity percentage (0-100)',
    pressure SMALLINT UNSIGNED COMMENT 'Atmospheric pressure in hPa',
    wind_speed DECIMAL(4,1) COMMENT 'Wind speed in m/s',
    wind_direction SMALLINT UNSIGNED COMMENT 'Wind direction in degrees (0-360)',
    weather_condition VARCHAR(50) COMMENT 'Weather condition (clear sky, rain, etc)',
    weather_description VARCHAR(100) COMMENT 'Detailed weather description',
    weather_icon VARCHAR(10) COMMENT 'OpenWeather icon code',
    visibility INT UNSIGNED COMMENT 'Visibility in meters',
    sunrise TIME COMMENT 'Sunrise time (local)',
    sunset TIME COMMENT 'Sunset time (local)',
    data_timestamp TIMESTAMP NOT NULL COMMENT 'When weather data was recorded',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE CASCADE,
    INDEX idx_country (country_id),
    INDEX idx_city (city_name),
    INDEX idx_coordinates (latitude, longitude),
    INDEX idx_timestamp (data_timestamp)
);

-- ===================================================================
-- 8. WEATHER_FORECAST TABLE (Weather forecast data)
-- ===================================================================
CREATE TABLE weather_forecast (
    id INT AUTO_INCREMENT PRIMARY KEY,
    country_id INT NOT NULL,
    city_name VARCHAR(100) NOT NULL,
    forecast_date DATE NOT NULL COMMENT 'Date of forecast',
    forecast_time TIME COMMENT 'Time of forecast (for hourly data)',
    temperature DECIMAL(4,1) COMMENT 'Forecasted temp',
    min_temperature DECIMAL(4,1) COMMENT 'Minimum temp',
    max_temperature DECIMAL(4,1) COMMENT 'Maximum temp',
    humidity TINYINT UNSIGNED COMMENT 'Forecasted humidity',
    weather_condition VARCHAR(50) COMMENT 'Forecasted weather condition',
    weather_description VARCHAR(100) COMMENT 'Detailed forecast description',
    weather_icon VARCHAR(10) COMMENT 'Weather icon code',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE CASCADE,
    INDEX idx_country (country_id),
    INDEX idx_date (forecast_date),
    INDEX idx_country_date (country_id, forecast_date)
);

-- ===================================================================
-- 9. BORDERS TABLE (Country border relationships)
-- ===================================================================
CREATE TABLE borders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    country_id INT NOT NULL COMMENT 'Country that has the border',
    border_country_id INT NOT NULL COMMENT 'Country it borders with',
    border_length_km DECIMAL(8,2) COMMENT 'Length of shared border in km',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE CASCADE,
    FOREIGN KEY (border_country_id) REFERENCES countries(id) ON DELETE CASCADE,
    UNIQUE KEY unique_border (country_id, border_country_id),
    INDEX idx_country (country_id),
    INDEX idx_border_country (border_country_id)
);

-- ===================================================================
-- 10. USER_SEARCHES TABLE (Track user search history)
-- ===================================================================
CREATE TABLE user_searches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ip_address VARCHAR(45) COMMENT 'User IP address',
    search_term VARCHAR(200) NOT NULL COMMENT 'What user searched up',
    country_id INT COMMENT 'Country that was found/selected',
    search_type ENUM('name', 'coordinates', 'auto_detect') DEFAULT 'name',
    user_latitude DECIMAL(8,6) COMMENT 'User location if available',
    user_longitude DECIMAL(9,6) COMMENT 'User location if available',
    user_agent TEXT COMMENT 'Browser user agent',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE SET NULL,
    INDEX idx_ip (ip_address),
    INDEX idx_country (country_id),
    INDEX idx_search_term (search_term),
    INDEX idx_date (created_at)
);

-- ===================================================================
-- 11. SYSTEM_CACHE TABLE (General caching for API responses)
-- ===================================================================
CREATE TABLE system_cache (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cache_key VARCHAR(255) NOT NULL UNIQUE COMMENT 'Unique cache identifier',
    cache_data LONGTEXT NOT NULL COMMENT 'Cached data (JSON format)',
    expires_at TIMESTAMP NOT NULL COMMENT 'When cache expires',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_key (cache_key),
    INDEX idx_expires (expires_at)
);

-- ===================================================================
-- SAMPLE DATA INSERTION
-- ===================================================================

-- Insert sample currencies
INSERT INTO currencies (code, name, symbol) VALUES
('USD', 'United States Dollar', '$'),
('GBP', 'British Pound Sterling', '£'),
('EUR', 'Euro', '€'),
('JPY', 'Japanese Yen', '¥'),
('CAD', 'Canadian Dollar', 'C$'),
('AUD', 'Australian Dollar', 'A$'),
('CHF', 'Swiss Franc', 'CHF'),
('CNY', 'Chinese Yuan', '¥'),
('INR', 'Indian Rupee', '₹');

-- Insert sample languages
INSERT INTO languages (code, name) VALUES
('eng', 'English'),
('spa', 'Spanish'),
('fra', 'French'),
('deu', 'German'),
('ita', 'Italian'),
('por', 'Portuguese'),
('rus', 'Russian'),
('ara', 'Arabic'),
('chi', 'Chinese'),
('jpn', 'Japanese');

-- Sample countries (will be populated from REST Countries API)
INSERT INTO countries (
    iso_code_2, iso_code_3, name_common, name_official, capital, 
    population, latitude, longitude, region, subregion
) VALUES
('GB', 'GBR', 'United Kingdom', 'United Kingdom of Great Britain and Northern Ireland', 
 'London', 67215293, 54.0, -2.0, 'Europe', 'Northern Europe'),
('US', 'USA', 'United States', 'United States of America', 
 'Washington, D.C.', 331900000, 39.8283, -98.5795, 'Americas', 'Northern America'),
('DE', 'DEU', 'Germany', 'Federal Republic of Germany', 
 'Berlin', 83240525, 51.1657, 10.4515, 'Europe', 'Central Europe'),
('JP', 'JPN', 'Japan', 'Japan', 
 'Tokyo', 125800000, 36.2048, 138.2529, 'Asia', 'Eastern Asia'),
('CA', 'CAN', 'Canada', 'Canada', 
 'Ottawa', 38008005, 56.1304, -106.3468, 'Americas', 'Northern America');

-- ===================================================================
-- STORED PROCEDURES FOR COMMON OPERATIONS
-- ===================================================================

DELIMITER //

-- Gets country info
CREATE PROCEDURE GetCountryInfo(IN p_country_code CHAR(2))
BEGIN
    SELECT 
        c.*,
        GROUP_CONCAT(DISTINCT curr.code) as currencies,
        GROUP_CONCAT(DISTINCT curr.symbol) as currency_symbols,
        GROUP_CONCAT(DISTINCT l.name) as languages
    FROM countries c
    LEFT JOIN country_currencies cc ON c.id = cc.country_id
    LEFT JOIN currencies curr ON cc.currency_id = curr.id
    LEFT JOIN country_languages cl ON c.id = cl.country_id
    LEFT JOIN languages l ON cl.language_id = l.id
    WHERE c.iso_code_2 = p_country_code
    GROUP BY c.id;
END //

-- Updates weather data
CREATE PROCEDURE UpdateWeatherData(
    IN p_country_id INT,
    IN p_city_name VARCHAR(100),
    IN p_lat DECIMAL(8,6),
    IN p_lng DECIMAL(9,6),
    IN p_temp DECIMAL(4,1),
    IN p_condition VARCHAR(50),
    IN p_description VARCHAR(100),
    IN p_humidity TINYINT,
    IN p_pressure SMALLINT,
    IN p_wind_speed DECIMAL(4,1)
)
BEGIN
    INSERT INTO weather_data (
        country_id, city_name, latitude, longitude, temperature,
        weather_condition, weather_description, humidity, pressure, 
        wind_speed, data_timestamp
    ) VALUES (
        p_country_id, p_city_name, p_lat, p_lng, p_temp,
        p_condition, p_description, p_humidity, p_pressure,
        p_wind_speed, NOW()
    )
    ON DUPLICATE KEY UPDATE
        temperature = p_temp,
        weather_condition = p_condition,
        weather_description = p_description,
        humidity = p_humidity,
        pressure = p_pressure,
        wind_speed = p_wind_speed,
        data_timestamp = NOW(),
        updated_at = NOW();
END //

DELIMITER ;

-- ===================================================================
-- VIEWS FOR COMMON QUERIES
-- ===================================================================

-- Complete country information
CREATE VIEW country_details AS
SELECT 
    c.id,
    c.iso_code_2,
    c.iso_code_3,
    c.name_common,
    c.name_official,
    c.capital,
    c.population,
    c.area_km2,
    c.latitude,
    c.longitude,
    c.region,
    c.subregion,
    c.timezone,
    c.flag_svg,
    c.flag_png,
    GROUP_CONCAT(DISTINCT curr.code) as currencies,
    GROUP_CONCAT(DISTINCT l.name) as languages,
    wd.temperature,
    wd.weather_condition,
    wd.weather_description,
    wd.data_timestamp as weather_updated
FROM countries c
LEFT JOIN country_currencies cc ON c.id = cc.country_id
LEFT JOIN currencies curr ON cc.currency_id = curr.id
LEFT JOIN country_languages cl ON c.id = cl.country_id
LEFT JOIN languages l ON cl.language_id = l.id
LEFT JOIN weather_data wd ON c.id = wd.country_id 
    AND wd.created_at = (
        SELECT MAX(created_at) 
        FROM weather_data 
        WHERE country_id = c.id
    )
GROUP BY c.id;

-- ===================================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION (specific column targetting for predictable lookups)
-- ===================================================================

-- Common query patterns
CREATE INDEX idx_country_weather ON weather_data(country_id, data_timestamp DESC);
CREATE INDEX idx_exchange_rate_lookup ON exchange_rates(target_currency, rate_date DESC);
CREATE INDEX idx_user_activity ON user_searches(created_at DESC, country_id);