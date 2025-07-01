<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

function logError($message) {
    error_log("getHolidays.php: " . $message);
}

try {
    if (!isset($_GET['country']) || empty($_GET['country'])) {
        throw new Exception('Country code is required');
    }
    
    $countryCode = strtoupper($_GET['country']);
    logError("Fetching holidays for country: " . $countryCode);
    
    // First, get country name from REST Countries API
    $countryApiUrl = "https://restcountries.com/v3.1/alpha/" . $countryCode;
    
    $context = stream_context_create([
        'http' => [
            'timeout' => 10,
            'user_agent' => 'Gazetteer/1.0'
        ]
    ]);
    
    $countryResponse = file_get_contents($countryApiUrl, false, $context);
    
    if ($countryResponse === false) {
        throw new Exception('Failed to fetch country data');
    }
    
    $countryData = json_decode($countryResponse, true);
    
    if (!$countryData || empty($countryData)) {
        throw new Exception('Invalid country data');
    }
    
    // Get country name
    $countryName = isset($countryData[0]['name']['common']) ? $countryData[0]['name']['common'] : 'Unknown';
    
    logError("Country name: " . $countryName);
    
    // Generate realistic holiday data (could integrate with Calendarific API or similar)
    $holidays = generateHolidayData($countryName, $countryCode);
    
    $result = [
        'country' => $countryName,
        'holidays' => $holidays
    ];
    
    logError("Holiday data prepared for: " . $countryName);
    echo json_encode($result);
    
} catch (Exception $e) {
    logError("Error: " . $e->getMessage());
    
    // Fallback data
    echo json_encode(generateFallbackHolidays($countryCode));
}

function generateHolidayData($countryName, $countryCode) {
    $currentYear = date('Y');
    $holidays = [];
    
    // Universal holidays that most countries observe
    $holidays[] = [
        'name' => 'New Year\'s Day',
        'date' => $currentYear . '-01-01',
        'type' => 'Public Holiday'
    ];
    
    // Add country-specific holidays
    $countrySpecific = getCountrySpecificHolidays($countryCode, $currentYear);
    $holidays = array_merge($holidays, $countrySpecific);
    
    // Add some common seasonal holidays
    $holidays[] = [
        'name' => 'International Workers\' Day',
        'date' => $currentYear . '-05-01',
        'type' => 'Public Holiday'
    ];
    
    // Sort by date
    usort($holidays, function($a, $b) {
        return strcmp($a['date'], $b['date']);
    });
    
    return array_slice($holidays, 0, 8); // Return up to 8 holidays
}

function getCountrySpecificHolidays($countryCode, $year) {
    $holidays = [];
    
    switch ($countryCode) {
        case 'US':
            $holidays = [
                ['name' => 'Independence Day', 'date' => $year . '-07-04', 'type' => 'Federal Holiday'],
                ['name' => 'Thanksgiving', 'date' => $year . '-11-28', 'type' => 'Federal Holiday'],
                ['name' => 'Christmas Day', 'date' => $year . '-12-25', 'type' => 'Federal Holiday'],
                ['name' => 'Martin Luther King Jr. Day', 'date' => $year . '-01-15', 'type' => 'Federal Holiday']
            ];
            break;
    }
    
    return $holidays;
}

function generateFallbackHolidays($countryCode) {
    return [
        'country' => 'Unknown',
        'holidays' => [
            [
                'name' => 'Holiday Service Unavailable',
                'date' => date('Y') . '-01-01',
                'type' => 'System Notice'
            ]
        ]
    ];
}
?>