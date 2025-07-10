<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

try {
    if (!isset($_GET['country']) || empty($_GET['country'])) {
        throw new Exception('Country code is required');
    }
    
    $requestedCountryCode = strtoupper($_GET['country']);
    
    // Load the GeoJSON file
    $geoJsonFile = '../countryBorders.geo.json';
    
    if (!file_exists($geoJsonFile)) {
        throw new Exception('Country borders file not found');
    }
    
    $geoJsonContent = file_get_contents($geoJsonFile);
    
    if ($geoJsonContent === false) {
        throw new Exception('Failed to read country borders file');
    }
    
    $data = json_decode($geoJsonContent, true);
    
    if (!$data || !isset($data['features'])) {
        throw new Exception('Invalid GeoJSON format');
    }
    
    // Search for the requested country
    foreach ($data['features'] as $feature) {
        if (isset($feature['properties'])) {
            $featureCode = getCountryCode($feature['properties']);
            
            if ($featureCode === $requestedCountryCode) {
                echo json_encode($feature);
                exit;
            }
        }
    }
    
    throw new Exception('Country not found: ' . $requestedCountryCode);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}

function getCountryCode($properties) {
    $isoProps = [
        'ISO3166-1-Alpha-2',
        'ISO_A2',
        'iso_a2',
        'ISO2',
        'iso2'
    ];
    
    foreach ($isoProps as $prop) {
        if (isset($properties[$prop])) {
            $value = $properties[$prop];
            if ($value && $value !== '-99' && $value !== '' && strlen($value) === 2) {
                return strtoupper($value);
            }
        }
    }
    
    // Fallback to name-based mapping
    if (isset($properties['name'])) {
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
        
        return $nameToIso[$properties['name']] ?? null;
    }
    
    return null;
}
?>