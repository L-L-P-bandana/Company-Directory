<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

function logError($message) {
    error_log("getAirports.php: " . $message);
}

try {
    if (!isset($_GET['country']) || empty($_GET['country'])) {
        throw new Exception('Country code is required');
    }
    
    $countryCode = strtoupper($_GET['country']);
    logError("Fetching airports for country: " . $countryCode);
    
    // GeoNames API configuration
    $geonamesUsername = 'thisismypassword'; // Your actual GeoNames username
    
    // Fetch real airports from GeoNames API
    $airports = fetchGeoNamesAirports($countryCode, $geonamesUsername);
    
    logError("Airports data prepared for: " . $countryCode . " (" . count($airports) . " airports)");
    echo json_encode($airports);
    
} catch (Exception $e) {
    logError("Error: " . $e->getMessage());
    // Minimal fallback only if API completely fails
    echo json_encode([]);
}

function fetchGeoNamesAirports($countryCode, $username) {
    $airports = [];
    
    try {
        // GeoNames API URL for airports
        $apiUrl = "http://api.geonames.org/searchJSON?" . http_build_query([
            'country' => $countryCode,
            'fcode' => 'AIRP', // Airport feature code
            'orderby' => 'relevance',
            'maxRows' => 15, // Get up to 15 airports
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
            throw new Exception('Failed to fetch airports from GeoNames API');
        }
        
        $data = json_decode($response, true);
        
        if (!$data) {
            throw new Exception('Invalid response from GeoNames API');
        }
        
        if (isset($data['status'])) {
            throw new Exception('GeoNames API error: ' . ($data['status']['message'] ?? 'Unknown error'));
        }
        
        if (!isset($data['geonames']) || !is_array($data['geonames'])) {
            logError("No airports found for country: " . $countryCode);
            return [];
        }
        
        logError("GeoNames returned " . count($data['geonames']) . " airports");
        
        foreach ($data['geonames'] as $airport) {
            // Extract IATA code from name if available (usually in parentheses)
            $name = $airport['name'] ?? $airport['toponymName'] ?? 'Unknown Airport';
            $code = extractAirportCode($name, $airport);
            
            $airports[] = [
                'name' => $name,
                'lat' => floatval($airport['lat'] ?? 0),
                'lng' => floatval($airport['lng'] ?? 0),
                'code' => $code,
                'admin1' => $airport['adminName1'] ?? '', // State/Region
                'elevation' => intval($airport['elevation'] ?? 0),
                'country' => $airport['countryName'] ?? ''
            ];
        }
        
        logError("Processed " . count($airports) . " airports successfully");
        return $airports;
        
    } catch (Exception $e) {
        logError("GeoNames API error: " . $e->getMessage());
        // Return empty array if API fails completely
        return [];
    }
}

function extractAirportCode($name, $airport) {
    // Try to extract IATA code from name (usually in parentheses)
    if (preg_match('/\(([A-Z]{3})\)/', $name, $matches)) {
        return $matches[1];
    }
    
    // Try to extract from toponymName if different
    if (isset($airport['toponymName']) && $airport['toponymName'] !== $name) {
        if (preg_match('/\(([A-Z]{3})\)/', $airport['toponymName'], $matches)) {
            return $matches[1];
        }
    }
    
    // Check for common airport code patterns
    if (preg_match('/\b([A-Z]{3})\b/', $name, $matches)) {
        return $matches[1];
    }
    
    // Generate code from airport name
    $cleanName = preg_replace('/\b(International|Airport|Field|Airfield|Regional)\b/i', '', $name);
    $words = preg_split('/\s+/', trim($cleanName));
    
    if (count($words) >= 2) {
        return strtoupper(substr($words[0], 0, 2) . substr($words[1], 0, 1));
    } elseif (count($words) == 1) {
        return strtoupper(substr($words[0], 0, 3));
    }
    
    // Last resort: use first 3 letters of name
    return strtoupper(substr(preg_replace('/[^A-Za-z]/', '', $name), 0, 3));
}
?>