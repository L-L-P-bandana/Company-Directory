<?php
header('Content-Type: text/html');
?>
<!DOCTYPE html>
<html>
<head>
    <title>Gazetteer Setup Test</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .test { margin: 10px 0; padding: 10px; border-left: 4px solid #ddd; }
        .pass { border-color: #28a745; background: #d4edda; }
        .fail { border-color: #dc3545; background: #f8d7da; }
        .info { border-color: #17a2b8; background: #d1ecf1; }
    </style>
</head>
<body>
    <h1>Gazetteer Setup Test</h1>
    
    <div class="test info">
        <strong>Current Directory:</strong> <?php echo getcwd(); ?>
    </div>
    
    <div class="test info">
        <strong>PHP Version:</strong> <?php echo phpversion(); ?>
    </div>
    
    <?php
    // Test 1: Check if countryBorders.geo.json exists
    $geoJsonFile = '../countryBorders.geo.json';
    if (file_exists($geoJsonFile)) {
        echo '<div class="test pass"><strong>✓ countryBorders.geo.json found</strong><br>';
        echo 'Path: ' . realpath($geoJsonFile) . '<br>';
        echo 'Size: ' . number_format(filesize($geoJsonFile)) . ' bytes</div>';
        
        // Test 2: Check if it's valid JSON
        $json = file_get_contents($geoJsonFile);
        $data = json_decode($json, true);
        if ($data && isset($data['features'])) {
            echo '<div class="test pass"><strong>✓ GeoJSON is valid</strong><br>';
            echo 'Features count: ' . count($data['features']) . '</div>';
            
            // Test 3: Check sample countries
            $sampleCountries = [];
            foreach (array_slice($data['features'], 0, 5) as $feature) {
                if (isset($feature['properties']['ISO_A2']) && isset($feature['properties']['NAME'])) {
                    $sampleCountries[] = $feature['properties']['ISO_A2'] . ' - ' . $feature['properties']['NAME'];
                }
            }
            
            if (!empty($sampleCountries)) {
                echo '<div class="test pass"><strong>✓ Sample countries found</strong><br>';
                echo implode('<br>', $sampleCountries) . '</div>';
            } else {
                echo '<div class="test fail"><strong>✗ No valid countries found in GeoJSON</strong></div>';
            }
        } else {
            echo '<div class="test fail"><strong>✗ Invalid GeoJSON format</strong><br>';
            echo 'JSON Error: ' . json_last_error_msg() . '</div>';
        }
    } else {
        echo '<div class="test fail"><strong>✗ countryBorders.geo.json NOT found</strong><br>';
        echo 'Looking for: ' . $geoJsonFile . '<br>';
        echo 'Current directory contents:<br>';
        foreach (scandir('.') as $file) {
            if ($file !== '.' && $file !== '..') {
                echo '&nbsp;&nbsp;' . $file . '<br>';
            }
        }
        echo 'Parent directory contents:<br>';
        foreach (scandir('..') as $file) {
            if ($file !== '.' && $file !== '..') {
                echo '&nbsp;&nbsp;' . $file . '<br>';
            }
        }
        echo '</div>';
    }
    
    // Test 4: Check PHP files
    $phpFiles = ['getCountries.php', 'getCountryBorder.php', 'getCountryInfo.php', 'getWeather.php', 'getCurrency.php'];
    foreach ($phpFiles as $file) {
        if (file_exists($file)) {
            echo '<div class="test pass"><strong>✓ ' . $file . ' found</strong></div>';
        } else {
            echo '<div class="test fail"><strong>✗ ' . $file . ' NOT found</strong></div>';
        }
    }
    
    // Test 5: Try a simple API call
    if (file_exists('getCountryInfo.php')) {
        echo '<div class="test info"><strong>Testing getCountryInfo.php</strong><br>';
        
        $url = 'http://' . $_SERVER['HTTP_HOST'] . dirname($_SERVER['REQUEST_URI']) . '/getCountryInfo.php?country=US';
        echo 'URL: <a href="' . $url . '" target="_blank">' . $url . '</a></div>';
    }
    ?>
    
    <h2>Quick Fix Steps</h2>
    <ol>
        <li>If countryBorders.geo.json is missing, upload it to the root directory (same level as index.html)</li>
        <li>If PHP files are missing, upload them to the php/ directory</li>
        <li>Test each PHP file by clicking the links above</li>
        <li>Check browser console for JavaScript errors</li>
    </ol>
    
</body>
</html>