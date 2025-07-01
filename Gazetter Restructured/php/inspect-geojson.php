<?php
header('Content-Type: text/html');
?>
<!DOCTYPE html>
<html>
<head>
    <title>GeoJSON Inspector</title>
    <style>
        body { font-family: Arial; margin: 20px; }
        .feature { margin: 10px 0; padding: 10px; border: 1px solid #ddd; }
        .properties { background: #f8f9fa; padding: 10px; margin: 5px 0; }
        pre { background: #e9ecef; padding: 10px; overflow-x: auto; }
    </style>
</head>
<body>
    <h1>GeoJSON Structure Inspector</h1>
    
    <?php
    try {
        $geoJsonFile = '../countryBorders.geo.json';
        $json = file_get_contents($geoJsonFile);
        $data = json_decode($json, true);
        
        echo "<h2>Total Features: " . count($data['features']) . "</h2>";
        
        echo "<h3>First 5 Feature Properties:</h3>";
        
        for ($i = 0; $i < min(5, count($data['features'])); $i++) {
            $feature = $data['features'][$i];
            echo "<div class='feature'>";
            echo "<h4>Feature #" . ($i + 1) . "</h4>";
            
            if (isset($feature['properties'])) {
                echo "<div class='properties'>";
                echo "<strong>Properties found:</strong><br>";
                foreach ($feature['properties'] as $key => $value) {
                    if (is_string($value) && strlen($value) < 100) {
                        echo "<strong>$key:</strong> " . htmlspecialchars($value) . "<br>";
                    } else {
                        echo "<strong>$key:</strong> [" . gettype($value) . "]<br>";
                    }
                }
                echo "</div>";
            }
            echo "</div>";
        }
        
        // Find all unique property keys
        echo "<h3>All Property Keys Found:</h3>";
        $allKeys = [];
        foreach ($data['features'] as $feature) {
            if (isset($feature['properties'])) {
                $allKeys = array_merge($allKeys, array_keys($feature['properties']));
            }
        }
        $uniqueKeys = array_unique($allKeys);
        sort($uniqueKeys);
        
        echo "<pre>" . implode("\n", $uniqueKeys) . "</pre>";
        
        // Look for country-like properties
        echo "<h3>Potential Country Properties:</h3>";
        $countryKeys = [];
        foreach ($uniqueKeys as $key) {
            $lower = strtolower($key);
            if (strpos($lower, 'iso') !== false || 
                strpos($lower, 'name') !== false || 
                strpos($lower, 'country') !== false ||
                strpos($lower, 'admin') !== false) {
                $countryKeys[] = $key;
            }
        }
        
        if (!empty($countryKeys)) {
            echo "<div class='properties'>";
            foreach ($countryKeys as $key) {
                echo "<strong>$key</strong><br>";
            }
            echo "</div>";
            
            // Show sample values for these keys
            echo "<h4>Sample Values:</h4>";
            $sample = $data['features'][0]['properties'];
            foreach ($countryKeys as $key) {
                if (isset($sample[$key])) {
                    echo "<strong>$key:</strong> " . htmlspecialchars($sample[$key]) . "<br>";
                }
            }
        } else {
            echo "<p>No obvious country properties found. Check the full list above.</p>";
        }
        
    } catch (Exception $e) {
        echo "<div style='color: red;'>Error: " . $e->getMessage() . "</div>";
    }
    ?>
</body>
</html>