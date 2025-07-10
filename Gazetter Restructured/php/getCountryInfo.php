<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

try {
    if (!isset($_GET['country']) || empty($_GET['country'])) {
        throw new Exception('Country code is required');
    }
    
    $countryCode = strtoupper($_GET['country']);
    
    // REST Countries API
    $apiUrl = "https://restcountries.com/v3.1/alpha/" . $countryCode;
    
    $context = stream_context_create([
        'http' => [
            'timeout' => 10,
            'user_agent' => 'Gazetteer/1.0'
        ]
    ]);
    
    $response = file_get_contents($apiUrl, false, $context);
    
    if ($response === false) {
        throw new Exception('Failed to fetch country data from API');
    }
    
    $data = json_decode($response, true);
    
    if (!$data || empty($data)) {
        throw new Exception('Invalid response from country API');
    }
    
    // Extract data from first result
    $country = $data[0];
    
    // Format population with commas
    $population = isset($country['population']) ? number_format($country['population']) : 'N/A';
    
    // Format area
    $area = isset($country['area']) ? number_format($country['area']) . ' km²' : 'N/A';
    
    // Get capital
    $capital = 'N/A';
    if (isset($country['capital']) && is_array($country['capital'])) {
        $capital = $country['capital'][0];
    } elseif (isset($country['capital'])) {
        $capital = $country['capital'];
    }
    
    // Get continent (instead of region)
    $continent = isset($country['continents']) && is_array($country['continents']) ? 
        $country['continents'][0] : 
        (isset($country['region']) ? $country['region'] : 'N/A');
    
    // Get languages
    $languages = 'N/A';
    if (isset($country['languages']) && is_array($country['languages'])) {
        $languages = implode(', ', array_values($country['languages']));
    }
    
    // Get currency
    $currency = 'N/A';
    if (isset($country['currencies']) && is_array($country['currencies'])) {
        $currencyArray = array_values($country['currencies']);
        if (!empty($currencyArray)) {
            $currencyInfo = $currencyArray[0];
            $currency = isset($currencyInfo['name']) ? $currencyInfo['name'] : 'N/A';
            if (isset($currencyInfo['symbol'])) {
                $currency .= ' (' . $currencyInfo['symbol'] . ')';
            }
        }
    }
    
    // Get ISO codes
    $isoAlpha2 = isset($country['cca2']) ? $country['cca2'] : 'N/A';
    $isoAlpha3 = isset($country['cca3']) ? $country['cca3'] : 'N/A';
    
    // Get postal code format
    $postalCodeFormat = getPostalCodeFormat($countryCode, $country);
    
    $result = [
        'capital' => $capital,
        'continent' => $continent,
        'languages' => $languages,
        'currency' => $currency,
        'isoAlpha2' => $isoAlpha2,
        'isoAlpha3' => $isoAlpha3,
        'population' => $population,
        'area' => $area,
        'postalCodeFormat' => $postalCodeFormat
    ];
    
    echo json_encode($result);
    
} catch (Exception $e) {
    // Fallback dummy data 
    $countryCode = isset($countryCode) ? $countryCode : 'UNKNOWN';
    
    $fallbackData = [
        'US' => [
            'capital' => 'Washington, D.C.',
            'continent' => 'North America',
            'languages' => 'English',
            'currency' => 'United States Dollar ($)',
            'isoAlpha2' => 'US',
            'isoAlpha3' => 'USA',
            'population' => '331,900,000',
            'area' => '9,833,517 km²',
            'postalCodeFormat' => '12345 or 12345-6789'
        ],
        'GB' => [
            'capital' => 'London',
            'continent' => 'Europe',
            'languages' => 'English',
            'currency' => 'Pound Sterling (£)',
            'isoAlpha2' => 'GB',
            'isoAlpha3' => 'GBR',
            'population' => '67,800,000',
            'area' => '243,610 km²',
            'postalCodeFormat' => 'SW1A 1AA format'
        ]
    ];
    
    if (isset($fallbackData[$countryCode])) {
        echo json_encode($fallbackData[$countryCode]);
    } else {
        echo json_encode([
            'capital' => 'API Error - Data unavailable',
            'continent' => 'API Error - Data unavailable',
            'languages' => 'API Error - Data unavailable',
            'currency' => 'API Error - Data unavailable',
            'isoAlpha2' => 'API Error - Data unavailable',
            'isoAlpha3' => 'API Error - Data unavailable',
            'population' => 'API Error - Data unavailable',
            'area' => 'API Error - Data unavailable',
            'postalCodeFormat' => 'API Error - Data unavailable'
        ]);
    }
}

function getPostalCodeFormat($countryCode, $countryData) {
    // Custom postal code format mapping
    $postalFormats = [
        'GB' => 'SW1A 1AA format',
        'US' => '12345 or 12345-6789',
        'CA' => 'K1A 0A6 format',
        'FR' => '75001 (5 digits)',
        'DE' => '10115 (5 digits)',
        'IT' => '00118 (5 digits)',
        'ES' => '28001 (5 digits)',
        'AU' => '2000 (4 digits)',
        'NZ' => '1010 (4 digits)',
        'JP' => '100-0001 (7 digits)',
        'KR' => '03051 (5 digits)',
        'CN' => '100000 (6 digits)',
        'IN' => '110001 (6 digits)',
        'BR' => '01310-100 (8 digits)',
        'MX' => '01000 (5 digits)',
        'AR' => 'C1000AAA format',
        'RU' => '101000 (6 digits)',
        'NL' => '1011 AB format',
        'BE' => '1000 (4 digits)',
        'CH' => '1234 (4 digits)',
        'AT' => '1010 (4 digits)',
        'SE' => '11455 (5 digits)',
        'NO' => '0010 (4 digits)',
        'DK' => '1050 (4 digits)',
        'FI' => '00100 (5 digits)',
        'PL' => '00-950 (5 digits)',
        'CZ' => '110 00 (5 digits)',
        'HU' => '1011 (4 digits)',
        'PT' => '1000-001 (7 digits)',
        'IE' => 'D02 XY45 format',
        'IS' => '101 (3 digits)',
        'LU' => 'L-1234 (4 digits)',
        'MT' => 'VLT 1117 format',
        'CY' => '1010 (4 digits)',
        'SI' => '1000 (4 digits)',
        'SK' => '010 01 (5 digits)',
        'EE' => '10111 (5 digits)',
        'LV' => 'LV-1010 (4 digits)',
        'LT' => 'LT-01103 (5 digits)',
        'HR' => '10000 (5 digits)',
        'BG' => '1000 (4 digits)',
        'RO' => '010041 (6 digits)',
        'GR' => '104 32 (5 digits)',
        'TR' => '06100 (5 digits)',
        'IL' => '9458109 (7 digits)',
        'ZA' => '7700 (4 digits)',
        'EG' => '11511 (5 digits)',
        'MA' => '10000 (5 digits)',
        'TN' => '1000 (4 digits)',
        'DZ' => '16000 (5 digits)',
        'NG' => '100001 (6 digits)',
        'KE' => '00100 (5 digits)',
        'GH' => 'GA-039-5028',
        'TH' => '10100 (5 digits)',
        'MY' => '50000 (5 digits)',
        'SG' => '018989 (6 digits)',
        'PH' => '1000 (4 digits)',
        'ID' => '10110 (5 digits)',
        'VN' => '100000 (6 digits)'
    ];
    
    // Return custom format if available
    if (isset($postalFormats[$countryCode])) {
        return $postalFormats[$countryCode];
    }
    
    // Try to extract from API data
    if (isset($countryData['postalCode']['format'])) {
        $apiFormat = $countryData['postalCode']['format'];
        // Clean up
        if (strlen($apiFormat) < 20) { // Only if it's not a complex regex
            return $apiFormat;
        }
    }
    
    // Fallback
    return 'Varies by region';
}
?>