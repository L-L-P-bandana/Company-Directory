<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

function logError($message) {
    error_log("getCities.php: " . $message);
}

try {
    if (!isset($_GET['country']) || empty($_GET['country'])) {
        throw new Exception('Country code is required');
    }
    
    $countryCode = strtoupper($_GET['country']);
    logError("Fetching cities for country: " . $countryCode);
    
    // GeoNames API configuration
    $geonamesUsername = 'thisismypassword'; // Your actual GeoNames username
    
    // Fetch real cities from GeoNames API
    $cities = fetchGeoNamesCities($countryCode, $geonamesUsername);
    
    logError("Cities data prepared for: " . $countryCode . " (" . count($cities) . " cities)");
    echo json_encode($cities);
    
} catch (Exception $e) {
    logError("Error: " . $e->getMessage());
    // Minimal fallback only if API completely fails
    echo json_encode([]);
}

function fetchGeoNamesCities($countryCode, $username) {
    $cities = [];
    
    try {
        // GeoNames API URL for cities (populated places)
        $apiUrl = "http://api.geonames.org/searchJSON?" . http_build_query([
            'country' => $countryCode,
            'featureClass' => 'P', // Populated places
            'orderby' => 'population',
            'maxRows' => 20, // Get up to 20 cities
            'username' => $username
        ]);
        
        logError("Calling GeoNames API: " . $apiUrl);
        
        $context = stream_context_create([
            'http' => [
                'timeout' => 15,
                'user_agent' => 'Gazetteer/1.0'
            ]
        ]);
        
        $response = file_get_contents($apiUrl, false, $context);
        
        if ($response === false) {
            throw new Exception('Failed to fetch cities from GeoNames API');
        }
        
        $data = json_decode($response, true);
        
        if (!$data) {
            throw new Exception('Invalid response from GeoNames API');
        }
        
        if (isset($data['status'])) {
            throw new Exception('GeoNames API error: ' . ($data['status']['message'] ?? 'Unknown error'));
        }
        
        if (!isset($data['geonames']) || !is_array($data['geonames'])) {
            logError("No cities found for country: " . $countryCode);
            return [];
        }
        
        logError("GeoNames returned " . count($data['geonames']) . " cities");
        
        foreach ($data['geonames'] as $city) {
            $cities[] = [
                'name' => $city['name'] ?? $city['toponymName'] ?? 'Unknown City',
                'lat' => floatval($city['lat'] ?? 0),
                'lng' => floatval($city['lng'] ?? 0),
                'population' => intval($city['population'] ?? 0),
                'admin1' => $city['adminName1'] ?? '', // State/Region
                'fcode' => $city['fcode'] ?? '', // Feature code (PPLC=capital, PPL=city, etc.)
                'country' => $city['countryName'] ?? ''
            ];
        }
        
        // Already sorted by population from API (orderby=population)
        logError("Processed " . count($cities) . " cities successfully");
        return $cities;
        
    } catch (Exception $e) {
        logError("GeoNames API error: " . $e->getMessage());
        // Return empty array if API fails completely
        return [];
    }
}
?>