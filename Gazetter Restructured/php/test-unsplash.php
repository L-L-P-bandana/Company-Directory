<?php
header('Content-Type: text/html');

// Enhanced test with correct access key
$accessKey = "XhdrXEeiO87sG1h2gh4JMAzye8kKAK_6mPJbziaAgWk";

echo "<h1>🔍 Unsplash API Diagnostic Test</h1>";
echo "<p><strong>Access Key:</strong> " . substr($accessKey, 0, 15) . "...</p>";
echo "<p><strong>Time:</strong> " . date('Y-m-d H:i:s') . "</p>";

// Test 1: Basic random photo
echo "<h2>Test 1: Random Photo (Simplest Test)</h2>";
testUnsplashEndpoint("https://api.unsplash.com/photos/random", $accessKey);

// Test 2: Search endpoint
echo "<h2>Test 2: Search Photos</h2>";
testUnsplashEndpoint("https://api.unsplash.com/search/photos?query=landscape&per_page=1", $accessKey);

// Test 3: Check what permissions we have
echo "<h2>Test 3: Check App Info</h2>";
testUnsplashEndpoint("https://api.unsplash.com/me", $accessKey);

function testUnsplashEndpoint($url, $accessKey) {
    echo "<p><strong>URL:</strong> " . htmlspecialchars($url) . "</p>";
    
    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 10,
            'header' => [
                'Authorization: Client-ID ' . $accessKey,
                'User-Agent: Gazetteer-Test/1.0',
                'Accept: application/json'
            ]
        ]
    ]);
    
    $response = @file_get_contents($url, false, $context);
    
    if ($response === false) {
        $error = error_get_last();
        echo "<div style='background: #ffebee; padding: 10px; border-left: 4px solid #f44336;'>";
        echo "<strong>❌ FAILED</strong><br>";
        echo "Error: " . htmlspecialchars($error['message']) . "<br>";
        
        // Parse HTTP response code from error message
        if (preg_match('/HTTP\/1\.\d (\d+)/', $error['message'], $matches)) {
            $httpCode = $matches[1];
            echo "<strong>HTTP Code:</strong> $httpCode<br>";
            
            switch($httpCode) {
                case '401':
                    echo "<strong>💡 Solution:</strong> Your API key is rejected. Check these:<br>";
                    echo "1. ✅ Enable 'Read photos access' permission in your Unsplash app<br>";
                    echo "2. ✅ Click 'Save' and wait 2-3 minutes<br>";
                    echo "3. ✅ Verify your access key is correct<br>";
                    break;
                case '403':
                    echo "<strong>💡 Solution:</strong> Rate limited or permissions issue<br>";
                    break;
                case '429':
                    echo "<strong>💡 Solution:</strong> Too many requests, wait for reset<br>";
                    break;
                default:
                    echo "<strong>💡 Solution:</strong> Unexpected error, check Unsplash status<br>";
            }
        }
        echo "</div><br>";
    } else {
        echo "<div style='background: #e8f5e8; padding: 10px; border-left: 4px solid #4caf50;'>";
        echo "<strong>✅ SUCCESS</strong><br>";
        echo "Response length: " . strlen($response) . " bytes<br>";
        
        $data = json_decode($response, true);
        if ($data) {
            echo "<strong>✅ Valid JSON received</strong><br>";
            if (isset($data['urls']['small'])) {
                echo "<strong>✅ Image URL found:</strong> " . htmlspecialchars($data['urls']['small']) . "<br>";
            } elseif (isset($data['results'][0]['urls']['small'])) {
                echo "<strong>✅ Search result found:</strong> " . htmlspecialchars($data['results'][0]['urls']['small']) . "<br>";
            } elseif (isset($data['total'])) {
                echo "<strong>Total search results:</strong> " . $data['total'] . "<br>";
            }
        } else {
            echo "<strong>⚠️ Invalid JSON response</strong><br>";
            echo "<pre>" . htmlspecialchars(substr($response, 0, 200)) . "...</pre>";
        }
        echo "</div><br>";
    }
}

echo "<hr>";
echo "<h2>🎯 Next Steps:</h2>";
echo "<ol>";
echo "<li><strong>If you see 401 errors:</strong> Go to your Unsplash app settings</li>";
echo "<li><strong>Check 'Read photos access'</strong> permission (in addition to Public access)</li>";
echo "<li><strong>Click 'Save'</strong> and wait 2-3 minutes</li>";
echo "<li><strong>Refresh this page</strong> to test again</li>";
echo "<li><strong>If still failing:</strong> Double-check your access key in the app</li>";
echo "</ol>";
?>