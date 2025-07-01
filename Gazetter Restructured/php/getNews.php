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
    
    // First, get country name from REST Countries API
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
    
    // NO FALLBACK DATA - return error response
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
        // News API Top Headlines endpoint
        $newsApiUrl = "https://newsapi.org/v2/top-headlines?" . http_build_query([
            'country' => strtolower($countryCode),
            'apiKey' => $apiKey,
            'pageSize' => 10, // Get up to 10 articles
            'sortBy' => 'publishedAt'
        ]);
        
        logError("Calling News API: " . $newsApiUrl);
        
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
        
        $response = file_get_contents($newsApiUrl, false, $context);
        
        if ($response === false) {
            throw new Exception('Failed to fetch news from News API');
        }
        
        $newsData = json_decode($response, true);
        
        if (!$newsData) {
            throw new Exception('Invalid response from News API');
        }
        
        // Check for API errors
        if (isset($newsData['status']) && $newsData['status'] !== 'ok') {
            $errorMessage = isset($newsData['message']) ? $newsData['message'] : 'Unknown News API error';
            throw new Exception('News API error: ' . $errorMessage);
        }
        
        // Check if articles exist
        if (!isset($newsData['articles']) || empty($newsData['articles'])) {
            logError("No articles found for country: " . $countryCode);
            return [];
        }
        
        $articles = [];
        
        foreach ($newsData['articles'] as $article) {
            // Skip articles with missing essential data
            if (empty($article['title']) || $article['title'] === '[Removed]') {
                continue;
            }
            
            $articles[] = [
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
        
        logError("Successfully processed " . count($articles) . " news articles");
        return $articles;
        
    } catch (Exception $e) {
        logError("News API error: " . $e->getMessage());
        
        // NO FALLBACK DATA - throw the exception
        throw $e;
    }
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