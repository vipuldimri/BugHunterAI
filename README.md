# Network Request Recorder Chrome Extension

A powerful Chrome extension that records network requests including headers, payload, and response body from web pages.

## Features

- **Unified Recording Session**: Start/stop all recording types with a single button
- **Session Management**: Ensures only one recording session per tab with automatic cleanup
- **Tab-Specific Recording**: Only captures data from the current active tab
- **Real-time Network Monitoring**: Capture all network requests as they happen
- **Complete Request Details**: Record headers, payload, and response body
- **Console Log Capture**: Record console.log, console.error, console.warn, and console.info messages
- **Screen Recording**: Capture and export current tab as video (WebM format)
- **Multiple Request Types**: Support for fetch, XMLHttpRequest, and static resources
- **DevTools Integration**: Custom panel in Chrome DevTools for detailed analysis
- **Separate Export Options**: Export network requests, console logs, and screen recordings individually
- **Live Statistics**: Real-time counters for total, completed, and pending requests
- **Modern UI**: Clean and intuitive interface with tabbed navigation

## Installation

### Method 1: Load as Unpacked Extension (Recommended for Development)

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension directory
5. The extension should now appear in your extensions list

### Method 2: Create Icons (Required)

Before using the extension, you need to create actual PNG icon files:

1. Create 16x16, 48x48, and 128x128 pixel PNG icons
2. Replace the placeholder files in the `icons/` directory:
   - `icons/icon16.png`
   - `icons/icon48.png`
   - `icons/icon128.png`

You can use any image editor like GIMP, Photoshop, or online tools to create these icons.

## Usage

### Basic Usage

1. **Install the Extension**: Follow the installation instructions above
2. **Navigate to a Website**: Go to any website you want to monitor
3. **Start Recording Session**: Click the extension icon and click "Start Recording Session"
4. **Browse the Website**: Navigate around the site to generate network requests, console logs, and screen activity
5. **View Results**: Click the extension icon again to see recorded data in tabs
6. **Stop Recording Session**: Click "Stop Recording Session" when done
7. **Export Data**: Use individual export buttons for network requests, console logs, and screen recording

### Session Management

- **Single Session Per Tab**: Only one recording session can be active at a time
- **Automatic Cleanup**: Recording automatically stops if the tab is closed
- **Session Information**: View active session details including start time and tab ID
- **Conflict Prevention**: Cannot start a new session while one is already active
- **Tab-Specific Data**: All recorded data is specific to the current tab only

### DevTools Panel

For detailed analysis:

1. Open Chrome DevTools (F12 or right-click → Inspect)
2. Look for the "Network Recorder" tab in the DevTools panel
3. This provides a detailed view with:
   - Request list with filtering
   - Complete request and response details
   - Headers and body inspection
   - Export functionality

### Features

#### Request Recording
- **Fetch API**: Intercepts all `fetch()` calls
- **XMLHttpRequest**: Captures traditional AJAX requests
- **API Calls**: Focuses on dynamic data requests and API endpoints
- **Excludes Static Resources**: Filters out images, scripts, stylesheets, and other static files

#### Data Captured
- **Request URL and Method**
- **Request Headers**
- **Request Body/Payload**
- **Response Status and Headers**
- **Response Body**
- **Timestamps**
- **Request Type Classification**

#### Console Logs Captured
- **Log Level**: log, error, warn, info
- **Log Message**: Formatted message content
- **Timestamp**: When the log was created
- **URL**: Page where the log occurred
- **Stack Trace**: Call stack information

#### Screen Recording
- **Format**: WebM video with VP9 codec
- **Quality**: High-quality tab capture
- **Duration**: From start to stop recording
- **Export**: Automatic download when recording stops

#### Export Options
- **Network Requests Export**: Download all recorded requests as a JSON file
- **Console Logs Export**: Download all console logs as a JSON file
- **Screen Recording Export**: Download recorded video as WebM file
- **Timestamped Filename**: Automatic naming with current date/time
- **Complete Data**: Includes all request, response, log, and video data

## File Structure

```
network-request-recorder/
├── manifest.json              # Extension manifest
├── background.js              # Background service worker
├── content.js                 # Content script for page injection
├── popup.html                 # Extension popup interface
├── popup.js                   # Popup functionality
├── devtools.html              # DevTools page
├── devtools.js                # DevTools integration
├── devtools-panel.html        # DevTools panel interface
├── devtools-panel.js          # DevTools panel functionality
├── icons/                     # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md                  # This file
```

## Permissions

The extension requires the following permissions:

- **webRequest**: To intercept network requests
- **storage**: To save recorded requests
- **activeTab**: To access the current tab
- **tabs**: To manage tabs
- **debugger**: To use Chrome DevTools Protocol
- **downloads**: To export recorded requests as JSON files
- **desktopCapture**: To capture screen recordings
- **host_permissions**: `<all_urls>` to monitor all websites

## Technical Details

### Architecture
- **Manifest V3**: Uses the latest Chrome extension manifest version
- **Service Worker**: Background script for request processing
- **Content Script**: Injects into web pages for request interception
- **DevTools Integration**: Custom panel for detailed analysis

### Request Interception Methods
1. **Debugger Protocol**: Primary method using Chrome DevTools Protocol (Manifest V3 compatible)
2. **Content Script Injection**: Intercepts `fetch()` API calls and `XMLHttpRequest` calls
3. **Request Filtering**: Automatically filters out static resources (images, CSS, JS, fonts, etc.)
4. **Service Worker**: Handles request processing and storage

### Data Storage
- **Chrome Storage API**: Uses local storage for persistence
- **Real-time Updates**: Live updates across all extension components
- **Memory Management**: Automatic cleanup and optimization

## Troubleshooting

### Common Issues

1. **Extension Not Loading**
   - Ensure all files are present in the directory
   - Check that manifest.json is valid JSON
   - Verify icons are actual PNG files

2. **No Requests Being Recorded**
   - Make sure recording is started
   - Check if the website uses HTTPS (some features require secure context)
   - Verify the extension has necessary permissions

3. **DevTools Panel Not Appearing**
   - Refresh the page after installing the extension
   - Check if DevTools is open
   - Look for the "Network Recorder" tab in DevTools

4. **Performance Issues**
   - Clear recorded requests if too many are stored
   - Restart the extension if memory usage is high
   - Consider filtering requests in the DevTools panel

### Debug Mode

To enable debug logging:

1. Open Chrome DevTools
2. Go to the Console tab
3. Look for messages from "Network Request Recorder"
4. Check for any error messages

## Development

### Building from Source

1. Clone the repository
2. Create the required icon files
3. Load as unpacked extension in Chrome
4. Make changes and reload the extension

### Testing

1. Install the extension
2. Navigate to various websites
3. Test different types of requests (API calls, form submissions, etc.)
4. Verify data is captured correctly
5. Test export functionality

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the MIT License.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review the console for error messages
3. Create an issue in the repository

## Changelog

### Version 1.0
- Initial release
- Basic network request recording
- DevTools integration
- Export functionality
- Modern UI design 