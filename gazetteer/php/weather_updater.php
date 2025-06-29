<?php
// ===================================================================
// WEATHER DATA UPDATER
// ===================================================================

// Database configuration
$config = [
    'host' => 'localhost',
    'dbname' => 'u215315340_Gazetteer',
    'username' => 'u215315340_Gazetteerllp',
    'password' => 'Rainbowunicorn1!!'
];

// OpenWeatherMap API configuration
$WEATHER_API_KEY = '633c784df32af33d2e4fbb39d138ce4f';
$WEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5/weather';

// Batch processing settings (using batches to circumvent API call rate limitations)
$BATCH_SIZE = 25; // Process 25 countries at a time
$BATCH_NUMBER = isset($_GET['batch']) ? (int)$_GET['batch'] : 1;

// Set execution time limit
set_time_limit(180); // 3 minutes per batch

echo "<h1>🌤️ Weather Data Update - Batch $BATCH_NUMBER</h1>";
echo "<hr>";

try {
    // Connect to database with persistent connection
    $pdo = new PDO(
        "mysql:host={$config['host']};dbname={$config['dbname']};charset=utf8mb4",
        $config['username'],
        $config['password'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_PERSISTENT => true, // Keep connection alive
            PDO::MYSQL_ATTR_INIT_COMMAND => "SET SESSION wait_timeout=600" // 10 minute timeout
        ]
    );
    
    echo "✅ Database connected successfully<br><br>";
    
    // Get countries that don't have weather data yet
    echo "<h3>🔍 Finding countries needing weather data...</h3>";
    
    $countriesStmt = $pdo->prepare("
        SELECT c.id, c.iso_code_2, c.name_common, c.capital, c.latitude, c.longitude 
        FROM countries c
        LEFT JOIN weather_data wd ON c.id = wd.country_id
        WHERE c.capital IS NOT NULL AND c.capital != ''
        AND wd.country_id IS NULL
        ORDER BY c.name_common
        LIMIT ? OFFSET ?
    ");
    
    $offset = ($BATCH_NUMBER - 1) * $BATCH_SIZE;
    $countriesStmt->execute([$BATCH_SIZE, $offset]);
    $countries = $countriesStmt->fetchAll();
    
    // Also get total count for progress tracking
    $totalStmt = $pdo->prepare("
        SELECT COUNT(*) FROM countries c
        LEFT JOIN weather_data wd ON c.id = wd.country_id  
        WHERE c.capital IS NOT NULL AND c.capital != ''
        AND wd.country_id IS NULL
    ");
    $totalStmt->execute();
    $totalRemaining = $totalStmt->fetchColumn();
    
    echo "📍 Processing " . count($countries) . " countries in this batch<br>";
    echo "🎯 Total remaining countries: $totalRemaining<br><br>";
    
    if (count($countries) == 0) {
        echo "<div style='background: #d4edda; padding: 15px; border: 1px solid #c3e6cb; border-radius: 5px;'>";
        echo "🎉 <strong>ALL WEATHER DATA IMPORTED!</strong><br>";
        echo "✅ No more countries need weather data<br>";
        echo "✅ Weather import process completed<br>";
        echo "</div>";
        exit;
    }
    
    // Prepare weather data insert statement
    $weatherStmt = $pdo->prepare("
        INSERT INTO weather_data (
            country_id, city_name, latitude, longitude, temperature,
            feels_like, humidity, pressure, wind_speed, wind_direction,
            weather_condition, weather_description, weather_icon,
            visibility, sunrise, sunset, data_timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    ");
    
    echo "<h3>🌡️ Fetching weather data for batch $BATCH_NUMBER...</h3>";
    
    // Crucial trackers
    $processed = 0;
    $errors = 0;
    $apiCalls = 0;
    
    foreach ($countries as $country) {
        try {
            // Reconnect to database periodically to prevent timeout
            if ($processed % 10 == 0 && $processed > 0) {
                $pdo = null; // Close connection
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
                // Re-prepare statement
                $weatherStmt = $pdo->prepare("
                    INSERT INTO weather_data (
                        country_id, city_name, latitude, longitude, temperature,
                        feels_like, humidity, pressure, wind_speed, wind_direction,
                        weather_condition, weather_description, weather_icon,
                        visibility, sunrise, sunset, data_timestamp
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                ");
            }
            
            // Build API URL
            $params = [
                'q' => $country['capital'] . ',' . $country['iso_code_2'],
                'appid' => $WEATHER_API_KEY,
                'units' => 'metric'
            ];
            
            $apiUrl = $WEATHER_BASE_URL . '?' . http_build_query($params);
            
            // Create context with shorter timeout
            $context = stream_context_create([
                'http' => [
                    'timeout' => 5, // Shorter timeout
                    'user_agent' => 'Gazetteer/1.0'
                ]
            ]);
            
            // Fetch weather data
            $weatherJson = @file_get_contents($apiUrl, false, $context);
            $apiCalls++;
            
            if ($weatherJson === false) {
                throw new Exception("Failed to fetch weather data");
            }
            
            $weatherData = json_decode($weatherJson, true);
            
            if ($weatherData === null || isset($weatherData['cod']) && $weatherData['cod'] != 200) {
                $error = isset($weatherData['message']) ? $weatherData['message'] : 'Unknown API error';
                throw new Exception("API Error: $error");
            }
            
            // Extract weather information
            $temperature = $weatherData['main']['temp'] ?? null;
            $feelsLike = $weatherData['main']['feels_like'] ?? null;
            $humidity = $weatherData['main']['humidity'] ?? null;
            $pressure = $weatherData['main']['pressure'] ?? null;
            $windSpeed = $weatherData['wind']['speed'] ?? null;
            $windDirection = $weatherData['wind']['deg'] ?? null;
            $weatherCondition = $weatherData['weather'][0]['main'] ?? null;
            $weatherDescription = $weatherData['weather'][0]['description'] ?? null;
            $weatherIcon = $weatherData['weather'][0]['icon'] ?? null;
            $visibility = $weatherData['visibility'] ?? null;
            
            // Convert sunrise/sunset
            $sunrise = null;
            $sunset = null;
            if (isset($weatherData['sys']['sunrise'])) {
                $sunrise = date('H:i:s', $weatherData['sys']['sunrise']);
            }
            if (isset($weatherData['sys']['sunset'])) {
                $sunset = date('H:i:s', $weatherData['sys']['sunset']);
            }
            
            // Get coordinates
            $lat = $weatherData['coord']['lat'] ?? $country['latitude'];
            $lng = $weatherData['coord']['lon'] ?? $country['longitude'];
            
            // Insert weather data
            $weatherStmt->execute([
                $country['id'], $country['capital'], $lat, $lng,
                $temperature, $feelsLike, $humidity, $pressure,
                $windSpeed, $windDirection, $weatherCondition,
                $weatherDescription, $weatherIcon, $visibility,
                $sunrise, $sunset
            ]);
            
            $processed++;
            echo "✅ {$country['name_common']} ({$country['capital']}) - {$temperature}°C<br>";
            
            // Small delay between requests (no long pauses)
            usleep(200000); // 0.2 seconds
            
        } catch (Exception $e) {
            $errors++;
            echo "❌ Error for {$country['name_common']} ({$country['capital']}): " . $e->getMessage() . "<br>";
        }
    }
    
    echo "<br><h3>📈 Batch $BATCH_NUMBER Statistics:</h3>";
    echo "✅ Countries processed: <strong>$processed</strong><br>";
    echo "📡 API calls made: <strong>$apiCalls</strong><br>";
    echo "❌ Errors encountered: <strong>$errors</strong><br>";
    
    // Show next batch button if there are more countries
    if ($totalRemaining > $BATCH_SIZE) {
        $nextBatch = $BATCH_NUMBER + 1;
        echo "<br><div style='background: #fff3cd; padding: 15px; border: 1px solid #ffeaa7; border-radius: 5px;'>";
        echo "🔄 <strong>MORE COUNTRIES TO PROCESS</strong><br>";
        echo "📊 Remaining countries: " . ($totalRemaining - $BATCH_SIZE) . "<br><br>";
        echo "<a href='?batch=$nextBatch' style='background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;'>";
        echo "▶️ Process Batch $nextBatch</a>";
        echo "</div>";
    } else {
        echo "<br><div style='background: #d4edda; padding: 15px; border: 1px solid #c3e6cb; border-radius: 5px;'>";
        echo "🎉 <strong>WEATHER IMPORT COMPLETED!</strong><br>";
        echo "✅ All countries with weather data processed<br>";
        echo "✅ Your Gazetteer is now 100% complete!<br>";
        echo "</div>";
    }
    
} catch (Exception $e) {
    echo "<div style='background: #f8d7da; padding: 15px; border: 1px solid #f5c6cb; border-radius: 5px;'>";
    echo "❌ <strong>BATCH PROCESSING ERROR!</strong><br>";
    echo "Error: " . htmlspecialchars($e->getMessage()) . "<br><br>";
    echo "<strong>Solutions:</strong><br>";
    echo "• Refresh the page to retry this batch<br>";
    echo "• Check your API key and internet connection<br>";
    echo "</div>";
}

echo "<br><hr>";
echo "<p><em>Batch $BATCH_NUMBER completed at: " . date('Y-m-d H:i:s') . "</em></p>";
?>