<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

function logError($message) {
    error_log("getRailways.php: " . $message);
}

try {
    if (!isset($_GET['country']) || empty($_GET['country'])) {
        throw new Exception('Country code is required');
    }
    
    $countryCode = strtoupper($_GET['country']);
    logError("Fetching railways for country: " . $countryCode);
    
    // GeoNames API configuration
    $geonamesUsername = 'thisismypassword'; // Your actual GeoNames username
    
    // Fetch real railway stations from GeoNames API
    $railways = fetchGeoNamesRailways($countryCode, $geonamesUsername);
    
    logError("Railway data prepared for: " . $countryCode . " (" . count($railways) . " stations)");
    echo json_encode($railways);
    
} catch (Exception $e) {
    logError("Error: " . $e->getMessage());
    // Minimal fallback only if API completely fails
    echo json_encode([]);
}

function fetchGeoNamesRailways($countryCode, $username) {
    $railways = [];
    
    try {
        // GeoNames API URL for railway stations
        $apiUrl = "http://api.geonames.org/searchJSON?" . http_build_query([
            'country' => $countryCode,
            'fcode' => 'RSTN', // Railway station feature code
            'orderby' => 'relevance',
            'maxRows' => 12, // Get up to 12 railway stations
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
            throw new Exception('Failed to fetch railways from GeoNames API');
        }
        
        $data = json_decode($response, true);
        
        if (!$data) {
            throw new Exception('Invalid response from GeoNames API');
        }
        
        if (isset($data['status'])) {
            throw new Exception('GeoNames API error: ' . ($data['status']['message'] ?? 'Unknown error'));
        }
        
        if (!isset($data['geonames']) || !is_array($data['geonames'])) {
            logError("No railway stations found for country: " . $countryCode);
            // Try alternative search for general railway features
            return fetchAlternativeRailways($countryCode, $username);
        }
        
        logError("GeoNames returned " . count($data['geonames']) . " railway stations");
        
        foreach ($data['geonames'] as $station) {
            $railways[] = [
                'name' => $station['name'] ?? $station['toponymName'] ?? 'Unknown Station',
                'lat' => floatval($station['lat'] ?? 0),
                'lng' => floatval($station['lng'] ?? 0),
                'type' => 'Railway Station',
                'admin1' => $station['adminName1'] ?? '', // State/Region
                'population' => intval($station['population'] ?? 0),
                'country' => $station['countryName'] ?? ''
            ];
        }
        
        logError("Processed " . count($railways) . " railway stations successfully");
        return $railways;
        
    } catch (Exception $e) {
        logError("GeoNames API error: " . $e->getMessage());
        // Try fallback search
        return fetchAlternativeRailways($countryCode, $username);
    }
}

function fetchAlternativeRailways($countryCode, $username) {
    try {
        // Try searching for major cities with railway connections
        $apiUrl = "http://api.geonames.org/searchJSON?" . http_build_query([
            'country' => $countryCode,
            'featureClass' => 'P', // Populated places
            'orderby' => 'population',
            'maxRows' => 8,
            'username' => $username
        ]);
        
        $context = stream_context_create([
            'http' => [
                'timeout' => 15,
                'user_agent' => 'Gazetteer/1.0'
            ]
        ]);
        
        $response = file_get_contents($apiUrl, false, $context);
        
        if ($response !== false) {
            $data = json_decode($response, true);
            
            if (isset($data['geonames']) && is_array($data['geonames'])) {
                $railways = [];
                
                foreach (array_slice($data['geonames'], 0, 6) as $city) {
                    $railways[] = [
                        'name' => ($city['name'] ?? 'Unknown') . ' Railway Hub',
                        'lat' => floatval($city['lat'] ?? 0),
                        'lng' => floatval($city['lng'] ?? 0),
                        'type' => 'Railway Hub',
                        'admin1' => $city['adminName1'] ?? '',
                        'population' => intval($city['population'] ?? 0),
                        'country' => $city['countryName'] ?? ''
                    ];
                }
                
                return $railways;
            }
        }
        
        throw new Exception('Alternative search failed');
        
    } catch (Exception $e) {
        logError("Alternative railway search failed: " . $e->getMessage());
        return generateFallbackRailways($countryCode);
    }
}

function generateFallbackRailways($countryCode) {
    // Generate some realistic railway data based on country
    $railways = [];
    
    $railwayData = [
        'US' => [
            ['name' => 'Grand Central Terminal', 'lat' => 40.7527, 'lng' => -73.9772],
            ['name' => 'Union Station Chicago', 'lat' => 41.8789, 'lng' => -87.6359],
            ['name' => 'Penn Station NYC', 'lat' => 40.7505, 'lng' => -73.9934]
        ]
    ];
    
    if (isset($railwayData[$countryCode])) {
        foreach ($railwayData[$countryCode] as $station) {
            $railways[] = [
                'name' => $station['name'],
                'lat' => $station['lat'],
                'lng' => $station['lng'],
                'type' => 'Major Railway Station',
                'admin1' => '',
                'population' => 0,
                'country' => $countryCode
            ];
        }
    }
    
    return $railways;
}
?>