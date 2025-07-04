// preview.js

// --- Video ---
const videoFileInput = document.getElementById('videoFile');
const videoDrop = document.getElementById('videoDrop');
const videoPlayer = document.getElementById('videoPlayer');
const videoInfo = document.getElementById('videoInfo');

videoFileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files[0]) {
    loadVideoFile(e.target.files[0]);
  }
});

videoDrop.addEventListener('dragover', (e) => {
  e.preventDefault();
  videoDrop.classList.add('dragover');
});
videoDrop.addEventListener('dragleave', (e) => {
  e.preventDefault();
  videoDrop.classList.remove('dragover');
});
videoDrop.addEventListener('drop', (e) => {
  e.preventDefault();
  videoDrop.classList.remove('dragover');
  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
    loadVideoFile(e.dataTransfer.files[0]);
  }
});

function loadVideoFile(file) {
  if (!file.type.startsWith('video/')) {
    videoInfo.textContent = 'Invalid file type. Please select a WebM video.';
    return;
  }
  const url = URL.createObjectURL(file);
  videoPlayer.src = url;
  videoPlayer.style.display = '';
  videoInfo.textContent = `${file.name} (${(file.size/1024/1024).toFixed(2)} MB)`;
}

// --- Tabs ---
const tabBtns = document.querySelectorAll('.tab-btn');
const networkTab = document.getElementById('networkTab');
const consoleTab = document.getElementById('consoleTab');

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (btn.dataset.tab === 'network') {
      networkTab.style.display = '';
      consoleTab.style.display = 'none';
    } else {
      networkTab.style.display = 'none';
      consoleTab.style.display = '';
    }
  });
});

// --- Network Data ---
const networkFileInput = document.getElementById('networkFile');
const networkDrop = document.getElementById('networkDrop');
let networkData = [];

networkFileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files[0]) {
    loadNetworkFile(e.target.files[0]);
  }
});
networkDrop.addEventListener('dragover', (e) => {
  e.preventDefault();
  networkDrop.classList.add('dragover');
});
networkDrop.addEventListener('dragleave', (e) => {
  e.preventDefault();
  networkDrop.classList.remove('dragover');
});
networkDrop.addEventListener('drop', (e) => {
  e.preventDefault();
  networkDrop.classList.remove('dragover');
  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
    loadNetworkFile(e.dataTransfer.files[0]);
  }
});

function loadNetworkFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      networkData = JSON.parse(e.target.result);
      renderNetworkTable();
    } catch (err) {
      networkTab.innerHTML = '<div style="color:red">Invalid JSON file.</div>';
    }
  };
  reader.readAsText(file);
}

function renderNetworkTable() {
  if (!Array.isArray(networkData) || networkData.length === 0) {
    networkTab.innerHTML = '<div style="color:#888">No network requests loaded.</div>';
    return;
  }
  let html = `<table class="network-table">
    <thead><tr><th>#</th><th>Method</th><th>Status</th><th>URL</th></tr></thead><tbody>`;
  networkData.forEach((req, i) => {
    html += `<tr class="network-row" data-idx="${i}">
      <td>${i+1}</td>
      <td>${req.method || (req.request && req.request.method) || ''}</td>
      <td>${(req.response && req.response.status) || ''}</td>
      <td title="${req.url || (req.request && req.request.url) || ''}">${truncateUrl(req.url || (req.request && req.request.url) || '')}</td>
    </tr>`;
    if (req._expanded) {
      html += `<tr><td colspan="4">
        <div class="network-details">
          <b>Request Headers:</b>\n${JSON.stringify(req.headers || (req.request && req.request.headers) || {}, null, 2)}\n\n` +
        `<b>Request Body:</b>\n${JSON.stringify(req.postData || (req.request && req.request.postData) || '', null, 2)}\n\n` +
        `<b>Response:</b>\n${JSON.stringify(req.response || {}, null, 2)}\n\n` +
        `<b>Response Body:</b>\n${typeof req.responseBody === 'string' ? req.responseBody : JSON.stringify(req.responseBody, null, 2)}
        </div>
      </td></tr>`;
    }
  });
  html += '</tbody></table>';
  networkTab.innerHTML = html;
  // Add expand/collapse
  document.querySelectorAll('.network-row').forEach(row => {
    row.addEventListener('click', () => {
      const idx = parseInt(row.dataset.idx);
      networkData[idx]._expanded = !networkData[idx]._expanded;
      renderNetworkTable();
    });
  });
}
function truncateUrl(url) {
  if (!url) return '';
  if (url.length > 60) return url.slice(0, 57) + '...';
  return url;
}

// --- Console Logs ---
const consoleFileInput = document.getElementById('consoleFile');
const consoleDrop = document.getElementById('consoleDrop');
let consoleData = [];

consoleFileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files[0]) {
    loadConsoleFile(e.target.files[0]);
  }
});
consoleDrop.addEventListener('dragover', (e) => {
  e.preventDefault();
  consoleDrop.classList.add('dragover');
});
consoleDrop.addEventListener('dragleave', (e) => {
  e.preventDefault();
  consoleDrop.classList.remove('dragover');
});
consoleDrop.addEventListener('drop', (e) => {
  e.preventDefault();
  consoleDrop.classList.remove('dragover');
  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
    loadConsoleFile(e.dataTransfer.files[0]);
  }
});

function loadConsoleFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      consoleData = JSON.parse(e.target.result);
      renderConsoleList();
    } catch (err) {
      consoleTab.innerHTML = '<div style="color:red">Invalid JSON file.</div>';
    }
  };
  reader.readAsText(file);
}

function renderConsoleList() {
  if (!Array.isArray(consoleData) || consoleData.length === 0) {
    consoleTab.innerHTML = '<div style="color:#888">No console logs loaded.</div>';
    return;
  }
  let html = '<ul class="console-list">';
  consoleData.forEach(log => {
    html += `<li class="console-item console-${log.level}">
      <b>[${log.level.toUpperCase()}]</b> ${escapeHtml(log.message)}<br>
      <span style="font-size:12px;color:#888">${log.timestamp || ''}</span>
    </li>`;
  });
  html += '</ul>';
  consoleTab.innerHTML = html;
}
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function (c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c];
  });
}

// Auto-load session data from chrome.storage.local if present
if (window.chrome && chrome.storage && chrome.storage.local) {
  chrome.storage.local.get(['preview_network', 'preview_console', 'preview_video'], (result) => {
    if (result.preview_network) {
      networkData = result.preview_network;
      renderNetworkTable();
    }
    if (result.preview_console) {
      consoleData = result.preview_console;
      renderConsoleList();
    }
    if (result.preview_video) {
      videoPlayer.src = result.preview_video;
      videoPlayer.style.display = '';
      videoInfo.textContent = 'Loaded from session';
    }
    // Clear after loading
    chrome.storage.local.remove(['preview_network', 'preview_console', 'preview_video']);
  });
} 