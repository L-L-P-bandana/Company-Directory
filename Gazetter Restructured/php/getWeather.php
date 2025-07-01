<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

function logError($message) {
    error_log("getWeather.php: " . $message);
}

try {
    if (!isset($_GET['country']) || empty($_GET['country'])) {
        throw new Exception('Country code is required');
    }
    
    $countryCode = strtoupper($_GET['country']);
    logError("Fetching weather for country: " . $countryCode);
    
    // OpenWeatherMap API key
    $apiKey = "633c784df32af33d2e4fbb39d138ce4f";
    
    // Get country info to find capital city
    $countryApiUrl = "https://restcountries.com/v3.1/alpha/" . $countryCode;
    
    $context = stream_context_create([
        'http' => [
            'timeout' => 10,
            'user_agent' => 'Gazetteer/1.0'
        ]
    ]);
    
    $countryResponse = file_get_contents($countryApiUrl, false, $context);
    
    if ($countryResponse === false) {
        throw new Exception('Failed to fetch country data');
    }
    
    $countryData = json_decode($countryResponse, true);
    
    if (!$countryData || empty($countryData)) {
        throw new Exception('Invalid country data');
    }
    
    // Get capital city
    $capital = 'Unknown';
    if (isset($countryData[0]['capital']) && is_array($countryData[0]['capital'])) {
        $capital = $countryData[0]['capital'][0];
    } elseif (isset($countryData[0]['capital'])) {
        $capital = $countryData[0]['capital'];
    }
    
    if ($capital === 'Unknown') {
        throw new Exception('Could not determine capital city for weather data');
    }
    
    logError("Capital city: " . $capital);
    
    // Get weather data from OpenWeatherMap
    $weatherData = fetchRealWeatherData($capital, $countryCode, $apiKey);
    
    logError("Weather data prepared for: " . $capital);
    echo json_encode($weatherData);
    
} catch (Exception $e) {
    logError("Error: " . $e->getMessage());
    
    // NO FALLBACK DATA - return error response
    http_response_code(500);
    echo json_encode([
        'error' => 'Weather API unavailable',
        'message' => $e->getMessage(),
        'temperature' => 'N/A',
        'condition' => 'Weather data unavailable',
        'humidity' => 'N/A'
    ]);
}

function fetchRealWeatherData($city, $countryCode, $apiKey) {
    try {
        // OpenWeatherMap Current Weather API
        $weatherApiUrl = "https://api.openweathermap.org/data/2.5/weather?" . http_build_query([
            'q' => $city . ',' . $countryCode,
            'appid' => $apiKey,
            'units' => 'metric' // Get temp in Celsius
        ]);
        
        logError("Calling OpenWeatherMap API: " . $weatherApiUrl);
        
        $context = stream_context_create([
            'http' => [
                'timeout' => 15,
                'user_agent' => 'Gazetteer/1.0'
            ]
        ]);
        
        $response = file_get_contents($weatherApiUrl, false, $context);
        
        if ($response === false) {
            throw new Exception('Failed to fetch weather data from OpenWeatherMap API');
        }
        
        $weatherData = json_decode($response, true);
        
        if (!$weatherData) {
            throw new Exception('Invalid response from weather API');
        }
        
        // Check for API errors
        if (isset($weatherData['cod']) && $weatherData['cod'] !== 200) {
            $errorMessage = isset($weatherData['message']) ? $weatherData['message'] : 'Unknown weather API error';
            throw new Exception('Weather API error: ' . $errorMessage);
        }
        
        // Extract weather information
        $temperature = round($weatherData['main']['temp'] ?? 0);
        $condition = $weatherData['weather'][0]['description'] ?? 'Unknown';
        $humidity = $weatherData['main']['humidity'] ?? 0;
        
        // Capitalize condition for better display
        $condition = ucwords($condition);
        
        $result = [
            'temperature' => $temperature . '°C',
            'condition' => $condition,
            'humidity' => $humidity . '%',
            'city' => $city,
            'pressure' => isset($weatherData['main']['pressure']) ? $weatherData['main']['pressure'] . ' hPa' : 'N/A',
            'wind_speed' => isset($weatherData['wind']['speed']) ? round($weatherData['wind']['speed']) . ' m/s' : 'N/A',
            'feels_like' => isset($weatherData['main']['feels_like']) ? round($weatherData['main']['feels_like']) . '°C' : 'N/A'
        ];
        
        logError("Successfully processed weather data - Temp: " . $result['temperature'] . ", Condition: " . $result['condition']);
        return $result;
        
    } catch (Exception $e) {
        logError("Weather API error: " . $e->getMessage());
        
        throw $e;
    }
}
?>