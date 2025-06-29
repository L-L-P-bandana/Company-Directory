<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
set_time_limit(300); // 5 minute timeout

// Db config
$config = [
    'host' => 'localhost',
    'dbname' => 'u215315340_Gazetteer',
    'username' => 'u215315340_Gazetteerllp',
    'password' => 'Rainbowunicorn1!!'
];

echo "<h2>🔧 Batch Country Data Enhancement - Fixed Version</h2>";

try {
    // Connect to database
    $dsn = "mysql:host={$config['host']};dbname={$config['dbname']};charset=utf8mb4";
    $pdo = new PDO($dsn, $config['username'], $config['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4"
    ]);
    echo "✅ Database connected successfully<br>";

    // Find countries that need enhancement (missing key data)
    $sql = "SELECT iso_code_2, name_common, capital 
            FROM countries 
            WHERE (population = 0 OR population IS NULL) 
               OR (latitude = 0 OR latitude IS NULL) 
               OR (area_km2 = 0 OR area_km2 IS NULL)
            ORDER BY name_common 
            LIMIT 5";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $countries_to_enhance = $stmt->fetchAll();
    
    if (empty($countries_to_enhance)) {
        echo "<div style='color: green; font-weight: bold;'>🎉 ALL COUNTRIES HAVE COMPLETE DATA!</div>";
        
        // Show summary statistics
        $stats_sql = "SELECT 
                        COUNT(*) as total_countries,
                        COUNT(CASE WHEN population > 0 THEN 1 END) as has_population,
                        COUNT(CASE WHEN latitude != 0 THEN 1 END) as has_coordinates,
                        COUNT(CASE WHEN area_km2 > 0 THEN 1 END) as has_area
                      FROM countries";
        $stats = $pdo->query($stats_sql)->fetch();
        
        echo "<h3>📊 Database Statistics:</h3>";
        echo "<ul>";
        echo "<li>Total Countries: {$stats['total_countries']}</li>";
        echo "<li>With Population Data: {$stats['has_population']}</li>";
        echo "<li>With Coordinates: {$stats['has_coordinates']}</li>";
        echo "<li>With Area Data: {$stats['has_area']}</li>";
        echo "</ul>";
        
        echo "<p><a href='api.php?request=status'>🔗 Test Your API</a></p>";
        exit;
    }
    
    echo "<div style='background: #f0f0f0; padding: 10px; margin: 10px 0;'>";
    echo "🔍 Found " . count($countries_to_enhance) . " countries needing enhancement<br>";
    echo "📍 Processing this batch: ";
    foreach ($countries_to_enhance as $country) {
        echo $country['name_common'] . " ";
    }
    echo "</div>";

    // Process each country in this batch (using batches to circumvent API call rate limits)
    $processed = 0;
    $errors = 0;
    
    foreach ($countries_to_enhance as $country) {
        echo "<div style='margin: 10px 0; padding: 5px; border-left: 3px solid #007cba;'>";
        echo "🌍 Processing: <strong>{$country['name_common']}</strong> ({$country['iso_code_2']})<br>";
        
        // Try to get detailed data from REST Countries API
        $api_url = "https://restcountries.com/v3.1/alpha/{$country['iso_code_2']}";
        
        // Add delay to respect rate limits
        if ($processed > 0) {
            echo "⏰ Waiting 1 second...<br>";
            sleep(1);
        }
        
        // Try to fetch data
        $context = stream_context_create([
            'http' => [
                'timeout' => 10,
                'user_agent' => 'Gazetteer/1.0 (Educational Project)'
            ]
        ]);
        
        $api_response = @file_get_contents($api_url, false, $context);
        
        if ($api_response === false) {
            echo "❌ API call failed<br>";
            $errors++;
        } else {
            $country_data = json_decode($api_response, true);
            
            if (!empty($country_data) && is_array($country_data) && isset($country_data[0])) {
                $data = $country_data[0];
                
                // Extract data safely
                $population = $data['population'] ?? 0;
                $area = $data['area'] ?? 0;
                $lat = $data['latlng'][0] ?? 0;
                $lng = $data['latlng'][1] ?? 0;
                $region = $data['region'] ?? null;
                $subregion = $data['subregion'] ?? null;
                $flag_svg = $data['flags']['svg'] ?? null;
                $flag_png = $data['flags']['png'] ?? null;
                
                // Get timezone (first one if multiple)
                $timezone = null;
                if (!empty($data['timezones']) && is_array($data['timezones'])) {
                    $timezone = $data['timezones'][0];
                }
                
                // Update the database with correct column names
                $update_sql = "UPDATE countries SET 
                              population = ?, 
                              area_km2 = ?, 
                              latitude = ?, 
                              longitude = ?, 
                              region = ?, 
                              subregion = ?, 
                              timezone = ?,
                              flag_svg = ?,
                              flag_png = ?
                              WHERE iso_code_2 = ?";
                
                $update_stmt = $pdo->prepare($update_sql);
                $result = $update_stmt->execute([
                    $population, $area, $lat, $lng, $region, $subregion, 
                    $timezone, $flag_svg, $flag_png, $country['iso_code_2']
                ]);
                
                if ($result) {
                    echo "✅ Enhanced with: Pop={$population}, Area={$area}km², Coords=({$lat},{$lng})<br>";
                    $processed++;
                } else {
                    echo "❌ Database update failed<br>";
                    $errors++;
                }
                
                // Handle currencies
                if (!empty($data['currencies']) && is_array($data['currencies'])) {
                    foreach ($data['currencies'] as $code => $currency_info) {
                        // Insert currency if it doesn't exist
                        $curr_insert = "INSERT IGNORE INTO currencies (code, name, symbol) 
                                       VALUES (?, ?, ?)";
                        $curr_stmt = $pdo->prepare($curr_insert);
                        $curr_stmt->execute([
                            $code, 
                            $currency_info['name'] ?? $code,
                            $currency_info['symbol'] ?? ''
                        ]);
                        
                        // Get country ID and currency ID for relationship
                        $country_id_sql = "SELECT id FROM countries WHERE iso_code_2 = ?";
                        $country_id_stmt = $pdo->prepare($country_id_sql);
                        $country_id_stmt->execute([$country['iso_code_2']]);
                        $country_id = $country_id_stmt->fetchColumn();
                        
                        $currency_id_sql = "SELECT id FROM currencies WHERE code = ?";
                        $currency_id_stmt = $pdo->prepare($currency_id_sql);
                        $currency_id_stmt->execute([$code]);
                        $currency_id = $currency_id_stmt->fetchColumn();
                        
                        // Link country to currency
                        if ($country_id && $currency_id) {
                            $link_insert = "INSERT IGNORE INTO country_currencies (country_id, currency_id) 
                                           VALUES (?, ?)";
                            $link_stmt = $pdo->prepare($link_insert);
                            $link_stmt->execute([$country_id, $currency_id]);
                        }
                    }
                    echo "💰 Added currencies<br>";
                }
                
                // Handle languages 
                if (!empty($data['languages']) && is_array($data['languages'])) {
                    foreach ($data['languages'] as $code => $language_name) {
                        // Insert language if it doesn't exist
                        $lang_insert = "INSERT IGNORE INTO languages (code, name) 
                                       VALUES (?, ?)";
                        $lang_stmt = $pdo->prepare($lang_insert);
                        $lang_stmt->execute([$code, $language_name]);
                        
                        // Get country ID and language ID for relationship
                        $country_id_sql = "SELECT id FROM countries WHERE iso_code_2 = ?";
                        $country_id_stmt = $pdo->prepare($country_id_sql);
                        $country_id_stmt->execute([$country['iso_code_2']]);
                        $country_id = $country_id_stmt->fetchColumn();
                        
                        $language_id_sql = "SELECT id FROM languages WHERE code = ?";
                        $language_id_stmt = $pdo->prepare($language_id_sql);
                        $language_id_stmt->execute([$code]);
                        $language_id = $language_id_stmt->fetchColumn();
                        
                        // Link country to language
                        if ($country_id && $language_id) {
                            $link_insert = "INSERT IGNORE INTO country_languages (country_id, language_id) 
                                           VALUES (?, ?)";
                            $link_stmt = $pdo->prepare($link_insert);
                            $link_stmt->execute([$country_id, $language_id]);
                        }
                    }
                    echo "🗣️ Added languages<br>";
                }
                
            } else {
                echo "❌ Invalid API response format<br>";
                $errors++;
            }
        }
        echo "</div>";
    }
    
    //Crucial Trackers
    echo "<h3>📈 Batch Results:</h3>";
    echo "<ul>";
    echo "<li>✅ Countries enhanced: {$processed}</li>";
    echo "<li>❌ Errors encountered: {$errors}</li>";
    echo "</ul>";
    
    // Check if more countries need processing
    $remaining_sql = "SELECT COUNT(*) as remaining 
                     FROM countries 
                     WHERE (population = 0 OR population IS NULL) 
                        OR (latitude = 0 OR latitude IS NULL) 
                        OR (area_km2 = 0 OR area_km2 IS NULL)";
    $remaining = $pdo->query($remaining_sql)->fetch()['remaining'];
    
    if ($remaining > 0) {
        echo "<div style='background: #e7f3ff; padding: 15px; margin: 15px 0; border: 1px solid #b3d9ff;'>";
        echo "<h3>🔄 Auto-Processing Next Batch</h3>";
        echo "<p>🎯 Countries still needing enhancement: <strong>{$remaining}</strong></p>";
        echo "<p>⏰ <span id='countdown'>5</span> seconds until next batch...</p>";
        echo "<p><button onclick='processNext()' style='background: #007cba; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer;'>➡️ Process Now (Skip Wait)</button></p>";
        echo "<p><button onclick='stopAuto()' style='background: #dc3545; color: white; padding: 8px 16px; border: none; border-radius: 5px; cursor: pointer;'>⏸️ Stop Auto-Processing</button></p>";
        echo "</div>";
        
        // Auto-redirect script
        echo "<script>
        let countdown = 5;
        let autoProcess = true;
        const countdownElement = document.getElementById('countdown');
        
        function updateCountdown() {
            if (!autoProcess) return;
            
            countdownElement.textContent = countdown;
            
            if (countdown <= 0) {
                processNext();
                return;
            }
            
            countdown--;
            setTimeout(updateCountdown, 1000);
        }
        
        function processNext() {
            window.location.href = '{$_SERVER['PHP_SELF']}';
        }
        
        function stopAuto() {
            autoProcess = false;
            countdownElement.parentElement.innerHTML = '⏸️ Auto-processing stopped by user';
        }
        
        // Start countdown
        setTimeout(updateCountdown, 1000);
        </script>";
    } else {
        echo "<div style='background: #d4edda; padding: 15px; margin: 15px 0; border: 1px solid #c3e6cb; color: #155724;'>";
        echo "<h3>🎉 AUTO-ENHANCEMENT COMPLETE!</h3>";
        echo "<p>✅ All countries now have complete geographical data</p>";
        echo "<p>🎊 <strong>Fully automated enhancement successful!</strong></p>";
        echo "<p><a href='api.php?request=country/GB' style='background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;'>🔗 Test Enhanced API</a></p>";
        echo "<p><a href='api.php?request=status' style='background: #17a2b8; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-left: 10px;'>📊 View Database Stats</a></p>";
        echo "</div>";
    }

} catch (PDOException $e) {
    echo "<div style='color: red; font-weight: bold;'>❌ DATABASE ERROR!</div>";
    echo "<p>Error: " . htmlspecialchars($e->getMessage()) . "</p>";
} catch (Exception $e) {
    echo "<div style='color: red; font-weight: bold;'>❌ GENERAL ERROR!</div>";
    echo "<p>Error: " . htmlspecialchars($e->getMessage()) . "</p>";
}

echo "<p style='margin-top: 20px; color: #666;'>Enhancement completed at: " . date('Y-m-d H:i:s') . "</p>";
?>