/**
 * QoS Status Monitor
 * This script monitors device QoS status and updates device status accordingly
 */

// Map to store active sessions by device IP
const deviceSessionsMap = new Map();

// Poll interval in milliseconds
const POLL_INTERVAL = 60000; // 1 minute

// Function to fetch all active QoS sessions
async function fetchActiveSessions() {
  try {
    // First try to fetch from API endpoint
    const response = await fetch('/api/qos/sessions');
    if (response.ok) {
      const sessions = await response.json();
      console.log(`Loaded ${sessions.length} QoS sessions from API`);
      
      // Update localStorage with the fresh data
      localStorage.setItem('qnow_active_qos_sessions', JSON.stringify(sessions));
      
      return sessions;
    }
    
    // Fallback: Get sessions from localStorage
    const savedSessions = localStorage.getItem('qnow_active_qos_sessions');
    if (savedSessions) {
      try {
        const sessions = JSON.parse(savedSessions);
        console.log(`Loaded ${sessions.length} QoS sessions from localStorage`);
        return sessions;
      } catch (error) {
        console.error('Error parsing saved QoS sessions:', error);
        // Continue to fallback if parsing fails
      }
    }
    
    // Final fallback: Get from UI (legacy approach)
    console.log('No sessions found in API or localStorage, extracting from UI');
    const sessionItems = document.querySelectorAll('.qos-session-item');
    console.log(`Found ${sessionItems.length} QoS session items in the UI`);
    
    const sessions = [];
    sessionItems.forEach(item => {
      const sessionId = item.dataset.sessionId;
      const statusBadge = item.querySelector('.session-status');
      const activeIndicator = item.querySelector('.active-indicator');
      
      if (sessionId && statusBadge) {
        // Extract device information from the session item
        const deviceInfoText = item.querySelector('b').textContent;
        const deviceIpMatch = deviceInfoText.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
        const deviceIp = deviceIpMatch ? deviceIpMatch[0] : null;
        
        const isActive = activeIndicator ? 
                          activeIndicator.textContent.includes('Active') : 
                          statusBadge.textContent === 'ACTIVE' || 
                          statusBadge.textContent === 'AVAILABLE' ||
                          statusBadge.textContent === 'REQUESTED';
        
        if (deviceIp) {
          sessions.push({
            sessionId,
            deviceIp,
            status: statusBadge.textContent,
            isActive
          });
        }
      }
    });
    
    return sessions;
  } catch (error) {
    console.error('Error fetching active sessions:', error);
    return [];
  }
}

// Function to fetch all devices
async function fetchDevices() {
  try {
    const response = await fetch('/api/devices');
    if (!response.ok) {
      throw new Error('Error retrieving devices');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching devices:', error);
    return [];
  }
}

// Function to update device status
async function updateDeviceStatus(deviceId, newStatus) {
  try {
    // Get the current device data first
    const response = await fetch(`/api/devices/${deviceId}`);
    if (!response.ok) {
      throw new Error('Error retrieving device');
    }
    const device = await response.json();
    
    // Only update if status is different
    if (device.status !== newStatus) {
      console.log(`Updating device ${device.name} (${deviceId}) status from ${device.status} to ${newStatus}`);
      
      // Update the device
      const updateResponse = await fetch(`/api/devices/${deviceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...device,
          status: newStatus
        })
      });
      
      if (!updateResponse.ok) {
        throw new Error('Error updating device status');
      }
      
      // Update UI
      const statusCell = document.querySelector(`#devices-table-body tr[data-device-id="${deviceId}"] td .badge`);
      if (statusCell) {
        statusCell.textContent = newStatus;
        statusCell.className = `badge ${getStatusBadgeClass(newStatus)}`;
      }
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error updating device status for ID ${deviceId}:`, error);
    return false;
  }
}

// Get status badge class (copy from devices.js)
function getStatusBadgeClass(status) {
  switch(status) {
    case 'active':
      return 'bg-success';
    case 'inactive':
      return 'bg-danger';
    case 'maintenance':
      return 'bg-warning';
    default:
      return 'bg-secondary';
  }
}

// Main function to update all device statuses based on QoS
async function updateAllDeviceStatuses() {
  try {
    const sessions = await fetchActiveSessions();
    const devices = await fetchDevices();
    
    if (!sessions.length || !devices.length) {
      console.log('No sessions or devices found');
      return;
    }
    
    console.log(`Processing ${sessions.length} sessions for ${devices.length} devices`);
    
    // Update device sessions map
    deviceSessionsMap.clear();
    sessions.forEach(session => {
      const deviceIp = session.deviceIp;
      if (deviceIp) {
        deviceSessionsMap.set(deviceIp, {
          sessionId: session.sessionId,
          status: session.status || session.qosStatus, // Adapt to different field names
          isActive: session.isActive
        });
      }
    });
    
    // Track if any status was updated for dashboard refresh
    let deviceStatusUpdated = false;
    
    // Update device statuses based on their QoS sessions
    for (const device of devices) {
      if (!device.ipAddress) continue;
      
      const session = deviceSessionsMap.get(device.ipAddress);
      
      if (session && session.isActive) {
        // If a device has an active QoS session, set status to active
        if (device.status !== 'active') {
          const updated = await updateDeviceStatus(device.id, 'active');
          if (updated) deviceStatusUpdated = true;
        }
      } else if (session && !session.isActive && device.status === 'active') {
        // If a device has an inactive QoS session and is currently active, set to inactive
        // We don't change maintenance status devices
        if (device.status !== 'maintenance') {
          const updated = await updateDeviceStatus(device.id, 'inactive');
          if (updated) deviceStatusUpdated = true;
        }
      }
    }
    
    // If any device status was updated, dispatch an event to refresh the dashboard
    if (deviceStatusUpdated) {
      const event = new CustomEvent('deviceStatusUpdated');
      document.dispatchEvent(event);
    }
    
    console.log('Device statuses updated based on QoS sessions');
  } catch (error) {
    console.error('Error updating device statuses:', error);
  }
}

// Add click handlers for manual refresh and connect to device status in devices page
function setupDeviceStatusRefresh() {
  // Find the existing refresh button in the devices page
  const existingRefreshBtn = document.getElementById('refresh-qos-status-btn');
  
  if (existingRefreshBtn) {
    // Add our QoS status update functionality to the existing button
    existingRefreshBtn.addEventListener('click', () => {
      console.log('Refresh QoS Status button clicked, updating device statuses');
      updateAllDeviceStatuses();
    });
  } else {
    console.warn('Existing refresh button not found, will try again later');
    // Try again after a delay in case the button is added later
    setTimeout(() => {
      const retryBtn = document.getElementById('refresh-qos-status-btn');
      if (retryBtn) {
        retryBtn.addEventListener('click', updateAllDeviceStatuses);
        console.log('Successfully connected to existing refresh button on retry');
      }
    }, 2000);
  }
}

// Initialize the monitoring
function initQoSStatusMonitor() {
  console.log('Initializing QoS Status Monitor');
  
  // Setup refresh button
  setupDeviceStatusRefresh();
  
  // Run an initial update
  setTimeout(updateAllDeviceStatuses, 2000);
  
  // Setup polling
  setInterval(updateAllDeviceStatuses, POLL_INTERVAL);
  
  // Listen for QoS session updates
  document.addEventListener('qosSessionUpdated', () => {
    console.log('QoS sessions updated, updating device statuses');
    updateAllDeviceStatuses();
  });
}

// Initialize when DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  // Wait until the page is fully loaded including scripts
  setTimeout(initQoSStatusMonitor, 1000);
  
  // Make function available globally
  window.updateAllDeviceStatuses = updateAllDeviceStatuses;
});

// Re-initialize when the hash changes to devices
window.addEventListener('hashchange', (event) => {
  console.log('Hash changed in qos-status-monitor.js:', window.location.hash, 'Previous URL:', event.oldURL);
  if (window.location.hash === '#devices') {
    // Call immediately when the tab is changed to maintain consistent timing with refresh status
    console.log('ATTEMPTING QoS status update on hash change...');
    setTimeout(() => {
      console.log('EXECUTING QoS status update on hash change...');
      updateAllDeviceStatuses();
    }, 800);
  }
});

// Initialize if already on devices tab when page first loads
if (window.location.hash === '#devices') {
  console.log('QoS Status Monitor: Already on devices tab - explicit check');
  console.log('ATTEMPTING QoS status update on page load...');
  setTimeout(() => {
    console.log('EXECUTING QoS status update on page load...');
    updateAllDeviceStatuses();
  }, 800);
} 