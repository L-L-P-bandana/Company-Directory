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
    
    // Get country name from REST Countries API
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
    
    // Fetch real holidays from Nager.Date API
    $holidays = fetchRealHolidays($countryCode);
    
    $result = [
        'country' => $countryName,
        'holidays' => $holidays
    ];
    
    logError("Holiday data prepared for: " . $countryName . " (" . count($holidays) . " holidays)");
    echo json_encode($result);
    
} catch (Exception $e) {
    logError("Error: " . $e->getMessage());
    
    http_response_code(500);
    echo json_encode([
        'error' => 'Holiday API unavailable',
        'message' => $e->getMessage(),
        'country' => isset($countryName) ? $countryName : 'Unknown',
        'holidays' => []
    ]);
}

function fetchRealHolidays($countryCode) {
    try {
        $currentYear = date('Y');
        
        // Nager.Date API
        $holidayApiUrl = "https://date.nager.at/api/v3/PublicHolidays/" . $currentYear . "/" . $countryCode;
        
        logError("Calling Nager.Date API: " . $holidayApiUrl);
        
        $context = stream_context_create([
            'http' => [
                'timeout' => 15,
                'user_agent' => 'Gazetteer/1.0'
            ]
        ]);
        
        $response = file_get_contents($holidayApiUrl, false, $context);
        
        if ($response === false) {
            throw new Exception('Failed to fetch holidays from Nager.Date API');
        }
        
        $holidaysData = json_decode($response, true);
        
        if (!$holidaysData) {
            throw new Exception('Invalid response from holidays API');
        }
        
        if (empty($holidaysData)) {
            logError("No holidays found for country: " . $countryCode . " (country may not be supported by API)");
            return [];
        }
        
        $holidays = [];
        
        foreach ($holidaysData as $holiday) {
            $holidays[] = [
                'name' => $holiday['name'] ?? 'Unknown Holiday',
                'date' => $holiday['date'] ?? '',
                'type' => getHolidayType($holiday)
            ];
        }
        
        // Sort holidays by date
        usort($holidays, function($a, $b) {
            return strcmp($a['date'], $b['date']);
        });
        
        logError("Successfully processed " . count($holidays) . " holidays");
        return $holidays;
        
    } catch (Exception $e) {
        logError("Holiday API error: " . $e->getMessage());
        
        throw $e;
    }
}

function getHolidayType($holiday) {
    // Determine holiday type based on API response
    if (isset($holiday['global']) && $holiday['global']) {
        return 'National Public Holiday';
    } elseif (isset($holiday['counties']) && !empty($holiday['counties'])) {
        return 'Regional Holiday';
    } elseif (isset($holiday['type'])) {
        return ucfirst($holiday['type']) . ' Holiday';
    } else {
        return 'Public Holiday';
    }
}
?>