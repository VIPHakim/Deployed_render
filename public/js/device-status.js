/**
 * QNow Platform - Device Status Manager
 * Handles updating device status based on Orange API reachability status
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize variables
  let orangeApiToken = null;
  let tokenExpiresAt = null;
  const TOKEN_REFRESH_MARGIN = 60000; // 1 minute before expiration
  let isRefreshing = false; // Flag to prevent multiple simultaneous refreshes
  
  // Element for status messages
  const createStatusElement = () => {
    const existingElement = document.getElementById('status-update-messages');
    if (existingElement) return existingElement;
    
    const element = document.createElement('div');
    element.id = 'status-update-messages';
    element.className = 'alert alert-info mt-2';
    element.style.display = 'none';
    
    // Find a good place to add it
    const devicePage = document.querySelector('#devices-container');
    if (devicePage) {
      devicePage.insertBefore(element, devicePage.firstChild);
    }
    
    return element;
  };
  
  // Show status message
  const showStatusMessage = (message, type = 'info') => {
    const statusElement = createStatusElement();
    statusElement.className = `alert alert-${type} mt-2`;
    statusElement.style.display = 'block';
    statusElement.innerHTML = message;
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      statusElement.style.display = 'none';
    }, 5000);
  };
  
  // Get Orange API token
  const getOrangeToken = async () => {
    try {
      // Check if we already have a valid token
      if (orangeApiToken && tokenExpiresAt && new Date() < tokenExpiresAt - TOKEN_REFRESH_MARGIN) {
        console.log('Using existing Orange API token');
        return orangeApiToken;
      }
      
      showStatusMessage('Getting Orange API token...', 'info');
      
      const response = await fetch('/api/orange-token');
      if (!response.ok) {
        throw new Error(`Failed to get token: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      if (data.access_token) {
        orangeApiToken = data.access_token;
        // Calculate token expiration time
        tokenExpiresAt = new Date(new Date().getTime() + (data.expires_in * 1000));
        console.log(`Orange API token received, expires: ${tokenExpiresAt.toLocaleTimeString()}`);
        return orangeApiToken;
      } else {
        throw new Error('No access token in response');
      }
    } catch (error) {
      console.error('Error getting Orange API token:', error);
      showStatusMessage(`Error getting API token: ${error.message}`, 'danger');
      return null;
    }
  };
  
  // Check device reachability
  const checkDeviceReachability = async (device) => {
    try {
      // Skip devices without MSISDN
      if (!device.msisdn || device.msisdn === 'Not set') {
        console.log(`Device ${device.name} has no MSISDN, skipping reachability check`);
        return { data: null, error: null };
      }
      
      // Get token first
      const token = await getOrangeToken();
      if (!token) {
        throw new Error('No valid token available');
      }
      
      // Call the API to check reachability
      const response = await fetch('/api/device-reachability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phoneNumber: device.msisdn,
          accessToken: token
        })
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        const errorMsg = `Failed to check reachability: ${response.status} ${response.statusText}${errorData ? ` - ${errorData}` : ''}`;
        console.error(`Error checking reachability for device ${device.name}:`, errorMsg);
        return { data: null, error: errorMsg };
      }
      
      const data = await response.json();
      console.log(`Reachability status for ${device.name}:`, data);
      return { data, error: null };
    } catch (error) {
      console.error(`Error checking reachability for device ${device.name}:`, error);
      return { data: null, error: error.message };
    }
  };
  
  // Update device status based on reachability
  const updateDeviceStatus = async (device, reachabilityData, error = null) => {
    try {
      // If we got an error from the API for a device with MSISDN, mark it as offline
      if (error && device.msisdn) {
        const newStatus = 'inactive';
        
        // Update the status in the UI without reloading
        const statusCell = document.querySelector(`tr[data-device-id="${device.id}"] .device-status-cell`);
        if (statusCell) {
          const badge = document.createElement('span');
          badge.className = 'badge bg-danger';
          badge.textContent = 'Offline';
          statusCell.innerHTML = '';
          statusCell.appendChild(badge);
          
          // Add animation to highlight the status change
          statusCell.classList.add('status-updated');
          setTimeout(() => {
            statusCell.classList.remove('status-updated');
          }, 1000);
        }
        
        console.log(`Device ${device.name} marked as offline due to API error: ${error}`);
        return;
      }
      
      if (!reachabilityData) return;
      
      let newStatus;
      
      // Map reachability status to device status
      switch (reachabilityData.reachabilityStatus) {
        case 'CONNECTED_DATA':
        case 'CONNECTED_SMS':
          newStatus = 'Active';
          break;
        case 'NOT_CONNECTED':
          newStatus = 'Maintenance';
          break;
        case 'DEVICE_NOT_APPLICABLE':
          newStatus = 'inactive';
          break;
        default:
          newStatus = device.status || 'Active'; // Keep current status
      }
      
      // If status hasn't changed, do nothing
      if (newStatus.toLowerCase() === device.status.toLowerCase()) {
        return;
      }
      
      // Update the status in the UI without reloading
      const statusCell = document.querySelector(`tr[data-device-id="${device.id}"] .device-status-cell`);
      if (statusCell) {
        const badge = document.createElement('span');
        badge.className = `badge ${newStatus.toLowerCase() === 'active' ? 'bg-success' : newStatus.toLowerCase() === 'inactive' ? 'bg-danger' : 'bg-warning'}`;
        badge.textContent = newStatus;
        statusCell.innerHTML = '';
        statusCell.appendChild(badge);
        
        // Add animation to highlight the status change
        statusCell.classList.add('status-updated');
        setTimeout(() => {
          statusCell.classList.remove('status-updated');
        }, 1000);
      }
      
      console.log(`Updated status for ${device.name} to ${newStatus}`);
      
    } catch (error) {
      console.error(`Error updating status for device ${device.name}:`, error);
    }
  };
  
  // Refresh status for all devices
  const refreshAllDeviceStatuses = async () => {
    try {
      // Prevent multiple simultaneous refreshes
      if (isRefreshing) {
        console.log('Already refreshing device statuses, skipping...');
        return;
      }
      
      isRefreshing = true;
      showStatusMessage(`Refreshing device statuses...`, 'info');
      
      // Get all devices
      const response = await fetch('/api/devices');
      if (!response.ok) {
        throw new Error(`Failed to get devices: ${response.status} ${response.statusText}`);
      }
      
      const devices = await response.json();
      if (!devices || !Array.isArray(devices)) {
        throw new Error('Invalid device data received');
      }
      
      showStatusMessage(`Checking status for ${devices.length} devices...`, 'info');
      
      let updatedCount = 0;
      let skippedCount = 0;
      let offlineCount = 0;
      
      // Process devices sequentially to avoid rate limits
      for (const device of devices) {
        if (!device.msisdn || device.msisdn === 'Not set') {
          skippedCount++;
          continue;
        }
        
        const { data, error } = await checkDeviceReachability(device);
        
        if (error) {
          // Device with MSISDN but got an error - mark as offline
          await updateDeviceStatus(device, null, error);
          offlineCount++;
        } else if (data) {
          // Device with valid reachability data
          await updateDeviceStatus(device, data);
          updatedCount++;
        }
      }
      
      showStatusMessage(`Status refresh complete: ${updatedCount} devices updated, ${offlineCount} devices offline, ${skippedCount} skipped (no MSISDN)`, 'success');
      
    } catch (error) {
      console.error('Error refreshing device statuses:', error);
      showStatusMessage(`Error refreshing device statuses: ${error.message}`, 'danger');
    } finally {
      isRefreshing = false;
    }
  };
  
  // Connect refresh button in the UI
  const connectRefreshButton = () => {
    // Find the refresh button
    const refreshBtn = document.querySelector('#refresh-device-status-btn') || document.querySelector('#refresh-status-btn');
    
    if (refreshBtn) {
      console.log('Found refresh status button, attaching event listener');
      refreshBtn.addEventListener('click', (e) => {
        e.preventDefault();
        refreshAllDeviceStatuses();
      });
    } else {
      console.warn('Refresh status button not found, will try again later');
      // Try again later in case the button is added dynamically
      setTimeout(connectRefreshButton, 1000);
    }
  };
  
  // Initialize
  const initialize = () => {
    console.log('Initializing device status manager');
    connectRefreshButton();
  };
  
  // Listen for hash change to initialize when devices tab is active
  window.addEventListener('hashchange', (event) => {
    console.log('Hash changed:', window.location.hash, 'Previous URL:', event.oldURL);
    if (window.location.hash === '#devices') {
      console.log('Devices tab activated - device-status.js');
      setTimeout(initialize, 500);
      
      // Explicitly log before and after refresh attempt
      console.log('ATTEMPTING auto refresh of device statuses...');
      setTimeout(() => {
        console.log('EXECUTING auto refresh of device statuses...');
        refreshAllDeviceStatuses();
      }, 800);
    }
  });
  
  // Initialize if already on devices tab
  if (window.location.hash === '#devices') {
    console.log('Already on devices tab - device-status.js');
    setTimeout(initialize, 500);
    
    // Explicitly log before and after refresh attempt
    console.log('ATTEMPTING auto refresh of device statuses on page load...');
    setTimeout(() => {
      console.log('EXECUTING auto refresh of device statuses on page load...');
      refreshAllDeviceStatuses();
    }, 800);
  }
  
  // Listen for devicesRendered event
  document.addEventListener('devicesRendered', (event) => {
    console.log('Devices rendered, reconnecting refresh button');
    connectRefreshButton();
  });
  
  // Make functions available globally for debugging
  window.deviceStatusManager = {
    refreshAllDeviceStatuses,
    getOrangeToken,
    checkDeviceReachability
  };
}); 