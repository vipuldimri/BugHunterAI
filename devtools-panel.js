// DevTools panel script for Network Request Recorder
let isRecording = false;
let recordedRequests = [];
let selectedRequest = null;

// DOM elements
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const clearBtn = document.getElementById('clearBtn');
const exportBtn = document.getElementById('exportBtn');
const statusDiv = document.getElementById('status');
const statusText = document.getElementById('statusText');
const totalRequests = document.getElementById('totalRequests');
const completedRequests = document.getElementById('completedRequests');
const pendingRequests = document.getElementById('pendingRequests');
const requestsList = document.getElementById('requestsList');
const requestDetails = document.getElementById('requestDetails');

// Initialize panel
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    setupEventListeners();
    updateUI();
});

// Load current state from storage
function loadState() {
    chrome.storage.local.get(['isRecording', 'recordedRequests'], (result) => {
        isRecording = result.isRecording || false;
        recordedRequests = result.recordedRequests || [];
        updateUI();
    });
}

// Setup event listeners
function setupEventListeners() {
    startBtn.addEventListener('click', startRecording);
    stopBtn.addEventListener('click', stopRecording);
    clearBtn.addEventListener('click', clearRequests);
    exportBtn.addEventListener('click', exportRequests);
}

// Start recording
function startRecording() {
    chrome.runtime.sendMessage({ action: 'startRecording' }, (response) => {
        if (response && response.success) {
            isRecording = true;
            updateUI();
        }
    });
}

// Stop recording
function stopRecording() {
    chrome.runtime.sendMessage({ action: 'stopRecording' }, (response) => {
        if (response && response.success) {
            isRecording = false;
            updateUI();
        }
    });
}

// Clear all recorded requests
function clearRequests() {
    if (confirm('Are you sure you want to clear all recorded requests?')) {
        chrome.runtime.sendMessage({ action: 'clearRecordedRequests' }, (response) => {
            if (response && response.success) {
                recordedRequests = [];
                selectedRequest = null;
                updateUI();
            }
        });
    }
}

// Export requests as JSON
function exportRequests() {
  if (recordedRequests.length === 0) {
    alert('No requests to export');
    return;
  }
  
  try {
    const dataStr = JSON.stringify(recordedRequests, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const dataUrl = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `network-requests-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(dataUrl);
  } catch (error) {
    console.error('Export failed:', error);
    // Fallback to background script method
    chrome.runtime.sendMessage({ action: 'exportRequests' }, (response) => {
      if (response && response.success) {
        console.log('Export initiated via background script');
      }
    });
  }
}

// Update UI based on current state
function updateUI() {
    // Update recording status
    if (isRecording) {
        statusDiv.className = 'status recording';
        statusText.textContent = 'Recording...';
        startBtn.disabled = true;
        stopBtn.disabled = false;
    } else {
        statusDiv.className = 'status stopped';
        statusText.textContent = 'Not Recording';
        startBtn.disabled = false;
        stopBtn.disabled = true;
    }
    
    // Update statistics
    const total = recordedRequests.length;
    const completed = recordedRequests.filter(req => req.status === 'completed' || req.status === 'finished').length;
    const pending = total - completed;
    
    totalRequests.textContent = total;
    completedRequests.textContent = completed;
    pendingRequests.textContent = pending;
    
    // Update requests list
    updateRequestsList();
    
    // Update request details
    updateRequestDetails();
}

// Update the requests list display
function updateRequestsList() {
    if (recordedRequests.length === 0) {
        requestsList.innerHTML = '<div class="no-request">No requests recorded yet</div>';
        return;
    }
    
    const requestsHTML = recordedRequests
        .slice(-50) // Show last 50 requests
        .reverse() // Most recent first
        .map(request => createRequestHTML(request))
        .join('');
    
    requestsList.innerHTML = requestsHTML;
    
    // Add click listeners
    document.querySelectorAll('.request-item').forEach(item => {
        item.addEventListener('click', () => {
            const requestId = item.dataset.requestId;
            selectRequest(requestId);
        });
    });
}

// Create HTML for a single request
function createRequestHTML(request) {
    const methodClass = `method-${request.method.toLowerCase()}`;
    const statusClass = request.status === 'completed' || request.status === 'finished' ? 'completed' : 'pending';
    const statusText = request.status === 'completed' || request.status === 'finished' ? '✓ Completed' : '⏳ Pending';
    const selectedClass = selectedRequest && selectedRequest.id === request.id ? 'selected' : '';
    
    return `
        <div class="request-item ${selectedClass}" data-request-id="${request.id}">
            <div>
                <span class="request-method ${methodClass}">${request.method}</span>
                <span class="request-status ${statusClass}">${statusText}</span>
            </div>
            <div class="request-url">${truncateUrl(request.url)}</div>
        </div>
    `;
}

// Select a request to view details
function selectRequest(requestId) {
    selectedRequest = recordedRequests.find(req => req.id === requestId);
    updateUI();
}

// Update request details display
function updateRequestDetails() {
    if (!selectedRequest) {
        requestDetails.innerHTML = '<div class="no-request">Select a request to view details</div>';
        return;
    }
    
    const detailsHTML = `
        <div class="detail-section">
            <h3>Request Information</h3>
            <div class="detail-content">
URL: ${selectedRequest.url}
Method: ${selectedRequest.method}
Type: ${selectedRequest.type || 'Unknown'}
Status: ${selectedRequest.status || 'Unknown'}
Timestamp: ${selectedRequest.timestamp}
            </div>
        </div>
        
        <div class="detail-section">
            <h3>Request Headers</h3>
            <div class="detail-content">${formatHeaders(selectedRequest.headers)}</div>
        </div>
        
        ${selectedRequest.postData ? `
        <div class="detail-section">
            <h3>Request Body</h3>
            <div class="detail-content">${formatBody(selectedRequest.postData)}</div>
        </div>
        ` : ''}
        
        ${selectedRequest.response ? `
        <div class="detail-section">
            <h3>Response Information</h3>
            <div class="detail-content">
Status: ${selectedRequest.response.status} ${selectedRequest.response.statusText}
MIME Type: ${selectedRequest.response.mimeType || 'Unknown'}
URL: ${selectedRequest.response.url}
            </div>
        </div>
        
        <div class="detail-section">
            <h3>Response Headers</h3>
            <div class="detail-content">${formatHeaders(selectedRequest.response.headers)}</div>
        </div>
        ` : ''}
        
        ${selectedRequest.responseBody ? `
        <div class="detail-section">
            <h3>Response Body</h3>
            <div class="detail-content">${formatBody(selectedRequest.responseBody)}</div>
        </div>
        ` : ''}
    `;
    
    requestDetails.innerHTML = detailsHTML;
}

// Format headers for display
function formatHeaders(headers) {
    if (!headers || Object.keys(headers).length === 0) {
        return 'No headers';
    }
    
    return Object.entries(headers)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
}

// Format body for display
function formatBody(body) {
  if (!body || body === 'undefined' || body === 'null' || body === '') {
    return 'No body';
  }
  
  // Clean up undefined values
  let cleanBody = body;
  if (typeof cleanBody === 'string') {
    cleanBody = cleanBody.replace(/undefined/g, '');
    cleanBody = cleanBody.replace(/null/g, '');
  }
  
  if (!cleanBody || cleanBody.trim() === '') {
    return 'No body';
  }
  
  try {
    // Try to parse as JSON for pretty formatting
    const parsed = JSON.parse(cleanBody);
    return JSON.stringify(parsed, null, 2);
  } catch {
    // If not JSON, return as is
    return cleanBody;
  }
}

// Truncate URL for display
function truncateUrl(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname + urlObj.pathname.substring(0, 40) + (urlObj.pathname.length > 40 ? '...' : '');
    } catch {
        return url.substring(0, 50) + (url.length > 50 ? '...' : '');
    }
}

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
        if (changes.isRecording) {
            isRecording = changes.isRecording.newValue;
        }
        if (changes.recordedRequests) {
            recordedRequests = changes.recordedRequests.newValue || [];
        }
        updateUI();
    }
});

// Refresh data periodically
setInterval(() => {
    loadState();
}, 1000); 