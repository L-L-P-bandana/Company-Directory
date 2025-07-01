<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

function logError($message) {
    error_log("getPorts.php: " . $message);
}

try {
    if (!isset($_GET['country']) || empty($_GET['country'])) {
        throw new Exception('Country code is required');
    }
    
    $countryCode = strtoupper($_GET['country']);
    logError("Fetching ports for country: " . $countryCode);
    
    // GeoNames API configuration
    $geonamesUsername = 'thisismypassword';
    
    // Fetch real ports from GeoNames API
    $ports = fetchGeoNamesPorts($countryCode, $geonamesUsername);
    
    logError("Port data prepared for: " . $countryCode . " (" . count($ports) . " ports)");
    echo json_encode($ports);
    
} catch (Exception $e) {
    logError("Error: " . $e->getMessage());
    echo json_encode([]);
}

function fetchGeoNamesPorts($countryCode, $username) {
    $ports = [];
    
    try {
        // GeoNames API URL for ports
        $apiUrl = "http://api.geonames.org/searchJSON?" . http_build_query([
            'country' => $countryCode,
            'fcode' => 'PRT', // Port feature code
            'orderby' => 'relevance',
            'maxRows' => 10, // Get up to 10 ports
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
            throw new Exception('Failed to fetch ports from GeoNames API');
        }
        
        $data = json_decode($response, true);
        
        if (!$data) {
            throw new Exception('Invalid response from GeoNames API');
        }
        
        if (isset($data['status'])) {
            throw new Exception('GeoNames API error: ' . ($data['status']['message'] ?? 'Unknown error'));
        }
        
        if (!isset($data['geonames']) || !is_array($data['geonames'])) {
            logError("No ports found for country: " . $countryCode);
            // Try alternative search for harbors and coastal cities
            return fetchAlternativePorts($countryCode, $username);
        }
        
        logError("GeoNames returned " . count($data['geonames']) . " ports");
        
        foreach ($data['geonames'] as $port) {
            $ports[] = [
                'name' => $port['name'] ?? $port['toponymName'] ?? 'Unknown Port',
                'lat' => floatval($port['lat'] ?? 0),
                'lng' => floatval($port['lng'] ?? 0),
                'type' => 'Seaport',
                'admin1' => $port['adminName1'] ?? '', // State/Region
                'population' => intval($port['population'] ?? 0),
                'country' => $port['countryName'] ?? ''
            ];
        }
        
        logError("Processed " . count($ports) . " ports successfully");
        return $ports;
        
    } catch (Exception $e) {
        logError("GeoNames API error: " . $e->getMessage());
        return fetchAlternativePorts($countryCode, $username);
    }
}

function fetchAlternativePorts($countryCode, $username) {
    try {
        // Searching for harbors
        $apiUrl = "http://api.geonames.org/searchJSON?" . http_build_query([
            'country' => $countryCode,
            'fcode' => 'HBR', // Harbor feature code
            'orderby' => 'relevance',
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
                $ports = [];
                
                foreach ($data['geonames'] as $harbor) {
                    $ports[] = [
                        'name' => $harbor['name'] ?? 'Unknown Harbor',
                        'lat' => floatval($harbor['lat'] ?? 0),
                        'lng' => floatval($harbor['lng'] ?? 0),
                        'type' => 'Harbor',
                        'admin1' => $harbor['adminName1'] ?? '',
                        'population' => intval($harbor['population'] ?? 0),
                        'country' => $harbor['countryName'] ?? ''
                    ];
                }
                
                return $ports;
            }
        }
        
        // If no harbors found, try coastal cities
        throw new Exception('Harbor search failed, trying coastal cities');
        
    } catch (Exception $e) {
        logError("Alternative port search failed: " . $e->getMessage());
        return [];
    }
}
?>