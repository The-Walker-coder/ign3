// Service Worker for Ignasia Website
// Provides offline support and caching

const CACHE_NAME = 'ignasia-v1.0.0';
const STATIC_CACHE_NAME = 'ignasia-static-v1.0.0';
const DYNAMIC_CACHE_NAME = 'ignasia-dynamic-v1.0.0';

// Files to cache immediately
const STATIC_FILES = [
    '/',
    '/css/style.css',
    '/js/error-handler.js',
    '/favicon.png',
    '/New Logo Color.png',
    '/about/',
    '/services/',
    '/team/',
    '/contact/',
    '/social-impact/',
    '/blog/',
    // Add other critical static assets
];

// Files that should be cached dynamically
const DYNAMIC_CACHE_PATTERNS = [
    /\/blog\/.+/,
    /\/team\/.+/,
    /\/images\/.+/,
];

// Files that should never be cached
const NEVER_CACHE_PATTERNS = [
    /\/admin/,
    /\/api/,
    /\.netlify/,
];

// Maximum number of items in dynamic cache
const MAX_DYNAMIC_CACHE_SIZE = 50;

// Install event - cache static files
self.addEventListener('install', function(event) {
    console.log('Service Worker: Installing...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME)
            .then(function(cache) {
                console.log('Service Worker: Caching static files');
                return cache.addAll(STATIC_FILES);
            })
            .then(function() {
                console.log('Service Worker: Static files cached successfully');
                return self.skipWaiting();
            })
            .catch(function(error) {
                console.error('Service Worker: Failed to cache static files', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', function(event) {
    console.log('Service Worker: Activating...');
    
    event.waitUntil(
        caches.keys()
            .then(function(cacheNames) {
                return Promise.all(
                    cacheNames.map(function(cacheName) {
                        if (cacheName !== STATIC_CACHE_NAME && 
                            cacheName !== DYNAMIC_CACHE_NAME) {
                            console.log('Service Worker: Deleting old cache', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(function() {
                console.log('Service Worker: Activated successfully');
                return self.clients.claim();
            })
    );
});

// Fetch event - serve cached files or fetch from network
self.addEventListener('fetch', function(event) {
    const request = event.request;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip admin and API requests
    if (shouldNeverCache(url.pathname)) {
        return;
    }
    
    // Handle different types of requests
    if (isStaticFile(url.pathname)) {
        event.respondWith(handleStaticFile(request));
    } else if (isDynamicFile(url.pathname)) {
        event.respondWith(handleDynamicFile(request));
    } else {
        event.respondWith(handleGenericRequest(request));
    }
});

// Check if file should never be cached
function shouldNeverCache(pathname) {
    return NEVER_CACHE_PATTERNS.some(pattern => pattern.test(pathname));
}

// Check if file is a static file
function isStaticFile(pathname) {
    return STATIC_FILES.includes(pathname) || 
           pathname.endsWith('.css') || 
           pathname.endsWith('.js') || 
           pathname.endsWith('.png') || 
           pathname.endsWith('.jpg') || 
           pathname.endsWith('.jpeg') || 
           pathname.endsWith('.gif') || 
           pathname.endsWith('.svg') ||
           pathname.endsWith('.ico');
}

// Check if file should be cached dynamically
function isDynamicFile(pathname) {
    return DYNAMIC_CACHE_PATTERNS.some(pattern => pattern.test(pathname));
}

// Handle static file requests (cache first strategy)
function handleStaticFile(request) {
    return caches.match(request)
        .then(function(cachedResponse) {
            if (cachedResponse) {
                return cachedResponse;
            }
            
            return fetch(request)
                .then(function(networkResponse) {
                    // Cache the response for future use
                    if (networkResponse.status === 200) {
                        const responseClone = networkResponse.clone();
                        caches.open(STATIC_CACHE_NAME)
                            .then(function(cache) {
                                cache.put(request, responseClone);
                            });
                    }
                    return networkResponse;
                })
                .catch(function(error) {
                    console.error('Service Worker: Failed to fetch static file', request.url, error);
                    return createOfflineResponse(request);
                });
        });
}

// Handle dynamic file requests (network first strategy)
function handleDynamicFile(request) {
    return fetch(request)
        .then(function(networkResponse) {
            if (networkResponse.status === 200) {
                const responseClone = networkResponse.clone();
                caches.open(DYNAMIC_CACHE_NAME)
                    .then(function(cache) {
                        cache.put(request, responseClone);
                        limitCacheSize(DYNAMIC_CACHE_NAME, MAX_DYNAMIC_CACHE_SIZE);
                    });
            }
            return networkResponse;
        })
        .catch(function(error) {
            console.log('Service Worker: Network failed, trying cache for', request.url);
            return caches.match(request)
                .then(function(cachedResponse) {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    return createOfflineResponse(request);
                });
        });
}

// Handle generic requests (network first with cache fallback)
function handleGenericRequest(request) {
    return fetch(request)
        .then(function(networkResponse) {
            if (networkResponse.status === 200) {
                const responseClone = networkResponse.clone();
                caches.open(DYNAMIC_CACHE_NAME)
                    .then(function(cache) {
                        cache.put(request, responseClone);
                        limitCacheSize(DYNAMIC_CACHE_NAME, MAX_DYNAMIC_CACHE_SIZE);
                    });
            }
            return networkResponse;
        })
        .catch(function(error) {
            return caches.match(request)
                .then(function(cachedResponse) {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    return createOfflineResponse(request);
                });
        });
}

// Limit cache size by removing oldest entries
function limitCacheSize(cacheName, maxSize) {
    caches.open(cacheName)
        .then(function(cache) {
            return cache.keys();
        })
        .then(function(keys) {
            if (keys.length > maxSize) {
                const keysToDelete = keys.slice(0, keys.length - maxSize);
                return Promise.all(
                    keysToDelete.map(function(key) {
                        return caches.open(cacheName).then(function(cache) {
                            return cache.delete(key);
                        });
                    })
                );
            }
        });
}

// Create offline response for failed requests
function createOfflineResponse(request) {
    const url = new URL(request.url);
    
    // For HTML pages, return a generic offline page
    if (request.headers.get('accept').includes('text/html')) {
        return new Response(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Offline - Ignasia Consulting</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        min-height: 100vh;
                        margin: 0;
                        background-color: #f8f9fa;
                        color: #333;
                    }
                    .offline-container {
                        text-align: center;
                        max-width: 500px;
                        padding: 2rem;
                        background: white;
                        border-radius: 10px;
                        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
                    }
                    .offline-icon {
                        font-size: 4rem;
                        margin-bottom: 1rem;
                    }
                    h1 {
                        color: #0066cc;
                        margin-bottom: 1rem;
                    }
                    p {
                        margin-bottom: 1rem;
                        line-height: 1.6;
                    }
                    .retry-button {
                        background-color: #0066cc;
                        color: white;
                        border: none;
                        padding: 0.75rem 1.5rem;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 1rem;
                        margin-top: 1rem;
                    }
                    .retry-button:hover {
                        background-color: #004499;
                    }
                </style>
            </head>
            <body>
                <div class="offline-container">
                    <div class="offline-icon">📡</div>
                    <h1>You're Offline</h1>
                    <p>It looks like you're not connected to the internet. Some content may not be available.</p>
                    <p>Please check your connection and try again.</p>
                    <button class="retry-button" onclick="window.location.reload()">
                        Try Again
                    </button>
                </div>
            </body>
            </html>
        `, {
            status: 200,
            statusText: 'OK',
            headers: {
                'Content-Type': 'text/html'
            }
        });
    }
    
    // For other resources, return a simple error response
    return new Response('Offline', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: {
            'Content-Type': 'text/plain'
        }
    });
}

// Handle background sync (if supported)
self.addEventListener('sync', function(event) {
    console.log('Service Worker: Background sync triggered', event.tag);
    
    if (event.tag === 'background-sync') {
        event.waitUntil(doBackgroundSync());
    }
});

// Background sync function
function doBackgroundSync() {
    // Implement background sync logic here
    // For example, sync form submissions that failed while offline
    return Promise.resolve();
}

// Handle push notifications (if needed in the future)
self.addEventListener('push', function(event) {
    console.log('Service Worker: Push notification received');
    
    const options = {
        body: event.data ? event.data.text() : 'New update available',
        icon: '/favicon.png',
        badge: '/favicon.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        }
    };
    
    event.waitUntil(
        self.registration.showNotification('Ignasia Consulting', options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', function(event) {
    console.log('Service Worker: Notification clicked');
    
    event.notification.close();
    
    event.waitUntil(
        clients.openWindow('/')
    );
});

// Log service worker events for debugging
self.addEventListener('message', function(event) {
    console.log('Service Worker: Message received', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

console.log('Service Worker: Script loaded');