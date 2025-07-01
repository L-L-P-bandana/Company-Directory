<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

function logError($message) {
    error_log("getCountryInfo.php: " . $message);
}

try {
    if (!isset($_GET['country']) || empty($_GET['country'])) {
        throw new Exception('Country code is required');
    }
    
    $countryCode = strtoupper($_GET['country']);
    logError("Fetching data for country: " . $countryCode);
    
    // Use REST Countries API
    $apiUrl = "https://restcountries.com/v3.1/alpha/" . $countryCode;
    
    logError("Calling API: " . $apiUrl);
    
    $context = stream_context_create([
        'http' => [
            'timeout' => 10,
            'user_agent' => 'Gazetteer/1.0'
        ]
    ]);
    
    $response = file_get_contents($apiUrl, false, $context);
    
    if ($response === false) {
        logError("API call failed for: " . $countryCode);
        throw new Exception('Failed to fetch country data from API');
    }
    
    $data = json_decode($response, true);
    
    if (!$data || empty($data)) {
        logError("Invalid API response for: " . $countryCode);
        throw new Exception('Invalid response from country API');
    }
    
    // Extract data from first result
    $country = $data[0];
    
    // Format population with commas
    $population = isset($country['population']) ? number_format($country['population']) : 'N/A';
    
    // Format area
    $area = isset($country['area']) ? number_format($country['area']) . ' km²' : 'N/A';
    
    // Get capital (handle array format)
    $capital = 'N/A';
    if (isset($country['capital']) && is_array($country['capital'])) {
        $capital = $country['capital'][0];
    } elseif (isset($country['capital'])) {
        $capital = $country['capital'];
    }
    
    // Get region
    $region = isset($country['region']) ? $country['region'] : 'N/A';
    if (isset($country['subregion']) && $country['subregion'] !== $region) {
        $region .= ' (' . $country['subregion'] . ')';
    }
    
    $result = [
        'population' => $population,
        'area' => $area,
        'capital' => $capital,
        'region' => $region
    ];
    
    logError("Successfully processed data for: " . $countryCode);
    echo json_encode($result);
    
} catch (Exception $e) {
    logError("Error: " . $e->getMessage());
    
    // Fallback to dummy data if API fails
    $countryCode = isset($countryCode) ? $countryCode : 'UNKNOWN';
    
    $fallbackData = [
        'AL' => [
            'population' => '2,838,000',
            'area' => '28,748 km²',
            'capital' => 'Tirana',
            'region' => 'Europe'
        ],
        'US' => [
            'population' => '331,900,000',
            'area' => '9,833,517 km²',
            'capital' => 'Washington, D.C.',
            'region' => 'North America'
        ],
        'GB' => [
            'population' => '67,886,000',
            'area' => '242,495 km²',
            'capital' => 'London',
            'region' => 'Europe'
        ]
    ];
    
    if (isset($fallbackData[$countryCode])) {
        echo json_encode($fallbackData[$countryCode]);
    } else {
        echo json_encode([
            'population' => 'API Error - Data unavailable',
            'area' => 'API Error - Data unavailable',
            'capital' => 'API Error - Data unavailable',
            'region' => 'API Error - Data unavailable'
        ]);
    }
}
?>