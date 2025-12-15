// Service Worker for Field Inspector App
// Handles offline caching and background sync

const CACHE_NAME = 'field-inspector-v1';
const RUNTIME_CACHE = 'runtime-cache-v1';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/field-inspector',
  '/manifest.json',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // API requests - network first
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Clone response and cache it
          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Fallback to cache if offline
          return caches.match(event.request);
        })
    );
    return;
  }

  // Static assets - cache first
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((response) => {
        // Clone and cache successful responses
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      });
    })
  );
});

// Background sync event
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-readings') {
    event.waitUntil(syncPendingReadings());
  }
});

// Sync pending readings from IndexedDB
async function syncPendingReadings() {
  try {
    // Get pending readings from IndexedDB
    const db = await openDB();
    const readings = await getAllPendingReadings(db);

    if (readings.length === 0) {
      return;
    }

    // Send each reading to server
    for (const reading of readings) {
      try {
        const response = await fetch('/api/trpc/tmlReadings.create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inspectionId: reading.inspectionId,
            cmlNumber: reading.cmlNumber,
            componentType: 'Field Reading',
            location: reading.location,
            currentThickness: reading.thickness,
          }),
        });

        if (response.ok) {
          // Mark as synced in IndexedDB
          await markReadingAsSynced(db, reading.id);
        }
      } catch (error) {
        console.error('Failed to sync reading:', reading.id, error);
      }
    }
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// IndexedDB helpers
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('FieldInspectorDB', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('readings')) {
        db.createObjectStore('readings', { keyPath: 'id' });
      }
    };
  });
}

function getAllPendingReadings(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['readings'], 'readonly');
    const store = transaction.objectStore('readings');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const readings = request.result.filter(r => !r.synced);
      resolve(readings);
    };
  });
}

function markReadingAsSynced(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['readings'], 'readwrite');
    const store = transaction.objectStore('readings');
    const request = store.get(id);

    request.onsuccess = () => {
      const reading = request.result;
      if (reading) {
        reading.synced = true;
        store.put(reading);
      }
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// Message event - handle commands from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
