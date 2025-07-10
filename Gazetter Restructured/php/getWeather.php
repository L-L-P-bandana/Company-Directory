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
    logError("Fetching weather forecast for country: " . $countryCode);
    
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
    
    // Get weather forecast data from OpenWeatherMap
    $forecastData = fetchWeatherForecast($capital, $countryCode, $apiKey);
    
    logError("Weather forecast data prepared for: " . $capital);
    echo json_encode($forecastData);
    
} catch (Exception $e) {
    logError("Error: " . $e->getMessage());
    
    // Return error response with fallback structure
    http_response_code(500);
    echo json_encode([
        'error' => 'Weather API unavailable',
        'message' => $e->getMessage(),
        'location' => 'Unknown',
        'lastUpdated' => date('H:i, jS M'),
        'forecast' => [
            [
                'condition' => 'Weather unavailable',
                'icon' => '',
                'maxTemp' => '--',
                'minTemp' => '--'
            ],
            [
                'date' => 'Tomorrow',
                'icon' => '',
                'maxTemp' => '--',
                'minTemp' => '--'
            ],
            [
                'date' => 'Day After',
                'icon' => '',
                'maxTemp' => '--',
                'minTemp' => '--'
            ]
        ]
    ]);
}

function fetchWeatherForecast($city, $countryCode, $apiKey) {
    try {
        // OpenWeatherMap 5-day forecast API
        $forecastApiUrl = "https://api.openweathermap.org/data/2.5/forecast?" . http_build_query([
            'q' => $city . ',' . $countryCode,
            'appid' => $apiKey,
            'units' => 'metric', // Get temp in Celsius
            'cnt' => 24 // Get enough data for 3 days
        ]);
        
        logError("Calling OpenWeatherMap Forecast API: " . $forecastApiUrl);
        
        $context = stream_context_create([
            'http' => [
                'timeout' => 15,
                'user_agent' => 'Gazetteer/1.0'
            ]
        ]);
        
        $response = file_get_contents($forecastApiUrl, false, $context);
        
        if ($response === false) {
            throw new Exception('Failed to fetch forecast data from OpenWeatherMap API');
        }
        
        $forecastData = json_decode($response, true);
        
        if (!$forecastData) {
            throw new Exception('Invalid response from weather forecast API');
        }
        
        // Check for API errors
        if (isset($forecastData['cod']) && $forecastData['cod'] !== "200") {
            $errorMessage = isset($forecastData['message']) ? $forecastData['message'] : 'Unknown forecast API error';
            throw new Exception('Weather forecast API error: ' . $errorMessage);
        }
        
        // Process forecast data for 3 days
        $forecast = processForecastData($forecastData);
        
        $result = [
            'location' => $city,
            'lastUpdated' => date('H:i, jS M'),
            'forecast' => $forecast
        ];
        
        logError("Successfully processed forecast data - " . count($forecast) . " days");
        return $result;
        
    } catch (Exception $e) {
        logError("Weather forecast API error: " . $e->getMessage());
        throw $e;
    }
}

function processForecastData($forecastData) {
    $forecast = [];
    $dailyData = [];
    
    // Group forecast by date
    foreach ($forecastData['list'] as $item) {
        $date = date('Y-m-d', $item['dt']);
        
        if (!isset($dailyData[$date])) {
            $dailyData[$date] = [
                'temps' => [],
                'conditions' => [],
                'icons' => []
            ];
        }
        
        $dailyData[$date]['temps'][] = $item['main']['temp'];
        $dailyData[$date]['conditions'][] = $item['weather'][0]['description'];
        $dailyData[$date]['icons'][] = $item['weather'][0]['icon'];
    }
    
    $dayCount = 0;
    foreach ($dailyData as $date => $data) {
        if ($dayCount >= 3) break;
        
        $maxTemp = round(max($data['temps']));
        $minTemp = round(min($data['temps']));
        
        // Get most common condition and icon
        $conditionCounts = array_count_values($data['conditions']);
        $condition = array_key_first($conditionCounts);
        
        $iconCounts = array_count_values($data['icons']);
        $icon = array_key_first($iconCounts);
        $iconUrl = "https://openweathermap.org/img/wn/{$icon}@2x.png";
        
        if ($dayCount === 0) {
            // Today
            $forecast[] = [
                'condition' => ucwords($condition),
                'icon' => $iconUrl,
                'maxTemp' => $maxTemp,
                'minTemp' => $minTemp
            ];
        } else {
            // Future days
            $dayName = $dayCount === 1 ? 
                date('D jS', strtotime($date)) : 
                date('D jS', strtotime($date));
            
            $forecast[] = [
                'date' => $dayName,
                'icon' => $iconUrl,
                'maxTemp' => $maxTemp,
                'minTemp' => $minTemp
            ];
        }
        
        $dayCount++;
    }
    
    // Ensure we always have 3 days
    while (count($forecast) < 3) {
        $forecast[] = [
            'date' => 'N/A',
            'icon' => '',
            'maxTemp' => '--',
            'minTemp' => '--'
        ];
    }
    
    return $forecast;
}
?>