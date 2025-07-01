<?php
header('Content-Type: text/html');
?>
<!DOCTYPE html>
<html>
<head>
    <title>GeoNames API Test</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1000px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .test { margin: 15px 0; padding: 15px; border-left: 4px solid #ddd; background: #f8f9fa; }
        .pass { border-color: #28a745; background: #d4edda; }
        .fail { border-color: #dc3545; background: #f8d7da; }
        .info { border-color: #17a2b8; background: #d1ecf1; }
        .warning { border-color: #ffc107; background: #fff3cd; }
        pre { background: #e9ecef; padding: 10px; border-radius: 4px; overflow-x: auto; max-height: 300px; }
        .button { display: inline-block; padding: 8px 16px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 5px; }
        .button:hover { background: #0056b3; }
        .status { font-weight: bold; }
        h1, h2 { color: #333; }
        .result-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
        @media (max-width: 768px) { .result-grid { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
    <div class="container">
        <h1>🌍 GeoNames API Test</h1>
        
        <?php
        // Configuration check
        $geonamesUsername = 'thisismypassword'; // Replace with your username
        $testCountry = isset($_GET['country']) ? strtoupper($_GET['country']) : 'US';
        
        echo '<div class="test info">';
        echo '<strong>Test Configuration:</strong><br>';
        echo 'GeoNames Username: <code>' . htmlspecialchars($geonamesUsername) . '</code><br>';
        echo 'Test Country: <code>' . htmlspecialchars($testCountry) . '</code><br>';
        echo 'Current Time: ' . date('Y-m-d H:i:s') . '<br>';
        echo '</div>';
        
        // Username check
        if ($geonamesUsername === 'YOUR_GEONAMES_USERNAME') {
            echo '<div class="test fail">';
            echo '<strong>⚠️ Configuration Required</strong><br>';
            echo 'Please update the $geonamesUsername variable in this file with your actual GeoNames username.<br>';
            echo '<strong>Steps:</strong><br>';
            echo '1. Register at <a href="http://www.geonames.org/login" target="_blank">geonames.org</a><br>';
            echo '2. Enable web services in your account<br>';
            echo '3. Replace "YOUR_GEONAMES_USERNAME" with your username in this file<br>';
            echo '</div>';
        } else {
            echo '<div class="test pass">';
            echo '<strong>✓ Username Configured</strong><br>';
            echo 'GeoNames username is set: ' . htmlspecialchars($geonamesUsername);
            echo '</div>';
        }
        
        // Test GeoNames API directly
        if ($geonamesUsername !== 'YOUR_GEONAMES_USERNAME') {
            echo '<h2>🧪 API Tests</h2>';
            
            // Test 1: Cities API
            echo '<div class="result-grid">';
            echo '<div>';
            echo '<h3>🏙️ Cities Test</h3>';
            testGeoNamesAPI('cities', $testCountry, $geonamesUsername);
            echo '</div>';
            
            // Test 2: Airports API  
            echo '<div>';
            echo '<h3>✈️ Airports Test</h3>';
            testGeoNamesAPI('airports', $testCountry, $geonamesUsername);
            echo '</div>';
            echo '</div>';
            
            // Test 3: Your PHP Files
            echo '<h2>📁 Your PHP Files Test</h2>';
            testLocalPHPFiles($testCountry);
        }
        
        // Test form
        echo '<h2>🔧 Test Different Countries</h2>';
        echo '<form method="get" style="margin: 20px 0;">';
        echo '<label>Country Code: </label>';
        echo '<input type="text" name="country" value="' . htmlspecialchars($testCountry) . '" placeholder="US" maxlength="2" style="padding: 5px; margin: 0 10px;">';
        echo '<input type="submit" value="Test Country" class="button">';
        echo '</form>';
        
        echo '<div class="test info">';
        echo '<strong>Common Country Codes:</strong><br>';
        echo 'US (United States), GB (United Kingdom), FR (France), DE (Germany), JP (Japan), AU (Australia), CA (Canada), IT (Italy), ES (Spain), BR (Brazil)';
        echo '</div>';
        ?>
    </div>
</body>
</html>

<?php
function testGeoNamesAPI($type, $countryCode, $username) {
    if ($type === 'cities') {
        $url = "http://api.geonames.org/searchJSON?country={$countryCode}&featureClass=P&orderby=population&maxRows=5&username={$username}";
        $description = "Testing GeoNames Cities API";
    } else {
        $url = "http://api.geonames.org/searchJSON?country={$countryCode}&fcode=AIRP&orderby=relevance&maxRows=5&username={$username}";
        $description = "Testing GeoNames Airports API";
    }
    
    echo '<div class="test info">';
    echo '<strong>' . $description . '</strong><br>';
    echo 'URL: <small>' . htmlspecialchars($url) . '</small><br>';
    echo '</div>';
    
    $context = stream_context_create([
        'http' => [
            'timeout' => 15,
            'user_agent' => 'Gazetteer/1.0'
        ]
    ]);
    
    $startTime = microtime(true);
    $response = file_get_contents($url, false, $context);
    $endTime = microtime(true);
    $responseTime = round(($endTime - $startTime) * 1000, 2);
    
    if ($response === false) {
        echo '<div class="test fail">';
        echo '<strong>❌ API Call Failed</strong><br>';
        echo 'Could not connect to GeoNames API<br>';
        echo 'Response Time: ' . $responseTime . 'ms<br>';
        echo '</div>';
        return;
    }
    
    $data = json_decode($response, true);
    
    if (!$data) {
        echo '<div class="test fail">';
        echo '<strong>❌ Invalid JSON Response</strong><br>';
        echo 'Response Time: ' . $responseTime . 'ms<br>';
        echo '<pre>' . htmlspecialchars(substr($response, 0, 500)) . '</pre>';
        echo '</div>';
        return;
    }
    
    if (isset($data['status'])) {
        echo '<div class="test fail">';
        echo '<strong>❌ GeoNames API Error</strong><br>';
        echo 'Error: ' . htmlspecialchars($data['status']['message'] ?? 'Unknown error') . '<br>';
        echo 'Response Time: ' . $responseTime . 'ms<br>';
        echo '</div>';
        return;
    }
    
    if (!isset($data['geonames']) || empty($data['geonames'])) {
        echo '<div class="test warning">';
        echo '<strong>⚠️ No Data Found</strong><br>';
        echo 'No ' . $type . ' found for country: ' . htmlspecialchars($countryCode) . '<br>';
        echo 'Response Time: ' . $responseTime . 'ms<br>';
        echo '</div>';
        return;
    }
    
    $count = count($data['geonames']);
    echo '<div class="test pass">';
    echo '<strong>✅ API Success</strong><br>';
    echo 'Found: ' . $count . ' ' . $type . '<br>';
    echo 'Response Time: ' . $responseTime . 'ms<br>';
    echo '</div>';
    
    echo '<div class="test info">';
    echo '<strong>Sample Data:</strong><br>';
    echo '<pre>' . htmlspecialchars(json_encode(array_slice($data['geonames'], 0, 3), JSON_PRETTY_PRINT)) . '</pre>';
    echo '</div>';
}

function testLocalPHPFiles($countryCode) {
    $baseUrl = 'http://' . $_SERVER['HTTP_HOST'] . dirname($_SERVER['REQUEST_URI']);
    
    // Test cities file
    $citiesUrl = $baseUrl . '/getCities.php?country=' . $countryCode;
    echo '<div class="test info">';
    echo '<strong>Testing: getCities.php</strong><br>';
    echo 'URL: <a href="' . $citiesUrl . '" target="_blank">' . $citiesUrl . '</a><br>';
    echo '</div>';
    
    // Test airports file
    $airportsUrl = $baseUrl . '/getAirports.php?country=' . $countryCode;
    echo '<div class="test info">';
    echo '<strong>Testing: getAirports.php</strong><br>';
    echo 'URL: <a href="' . $airportsUrl . '" target="_blank">' . $airportsUrl . '</a><br>';
    echo '</div>';
    
    echo '<div class="test info">';
    echo '<strong>Manual Testing:</strong><br>';
    echo '1. Click the links above to test your PHP files directly<br>';
    echo '2. You should see JSON data with cities/airports<br>';
    echo '3. If you see errors, check your GeoNames username configuration<br>';
    echo '4. Check your server error logs for detailed error messages';
    echo '</div>';
}
?>