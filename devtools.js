// DevTools script for Network Request Recorder
chrome.devtools.panels.create(
    "Network Recorder",
    "icons/icon16.png",
    "devtools-panel.html",
    (panel) => {
        console.log("Network Recorder panel created");
    }
); 