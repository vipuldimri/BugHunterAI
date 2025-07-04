// Popup script for Network Request Recorder
let isRecording = false;
let recordedRequests = [];
let consoleLogs = [];
let screenRecording = false;

// DOM elements
const startSessionBtn = document.getElementById('startSessionBtn');
const stopSessionBtn = document.getElementById('stopSessionBtn');
const clearBtn = document.getElementById('clearBtn');
const exportNetworkBtn = document.getElementById('exportNetworkBtn');
const exportConsoleBtn = document.getElementById('exportConsoleBtn');
const exportVideoBtn = document.getElementById('exportVideoBtn');
const statusDiv = document.getElementById('status');
const statusText = document.getElementById('statusText');
const totalRequests = document.getElementById('totalRequests');
const completedRequests = document.getElementById('completedRequests');
const pendingRequests = document.getElementById('pendingRequests');
const totalLogs = document.getElementById('totalLogs');
const requestsList = document.getElementById('requestsList');
const logsList = document.getElementById('logsList');
const openLastSessionBtn = document.getElementById('openLastSessionBtn');

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    setupEventListeners();
    updateUI();
});

// Load current state from storage
function loadState() {
  chrome.storage.local.get(['isRecording', 'recordedRequests', 'consoleLogs', 'currentSessionTabId', 'sessionStartTime'], (result) => {
    isRecording = result.isRecording || false;
    recordedRequests = result.recordedRequests || [];
    consoleLogs = result.consoleLogs || [];
    
    // Get screen recording status and session status
    chrome.runtime.sendMessage({ action: 'getScreenRecordingStatus' }, (response) => {
      if (response) {
        screenRecording = response.isRecording;
      }
      
      // Get session status
      chrome.runtime.sendMessage({ action: 'getSessionStatus' }, (sessionResponse) => {
        if (sessionResponse) {
          // Update UI with session information
          updateSessionInfo(sessionResponse);
        }
        updateUI();
      });
    });
  });
}

// Setup event listeners
function setupEventListeners() {
  startSessionBtn.addEventListener('click', startRecordingSession);
  stopSessionBtn.addEventListener('click', stopRecordingSession);
  clearBtn.addEventListener('click', clearRequests);
  exportNetworkBtn.addEventListener('click', exportNetworkRequests);
  exportConsoleBtn.addEventListener('click', exportConsoleLogs);
  exportVideoBtn.addEventListener('click', exportScreenRecording);
  openLastSessionBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('preview.html') });
  });
  
  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      switchTab(tabName);
    });
  });
}

// Start unified recording session
function startRecordingSession() {
  // Check if there's already an active session
  if (isRecording || screenRecording) {
    alert('Cannot start new session: An active recording session already exists. Please stop the current session first.');
    return;
  }
  
  chrome.runtime.sendMessage({ action: 'startRecordingSession' }, (response) => {
    if (chrome.runtime.lastError) {
      // Handle runtime error
      alert(`Failed to start recording session: ${chrome.runtime.lastError.message}`);
      return;
    }
    
    if (response && response.success) {
      isRecording = true;
      screenRecording = true;
      updateUI();
    } else {
      // Handle error response
      alert('Failed to start recording session. Please try again.');
    }
  });
}

// Stop unified recording session
function stopRecordingSession() {
  chrome.runtime.sendMessage({ action: 'stopRecordingSession' }, (response) => {
    if (response && response.success) {
      isRecording = false;
      screenRecording = false;
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
                updateUI();
            }
        });
    }
}

// Export network requests
function exportNetworkRequests() {
  if (recordedRequests.length === 0) {
    alert('No network requests to export');
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
    console.error('Network export failed:', error);
    // Fallback to background script method
    chrome.runtime.sendMessage({ action: 'exportRequests' }, (response) => {
      if (response && response.success) {
        console.log('Network export initiated via background script');
      }
    });
  }
}

// Export console logs
function exportConsoleLogs() {
  if (consoleLogs.length === 0) {
    alert('No console logs to export');
    return;
  }
  
  try {
    const dataStr = JSON.stringify(consoleLogs, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const dataUrl = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `console-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(dataUrl);
  } catch (error) {
    console.error('Console export failed:', error);
    // Fallback to background script method
    chrome.runtime.sendMessage({ action: 'exportConsoleLogs' }, (response) => {
      if (response && response.success) {
        console.log('Console export initiated via background script');
      }
    });
  }
}

// Export screen recording
function exportScreenRecording() {
  chrome.runtime.sendMessage({ action: 'exportScreenRecording' }, (response) => {
    if (chrome.runtime.lastError) {
      alert('Screen recording export failed: ' + chrome.runtime.lastError.message);
      return;
    }
    
    if (response && response.success) {
      console.log('Screen recording export initiated');
    } else {
      alert('No screen recording available to export. Screen recording may not be available or may have been denied permission.');
    }
  });
}

// Listen for screen recording not available message
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'screenRecordingNotAvailable') {
    // Show a more user-friendly message
    const message = request.message || 'Screen recording is not available. Network and console recording are still active.';
    console.log('Screen recording message:', message);
    
    // Update UI to show the message instead of using alert
    const statusText = document.getElementById('statusText');
    if (statusText && message.includes('not available')) {
      statusText.textContent = 'Recording (Network & Console) - Screen recording not available';
    }
  }
});

// Update session information
function updateSessionInfo(sessionData) {
  if (sessionData.hasActiveSession) {
    const sessionInfo = document.getElementById('sessionInfo');
    if (sessionInfo) {
      const startTime = sessionData.sessionStartTime ? new Date(sessionData.sessionStartTime).toLocaleString() : 'Unknown';
      sessionInfo.innerHTML = `
        <div class="session-details">
          <strong>Active Session:</strong><br>
          Tab ID: ${sessionData.currentSessionTabId || 'Unknown'}<br>
          Started: ${startTime}<br>
          <small>Recording: Network ${sessionData.isRecording ? '✓' : '✗'}, Screen ${sessionData.screenRecording ? '✓' : '✗'}</small>
        </div>
      `;
      sessionInfo.style.display = 'block';
    }
  } else {
    const sessionInfo = document.getElementById('sessionInfo');
    if (sessionInfo) {
      sessionInfo.style.display = 'none';
    }
  }
  
  // Update the global screenRecording variable
  if (sessionData.screenRecording !== undefined) {
    screenRecording = sessionData.screenRecording;
  }
}

// Update UI based on current state
function updateUI() {
  // Update recording session status
  if (isRecording || screenRecording) {
    statusDiv.className = 'status recording';
    statusText.textContent = 'Recording Session Active...';
    startSessionBtn.disabled = true;
    stopSessionBtn.disabled = false;
    
    // Show warning about active session
    const warningDiv = document.getElementById('sessionWarning');
    const warningText = document.getElementById('warningText');
    if (warningDiv && warningText) {
      warningText.textContent = '⚠️ Active session detected. Stop current session before starting a new one.';
      warningDiv.style.display = 'block';
    }
  } else {
    statusDiv.className = 'status stopped';
    statusText.textContent = 'Not Recording';
    startSessionBtn.disabled = false;
    stopSessionBtn.disabled = true;
    
    // Hide warning
    const warningDiv = document.getElementById('sessionWarning');
    if (warningDiv) {
      warningDiv.style.display = 'none';
    }
  }
  
  // Update statistics
  const total = recordedRequests.length;
  const completed = recordedRequests.filter(req => req.status === 'completed' || req.status === 'finished').length;
  const pending = total - completed;
  const logs = consoleLogs.length;
  
  totalRequests.textContent = total;
  completedRequests.textContent = completed;
  pendingRequests.textContent = pending;
  totalLogs.textContent = logs;
  
  // Update lists
  updateRequestsList();
  updateLogsList();
}

// Update the requests list display
function updateRequestsList() {
    if (recordedRequests.length === 0) {
        requestsList.innerHTML = '<div class="no-requests">No requests recorded yet</div>';
        return;
    }
    
    const requestsHTML = recordedRequests
        .slice(-10) // Show last 10 requests
        .reverse() // Most recent first
        .map(request => createRequestHTML(request))
        .join('');
    
    requestsList.innerHTML = requestsHTML;
}

// Create HTML for a single request
function createRequestHTML(request) {
    const methodClass = `method-${request.method.toLowerCase()}`;
    const statusClass = request.status === 'completed' || request.status === 'finished' ? 'completed' : 'pending';
    const statusText = request.status === 'completed' || request.status === 'finished' ? '✓ Completed' : '⏳ Pending';
    
    return `
        <div class="request-item" data-request-id="${request.id}">
            <div>
                <span class="request-method ${methodClass}">${request.method}</span>
                <span class="request-status ${statusClass}">${statusText}</span>
            </div>
            <div class="request-url">${truncateUrl(request.url)}</div>
        </div>
    `;
}

// Switch between tabs
function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  
  // Update tab content
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.remove('active');
  });
  document.getElementById(`${tabName}Tab`).classList.add('active');
}

// Update the logs list display
function updateLogsList() {
  if (consoleLogs.length === 0) {
    logsList.innerHTML = '<div class="no-logs">No console logs recorded yet</div>';
    return;
  }
  
  const logsHTML = consoleLogs
    .slice(-20) // Show last 20 logs
    .reverse() // Most recent first
    .map(log => createLogHTML(log))
    .join('');
  
  logsList.innerHTML = logsHTML;
}

// Create HTML for a single log
function createLogHTML(log) {
  const levelClass = `level-${log.level}`;
  const levelText = log.level.toUpperCase();
  
  return `
    <div class="log-item" data-log-id="${log.id}">
      <div>
        <span class="log-level ${levelClass}">${levelText}</span>
      </div>
      <div class="log-message">${log.message}</div>
      <div class="log-timestamp">${new Date(log.timestamp).toLocaleTimeString()}</div>
    </div>
  `;
}

// Truncate URL for display
function truncateUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname + urlObj.pathname.substring(0, 50) + (urlObj.pathname.length > 50 ? '...' : '');
  } catch {
    return url.substring(0, 60) + (url.length > 60 ? '...' : '');
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
    if (changes.consoleLogs) {
      consoleLogs = changes.consoleLogs.newValue || [];
    }
    updateUI();
  }
});

// Refresh data periodically
setInterval(() => {
    loadState();
}, 1000); 