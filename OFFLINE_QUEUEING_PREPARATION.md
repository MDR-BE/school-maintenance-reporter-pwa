# Offline Queueing Preparation

To prepare the architecture for future offline queueing as mentioned in the spec, I need to add the following mechanisms:

## Current State:
- The API layer uses `apiFetch` with caching but no offline detection or queuing
- No mechanism to detect online/offline status
- No storage for failed requests when offline

## Proposed Implementation:

### 1. Online/Offline Detection Utility
Add to `js/utils.js`:
```javascript
/**
 * Returns true if browser is online, false if offline
 * @return {boolean} Online status
 */
export function isOnline() {
  return navigator.onLine;
}

/**
 * Returns a Promise that resolves when online status changes
 * @param {Function} callback - Function to call when status changes
 * @return {Function} Unsubscribe function
 */
export function onOnlineChange(callback) {
  const handler = () => callback(navigator.onLine);
  window.addEventListener('online', handler);
  window.addEventListener('offline', handler);
  return () => {
    window.removeEventListener('online', handler);
    window.removeEventListener('offline', handler);
  };
}
```

### 2. Request Queuing Mechanism
Add to `js/utils.js` or create a new queue utility:
```javascript
/**
 * Simple request queue for offline storage
 */
class RequestQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
  }

  /**
   * Add a request to the queue
   * @param {Object} request - {url, options, timestamp}
   */
  async enqueue(request) {
    this.queue.push({
      ...request,
      timestamp: Date.now()
    });
    await this.persistQueue();
    if (!this.processing) {
      this.processQueue();
    }
  }

  /**
   * Process all queued requests
   */
  async processQueue() {
    if (this.processing || !navigator.onLine) return;
    
    this.processing = true;
    while (this.queue.length > 0 && navigator.onLine) {
      const request = this.queue.shift();
      try {
        // Attempt the request
        await timeoutFetch(request.url, request.options);
        await this.persistQueue(); // Update persisted queue
      } catch (error) {
        // If request fails, put it back at the end of the queue
        console.warn('Request failed, re-queuing:', error);
        this.queue.push(request);
        await this.persistQueue();
        break; // Stop processing if we're offline now
      }
    }
    this.processing = false;
    
    // Retry after a delay if there are still items
    if (this.queue.length > 0) {
      setTimeout(() => this.processQueue(), 30000); // 30 seconds
    }
  }

  /**
   * Persist queue to localStorage
   */
  async persistQueue() {
    try {
      localStorage.setItem('pwa_request_queue', JSON.stringify(this.queue));
    } catch (e) {
      console.warn('Failed to persist request queue:', e);
    }
  }

  /**
   * Load queue from localStorage
   */
  async loadQueue() {
    try {
      const saved = localStorage.getItem('pwa_request_queue');
      if (saved) {
        this.queue = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load request queue:', e);
      this.queue = [];
    }
  }
}

// Create singleton instance
export const requestQueue = new RequestQueue();
```

### 3. Enhanced API Layer with Offline Support
Modify `js/api.js` to:
1. Detect offline status before making requests
2. Queue requests when offline
3. Automatically process queue when online comes back

### 4. Integration Points:
- In `js/api.js`, modify `apiFetch` to check `isOnline()` and queue if offline
- Add event listeners for online/offline events to process queue
- Initialize queue loading on app startup

## Implementation Approach:
Since the spec says "Do not over-engineer offline functionality in version 1. However, prepare the architecture for future offline queueing", I'll implement the core utilities and hooks without modifying the existing API calls to maintain backward compatibility.

The implementation will:
1. Provide the online/offline detection utilities
2. Provide the request queue class
3. Export these so they can be used in the future
4. Add initialization code that sets up event listeners
5. Leave the actual queuing of API calls for future implementation

This prepares the architecture while keeping version 1 simple and functional online-only.