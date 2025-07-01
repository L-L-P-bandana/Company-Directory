<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

function logError($message) {
    error_log("getNews.php: " . $message);
}

try {
    if (!isset($_GET['country']) || empty($_GET['country'])) {
        throw new Exception('Country code is required');
    }
    
    $countryCode = strtoupper($_GET['country']);
    logError("Fetching news for country: " . $countryCode);
    
    // News API key
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
    
    logError("Country name: " . $countryName);
    
    // Fetch real news from News API
    $articles = fetchRealNews($countryCode, $countryName, $apiKey);
    
    $result = [
        'country' => $countryName,
        'articles' => $articles
    ];
    
    logError("News data prepared for: " . $countryName . " (" . count($articles) . " articles)");
    echo json_encode($result);
    
} catch (Exception $e) {
    logError("Error: " . $e->getMessage());
    
    http_response_code(500);
    echo json_encode([
        'error' => 'News API unavailable',
        'message' => $e->getMessage(),
        'country' => isset($countryName) ? $countryName : 'Unknown',
        'articles' => []
    ]);
}

function fetchRealNews($countryCode, $countryName, $apiKey) {
    try {
        // Strat 1: Try country-specific top headlines first
        $articles = tryTopHeadlines($countryCode, $apiKey);
        
        if (!empty($articles)) {
            logError("Success with top headlines for: " . $countryCode);
            return $articles;
        }
        
        logError("No top headlines found for " . $countryCode . ", trying everything endpoint with country name");
        
        // Strat 2: Try "everything" endpoint with country name search
        $articles = tryEverythingSearch($countryName, $apiKey);
        
        if (!empty($articles)) {
            logError("Success with everything search for: " . $countryName);
            return $articles;
        }
        
        logError("No articles found with everything search for: " . $countryName);
        
        // Strat 3: Try broader search terms
        $broadTerms = getBroadSearchTerms($countryName);
        foreach ($broadTerms as $term) {
            logError("Trying broad search term: " . $term);
            $articles = tryEverythingSearch($term, $apiKey);
            if (!empty($articles)) {
                logError("Success with broad term: " . $term);
                return array_slice($articles, 0, 5); // Limit to 5 for broad searches
            }
        }
        
        logError("All strategies failed for: " . $countryName);
        return [];
        
    } catch (Exception $e) {
        logError("News API error: " . $e->getMessage());
        throw $e;
    }
}

function tryTopHeadlines($countryCode, $apiKey) {
    $newsApiUrl = "https://newsapi.org/v2/top-headlines?" . http_build_query([
        'country' => strtolower($countryCode),
        'apiKey' => $apiKey,
        'pageSize' => 10,
        'sortBy' => 'publishedAt'
    ]);
    
    logError("Trying top headlines: " . $newsApiUrl);
    
    $response = makeNewsRequest($newsApiUrl);
    if ($response && isset($response['articles'])) {
        return processArticles($response['articles']);
    }
    
    return [];
}

function tryEverythingSearch($searchTerm, $apiKey) {
    $newsApiUrl = "https://newsapi.org/v2/everything?" . http_build_query([
        'q' => $searchTerm,
        'apiKey' => $apiKey,
        'pageSize' => 10,
        'sortBy' => 'publishedAt',
        'from' => date('Y-m-d', strtotime('-7 days')), // Last 7 days
        'language' => 'en'
    ]);
    
    logError("Trying everything search: " . $newsApiUrl);
    
    $response = makeNewsRequest($newsApiUrl);
    if ($response && isset($response['articles'])) {
        return processArticles($response['articles']);
    }
    
    return [];
}

function makeNewsRequest($url) {
    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 15,
            'header' => [
                'User-Agent: Gazetteer/1.0',
                'Accept: application/json'
            ]
        ]
    ]);
    
    $response = file_get_contents($url, false, $context);
    
    if ($response === false) {
        logError("Failed to fetch from: " . $url);
        return null;
    }
    
    $data = json_decode($response, true);
    
    if (!$data) {
        logError("Invalid JSON response from: " . $url);
        return null;
    }
    
    if (isset($data['status']) && $data['status'] !== 'ok') {
        $errorMessage = isset($data['message']) ? $data['message'] : 'Unknown News API error';
        logError("News API error from " . $url . ": " . $errorMessage);
        return null;
    }
    
    logError("Successful response from: " . $url . " with " . count($data['articles'] ?? []) . " articles");
    return $data;
}

function processArticles($articles) {
    $processedArticles = [];
    
    foreach ($articles as $article) {
        // Skip articles with missing essential data
        if (empty($article['title']) || $article['title'] === '[Removed]') {
            continue;
        }
        
        $processedArticles[] = [
            'title' => $article['title'] ?? 'No title available',
            'description' => !empty($article['description']) && $article['description'] !== '[Removed]' 
                ? $article['description'] 
                : 'Full article available at source',
            'source' => isset($article['source']['name']) ? $article['source']['name'] : 'Unknown source',
            'url' => !empty($article['url']) ? $article['url'] : '',
            'publishedAt' => isset($article['publishedAt']) ? formatPublishDate($article['publishedAt']) : '',
            'author' => !empty($article['author']) && $article['author'] !== '[Removed]' 
                ? $article['author'] 
                : null
        ];
    }
    
    return $processedArticles;
}

function getBroadSearchTerms($countryName) {
    // Generate broader search terms for countries that might not have direct news coverage
    $terms = [];
    
    // Add the country name itself
    $terms[] = $countryName;
    
    // Add major cities or regions for specific countries
    $cityMap = [
        'United Kingdom' => ['London', 'Brexit', 'UK'],
        'United States' => ['America', 'Washington', 'US'],
        'France' => ['Paris', 'French'],
        'Germany' => ['Berlin', 'German'],
        'Japan' => ['Tokyo', 'Japanese'],
        'China' => ['Beijing', 'Chinese'],
        'Russia' => ['Moscow', 'Russian'],
        'India' => ['Delhi', 'Mumbai', 'Indian'],
        'Brazil' => ['Brasilia', 'Sao Paulo', 'Brazilian'],
        'Australia' => ['Sydney', 'Melbourne', 'Australian'],
        'Canada' => ['Ottawa', 'Toronto', 'Canadian'],
        'Italy' => ['Rome', 'Milan', 'Italian'],
        'Spain' => ['Madrid', 'Barcelona', 'Spanish']
    ];
    
    if (isset($cityMap[$countryName])) {
        $terms = array_merge($terms, $cityMap[$countryName]);
    }
    
    return $terms;
}

function formatPublishDate($dateString) {
    try {
        $date = new DateTime($dateString);
        $now = new DateTime();
        $diff = $now->diff($date);
        
        if ($diff->days == 0) {
            if ($diff->h == 0) {
                return $diff->i . ' minutes ago';
            } else {
                return $diff->h . ' hours ago';
            }
        } elseif ($diff->days == 1) {
            return 'Yesterday';
        } elseif ($diff->days < 7) {
            return $diff->days . ' days ago';
        } else {
            return $date->format('M j, Y');
        }
    } catch (Exception $e) {
        return 'Recently';
    }
}
?>