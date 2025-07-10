<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

try {
    // REST Countries API - get all countries
    $apiUrl = "https://restcountries.com/v3.1/all?fields=name,cca2";
    
    $context = stream_context_create([
        'http' => [
            'timeout' => 15,
            'user_agent' => 'Gazetteer/1.0'
        ]
    ]);
    
    $response = file_get_contents($apiUrl, false, $context);
    
    if ($response === false) {
        throw new Exception('Failed to fetch countries from API');
    }
    
    $data = json_decode($response, true);
    
    if (!$data || !is_array($data)) {
        throw new Exception('Invalid response from countries API');
    }
    
    $countries = [];
    foreach ($data as $country) {
        if (isset($country['name']['common']) && isset($country['cca2'])) {
            $countries[] = [
                'name' => $country['name']['common'],
                'code' => $country['cca2']
            ];
        }
    }
    
    // Sort countries alphabetically by name
    usort($countries, function($a, $b) {
        return strcmp($a['name'], $b['name']);
    });
    
    echo json_encode($countries);
    
} catch (Exception $e) {
    // Fallback country list
    echo json_encode([
        ['name' => 'United States', 'code' => 'US'],
        ['name' => 'United Kingdom', 'code' => 'GB'],
        ['name' => 'Canada', 'code' => 'CA'],
        ['name' => 'Australia', 'code' => 'AU'],
        ['name' => 'Germany', 'code' => 'DE'],
        ['name' => 'France', 'code' => 'FR'],
        ['name' => 'Japan', 'code' => 'JP'],
        ['name' => 'Brazil', 'code' => 'BR'],
        ['name' => 'India', 'code' => 'IN'],
        ['name' => 'China', 'code' => 'CN']
    ]);
}
?>