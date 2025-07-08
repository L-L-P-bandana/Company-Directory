<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

function logError($message) {
    error_log("getCountries.php: " . $message);
}

function getCountryCode($properties) {
    // Try multiple possible ISO code properties (Necessary as France and Norway were being stubborn)
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
    $problemCountries = [];
    
    foreach ($data['features'] as $index => $feature) {
        if (isset($feature['properties'])) {
            $props = $feature['properties'];
            
            // Use robust country code detection
            $countryCode = getCountryCode($props);
            $countryName = $props['name'] ?? 'Unknown';
            
            if ($countryCode && !empty($countryName)) {
                $countries[] = [
                    'code' => $countryCode,
                    'name' => $countryName
                ];
                
                // Log specific countries we're interested in
                if (stripos($countryName, 'france') !== false || stripos($countryName, 'norway') !== false) {
                    logError("Special country found - Name: {$countryName}, Code: {$countryCode}");
                }
            } else {
                // Track problem countries for debugging
                $problemCountries[] = [
                    'index' => $index,
                    'name' => $countryName,
                    'attempted_code' => $countryCode,
                    'iso_props' => array_filter($props, function($key) {
                        return stripos($key, 'iso') !== false;
                    }, ARRAY_FILTER_USE_KEY)
                ];
            }
        }
    }
    
    logError("Processed " . count($countries) . " valid countries");
    logError("Found " . count($problemCountries) . " problem countries");
    
    // Log first few problem countries for debugging
    foreach (array_slice($problemCountries, 0, 3) as $problem) {
        logError("Problem country: " . json_encode($problem));
    }
    
    // Remove duplicates and sort by name
    $uniqueCountries = [];
    $seenCodes = [];
    
    foreach ($countries as $country) {
        if (!in_array($country['code'], $seenCodes)) {
            $uniqueCountries[] = $country;
            $seenCodes[] = $country['code'];
        }
    }
    
    usort($uniqueCountries, function($a, $b) {
        return strcmp($a['name'], $b['name']);
    });
    
    logError("Final unique countries: " . count($uniqueCountries));
    
    // Verify France and Norway are included
    $foundFrance = false;
    $foundNorway = false;
    
    foreach ($uniqueCountries as $country) {
        if ($country['code'] === 'FR') $foundFrance = true;
        if ($country['code'] === 'NO') $foundNorway = true;
    }
    
    logError("France found: " . ($foundFrance ? 'YES' : 'NO'));
    logError("Norway found: " . ($foundNorway ? 'YES' : 'NO'));
    
    echo json_encode($uniqueCountries);
    
} catch (Exception $e) {
    logError("Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>