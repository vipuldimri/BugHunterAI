import { saveLatestSession } from './db.js';

// Background service worker for network request recording
let isRecording = false;
let recordedRequests = [];
let consoleLogs = [];
let debuggerAttached = false;
let screenRecording = false;
let currentSessionTabId = null; // Track which tab the current session is for
let sessionStartTime = null; // Track when the session started

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('Network Request Recorder extension installed');
  chrome.storage.local.set({ 
    isRecording: false, 
    recordedRequests: [], 
    consoleLogs: [],
    currentSessionTabId: null,
    sessionStartTime: null
  });
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'startRecording':
      startRecording();
      sendResponse({ success: true });
      break;
    case 'stopRecording':
      stopRecording();
      sendResponse({ success: true });
      break;
    case 'getRecordedRequests':
      sendResponse({ requests: recordedRequests });
      break;
    case 'clearRecordedRequests':
      recordedRequests = [];
      chrome.storage.local.set({ recordedRequests: [] });
      sendResponse({ success: true });
      break;
    case 'exportRequests':
      exportRequests();
      sendResponse({ success: true });
      break;
    case 'recordRequest':
      // Only record requests from the current session tab
      if (sender.tab && sender.tab.id === currentSessionTabId) {
        handleContentScriptRequest(request.data);
      }
      sendResponse({ success: true });
      break;
    case 'recordResponse':
      // Only record responses from the current session tab
      if (sender.tab && sender.tab.id === currentSessionTabId) {
        handleContentScriptResponse(request.data);
      }
      sendResponse({ success: true });
      break;
    case 'recordConsoleLog':
      // Only record console logs from the current session tab
      if (sender.tab && sender.tab.id === currentSessionTabId) {
        handleConsoleLog(request.data);
      }
      sendResponse({ success: true });
      break;
    case 'getConsoleLogs':
      sendResponse({ logs: consoleLogs });
      break;
    case 'clearConsoleLogs':
      consoleLogs = [];
      chrome.storage.local.set({ consoleLogs: [] });
      sendResponse({ success: true });
      break;
    case 'exportConsoleLogs':
      exportConsoleLogs();
      sendResponse({ success: true });
      break;
    case 'startRecordingSession':
      startRecordingSession();
      sendResponse({ success: true });
      break;
    case 'stopRecordingSession':
      stopRecordingSession();
      sendResponse({ success: true });
      break;
    case 'startScreenRecording':
      startScreenRecording();
      sendResponse({ success: true });
      break;
    case 'stopScreenRecording':
      stopScreenRecording();
      sendResponse({ success: true });
      break;
    case 'getScreenRecordingStatus':
      sendResponse({ isRecording: screenRecording });
      break;
    case 'exportScreenRecording':
      exportScreenRecording();
      sendResponse({ success: true });
      break;
    case 'getSessionStatus':
      sendResponse({ 
        isRecording, 
        screenRecording,
        currentSessionTabId, 
        sessionStartTime,
        hasActiveSession: isRecording || screenRecording,
        sessionActive: isRecording // Network recording is the primary indicator
      });
      break;
  }
  return true;
});

// Start recording network requests
async function startRecording() {
  if (isRecording) return;
  
  try {
    // Get the current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Set the current session tab
    currentSessionTabId = tab.id;
    sessionStartTime = new Date().toISOString();
    
    isRecording = true;
    chrome.storage.local.set({ 
      isRecording: true, 
      currentSessionTabId: tab.id,
      sessionStartTime: sessionStartTime
    });
    
    // Attach debugger to capture network requests
    await chrome.debugger.attach({ tabId: tab.id }, '1.3');
    await chrome.debugger.sendCommand({ tabId: tab.id }, 'Network.enable');
    debuggerAttached = true;
    
    // Listen for network events
    chrome.debugger.onEvent.addListener(handleNetworkEvent);
    
    console.log(`Started recording network requests for tab ${tab.id}`);
  } catch (error) {
    console.error('Failed to start recording:', error);
    isRecording = false;
    currentSessionTabId = null;
    sessionStartTime = null;
    chrome.storage.local.set({ 
      isRecording: false, 
      currentSessionTabId: null,
      sessionStartTime: null
    });
  }
}

// Stop recording network requests
async function stopRecording() {
  if (!isRecording) return;
  
  isRecording = false;
  chrome.storage.local.set({ isRecording: false });
  
  if (debuggerAttached) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const targets = await new Promise(resolve => chrome.debugger.getTargets(resolve));
      const target = targets.find(t => t.tabId === tab.id);
      if (target && target.attached) {
        await chrome.debugger.detach({ tabId: tab.id });
        debuggerAttached = false;
      }
    } catch (error) {
      console.error('Failed to detach debugger:', error);
    }
  }
  
  chrome.debugger.onEvent.removeListener(handleNetworkEvent);
  console.log('Stopped recording network requests');
}

// Handle network events from debugger
function handleNetworkEvent(source, method, params) {
  if (!isRecording || source.tabId !== currentSessionTabId) return;
  
  const requestData = {
    timestamp: new Date().toISOString(),
    method: method,
    params: params
  };
  
  switch (method) {
    case 'Network.requestWillBeSent':
      handleRequestWillBeSent(params);
      break;
    case 'Network.responseReceived':
      handleResponseReceived(params);
      break;
    case 'Network.dataReceived':
      handleDataReceived(params);
      break;
    case 'Network.loadingFinished':
      handleLoadingFinished(params);
      break;
  }
}

// Handle request being sent
function handleRequestWillBeSent(params) {
  // Only capture Fetch/XHR requests, exclude static resources
  const resourceType = params.type;
  const url = params.request.url;
  
  // Skip static resources
  if (resourceType === 'Image' || 
      resourceType === 'Stylesheet' || 
      resourceType === 'Script' ||
      resourceType === 'Font' ||
      resourceType === 'Media' ||
      resourceType === 'WebSocket' ||
      resourceType === 'Other') {
    return;
  }
  
  // Skip common static file extensions
  const staticExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.ico', '.css', '.js', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.mp3', '.wav', '.pdf'];
  const hasStaticExtension = staticExtensions.some(ext => url.toLowerCase().includes(ext));
  if (hasStaticExtension) {
    return;
  }
  
  const request = {
    id: params.requestId,
    timestamp: new Date().toISOString(),
    url: params.request.url,
    method: params.request.method,
    headers: params.request.headers,
    postData: params.request.postData,
    type: params.type,
    frameId: params.frameId,
    loaderId: params.loaderId,
    documentURL: params.documentURL,
    request: params.request,
    response: null,
    responseBody: null,
    status: 'pending'
  };
  
  // Find existing request or create new one
  const existingIndex = recordedRequests.findIndex(r => r.id === params.requestId);
  if (existingIndex >= 0) {
    recordedRequests[existingIndex] = { ...recordedRequests[existingIndex], ...request };
  } else {
    recordedRequests.push(request);
  }
  
  chrome.storage.local.set({ recordedRequests: recordedRequests });
}

// Handle response received
function handleResponseReceived(params) {
  const existingIndex = recordedRequests.findIndex(r => r.id === params.requestId);
  if (existingIndex >= 0) {
    recordedRequests[existingIndex].response = params.response;
    recordedRequests[existingIndex].status = 'completed';
    chrome.storage.local.set({ recordedRequests: recordedRequests });
  }
}

// Handle data received
function handleDataReceived(params) {
  const existingIndex = recordedRequests.findIndex(r => r.id === params.requestId);
  if (existingIndex >= 0) {
    if (!recordedRequests[existingIndex].responseBody) {
      recordedRequests[existingIndex].responseBody = '';
    }
    // Only add data if it's not undefined or null
    if (params.data !== undefined && params.data !== null) {
      recordedRequests[existingIndex].responseBody += params.data;
    }
    chrome.storage.local.set({ recordedRequests: recordedRequests });
  }
}

// Handle loading finished
function handleLoadingFinished(params) {
  const existingIndex = recordedRequests.findIndex(r => r.id === params.requestId);
  if (existingIndex >= 0) {
    recordedRequests[existingIndex].status = 'finished';
    
    // Try to get the full response body
    getResponseBody(params.requestId, existingIndex);
    
    chrome.storage.local.set({ recordedRequests: recordedRequests });
  }
}

// Get the full response body for a request
async function getResponseBody(requestId, requestIndex) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const result = await chrome.debugger.sendCommand(
      { tabId: tab.id },
      'Network.getResponseBody',
      { requestId: requestId }
    );
    
    if (result && result.body) {
      recordedRequests[requestIndex].responseBody = result.body;
      chrome.storage.local.set({ recordedRequests: recordedRequests });
    }
  } catch (error) {
    console.log('Could not get response body for request:', requestId, error.message);
    // If we can't get the full body, keep the accumulated data
  }
}

// Handle content script request
function handleContentScriptRequest(requestData) {
  const request = {
    id: `content-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: requestData.timestamp,
    url: requestData.url,
    method: requestData.method,
    headers: requestData.headers,
    postData: requestData.body,
    type: requestData.type,
    request: requestData,
    response: null,
    responseBody: null,
    status: 'pending'
  };
  
  recordedRequests.push(request);
  chrome.storage.local.set({ recordedRequests: recordedRequests });
}

// Handle content script response
function handleContentScriptResponse(responseData) {
  const existingIndex = recordedRequests.findIndex(r => 
    r.url === responseData.url && r.type === responseData.type.replace('-response', '')
  );
  
  if (existingIndex >= 0) {
    recordedRequests[existingIndex].response = {
      status: responseData.status,
      statusText: responseData.statusText,
      headers: responseData.headers,
      url: responseData.url
    };
    
    // Clean up response body - remove undefined values
    let cleanBody = responseData.body;
    if (cleanBody === 'undefined' || cleanBody === 'null') {
      cleanBody = '';
    } else if (typeof cleanBody === 'string' && cleanBody.includes('undefined')) {
      cleanBody = cleanBody.replace(/undefined/g, '');
    }
    
    recordedRequests[existingIndex].responseBody = cleanBody;
    recordedRequests[existingIndex].status = 'completed';
    chrome.storage.local.set({ recordedRequests: recordedRequests });
  }
}

// Handle console log
function handleConsoleLog(logData) {
  consoleLogs.push(logData);
  chrome.storage.local.set({ consoleLogs: consoleLogs });
}

// Start unified recording session
async function startRecordingSession() {
  // Check if there's already an active session
  if (isRecording || screenRecording) {
    console.log('Cannot start new session: Active session already exists');
    throw new Error('Active session already exists. Please stop the current session first.');
  }
  
  try {
    // Check if current tab is valid
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      throw new Error('No active tab found. Please ensure you have a tab open.');
    }
    
    // Check if the tab is accessible (not a chrome:// or chrome-extension:// page)
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      throw new Error('Cannot record on Chrome system pages. Please navigate to a regular website.');
    }
    
    // Start network recording
    await startRecording();
    
    // Inject content script programmatically if needed
    await ensureContentScriptInjected(tab.id);
    
    // Wait for content script to be ready
    await waitForContentScript(tab.id);
    
    // Start screen recording
    await startScreenRecording();
    
    console.log('Recording session started - Network, Console, and Screen recording active');
  } catch (error) {
    console.error('Failed to start recording session:', error);
    // Clean up if partial start occurred
    if (isRecording) {
      await stopRecording();
    }
    if (screenRecording) {
      await stopScreenRecording();
    }
    throw error;
  }
}

// Ensure content script is injected
async function ensureContentScriptInjected(tabId) {
  try {
    // Try to inject content script
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    });
    console.log('Content script injected successfully');
  } catch (error) {
    // Content script might already be injected, which is fine
    console.log('Content script injection result:', error.message);
  }
}

// Wait for content script to be ready
async function waitForContentScript(tabId, maxAttempts = 10) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
      if (response && response.success) {
        console.log('Content script is ready');
        return true;
      }
    } catch (error) {
      console.log(`Content script not ready, attempt ${attempt + 1}/${maxAttempts}`);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  throw new Error('Content script failed to initialize after multiple attempts');
}

// Stop unified recording session
async function stopRecordingSession() {
  try {
    // Stop network recording
    await stopRecording();
    // Stop screen recording
    await stopScreenRecording();
    // Clear session state
    currentSessionTabId = null;
    sessionStartTime = null;
    chrome.storage.local.set({ 
      currentSessionTabId: null,
      sessionStartTime: null
    });
    console.log('Recording session stopped');
    // Save session to IndexedDB
    await saveSessionToIndexedDB();
    // Open preview tab with session data
    openPreviewTab();
  } catch (error) {
    console.error('Failed to stop recording session:', error);
  }
}

async function saveSessionToIndexedDB() {
  try {
    // Get the current active tab (for video export)
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    let videoBlob = null;
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getScreenRecordingBlobData' });
      if (response && response.blob) {
        videoBlob = response.blob;
      }
    } catch (e) {
      // No video or content script not available
    }
    await saveLatestSession({
      network: recordedRequests,
      console: consoleLogs,
      videoBlob: videoBlob || null
    });
    console.log('Session saved to IndexedDB');
  } catch (e) {
    console.error('Failed to save session to IndexedDB:', e);
  }
}

// Export recorded requests
function exportRequests() {
  try {
    if (recordedRequests.length === 0) {
      console.log('No requests to export');
      return;
    }
    
    const dataStr = JSON.stringify(recordedRequests, null, 2);
    const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    
    chrome.downloads.download({
      url: dataUrl,
      filename: `network-requests-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`,
      saveAs: true
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('Download failed:', chrome.runtime.lastError);
      } else {
        console.log('Export successful, download ID:', downloadId);
      }
    });
  } catch (error) {
    console.error('Export failed:', error);
  }
}

// Start screen recording
async function startScreenRecording() {
  if (screenRecording) {
    console.log('Screen recording already active');
    return;
  }
  
  try {
    // Get the current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Ensure we're recording for the same tab as the network recording
    if (currentSessionTabId && currentSessionTabId !== tab.id) {
      console.error('Screen recording must be for the same tab as network recording');
      return;
    }
    
    // Check if content script is ready by sending a test message
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'getPageInfo' });
    } catch (error) {
      console.error('Content script not ready, cannot start screen recording:', error);
      return;
    }
    
    console.log('Starting screen recording...');
    
    // Send message to content script to start screen recording
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'startScreenRecording' });
    
    if (response && response.success) {
      screenRecording = true;
      console.log('Screen recording started via content script');
    } else {
      console.log('Failed to start screen recording via content script - user may have denied permission');
      // Don't set screenRecording to true if it failed, but don't throw error
      // Screen recording is optional, so we continue with network and console recording
    }
  } catch (error) {
    console.error('Failed to start screen recording:', error);
    // Don't set screenRecording to true if it failed, but don't throw error
    // Screen recording is optional, so we continue with network and console recording
  }
}

// Stop screen recording
async function stopScreenRecording() {
  if (!screenRecording) return;
  
  try {
    // Get the current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Check if content script is ready
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'getPageInfo' });
    } catch (error) {
      console.error('Content script not ready, cannot stop screen recording:', error);
      screenRecording = false;
      return;
    }
    
    // Send message to content script to stop screen recording
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'stopScreenRecording' });
    
    if (response && response.success) {
      screenRecording = false;
      console.log('Screen recording stopped via content script');
    } else {
      console.log('Failed to stop screen recording via content script');
      screenRecording = false;
    }
  } catch (error) {
    console.error('Failed to stop screen recording:', error);
    screenRecording = false;
  }
}

// Export screen recording
async function exportScreenRecording() {
  try {
    // Check if screen recording is active
    if (!screenRecording) {
      console.log('No active screen recording to export');
      chrome.runtime.sendMessage({
        action: 'screenRecordingNotAvailable',
        message: 'No active screen recording to export. Start a recording session first.'
      });
      return;
    }
    
    // Get the current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Check if content script is ready
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'getPageInfo' });
    } catch (error) {
      console.error('Content script not ready, cannot export screen recording:', error);
      chrome.runtime.sendMessage({
        action: 'screenRecordingNotAvailable',
        message: 'Content script not ready. Please refresh the page and try again.'
      });
      return;
    }
    
    // Send message to content script to export screen recording
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'exportScreenRecording' });
    
    if (response && response.success) {
      console.log('Screen recording export successful via content script');
    } else {
      console.log('No screen recording to export');
      // Send a message to the popup to show user-friendly message
      chrome.runtime.sendMessage({
        action: 'screenRecordingNotAvailable',
        message: 'No screen recording available to export. Network and console recording are still active.'
      });
    }
  } catch (error) {
    console.error('Screen recording export failed:', error);
    // Send a message to the popup to show user-friendly message
    chrome.runtime.sendMessage({
      action: 'screenRecordingNotAvailable',
      message: 'Screen recording export failed. Network and console recording are still active.'
    });
  }
}

// Export console logs
function exportConsoleLogs() {
  try {
    if (consoleLogs.length === 0) {
      console.log('No console logs to export');
      return;
    }
    
    const dataStr = JSON.stringify(consoleLogs, null, 2);
    const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    
    chrome.downloads.download({
      url: dataUrl,
      filename: `console-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`,
      saveAs: true
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('Console logs download failed:', chrome.runtime.lastError);
      } else {
        console.log('Console logs export successful, download ID:', downloadId);
      }
    });
  } catch (error) {
    console.error('Console logs export failed:', error);
  }
}

// Handle tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && isRecording && debuggerAttached && currentSessionTabId === tabId) {
    // Only re-attach debugger if it's the current session tab and debugger is not already attached
    chrome.debugger.getTargets((targets) => {
      const target = targets.find(t => t.tabId === tabId);
      if (target && !target.attached) {
        chrome.debugger.attach({ tabId: tabId }, '1.3')
          .then(() => chrome.debugger.sendCommand({ tabId: tabId }, 'Network.enable'))
          .catch(error => {
            if (error.message && !error.message.includes('Another debugger is already attached')) {
              console.error('Failed to re-attach debugger:', error);
            }
          });
      }
    });
  }
});

// Handle tab removal - stop recording if the session tab is closed
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  if (currentSessionTabId === tabId && (isRecording || screenRecording)) {
    console.log(`Session tab ${tabId} was closed, stopping recording session`);
    stopRecordingSession();
  }
});

// Open preview tab and pass session data
async function openPreviewTab() {
  try {
    // Get the current active tab (for video export)
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    // Ask content script for the latest video blob (if any)
    let videoBlobUrl = null;
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getScreenRecordingBlob' });
      if (response && response.blobUrl) {
        videoBlobUrl = response.blobUrl;
      }
    } catch (e) {
      // No video or content script not available
    }
    // Save session data to chrome.storage.local
    await chrome.storage.local.set({
      preview_network: recordedRequests,
      preview_console: consoleLogs,
      preview_video: videoBlobUrl || null
    });
    // Open preview.html in a new tab
    chrome.tabs.create({ url: chrome.runtime.getURL('preview.html') });
  } catch (error) {
    console.error('Failed to open preview tab:', error);
  }
} 