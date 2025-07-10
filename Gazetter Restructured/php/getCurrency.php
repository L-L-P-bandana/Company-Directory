<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

try {
    // Check if this is a request for all exchange rates
    if (isset($_GET['action']) && $_GET['action'] === 'getAllRates') {
        echo json_encode(fetchAllExchangeRates());
        exit;
    }
    
    if (!isset($_GET['country']) || empty($_GET['country'])) {
        throw new Exception('Country code is required');
    }
    
    $countryCode = strtoupper($_GET['country']);
    
    // Get country currency info
    $currencyData = fetchCountryCurrency($countryCode);
    
    echo json_encode($currencyData);
    
} catch (Exception $e) {
    echo json_encode([
        'error' => 'Currency API unavailable',
        'message' => $e->getMessage(),
        'name' => 'Unknown Currency',
        'code' => 'XXX',
        'rate' => 'N/A'
    ]);
}

function fetchCountryCurrency($countryCode) {
    try {
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
            throw new Exception('Failed to fetch country data');
        }
        
        $data = json_decode($response, true);
        
        if (!$data || empty($data)) {
            throw new Exception('Invalid country data');
        }
        
        $country = $data[0];
        
        // Extract currency info
        $currencyName = 'Unknown Currency';
        $currencyCode = 'XXX';
        
        if (isset($country['currencies']) && is_array($country['currencies'])) {
            $currencies = array_values($country['currencies']);
            if (!empty($currencies)) {
                $currency = $currencies[0];
                $currencyName = $currency['name'] ?? 'Unknown Currency';
                $currencyCode = array_keys($country['currencies'])[0] ?? 'XXX';
            }
        }
        
        return [
            'name' => $currencyName,
            'code' => $currencyCode,
            'rate' => '1.0000' // Placeholder rate
        ];
        
    } catch (Exception $e) {
        throw $e;
    }
}

function fetchAllExchangeRates() {
    try {
        // Open Exchange Rates API 
        $apiKey = "913c3c93e4bc43ef8ab10266e9e14a81";
        $apiUrl = "https://api.exchangerate-api.com/v4/latest/USD";
        
        $context = stream_context_create([
            'http' => [
                'timeout' => 10,
                'user_agent' => 'Gazetteer/1.0'
            ]
        ]);
        
        $response = file_get_contents($apiUrl, false, $context);
        
        if ($response === false) {
            throw new Exception('Failed to fetch exchange rates');
        }
        
        $data = json_decode($response, true);
        
        if (!$data || !isset($data['rates'])) {
            throw new Exception('Invalid exchange rate data');
        }
        
        // Common currencies with symbols
        $currencies = [
            ['code' => 'USD', 'name' => 'US Dollar', 'symbol' => '$'],
            ['code' => 'EUR', 'name' => 'Euro', 'symbol' => '€'],
            ['code' => 'GBP', 'name' => 'British Pound', 'symbol' => '£'],
            ['code' => 'JPY', 'name' => 'Japanese Yen', 'symbol' => '¥'],
            ['code' => 'CAD', 'name' => 'Canadian Dollar', 'symbol' => 'C$'],
            ['code' => 'AUD', 'name' => 'Australian Dollar', 'symbol' => 'A$'],
            ['code' => 'CHF', 'name' => 'Swiss Franc', 'symbol' => 'CHF'],
            ['code' => 'CNY', 'name' => 'Chinese Yuan', 'symbol' => '¥'],
            ['code' => 'SEK', 'name' => 'Swedish Krona', 'symbol' => 'kr'],
            ['code' => 'NZD', 'name' => 'New Zealand Dollar', 'symbol' => 'NZ$']
        ];
        
        return [
            'base' => 'USD',
            'rates' => $data['rates'],
            'currencies' => $currencies
        ];
        
    } catch (Exception $e) {
        // Fallback exchange rates
        return [
            'base' => 'USD',
            'rates' => [
                'USD' => 1.0,
                'EUR' => 0.85,
                'GBP' => 0.73,
                'JPY' => 110.0,
                'CAD' => 1.25,
                'AUD' => 1.35
            ],
            'currencies' => [
                ['code' => 'USD', 'name' => 'US Dollar', 'symbol' => '$'],
                ['code' => 'EUR', 'name' => 'Euro', 'symbol' => '€'],
                ['code' => 'GBP', 'name' => 'British Pound', 'symbol' => '£']
            ]
        ];
    }
}
?>