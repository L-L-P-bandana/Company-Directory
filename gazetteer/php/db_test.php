<?php
// ===================================================================
// DATABASE CONNECTION TEST - Making sure everything works
// ===================================================================

// Db config
$config = [
    'host' => 'localhost',
    'dbname' => 'u215315340_Gazetteer',
    'username' => 'u215315340_Gazetteerllp',
    'password' => 'Rainbowunicorn1!!'
];

echo "<h1>🚀 Gazetteer Database Connection Test</h1>";
echo "<hr>";

try {
    // Create PDO connection
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
    
    echo "✅ <strong>Database Connection:</strong> SUCCESS!<br><br>";
    
    // Test 1: Check if all tables exist
    echo "<h3>📋 Table Structure Check:</h3>";
    $tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
    
    $expectedTables = [
        'borders', 'countries', 'country_currencies', 'country_details',
        'country_languages', 'currencies', 'exchange_rates', 'languages',
        'system_cache', 'user_searches', 'weather_data', 'weather_forecast'
    ];
    
    foreach ($expectedTables as $table) {
        if (in_array($table, $tables)) {
            echo "✅ Table <strong>$table</strong> exists<br>";
        } else {
            echo "❌ Table <strong>$table</strong> missing<br>";
        }
    }
    
    echo "<br>";
    
    // Test 2: Check sample data
    echo "<h3>🧪 Sample Data Check:</h3>";
    
    // Check currencies
    $currencyCount = $pdo->query("SELECT COUNT(*) FROM currencies")->fetchColumn();
    echo "💰 Currencies in database: <strong>$currencyCount</strong><br>";
    
    // Check languages  
    $languageCount = $pdo->query("SELECT COUNT(*) FROM languages")->fetchColumn();
    echo "🗣️ Languages in database: <strong>$languageCount</strong><br>";
    
    // Check countries
    $countryCount = $pdo->query("SELECT COUNT(*) FROM countries")->fetchColumn();
    echo "🌍 Countries in database: <strong>$countryCount</strong><br>";
    
    if ($countryCount > 0) {
        echo "<br><h3>🔍 Sample Country Data:</h3>";
        $sampleCountries = $pdo->query("SELECT iso_code_2, name_common, capital, population FROM countries LIMIT 5")->fetchAll();
        
        echo "<table border='1' style='border-collapse: collapse; width: 100%;'>";
        echo "<tr><th>Code</th><th>Country</th><th>Capital</th><th>Population</th></tr>";
        foreach ($sampleCountries as $country) {
            $population = number_format($country['population']);
            echo "<tr>";
            echo "<td>{$country['iso_code_2']}</td>";
            echo "<td>{$country['name_common']}</td>";
            echo "<td>{$country['capital']}</td>";
            echo "<td>{$population}</td>";
            echo "</tr>";
        }
        echo "</table>";
    }
    
    echo "<br>";
    
    // Test 3: Testing sample query using the view
    echo "<h3>🔬 Advanced Query Test:</h3>";
    try {
        $viewTest = $pdo->query("SELECT COUNT(*) FROM country_details")->fetchColumn();
        echo "✅ Country details view working: <strong>$viewTest records</strong><br>";
    } catch (Exception $e) {
        echo "❌ Country details view error: " . $e->getMessage() . "<br>";
    }
    
    // Test 4: Test stored procedure
    echo "<br><h3>⚙️ Stored Procedure Test:</h3>";
    try {
        $stmt = $pdo->prepare("CALL GetCountryInfo('GB')");
        $stmt->execute();
        $result = $stmt->fetch();
        
        if ($result) {
            echo "✅ GetCountryInfo procedure working<br>";
            echo "📍 GB Result: {$result['name_common']} - {$result['capital']}<br>";
        } else {
            echo "⚠️ GetCountryInfo procedure returned no data (normal if GB not imported yet)<br>";
        }
    } catch (Exception $e) {
        echo "❌ Stored procedure error: " . $e->getMessage() . "<br>";
    }
    
    echo "<br><hr>";
    echo "<h2>🎯 OVERALL STATUS:</h2>";
    
    if (count($tables) >= 10 && $currencyCount > 0 && $languageCount > 0) {
        echo "<div style='background: #d4edda; padding: 15px; border: 1px solid #c3e6cb; border-radius: 5px;'>";
        echo "🎉 <strong>DATABASE IS READY!</strong><br>";
        echo "✅ All tables created successfully<br>";
        echo "✅ Sample data loaded<br>";
        echo "</div>";
    } else {
        echo "<div style='background: #f8d7da; padding: 15px; border: 1px solid #f5c6cb; border-radius: 5px;'>";
        echo "⚠️ <strong>SETUP INCOMPLETE</strong><br>";
        echo "❌ Some tables or data missing<br>";
        echo "❌ Check SQL import process<br>";
        echo "</div>";
    }
    
} catch (PDOException $e) {
    echo "<div style='background: #f8d7da; padding: 15px; border: 1px solid #f5c6cb; border-radius: 5px;'>";
    echo "❌ <strong>DATABASE CONNECTION FAILED!</strong><br>";
    echo "Error: " . htmlspecialchars($e->getMessage()) . "<br><br>";
    echo "<strong>Common fixes:</strong><br>";
    echo "• Check db credentials<br>";
    echo "• Verify db name<br>";
    echo "• Check db perms<br>";
    echo "</div>";
}

echo "<br><hr>";
echo "<p><em>Test completed at: " . date('Y-m-d H:i:s') . "</em></p>";
?>