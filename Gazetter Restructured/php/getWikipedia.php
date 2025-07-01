<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

function logError($message) {
    error_log("getWikipedia.php: " . $message);
}

try {
    if (!isset($_GET['country']) || empty($_GET['country'])) {
        throw new Exception('Country code is required');
    }
    
    $countryCode = strtoupper($_GET['country']);
    logError("Fetching Wikipedia data for country: " . $countryCode);
    
    // Get country name from REST Countries API
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
    
    // Get country name
    $countryName = isset($countryData[0]['name']['common']) ? $countryData[0]['name']['common'] : 'Unknown';
    
    logError("Country name: " . $countryName);
    
    // Fetch Wikipedia data
    $wikiData = fetchWikipediaData($countryName);
    
    // Fetch country images
    $images = fetchCountryImages($countryName);
    
    $result = [
        'title' => $countryName,
        'extract' => $wikiData['extract'] ?? null,
        'url' => $wikiData['url'] ?? null,
        'images' => $images
    ];
    
    logError("Wikipedia data prepared for: " . $countryName);
    echo json_encode($result);
    
} catch (Exception $e) {
    logError("Error: " . $e->getMessage());
    
    // Fallback data
    echo json_encode(generateFallbackWikipedia($countryCode));
}

function fetchWikipediaData($countryName) {
    try {
        // Use Wikipedia API to get page extract
        $wikiApiUrl = "https://en.wikipedia.org/api/rest_v1/page/summary/" . urlencode($countryName);
        
        $context = stream_context_create([
            'http' => [
                'timeout' => 10,
                'user_agent' => 'Gazetteer/1.0'
            ]
        ]);
        
        $response = file_get_contents($wikiApiUrl, false, $context);
        
        if ($response === false) {
            throw new Exception('Failed to fetch Wikipedia data');
        }
        
        $data = json_decode($response, true);
        
        if (!$data) {
            throw new Exception('Invalid Wikipedia response');
        }
        
        $extract = isset($data['extract']) ? $data['extract'] : '';
        $url = isset($data['content_urls']['desktop']['page']) ? $data['content_urls']['desktop']['page'] : '';
        
        // Limit extract length
        if (strlen($extract) > 500) {
            $extract = substr($extract, 0, 500) . '...';
        }
        
        return [
            'extract' => $extract,
            'url' => $url
        ];
        
    } catch (Exception $e) {
        logError("Wikipedia API error: " . $e->getMessage());
        return generateWikipediaFallback($countryName);
    }
}

function fetchCountryImages($countryName) {
    try {
        // generate placeholder images with country-specific URLs
        $images = [];
        
        // For demo purposes, we'll create placeholder images
        // In a real implementation, you might use Unsplash API or similar
        $imageTemplates = [
            [
                'url' => 'https://picsum.photos/200/150?random=1',
                'caption' => 'Landscape view of ' . $countryName
            ],
            [
                'url' => 'https://picsum.photos/200/150?random=2',
                'caption' => 'Architecture in ' . $countryName
            ],
            [
                'url' => 'https://picsum.photos/200/150?random=3',
                'caption' => 'Cultural site in ' . $countryName
            ],
            [
                'url' => 'https://picsum.photos/200/150?random=4',
                'caption' => 'Natural beauty of ' . $countryName
            ]
        ];
        
        return $imageTemplates;
        
    } catch (Exception $e) {
        logError("Images API error: " . $e->getMessage());
        return [];
    }
}

function generateWikipediaFallback($countryName) {
    // Generate basic information about the country
    $fallbackTexts = [
        'This country is located in a specific region of the world and has its own unique culture, history, and traditions.',
        'The nation has developed over centuries, with influences from various civilizations and cultures.',
        'It features diverse landscapes, from urban areas to natural environments, each with their own characteristics.',
        'The country has its own government, economy, and social systems that reflect its particular heritage.',
        'Tourism, industry, and agriculture may play important roles in the national economy.'
    ];
    
    $randomText = $fallbackTexts[array_rand($fallbackTexts)];
    
    return [
        'extract' => $countryName . ' is a sovereign nation. ' . $randomText . ' For more detailed information, please visit the official Wikipedia page.',
        'url' => 'https://en.wikipedia.org/wiki/' . urlencode($countryName)
    ];
}

function generateFallbackWikipedia($countryCode) {
    return [
        'title' => 'Country Information',
        'extract' => 'Wikipedia information is temporarily unavailable. Please try again later or visit Wikipedia directly for more information about this country.',
        'url' => 'https://en.wikipedia.org',
        'images' => []
    ];
}
?>