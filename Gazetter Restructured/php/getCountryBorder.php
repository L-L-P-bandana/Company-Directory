<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

function logError($message) {
    error_log("getCountryBorder.php: " . $message);
}

try {
    if (!isset($_GET['country']) || empty($_GET['country'])) {
        throw new Exception('Country code is required');
    }
    
    $countryCode = strtoupper($_GET['country']);
    logError("Looking for country: " . $countryCode);
    
    $geoJsonFile = '../countryBorders.geo.json';
    
    if (!file_exists($geoJsonFile)) {
        throw new Exception('Country borders file not found');
    }
    
    $json = file_get_contents($geoJsonFile);
    $data = json_decode($json, true);
    
    if (!$data || !isset($data['features'])) {
        throw new Exception('Invalid GeoJSON data');
    }
    
    logError("Searching through " . count($data['features']) . " features");
    
    foreach ($data['features'] as $feature) {
        if (isset($feature['properties']['ISO3166-1-Alpha-2'])) {
            $featureCode = strtoupper($feature['properties']['ISO3166-1-Alpha-2']);
            
            if ($featureCode === $countryCode) {
                logError("Found match: " . $featureCode);
                echo json_encode($feature);
                exit;
            }
        }
    }
    
    logError("Country not found: " . $countryCode);
    throw new Exception('Country not found: ' . $countryCode);
    
} catch (Exception $e) {
    logError("Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>