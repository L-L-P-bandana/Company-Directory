<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

function logError($message) {
    error_log("getCountryBorder.php: " . $message);
}

function getCountryCode($properties) {
    // Try multiple possible ISO code properties in order of preference (Necessary as France and Norway were being stubborn)
    $isoProps = [
        'ISO3166-1-Alpha-2',  // Primary
        'ISO_A2',             // Alternative
        'iso_a2',             // Lowercase alternative
        'ISO2',               // Another common name
        'iso2'                // Lowercase
    ];
    
    foreach ($isoProps as $prop) {
        if (isset($properties[$prop])) {
            $value = $properties[$prop];
            if ($value && $value !== '-99' && $value !== '' && strlen($value) === 2) {
                return strtoupper($value);
            }
        }
    }
    
    // If no valid ISO code found, try to map by name
    return mapCountryNameToIso($properties['name'] ?? '');
}

function mapCountryNameToIso($countryName) {
    if (!$countryName) return null;
    
    $nameToIso = [
        'France' => 'FR',
        'French Republic' => 'FR',
        'Norway' => 'NO',
        'Kingdom of Norway' => 'NO',
        'United Kingdom' => 'GB',
        'United States of America' => 'US',
        'United States' => 'US',
        'Germany' => 'DE',
        'Federal Republic of Germany' => 'DE'
    ];
    
    return $nameToIso[$countryName] ?? null;
}

try {
    if (!isset($_GET['country']) || empty($_GET['country'])) {
        throw new Exception('Country code is required');
    }
    
    $requestedCountryCode = strtoupper($_GET['country']);
    logError("Looking for country: " . $requestedCountryCode);
    
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
    
    foreach ($data['features'] as $index => $feature) {
        if (isset($feature['properties'])) {
            $featureCode = getCountryCode($feature['properties']);
            
            if ($featureCode === $requestedCountryCode) {
                logError("Found match: {$featureCode} for {$requestedCountryCode}");
                logError("Country name: " . ($feature['properties']['name'] ?? 'Unknown'));
                echo json_encode($feature);
                exit;
            }
        }
    }
    
    logError("Country not found: " . $requestedCountryCode);
    
    // Additional debugging: show what we did find for similar names
    $similarCountries = [];
    foreach ($data['features'] as $feature) {
        if (isset($feature['properties']['name'])) {
            $name = $feature['properties']['name'];
            if (($requestedCountryCode === 'FR' && stripos($name, 'france') !== false) ||
                ($requestedCountryCode === 'NO' && stripos($name, 'norway') !== false)) {
                $similarCountries[] = [
                    'name' => $name,
                    'attempted_code' => getCountryCode($feature['properties']),
                    'properties' => $feature['properties']
                ];
            }
        }
    }
    
    if (!empty($similarCountries)) {
        logError("Found similar countries: " . json_encode($similarCountries));
    }
    
    throw new Exception('Country not found: ' . $requestedCountryCode);
    
} catch (Exception $e) {
    logError("Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>