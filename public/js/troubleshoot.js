async function updateTroubleshootZone() {
  try {
    const response = await fetch('/api/debug/latest-log');
    const log = await response.json();
    
    if (!log) {
      console.error('No log data available');
      return;
    }

    // Format request data
    const requestJson = document.getElementById('request-json');
    const requestData = {
      endpoint: log.endpoint,
      method: log.method,
      sessionId: log.sessionId,
      headers: log.headers,
      body: log.body || null,
      timestamp: log.timestamp
    };
    requestJson.textContent = JSON.stringify(requestData, null, 2);

    // Format response data
    const responseJson = document.getElementById('response-json');
    responseJson.textContent = JSON.stringify(log.response, null, 2);
    
    // Update troubleshoot panel title
    const title = document.querySelector('#troubleshoot-zone h3');
    if (title) {
      title.textContent = `Last Orange API Call: ${log.method} ${log.endpoint}`;
    }
    
    // Make troubleshoot zone visible
    const troubleshootZone = document.getElementById('troubleshoot-zone');
    if (troubleshootZone) {
      troubleshootZone.style.display = 'block';
    }
  } catch (error) {
    console.error('Error fetching latest log:', error);
  }
}

// Setup auto-refresh
function setupRefreshTimer() {
  // Call immediately on page load
  updateTroubleshootZone();
  
  // Then refresh every 5 seconds
  setInterval(updateTroubleshootZone, 5000);
}

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', setupRefreshTimer);

// Function to manually refresh
function refreshTroubleshootZone() {
  updateTroubleshootZone();
}

// Export for manual refreshes from other modules
window.refreshTroubleshootZone = refreshTroubleshootZone; 