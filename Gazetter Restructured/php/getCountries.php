<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

function logError($message) {
    error_log("getCountries.php: " . $message);
}

try {
    logError("Script started");
    
    $geoJsonFile = '../countryBorders.geo.json';
    
    if (!file_exists($geoJsonFile)) {
        throw new Exception('Country borders file not found');
    }
    
    $json = file_get_contents($geoJsonFile);
    $data = json_decode($json, true);
    
    if (!$data || !isset($data['features'])) {
        throw new Exception('Invalid GeoJSON data');
    }
    
    logError("Found " . count($data['features']) . " features");
    
    $countries = [];
    
    foreach ($data['features'] as $index => $feature) {
        if (isset($feature['properties'])) {
            $props = $feature['properties'];
            
            // Use the exact property names from the GeoJSON file
            if (isset($props['ISO3166-1-Alpha-2']) && isset($props['name'])) {
                $countryCode = $props['ISO3166-1-Alpha-2'];
                $countryName = $props['name'];
                
                // Make sure I've got valid data
                if (!empty($countryCode) && !empty($countryName)) {
                    $countries[] = [
                        'code' => strtoupper($countryCode),
                        'name' => $countryName
                    ];
                }
            }
            
            // Log first few entries for debugging
            if ($index < 3) {
                logError("Feature $index - Code: " . ($props['ISO3166-1-Alpha-2'] ?? 'N/A') . ", Name: " . ($props['name'] ?? 'N/A'));
            }
        }
    }
    
    logError("Processed " . count($countries) . " valid countries");
    
    // Sort by name
    usort($countries, function($a, $b) {
        return strcmp($a['name'], $b['name']);
    });
    
    // Log sample countries
    if (count($countries) > 0) {
        logError("Sample countries: " . $countries[0]['code'] . " - " . $countries[0]['name']);
        if (count($countries) > 1) {
            logError("Second country: " . $countries[1]['code'] . " - " . $countries[1]['name']);
        }
    }
    
    echo json_encode($countries);
    
} catch (Exception $e) {
    logError("Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>