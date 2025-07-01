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
    $loadImages = isset($_GET['images']) && $_GET['images'] === 'true';
    
    logError("Fetching Wikipedia data for country: " . $countryCode . " (Images: " . ($loadImages ? 'YES' : 'NO') . ")");
    
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
    
    // Always fetch Wikipedia data
    $wikiData = fetchWikipediaData($countryName);
    
    // Only fetch images if specifically requested
    $images = [];
    if ($loadImages) {
        logError("Loading images for: " . $countryName);
        $images = fetchRealCountryImages($countryName);
    } else {
        logError("Skipping image loading for: " . $countryName);
    }
    
    $result = [
        'title' => $countryName,
        'extract' => $wikiData['extract'] ?? null,
        'url' => $wikiData['url'] ?? null,
        'images' => $images,
        'images_loaded' => $loadImages
    ];
    
    logError("Wikipedia data prepared for: " . $countryName . " (Images loaded: " . ($loadImages ? 'YES' : 'NO') . ")");
    echo json_encode($result);
    
} catch (Exception $e) {
    logError("Error: " . $e->getMessage());
    
    // Return error response with empty images array
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

function fetchRealCountryImages($countryName) {
    try {
        // Unsplash API - Your correct credentials
        $unsplashAccessKey = "XhdrXEeiO87sG1h2gh4JMAzye8kKAK_6mPJbziaAgWk";
        
        logError("Fetching images for: " . $countryName);
        
        $images = [];
        
        // Try Unsplash first (but only 2 images to conserve API calls)
        $images = fetchUnsplashImages($countryName, $unsplashAccessKey, 2);
        
        // If Unsplash fails or rate limited, try Wikimedia Commons
        if (empty($images)) {
            logError("Unsplash failed, trying Wikimedia Commons");
            $images = fetchWikimediaImages($countryName);
        }
        
        // If both fail, use optimized fallback (no CORS issues)
        if (empty($images)) {
            logError("All APIs failed, using optimized fallback");
            $images = generateOptimizedFallbacks($countryName);
        }
        
        logError("Successfully fetched " . count($images) . " images for " . $countryName);
        return $images;
        
    } catch (Exception $e) {
        logError("Images API error: " . $e->getMessage());
        return generateOptimizedFallbacks($countryName);
    }
}

function fetchUnsplashImages($countryName, $accessKey, $maxImages = 2) {
    try {
        if (empty($accessKey)) {
            return [];
        }
        
        $images = [];
        
        // Simplified search terms to reduce API calls
        $searchTerms = [
            $countryName . ' landmarks',
            $countryName . ' architecture'
        ];
        
        foreach ($searchTerms as $index => $searchTerm) {
            if ($index >= $maxImages) break;
            
            $imageData = fetchSingleUnsplashImage($searchTerm, $accessKey);
            if ($imageData) {
                $images[] = $imageData;
            }
            
            // Delay between requests to respect rate limits
            if ($index < count($searchTerms) - 1) {
                usleep(500000); // 0.5 seconds
            }
        }
        
        return $images;
        
    } catch (Exception $e) {
        logError("Unsplash batch error: " . $e->getMessage());
        return [];
    }
}

function fetchSingleUnsplashImage($searchTerm, $accessKey) {
    try {
        $unsplashUrl = "https://api.unsplash.com/search/photos?" . http_build_query([
            'query' => $searchTerm,
            'per_page' => 1,
            'orientation' => 'landscape'
        ]);
        
        logError("Attempting Unsplash API call: " . $unsplashUrl);
        logError("Using access key: " . substr($accessKey, 0, 10) . "...");
        
        $context = stream_context_create([
            'http' => [
                'timeout' => 10,
                'header' => [
                    'Authorization: Client-ID ' . $accessKey,
                    'User-Agent: Gazetteer/1.0'
                ]
            ]
        ]);
        
        $response = file_get_contents($unsplashUrl, false, $context);
        
        if ($response === false) {
            $error = error_get_last();
            logError("Unsplash API call failed for: " . $searchTerm . " - Error: " . json_encode($error));
            return null;
        }
        
        logError("Unsplash API response received for: " . $searchTerm . " - Length: " . strlen($response));
        
        $data = json_decode($response, true);
        
        if (!$data) {
            logError("Invalid JSON response from Unsplash for: " . $searchTerm);
            return null;
        }
        
        // Log the response structure for debugging
        logError("Unsplash response structure: " . json_encode(array_keys($data)));
        
        if (isset($data['errors'])) {
            logError("Unsplash API errors: " . json_encode($data['errors']));
            return null;
        }
        
        if (!isset($data['results']) || empty($data['results'])) {
            logError("No Unsplash results for: " . $searchTerm . " - Total: " . ($data['total'] ?? 'unknown'));
            return null;
        }
        
        $photo = $data['results'][0];
        logError("Successfully processed Unsplash image for: " . $searchTerm);
        
        return [
            'url' => $photo['urls']['small'] ?? $photo['urls']['regular'] ?? '',
            'caption' => $searchTerm . ' - Photo by ' . ($photo['user']['name'] ?? 'Unknown') . ' on Unsplash'
        ];
        
    } catch (Exception $e) {
        logError("Unsplash exception for '" . $searchTerm . "': " . $e->getMessage());
        return null;
    }
}

function fetchWikimediaImages($countryName) {
    try {
        // Wikimedia Commons API - completely free
        $searchUrl = "https://commons.wikimedia.org/w/api.php?" . http_build_query([
            'action' => 'query',
            'generator' => 'search',
            'gsrsearch' => $countryName . ' country',
            'gsrlimit' => 4,
            'prop' => 'imageinfo',
            'iiprop' => 'url|size',
            'iiurlwidth' => 300,
            'format' => 'json'
        ]);
        
        $context = stream_context_create([
            'http' => [
                'timeout' => 10,
                'user_agent' => 'Gazetteer/1.0'
            ]
        ]);
        
        $response = file_get_contents($searchUrl, false, $context);
        
        if ($response === false) {
            return [];
        }
        
        $data = json_decode($response, true);
        
        if (!$data || !isset($data['query']['pages'])) {
            return [];
        }
        
        $images = [];
        foreach ($data['query']['pages'] as $page) {
            if (isset($page['imageinfo'][0]['thumburl'])) {
                $images[] = [
                    'url' => $page['imageinfo'][0]['thumburl'],
                    'caption' => $countryName . ' - ' . str_replace('File:', '', $page['title'])
                ];
            }
        }
        
        return $images;
        
    } catch (Exception $e) {
        logError("Wikimedia API error: " . $e->getMessage());
        return [];
    }
}

function getImageSearchTerms($countryName) {
    // Enhanced search terms for better image results
    $baseTerms = [
        $countryName . ' landmarks',
        $countryName . ' architecture', 
        $countryName . ' landscape',
        $countryName . ' culture'
    ];
    
    // Add capital city for better results
    $capitalMap = [
        'United Kingdom' => 'London',
        'United States' => 'Washington DC',
        'France' => 'Paris',
        'Germany' => 'Berlin',
        'Japan' => 'Tokyo',
        'China' => 'Beijing',
        'Italy' => 'Rome',
        'Spain' => 'Madrid',
        'Russia' => 'Moscow',
        'India' => 'Delhi',
        'Brazil' => 'Brasilia',
        'Australia' => 'Sydney',
        'Canada' => 'Ottawa'
    ];
    
    if (isset($capitalMap[$countryName])) {
        $baseTerms[] = $capitalMap[$countryName];
    }
    
    return $baseTerms;
}

function generateOptimizedFallbacks($countryName) {
    // Use Wikipedia/Wikimedia as primary fallback to avoid CORS issues
    logError("Generating optimized fallbacks for: " . $countryName);
    
    // Try Wikimedia first
    $images = fetchWikimediaImages($countryName);
    
    if (!empty($images)) {
        return $images;
    }
    
    // If Wikimedia fails, generate country-specific info cards instead of broken images
    return [
        [
            'url' => '', // No image URL - will be handled in frontend
            'caption' => 'Images temporarily unavailable for ' . $countryName,
            'type' => 'info_card'
        ]
    ];
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