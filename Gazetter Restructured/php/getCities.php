<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

try {
    if (!isset($_GET['country']) || empty($_GET['country'])) {
        throw new Exception('Country code is required');
    }
    
    $countryCode = strtoupper($_GET['country']);
    
    // GeoNames API configuration
    $geonamesUsername = 'thisismypassword';
    
    // Fetch cities from GeoNames
    $cities = fetchGeoNamesCities($countryCode, $geonamesUsername);
    
    echo json_encode($cities);
    
} catch (Exception $e) {
    echo json_encode([]);
}

function fetchGeoNamesCities($countryCode, $username) {
    $cities = [];
    
    try {
        // GeoNames API URL for populated cities
        $apiUrl = "http://api.geonames.org/searchJSON?" . http_build_query([
            'country' => $countryCode,
            'featureClass' => 'P', // Populated places
            'orderby' => 'population',
            'maxRows' => 20, // Get up to 20 cities (avoid clutter)
            'username' => $username
        ]);
        
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
            return [];
        }
        
        foreach ($data['geonames'] as $city) {
            $cities[] = [
                'name' => $city['name'] ?? $city['toponymName'] ?? 'Unknown City',
                'lat' => floatval($city['lat'] ?? 0),
                'lng' => floatval($city['lng'] ?? 0),
                'population' => intval($city['population'] ?? 0),
                'admin1' => $city['adminName1'] ?? '', // State/Region
                'fcode' => $city['fcode'] ?? '', // Feature code (PPLC=capital, PPL=city, etc.)
            ];
        }
        
        return $cities;
        
    } catch (Exception $e) {
        return [];
    }
}
?>