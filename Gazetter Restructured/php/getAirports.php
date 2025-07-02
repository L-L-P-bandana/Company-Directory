<?php
// Enable error reporting for debugging
ini_set('display_errors', 0); // Keep off for production
error_reporting(E_ALL);

header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');

try {
    if (!isset($_GET['country']) || empty($_GET['country'])) {
        throw new Exception('Country code is required');
    }
    
    $countryCode = strtoupper(trim($_GET['country']));
    
    // Get the airports
    $airports = getAirportsSimple($countryCode);
    echo json_encode($airports, JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    // Return empty array on any error (don't break the app)
    echo json_encode([]);
}

function getAirportsSimple($countryCode) {
    try {
        $username = 'thisismypassword';
        
        // API call
        $apiUrl = "http://api.geonames.org/searchJSON?" . http_build_query([
            'country' => $countryCode,
            'fcode' => 'AIRP',
            'orderby' => 'relevance',
            'maxRows' => 15,
            'username' => $username
        ]);
        
        // Make request with context
        $context = stream_context_create([
            'http' => [
                'timeout' => 15,
                'user_agent' => 'Gazetteer/1.0',
                'method' => 'GET'
            ]
        ]);
        
        $response = file_get_contents($apiUrl, false, $context);
        
        if ($response === false) {
            return []; // Return empty array if API fails
        }
        
        $data = json_decode($response, true);
        
        if (!$data || !isset($data['geonames'])) {
            return []; // Return empty array if no data
        }
        
        // Process the airports
        $airports = [];
        foreach ($data['geonames'] as $airport) {
            $name = $airport['name'] ?? $airport['toponymName'] ?? 'Unknown Airport';
            
            // Gen airport code
            $code = generateSimpleCode($name);
            
            $airports[] = [
                'name' => $name,
                'lat' => floatval($airport['lat'] ?? 0),
                'lng' => floatval($airport['lng'] ?? 0),
                'code' => $code,
                'admin1' => $airport['adminName1'] ?? '',
                'elevation' => intval($airport['elevation'] ?? 0),
                'country' => $airport['countryName'] ?? ''
            ];
        }
        
        return $airports;
        
    } catch (Exception $e) {
        return []; // Return empty array on error
    }
}

function generateSimpleCode($name) {
    // Extract IATA code if present
    if (preg_match('/\(([A-Z]{3})\)/', $name, $matches)) {
        return $matches[1];
    }
    
    // Generate from name
    $clean = preg_replace('/[^A-Za-z\s]/', '', $name);
    $words = explode(' ', trim($clean));
    
    if (count($words) >= 2) {
        return strtoupper(substr($words[0], 0, 2) . substr($words[1], 0, 1));
    }
    
    return strtoupper(substr($clean, 0, 3));
}
?>