<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

try {
    if (!isset($_GET['country']) || empty($_GET['country'])) {
        throw new Exception('Country code is required');
    }
    
    $countryCode = strtoupper($_GET['country']);
    
    // Check if this is a request for images only
    $imagesOnly = isset($_GET['images']) && $_GET['images'] === 'true';
    
    if ($imagesOnly) {
        $images = fetchCountryImages($countryCode);
        echo json_encode(['images' => $images]);
    } else {
        $wikipediaData = fetchWikipediaData($countryCode);
        echo json_encode($wikipediaData);
    }
    
} catch (Exception $e) {
    echo json_encode([
        'error' => 'Wikipedia API unavailable',
        'message' => $e->getMessage(),
        'title' => 'Country Information',
        'extract' => 'Wikipedia information is temporarily unavailable. Please try again later.',
        'url' => 'https://en.wikipedia.org',
        'images' => []
    ]);
}

function fetchWikipediaData($countryCode) {
    try {
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
        
        $countryName = $countryData[0]['name']['common'] ?? 'Unknown';
        
        // Try multiple Wikipedia search strategies
        $wikiData = tryWikipediaSearch($countryName, $context);
        
        return [
            'title' => $countryName,
            'extract' => $wikiData['extract'] ?? generateFallbackExtract($countryName),
            'url' => $wikiData['url'] ?? "https://en.wikipedia.org/wiki/" . urlencode($countryName)
        ];
        
    } catch (Exception $e) {
        return [
            'title' => 'Country Information',
            'extract' => 'Wikipedia information is temporarily unavailable.',
            'url' => 'https://en.wikipedia.org'
        ];
    }
}

function tryWikipediaSearch($countryName, $context) {
    // Strategy 1: Try direct page summary
    $wikiApiUrl = "https://en.wikipedia.org/api/rest_v1/page/summary/" . urlencode($countryName);
    
    $response = @file_get_contents($wikiApiUrl, false, $context);
    
    if ($response !== false) {
        $data = json_decode($response, true);
        if ($data && isset($data['extract']) && !empty($data['extract'])) {
            return [
                'extract' => strlen($data['extract']) > 500 ? substr($data['extract'], 0, 500) . '...' : $data['extract'],
                'url' => $data['content_urls']['desktop']['page'] ?? ''
            ];
        }
    }
    
    // Strategy 2: Try alternative country names
    $alternativeNames = getAlternativeCountryNames($countryName);
    
    foreach ($alternativeNames as $altName) {
        $altApiUrl = "https://en.wikipedia.org/api/rest_v1/page/summary/" . urlencode($altName);
        $response = @file_get_contents($altApiUrl, false, $context);
        
        if ($response !== false) {
            $data = json_decode($response, true);
            if ($data && isset($data['extract']) && !empty($data['extract'])) {
                return [
                    'extract' => strlen($data['extract']) > 500 ? substr($data['extract'], 0, 500) . '...' : $data['extract'],
                    'url' => $data['content_urls']['desktop']['page'] ?? ''
                ];
            }
        }
    }
    
    // If all strategies fail, return null to trigger fallback
    return null;
}

function getAlternativeCountryNames($countryName) {
    $alternatives = [
        'United States' => ['United States of America', 'USA', 'US'],
        'United Kingdom' => ['UK', 'Britain', 'Great Britain'],
        'Russia' => ['Russian Federation'],
        'South Korea' => ['Korea', 'Republic of Korea'],
        'North Korea' => ['Democratic People\'s Republic of Korea'],
        'Czech Republic' => ['Czechia'],
        'Congo' => ['Republic of the Congo'],
        'Myanmar' => ['Burma'],
        'Iran' => ['Islamic Republic of Iran'],
        'Syria' => ['Syrian Arab Republic'],
        'Venezuela' => ['Bolivarian Republic of Venezuela'],
        'Bolivia' => ['Plurinational State of Bolivia'],
        'Tanzania' => ['United Republic of Tanzania'],
        'Moldova' => ['Republic of Moldova'],
        'Macedonia' => ['North Macedonia'],
        'Ivory Coast' => ['Côte d\'Ivoire']
    ];
    
    return $alternatives[$countryName] ?? [$countryName];
}

function generateFallbackExtract($countryName) {
    return $countryName . " is a sovereign nation with its own unique culture, history, and traditions. The country has developed over centuries and features diverse landscapes and communities. For detailed information about " . $countryName . ", please visit the official Wikipedia page.";
}

function fetchCountryImages($countryCode) {
    try {
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
            return [];
        }
        
        $countryData = json_decode($countryResponse, true);
        
        if (!$countryData || empty($countryData)) {
            return [];
        }
        
        $countryName = $countryData[0]['name']['common'] ?? 'Unknown';
        
        // Skip images for "Unknown" countries
        if ($countryName === 'Unknown') {
            return [
                [
                    'type' => 'info_card',
                    'caption' => 'Country information not available'
                ]
            ];
        }
        
        // Unsplash API for country images
        $unsplashApiKey = "XhdrXEeiO87sG1h2gh4JMAzye8kKAK_6mPJbziaAgWk";
        
        $unsplashUrl = "https://api.unsplash.com/search/photos?" . http_build_query([
            'query' => $countryName . ' landmarks',
            'per_page' => 4,
            'client_id' => $unsplashApiKey
        ]);
        
        $unsplashResponse = @file_get_contents($unsplashUrl, false, $context);
        
        if ($unsplashResponse === false) {
            return [
                [
                    'type' => 'info_card',
                    'caption' => 'Images temporarily unavailable for ' . $countryName
                ]
            ];
        }
        
        $unsplashData = json_decode($unsplashResponse, true);
        
        if (!$unsplashData || !isset($unsplashData['results']) || empty($unsplashData['results'])) {
            return [
                [
                    'type' => 'info_card',
                    'caption' => 'No images found for ' . $countryName
                ]
            ];
        }
        
        $images = [];
        foreach ($unsplashData['results'] as $photo) {
            if (isset($photo['urls']['small'])) {
                $images[] = [
                    'url' => $photo['urls']['small'],
                    'caption' => $photo['alt_description'] ?? ($countryName . ' - Country image')
                ];
            }
        }
        
        return $images;
        
    } catch (Exception $e) {
        return [
            [
                'type' => 'info_card',
                'caption' => 'Images temporarily unavailable'
            ]
        ];
    }
}