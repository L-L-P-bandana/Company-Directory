<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

function logError($message) {
    error_log("getCurrency.php: " . $message);
}

try {
    // Check if this is a request for all exchange rates
    if (isset($_GET['action']) && $_GET['action'] === 'getAllRates') {
        logError("Fetching global exchange rates");
        
        $exchangeRates = fetchLiveExchangeRates();
        $currencies = getPopularCurrencies();
        
        $result = [
            'rates' => $exchangeRates,
            'currencies' => $currencies,
            'base' => 'USD',
            'timestamp' => time()
        ];
        
        logError("Global exchange rates prepared successfully");
        echo json_encode($result);
        exit;
    }
    
    // Country-specific currency logic
    if (!isset($_GET['country']) || empty($_GET['country'])) {
        throw new Exception('Country code is required');
    }
    
    $countryCode = strtoupper($_GET['country']);
    logError("Fetching currency for country: " . $countryCode);
    
    // Get country info to find currency
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
    
    // Extract currency information
    $currencyCode = 'USD';
    $currencyName = 'US Dollar';
    
    if (isset($countryData[0]['currencies']) && is_array($countryData[0]['currencies'])) {
        $currencies = $countryData[0]['currencies'];
        $firstCurrency = array_keys($currencies)[0];
        $currencyCode = $firstCurrency;
        $currencyName = isset($currencies[$firstCurrency]['name']) ? $currencies[$firstCurrency]['name'] : $firstCurrency;
    }
    
    logError("Currency found: " . $currencyCode . " - " . $currencyName);
    
    // Get live exchange rate
    $exchangeRate = 'N/A';
    
    try {
        $liveRates = fetchLiveExchangeRates();
        if (isset($liveRates[$currencyCode])) {
            $exchangeRate = number_format($liveRates[$currencyCode], 4);
        }
    } catch (Exception $ex) {
        logError("Exchange API error: " . $ex->getMessage());
    }
    
    $result = [
        'name' => $currencyName,
        'code' => $currencyCode,
        'rate' => $exchangeRate
    ];
    
    logError("Currency data prepared for: " . $countryCode);
    echo json_encode($result);
    
} catch (Exception $e) {
    logError("Error: " . $e->getMessage());
    
    http_response_code(500);
    echo json_encode([
        'error' => 'Currency API unavailable',
        'message' => $e->getMessage()
    ]);
}

function fetchLiveExchangeRates() {
    try {
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
            throw new Exception('Invalid exchange rate response');
        }
        
        return $data['rates'];
        
    } catch (Exception $e) {
        throw $e;
    }
}

function getPopularCurrencies() {
    return [
        ['code' => 'USD', 'name' => 'US Dollar', 'symbol' => '$'],
        ['code' => 'EUR', 'name' => 'Euro', 'symbol' => '€'],
        ['code' => 'GBP', 'name' => 'British Pound', 'symbol' => '£'],
        ['code' => 'JPY', 'name' => 'Japanese Yen', 'symbol' => '¥'],
        ['code' => 'AUD', 'name' => 'Australian Dollar', 'symbol' => 'A$'],
        ['code' => 'CAD', 'name' => 'Canadian Dollar', 'symbol' => 'C$'],
        ['code' => 'CHF', 'name' => 'Swiss Franc', 'symbol' => 'CHF'],
        ['code' => 'CNY', 'name' => 'Chinese Yuan', 'symbol' => '¥'],
        ['code' => 'SEK', 'name' => 'Swedish Krona', 'symbol' => 'kr'],
        ['code' => 'NZD', 'name' => 'New Zealand Dollar', 'symbol' => 'NZ$'],
        ['code' => 'MXN', 'name' => 'Mexican Peso', 'symbol' => '$'],
        ['code' => 'SGD', 'name' => 'Singapore Dollar', 'symbol' => 'S$'],
        ['code' => 'HKD', 'name' => 'Hong Kong Dollar', 'symbol' => 'HK$'],
        ['code' => 'NOK', 'name' => 'Norwegian Krone', 'symbol' => 'kr'],
        ['code' => 'KRW', 'name' => 'South Korean Won', 'symbol' => '₩'],
        ['code' => 'TRY', 'name' => 'Turkish Lira', 'symbol' => '₺'],
        ['code' => 'RUB', 'name' => 'Russian Ruble', 'symbol' => '₽'],
        ['code' => 'INR', 'name' => 'Indian Rupee', 'symbol' => '₹'],
        ['code' => 'BRL', 'name' => 'Brazilian Real', 'symbol' => 'R$'],
        ['code' => 'ZAR', 'name' => 'South African Rand', 'symbol' => 'R'],
        ['code' => 'PLN', 'name' => 'Polish Zloty', 'symbol' => 'zł'],
        ['code' => 'ILS', 'name' => 'Israeli Shekel', 'symbol' => '₪'],
        ['code' => 'DKK', 'name' => 'Danish Krone', 'symbol' => 'kr'],
        ['code' => 'CZK', 'name' => 'Czech Koruna', 'symbol' => 'Kč'],
        ['code' => 'HUF', 'name' => 'Hungarian Forint', 'symbol' => 'Ft'],
        ['code' => 'BGN', 'name' => 'Bulgarian Lev', 'symbol' => 'лв'],
        ['code' => 'RON', 'name' => 'Romanian Leu', 'symbol' => 'lei'],
        ['code' => 'HRK', 'name' => 'Croatian Kuna', 'symbol' => 'kn'],
        ['code' => 'ISK', 'name' => 'Icelandic Krona', 'symbol' => 'kr'],
        ['code' => 'PHP', 'name' => 'Philippine Peso', 'symbol' => '₱'],
        ['code' => 'THB', 'name' => 'Thai Baht', 'symbol' => '฿'],
        ['code' => 'MYR', 'name' => 'Malaysian Ringgit', 'symbol' => 'RM'],
        ['code' => 'IDR', 'name' => 'Indonesian Rupiah', 'symbol' => 'Rp'],
        ['code' => 'AED', 'name' => 'UAE Dirham', 'symbol' => 'د.إ'],
        ['code' => 'SAR', 'name' => 'Saudi Riyal', 'symbol' => '﷼'],
        ['code' => 'EGP', 'name' => 'Egyptian Pound', 'symbol' => '£'],
        ['code' => 'CLP', 'name' => 'Chilean Peso', 'symbol' => '$'],
        ['code' => 'COP', 'name' => 'Colombian Peso', 'symbol' => '$'],
        ['code' => 'PEN', 'name' => 'Peruvian Sol', 'symbol' => 'S/.'],
        ['code' => 'ARS', 'name' => 'Argentine Peso', 'symbol' => '$']
    ];
}
?>