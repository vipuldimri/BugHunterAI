// Content script for Network Request Recorder
// This script runs in the context of web pages

console.log('Network Request Recorder content script loaded at:', new Date().toISOString());
console.log('Page URL:', window.location.href);
console.log('Document ready state:', document.readyState);

let isActiveSession = false;
let mediaRecorder = null;
let recordedChunks = [];
let isScreenRecording = false;
let screenStream = null;

// Initialize content script
async function initializeContentScript() {
  try {
    // Check session status on load
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getSessionStatus' }, resolve);
    });
    
    if (response && response.hasActiveSession) {
      isActiveSession = true;
    }
    
    console.log('Content script initialized successfully');
  } catch (error) {
    console.error('Failed to initialize content script:', error);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeContentScript);
} else {
  initializeContentScript();
}

// Console log capturing
let consoleLogs = [];

// Override console methods to capture logs
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;

function captureConsoleLog(level, args) {
  const logEntry = {
    id: `console-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    level: level,
    message: args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' '),
    timestamp: new Date().toISOString(),
    url: window.location.href,
    stack: new Error().stack
  };
  
  consoleLogs.push(logEntry);
  
  // Only send to background script if there's an active session
  if (isActiveSession) {
    chrome.runtime.sendMessage({
      action: 'recordConsoleLog',
      data: logEntry
    });
  }
}

// Override console methods
console.log = function(...args) {
  captureConsoleLog('log', args);
  originalConsoleLog.apply(console, args);
};

console.error = function(...args) {
  captureConsoleLog('error', args);
  originalConsoleError.apply(console, args);
};

console.warn = function(...args) {
  captureConsoleLog('warn', args);
  originalConsoleWarn.apply(console, args);
};

console.info = function(...args) {
  captureConsoleLog('info', args);
  originalConsoleInfo.apply(console, args);
};

// Intercept fetch requests
const originalFetch = window.fetch;
window.fetch = function(...args) {
    const requestInfo = args[0];
    const requestInit = args[1] || {};
    
    // Create request object for recording
    const requestData = {
        type: 'fetch',
        url: typeof requestInfo === 'string' ? requestInfo : requestInfo.url,
        method: requestInit.method || 'GET',
        headers: requestInit.headers || {},
        body: requestInit.body || null,
        timestamp: new Date().toISOString()
    };
    
    // Only send to background script if there's an active session
    if (isActiveSession) {
      chrome.runtime.sendMessage({
          action: 'recordRequest',
          data: requestData
      });
    }
    
    // Call original fetch
    return originalFetch.apply(this, args).then(response => {
        // Clone response to read body
        const responseClone = response.clone();
        
                // Record response data
        responseClone.text().then(responseText => {
          const responseData = {
            type: 'fetch-response',
            url: requestData.url,
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            body: responseText || '',
            timestamp: new Date().toISOString()
          };
          
          if (isActiveSession) {
            chrome.runtime.sendMessage({
              action: 'recordResponse',
              data: responseData
            });
          }
        }).catch(error => {
          console.error('Error reading response body:', error);
          // Send response without body if we can't read it
          const responseData = {
            type: 'fetch-response',
            url: requestData.url,
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            body: '',
            timestamp: new Date().toISOString()
          };
          
          if (isActiveSession) {
            chrome.runtime.sendMessage({
              action: 'recordResponse',
              data: responseData
            });
          }
        });
        
        return response;
    });
};

// Intercept XMLHttpRequest
const originalXHROpen = XMLHttpRequest.prototype.open;
const originalXHRSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function(method, url, ...args) {
    this._xhrMethod = method;
    this._xhrUrl = url;
    return originalXHROpen.apply(this, [method, url, ...args]);
};

XMLHttpRequest.prototype.send = function(data) {
    const requestData = {
        type: 'xhr',
        url: this._xhrUrl,
        method: this._xhrMethod,
        headers: {},
        body: data,
        timestamp: new Date().toISOString()
    };
    
    // Get headers if available
    if (this.getAllResponseHeaders) {
        try {
            const headerString = this.getAllResponseHeaders();
            const headers = {};
            headerString.split('\r\n').forEach(line => {
                const [key, value] = line.split(': ');
                if (key && value) {
                    headers[key] = value;
                }
            });
            requestData.headers = headers;
        } catch (error) {
            console.error('Error getting XHR headers:', error);
        }
    }
    
    // Only send to background script if there's an active session
    if (isActiveSession) {
      chrome.runtime.sendMessage({
          action: 'recordRequest',
          data: requestData
      });
    }
    
        // Listen for response
    this.addEventListener('load', function() {
      const responseData = {
        type: 'xhr-response',
        url: this._xhrUrl,
        status: this.status,
        statusText: this.statusText,
        headers: {},
        body: this.responseText || '',
        timestamp: new Date().toISOString()
      };
        
      // Get response headers
      try {
          const headerString = this.getAllResponseHeaders();
          const headers = {};
          headerString.split('\r\n').forEach(line => {
              const [key, value] = line.split(': ');
              if (key && value) {
                  headers[key] = value;
              }
          });
          responseData.headers = headers;
      } catch (error) {
          console.error('Error getting XHR response headers:', error);
      }
      
      if (isActiveSession) {
        chrome.runtime.sendMessage({
            action: 'recordResponse',
            data: responseData
        });
      }
    });
    
    return originalXHRSend.apply(this, arguments);
};

// Note: Removed static resource monitoring to focus only on Fetch/XHR requests
// The extension now only captures dynamic API calls and AJAX requests

// Note: Removed page load recording to focus only on Fetch/XHR requests
// The extension now only captures dynamic API calls and AJAX requests

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'ping') {
        // Respond to ping to confirm content script is ready
        sendResponse({ success: true, message: 'Content script is ready' });
    } else if (request.action === 'getPageInfo') {
        sendResponse({
            url: window.location.href,
            title: document.title,
            userAgent: navigator.userAgent
        });
    } else if (request.action === 'getScreenRecordingBlob') {
        // Return the current video as a blob URL (if available)
        if (recordedChunks && recordedChunks.length > 0) {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            const blobUrl = URL.createObjectURL(blob);
            sendResponse({ blobUrl });
        } else {
            sendResponse({ blobUrl: null });
        }
    } else if (request.action === 'startScreenRecording') {
        // Handle screen recording start
        isActiveSession = true;
        startScreenRecording().then(success => {
            sendResponse({ success: success });
        });
        return true; // Keep message channel open for async response
    } else if (request.action === 'stopScreenRecording') {
        // Handle screen recording stop
        stopScreenRecording().then(success => {
            sendResponse({ success: success });
        });
        return true;
    } else if (request.action === 'exportScreenRecording') {
        // Handle screen recording export
        exportScreenRecording().then(success => {
            sendResponse({ success: success });
        });
        return true;
    }
});

// Start screen recording
async function startScreenRecording() {
    if (isScreenRecording) {
        console.log('Screen recording already active');
        return true;
    }
    
    try {
        // Check if MediaRecorder is available
        if (typeof MediaRecorder === 'undefined') {
            console.error('MediaRecorder not available');
            return false;
        }
        
        // Check if getDisplayMedia is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            console.error('getDisplayMedia not available');
            return false;
        }
        
        console.log('Requesting screen capture...');
        
        // Request screen capture
        screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                mediaSource: 'screen'
            }
        });
        
        console.log('Screen capture stream obtained');
        
        // Create MediaRecorder with fallback options
        let mimeType = 'video/webm;codecs=vp9';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'video/webm;codecs=vp8';
        }
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'video/webm';
        }
        
        mediaRecorder = new MediaRecorder(screenStream, {
            mimeType: mimeType
        });
        
        recordedChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
                console.log('Screen recording chunk received:', event.data.size, 'bytes');
            }
        };
        
        mediaRecorder.onstop = () => {
            console.log('Screen recording stopped, auto-exporting...');
            // Auto-export when recording stops
            exportScreenRecording();
        };
        
        mediaRecorder.onerror = (event) => {
            console.error('MediaRecorder error:', event.error);
        };
        
        // Start recording
        mediaRecorder.start(1000); // Capture in 1-second chunks
        isScreenRecording = true;
        
        console.log('Screen recording started from content script');
        return true;
    } catch (error) {
        console.error('Failed to start screen recording:', error);
        return false;
    }
}

// Stop screen recording
async function stopScreenRecording() {
    if (!isScreenRecording || !mediaRecorder) return false;
    
    try {
        mediaRecorder.stop();
        isScreenRecording = false;
        // Stop all tracks of the screen stream
        if (screenStream) {
            screenStream.getTracks().forEach(track => track.stop());
            screenStream = null;
        }
        console.log('Screen recording stopped from content script');
        return true;
    } catch (error) {
        console.error('Failed to stop screen recording:', error);
        return false;
    }
}

// Export screen recording
async function exportScreenRecording() {
    try {
        if (recordedChunks.length === 0) {
            console.log('No screen recording to export');
            return false;
        }
        
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        
        // Create download link
        const link = document.createElement('a');
        link.href = url;
        link.download = `screen-recording-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up
        URL.revokeObjectURL(url);
        recordedChunks = [];
        
        console.log('Screen recording exported successfully');
        return true;
    } catch (error) {
        console.error('Screen recording export failed:', error);
        return false;
    }
} 