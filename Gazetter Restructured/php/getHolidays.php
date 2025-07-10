<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

try {
    if (!isset($_GET['country']) || empty($_GET['country'])) {
        throw new Exception('Country code is required');
    }
    
    $countryCode = strtoupper($_GET['country']);
    
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
    
    $countryName = isset($countryData[0]['name']['common']) ? $countryData[0]['name']['common'] : 'Unknown';
    
    // Fetch holidays from Nager.Date API
    $holidays = fetchPublicHolidays($countryCode);
    
    $result = [
        'country' => $countryName,
        'year' => date('Y'),
        'holidays' => $holidays
    ];
    
    echo json_encode($result);
    
} catch (Exception $e) {
    echo json_encode([
        'error' => 'Holidays API unavailable',
        'message' => $e->getMessage(),
        'country' => isset($countryName) ? $countryName : 'Unknown',
        'holidays' => []
    ]);
}

function fetchPublicHolidays($countryCode) {
    try {
        $currentYear = date('Y');
        $apiUrl = "https://date.nager.at/api/v3/PublicHolidays/{$currentYear}/{$countryCode}";
        
        $context = stream_context_create([
            'http' => [
                'timeout' => 10,
                'user_agent' => 'Gazetteer/1.0'
            ]
        ]);
        
        $response = file_get_contents($apiUrl, false, $context);
        
        if ($response === false) {
            throw new Exception('Failed to fetch holidays from API');
        }
        
        $data = json_decode($response, true);
        
        if (!$data || !is_array($data)) {
            throw new Exception('Invalid response from holidays API');
        }
        
        $holidays = [];
        foreach ($data as $holiday) {
            $holidays[] = [
                'name' => $holiday['name'] ?? 'Unknown Holiday',
                'date' => $holiday['date'] ?? '',
                'type' => $holiday['types'][0] ?? 'Public Holiday'
            ];
        }
        
        return $holidays;
        
    } catch (Exception $e) {
        // Return fallback holidays
        return [
            [
                'name' => 'New Year\'s Day',
                'date' => date('Y') . '-01-01',
                'type' => 'Public Holiday'
            ],
            [
                'name' => 'Christmas Day',
                'date' => date('Y') . '-12-25',
                'type' => 'Public Holiday'
            ]
        ];
    }
}
?>