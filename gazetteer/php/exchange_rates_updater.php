<?php
// ===================================================================
// EXCHANGE RATES UPDATER - Fetch from ExchangeRate-API
// ===================================================================

// Database configuration
$config = [
    'host' => 'localhost',
    'dbname' => 'u215315340_Gazetteer',
    'username' => 'u215315340_Gazetteerllp',
    'password' => 'Rainbowunicorn1!!'
];

// Exchange Rate API configuration
$EXCHANGE_API_BASE = 'https://api.exchangerate-api.com/v4/latest/';
$BASE_CURRENCY = 'USD'; // Base currency for rates
?>
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Exchange Rates Update</title>
    <link rel="stylesheet" href="../css/db-setup-files_style.css">
</head>
<body>

<h1>💱 Exchange Rates Update from ExchangeRate-API</h1>
<hr>

<?php
try {
    // Connect to database
    $pdo = new PDO(
        "mysql:host={$config['host']};dbname={$config['dbname']};charset=utf8mb4",
        $config['username'],
        $config['password'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false
        ]
    );
    
    echo "✅ Database connected successfully<br><br>";
    
    // Check for existing rates today
    $existingRates = $pdo->prepare("
        SELECT COUNT(*) FROM exchange_rates 
        WHERE base_currency = ? AND rate_date = CURDATE()
    ");
    $existingRates->execute([$BASE_CURRENCY]);
    $todayRatesCount = $existingRates->fetchColumn();
    
    if ($todayRatesCount > 0) {
        echo "<div class='info-box'>";
        echo "ℹ️ <strong>RATES ALREADY UPDATED TODAY</strong><br>";
        echo "Found $todayRatesCount exchange rates for today.<br>";
        echo "Exchange rates typically update once per day.<br><br>";
        echo "Click 'Proceed Anyway' to force update, or skip if rates are recent.<br>";
        echo "</div><br>";
    }
    
    echo "<h3>📡 Fetching exchange rates from ExchangeRate-API...</h3>";
    
    // Build API URL
    $apiUrl = $EXCHANGE_API_BASE . $BASE_CURRENCY;
    
    // Create context with timeout
    $context = stream_context_create([
        'http' => [
            'timeout' => 15,
            'user_agent' => 'Gazetteer/1.0'
        ]
    ]);
    
    // Fetch exchange rates
    $ratesJson = file_get_contents($apiUrl, false, $context);
    
    if ($ratesJson === false) {
        throw new Exception("Failed to fetch exchange rates from API");
    }
    
    $ratesData = json_decode($ratesJson, true);
    
    if ($ratesData === null) {
        throw new Exception("Failed to parse JSON response from Exchange Rate API");
    }
    
    if (!isset($ratesData['rates']) || !is_array($ratesData['rates'])) {
        throw new Exception("Invalid response format from Exchange Rate API");
    }
    
    echo "✅ Successfully fetched rates for " . count($ratesData['rates']) . " currencies<br>";
    echo "📅 Rates date: " . $ratesData['date'] . "<br>";
    echo "💱 Base currency: " . $ratesData['base'] . "<br><br>";
    
    // Clear today's rates first (if any)
    echo "<h3>🧹 Cleaning old rates...</h3>";
    $deleteStmt = $pdo->prepare("
        DELETE FROM exchange_rates 
        WHERE base_currency = ? AND rate_date = CURDATE()
    ");
    $deleteStmt->execute([$BASE_CURRENCY]);
    echo "✅ Cleared " . $deleteStmt->rowCount() . " old rates<br><br>";
    
    // Prepare insert statement
    echo "<h3>💾 Inserting new exchange rates...</h3>";
    $insertStmt = $pdo->prepare("
        INSERT INTO exchange_rates (base_currency, target_currency, rate, rate_date)
        VALUES (?, ?, ?, CURDATE())
    ");
    
    // Start transaction
    $pdo->beginTransaction();
    
    // Crucial Trackers
    $processed = 0;
    $errors = 0;
    
    foreach ($ratesData['rates'] as $currency => $rate) {
        try {
            // Skip if rate is not numeric
            if (!is_numeric($rate) || $rate <= 0) {
                echo "⚠️ Skipping invalid rate for $currency: $rate<br>";
                continue;
            }
            
            // Insert exchange rate
            $insertStmt->execute([$BASE_CURRENCY, $currency, $rate]);
            $processed++;
            
            // Show progress every 25 currencies
            if ($processed % 25 == 0) {
                echo "📊 Processed $processed currencies...<br>";
                flush();
                ob_flush();
            }
            
        } catch (Exception $e) {
            $errors++;
            echo "❌ Error inserting rate for $currency: " . $e->getMessage() . "<br>";
        }
    }
    
    // Commit transaction
    $pdo->commit();
    
    
    // Crucial Trackers
    echo "<br><h3>📈 Exchange Rates Update Statistics:</h3>";
    echo "✅ Currencies processed: <strong>$processed</strong><br>";
    echo "❌ Errors encountered: <strong>$errors</strong><br>";
    
    // Get summary statistics
    $rateStats = $pdo->query("
        SELECT 
            COUNT(*) as total_rates,
            MIN(rate) as min_rate,
            MAX(rate) as max_rate,
            COUNT(DISTINCT target_currency) as unique_currencies
        FROM exchange_rates 
        WHERE base_currency = '$BASE_CURRENCY' AND rate_date = CURDATE()
    ")->fetch();
    
    
    // I got a a bit carried away here seeing what I could do, I though since this file is just used to set up the database and wont impact the main app beyond that, why not just play around a bit
    echo "<br><h3>💱 Rate Summary:</h3>";
    echo "📊 Total rates stored: <strong>{$rateStats['total_rates']}</strong><br>";
    echo "📈 Highest rate: <strong>" . number_format($rateStats['max_rate'], 6) . "</strong><br>";
    echo "📉 Lowest rate: <strong>" . number_format($rateStats['min_rate'], 6) . "</strong><br>";
    echo "💰 Unique currencies: <strong>{$rateStats['unique_currencies']}</strong><br>";
    
    // Show popular currency rates
    echo "<br><h3>🔍 Popular Currency Rates (vs $BASE_CURRENCY):</h3>";
    
    $popularCurrencies = ['EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'BTC'];
    $popularRates = $pdo->prepare("
        SELECT target_currency, rate 
        FROM exchange_rates 
        WHERE base_currency = ? AND target_currency = ? AND rate_date = CURDATE()
    ");
    
    echo "<table class='data-table'>";
    echo "<tr><th>Currency</th><th>Rate (1 $BASE_CURRENCY =)</th><th>Inverse (1 unit =)</th></tr>";
    
    foreach ($popularCurrencies as $currency) {
        $popularRates->execute([$BASE_CURRENCY, $currency]);
        $rate = $popularRates->fetch();
        
        if ($rate) {
            $inverse = 1 / $rate['rate'];
            echo "<tr>";
            echo "<td><strong>$currency</strong></td>";
            echo "<td>" . number_format($rate['rate'], 4) . " $currency</td>";
            echo "<td>" . number_format($inverse, 4) . " $BASE_CURRENCY</td>";
            echo "</tr>";
        }
    }
    echo "</table>";
    
    // Show currencies used by countries in our database
    echo "<br><h3>🌍 Rates for Countries in Database:</h3>";
    $countryRates = $pdo->query("
        SELECT DISTINCT c.code, c.name, er.rate
        FROM currencies c
        JOIN country_currencies cc ON c.id = cc.currency_id
        LEFT JOIN exchange_rates er ON c.code = er.target_currency 
            AND er.base_currency = '$BASE_CURRENCY' 
            AND er.rate_date = CURDATE()
        ORDER BY c.code
        LIMIT 20
    ")->fetchAll();
    
    echo "<table class='data-table-small'>";
    echo "<tr><th>Code</th><th>Currency</th><th>Rate</th><th>Status</th></tr>";
    
    foreach ($countryRates as $curr) {
        echo "<tr>";
        echo "<td><strong>{$curr['code']}</strong></td>";
        echo "<td>{$curr['name']}</td>";
        
        if ($curr['rate']) {
            echo "<td>" . number_format($curr['rate'], 4) . "</td>";
            echo "<td class='success-text'>✅ Available</td>";
        } else {
            echo "<td>-</td>";
            echo "<td class='warning-text'>⚠️ No rate</td>";
        }
        echo "</tr>";
    }
    echo "</table>";
    
    echo "<br><hr>";
    echo "<div class='success-box'>";
    echo "🎉 <strong>EXCHANGE RATES UPDATE COMPLETED!</strong><br>";
    echo "✅ Current exchange rates fetched and stored<br>";
    echo "✅ Database updated with today's currency rates<br>";
    echo "✅ Rates will be cached until next update<br>";
    echo "</div>";
    
} catch (Exception $e) {
    // Rollback transaction on error
    if ($pdo && $pdo->inTransaction()) {
        $pdo->rollback();
    }
    
    echo "<div class='error-box'>";
    echo "❌ <strong>EXCHANGE RATES UPDATE FAILED!</strong><br>";
    echo "Error: " . htmlspecialchars($e->getMessage()) . "<br><br>";
    echo "<strong>Common solutions:</strong><br>";
    echo "• Check internet connection<br>";
    echo "• Verify the ExchangeRate-API service is available<br>";
    echo "• Try again in a few minutes (API might be temporarily down)<br>";
    echo "• Check database permissions<br>";
    echo "</div>";
}

echo "<br><hr>";
echo "<p class='footer-text'><em>Exchange rates update completed at: " . date('Y-m-d H:i:s') . "</em></p>";
?>

</body>
</html>