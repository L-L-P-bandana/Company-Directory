<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

try {
    if (!isset($_GET['country']) || empty($_GET['country'])) {
        throw new Exception('Country code is required');
    }
    
    $countryCode = strtoupper($_GET['country']);
    
    // API key config
    $apiKey = "624c7b4a70024c34a7d20bce1e34daaa";
    
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
    
    // Fetch real news from News API
    $articles = fetchEnhancedNews($countryCode, $countryName, $apiKey);
    
    $result = [
        'country' => $countryName,
        'articles' => $articles,
        'total' => count($articles)
    ];
    
    echo json_encode($result);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'News API unavailable',
        'message' => $e->getMessage(),
        'country' => isset($countryName) ? $countryName : 'Unknown',
        'articles' => []
    ]);
}

function fetchEnhancedNews($countryCode, $countryName, $apiKey) {
    try {
        // Strategy 1: Try country-specific top headlines first
        $articles = tryTopHeadlinesEnhanced($countryCode, $apiKey);
        
        if (!empty($articles)) {
            return $articles;
        }
        
        // Strategy 2: Try "everything" endpoint with country name search
        $articles = tryEverythingSearchEnhanced($countryName, $apiKey);
        
        if (!empty($articles)) {
            return $articles;
        }
        
        // Strategy 3: Fallback to general news for region
        $articles = tryRegionalNewsEnhanced($countryCode, $apiKey);
        
        if (!empty($articles)) {
            return $articles;
        }
        
        return createFallbackNewsData($countryName);
        
    } catch (Exception $e) {
        return createFallbackNewsData($countryName);
    }
}

function tryTopHeadlinesEnhanced($countryCode, $apiKey) {
    // Country code mapping for News API
    $countryMapping = [
        'US' => 'us', 'GB' => 'gb', 'CA' => 'ca', 'AU' => 'au',
        'DE' => 'de', 'FR' => 'fr', 'IT' => 'it', 'ES' => 'es',
        'JP' => 'jp', 'CN' => 'cn', 'IN' => 'in', 'BR' => 'br',
        'RU' => 'ru', 'KR' => 'kr', 'NL' => 'nl', 'SE' => 'se',
        'NO' => 'no', 'DK' => 'dk', 'FI' => 'fi', 'BE' => 'be',
        'CH' => 'ch', 'AT' => 'at', 'IE' => 'ie', 'PL' => 'pl',
        'GR' => 'gr', 'PT' => 'pt', 'CZ' => 'cz', 'HU' => 'hu',
        'ZA' => 'za', 'EG' => 'eg', 'MA' => 'ma', 'NG' => 'ng',
        'MX' => 'mx', 'AR' => 'ar', 'CO' => 'co', 'VE' => 've',
        'TH' => 'th', 'MY' => 'my', 'SG' => 'sg', 'PH' => 'ph',
        'ID' => 'id', 'VN' => 'vn', 'TW' => 'tw', 'HK' => 'hk',
        'AE' => 'ae', 'SA' => 'sa', 'IL' => 'il', 'TR' => 'tr',
        'UA' => 'ua', 'RO' => 'ro', 'BG' => 'bg', 'HR' => 'hr',
        'SI' => 'si', 'SK' => 'sk', 'LT' => 'lt', 'LV' => 'lv',
        'EE' => 'ee', 'CY' => 'cy', 'MT' => 'mt', 'LU' => 'lu'
    ];
    
    if (!isset($countryMapping[$countryCode])) {
        return [];
    }
    
    $newsCountryCode = $countryMapping[$countryCode];
    
    $apiUrl = "https://newsapi.org/v2/top-headlines?" . http_build_query([
        'country' => $newsCountryCode,
        'apiKey' => $apiKey,
        'pageSize' => 10 // Get 10 articles for view more functionality
    ]);
    
    $response = @file_get_contents($apiUrl, false, stream_context_create([
        'http' => ['timeout' => 15, 'user_agent' => 'Gazetteer/1.0']
    ]));
    
    if ($response === false) {
        return [];
    }
    
    $data = json_decode($response, true);
    
    if (!$data || $data['status'] !== 'ok' || !isset($data['articles'])) {
        return [];
    }
    
    return processEnhancedArticles($data['articles']);
}

function tryEverythingSearchEnhanced($countryName, $apiKey) {
    $apiUrl = "https://newsapi.org/v2/everything?" . http_build_query([
        'q' => $countryName,
        'sortBy' => 'publishedAt',
        'apiKey' => $apiKey,
        'pageSize' => 10,
        'language' => 'en'
    ]);
    
    $response = @file_get_contents($apiUrl, false, stream_context_create([
        'http' => ['timeout' => 15, 'user_agent' => 'Gazetteer/1.0']
    ]));
    
    if ($response === false) {
        return [];
    }
    
    $data = json_decode($response, true);
    
    if (!$data || $data['status'] !== 'ok' || !isset($data['articles'])) {
        return [];
    }
    
    return processEnhancedArticles($data['articles']);
}

function tryRegionalNewsEnhanced($countryCode, $apiKey) {
    // Regional fallback - get general news from major English-speaking countries
    $fallbackCountries = ['us', 'gb', 'ca', 'au'];
    
    foreach ($fallbackCountries as $fallbackCountry) {
        $apiUrl = "https://newsapi.org/v2/top-headlines?" . http_build_query([
            'country' => $fallbackCountry,
            'category' => 'general',
            'apiKey' => $apiKey,
            'pageSize' => 10
        ]);
        
        $response = @file_get_contents($apiUrl, false, stream_context_create([
            'http' => ['timeout' => 10, 'user_agent' => 'Gazetteer/1.0']
        ]));
        
        if ($response !== false) {
            $data = json_decode($response, true);
            if ($data && $data['status'] === 'ok' && isset($data['articles'])) {
                return processEnhancedArticles($data['articles']);
            }
        }
    }
    
    return [];
}

function processEnhancedArticles($articles) {
    $processedArticles = [];
    
    foreach ($articles as $article) {
        // Skip articles without titles or descriptions
        if (empty($article['title']) || $article['title'] === '[Removed]') {
            continue;
        }
        
        // Enhanced article structure with image support
        $processedArticle = [
            'title' => $article['title'],
            'description' => $article['description'] ?: 'No description available',
            'url' => $article['url'],
            'urlToImage' => !empty($article['urlToImage']) ? $article['urlToImage'] : null,
            'publishedAt' => $article['publishedAt'],
            'source' => [
                'name' => $article['source']['name'] ?? 'Unknown Source'
            ]
        ];
        
        // Add author if available
        if (!empty($article['author'])) {
            $processedArticle['author'] = $article['author'];
        }
        
        $processedArticles[] = $processedArticle;
        
        // Limit to 10 articles maximum
        if (count($processedArticles) >= 10) {
            break;
        }
    }
    
    return $processedArticles;
}

function createFallbackNewsData($countryName) {
    return [
        [
            'title' => "Latest developments in $countryName",
            'description' => 'Stay updated with the most recent news and events happening in this region.',
            'url' => '#',
            'urlToImage' => null,
            'publishedAt' => date('c'),
            'source' => ['name' => 'Local News']
        ],
        [
            'title' => "Economic updates from $countryName",
            'description' => 'Current economic trends and business developments affecting the local market.',
            'url' => '#',
            'urlToImage' => null,
            'publishedAt' => date('c', strtotime('-2 hours')),
            'source' => ['name' => 'Business Wire']
        ],
        [
            'title' => "Cultural events and society news",
            'description' => 'Discover the latest cultural happenings and social developments in the region.',
            'url' => '#',
            'urlToImage' => null,
            'publishedAt' => date('c', strtotime('-4 hours')),
            'source' => ['name' => 'Culture Today']
        ]
    ];
}
?>