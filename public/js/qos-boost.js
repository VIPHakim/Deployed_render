/**
 * QNow Platform - QoS Boost Activation
 * Handles activating QoS boosts using the stored token
 */

document.addEventListener('DOMContentLoaded', () => {
  // Get the activation button
  const activateQosBoostBtn = document.getElementById('activate-qos-boost');
  const scheduleQosBoostBtn = document.getElementById('schedule-qos-boost');
  
  if (activateQosBoostBtn) {
    activateQosBoostBtn.addEventListener('click', handleActivateQosBoost);
  }
  
  if (scheduleQosBoostBtn) {
    scheduleQosBoostBtn.addEventListener('click', handleScheduleQosBoost);
  }
});

/**
 * Handles the QoS boost activation
 */
async function handleActivateQosBoost() {
  try {
    // Get the form data
    const duration = document.getElementById('duration').value;
    const appServerIpv4 = document.getElementById('app-server-ipv4').value;
    const qosProfileUuid = document.getElementById('qos-profile-uuid').value;
    const webhookUrl = document.getElementById('webhook-url').value;
    
    // Get selected devices
    const selectedDevices = [];
    const selectedDeviceNames = [];
    document.querySelectorAll('input[name="device"]:checked').forEach(checkbox => {
      selectedDevices.push(checkbox.value);
      selectedDeviceNames.push(checkbox.getAttribute('data-device-name') || 'Device');
    });
    
    if (selectedDevices.length === 0) {
      showStatusMessage('Please select at least one device', 'danger');
      return;
    }
    
    // Validate inputs
    if (!duration || !appServerIpv4 || !qosProfileUuid) {
      showStatusMessage('Please fill in all required fields', 'danger');
      return;
    }
    
    // Get the token from localStorage
    const storedToken = localStorage.getItem('orange_api_token');
    if (!storedToken) {
      showStatusMessage('No authentication token found. Please use the Developer Tools to get a token first.', 'danger');
      return;
    }
    
    // Parse the token
    const tokenData = JSON.parse(storedToken);
    const accessToken = tokenData.access_token;
    
    // Show loading status
    showStatusMessage('Activating QoS boost...', 'info');
    
    // Prepare the request payload
    const payload = {
      duration: parseInt(duration),
      qosProfile: qosProfileUuid,
      deviceIds: selectedDevices,
      ipv4Address: appServerIpv4
    };
    
    if (webhookUrl) {
      payload.webhook = {
        notificationUrl: webhookUrl
      };
    }
    
    // Call the API to activate QoS boost
    const response = await fetch('/api/qos/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    // Parse the response
    const data = await response.json();
    
    if (response.ok) {
      showStatusMessage(`QoS boost activated successfully. Session ID: ${data.id}`, 'success');
      
      // Create a session object
      const deviceName = selectedDeviceNames.length === 1 ? 
        selectedDeviceNames[0] : 
        `${selectedDeviceNames.length} devices`;
      
      const session = {
        sessionId: data.id,
        deviceName: deviceName,
        qosStatus: 'ACTIVE',
        isActive: true,
        timestamp: new Date().toISOString(),
        duration: parseInt(duration),
        deviceIds: selectedDevices,
        appServerIpv4,
        qosProfileUuid,
        webhookUrl,
        expirationNotified: false
      };
      
      // Store the session both in our local storage and the shared localStorage
      storeSession(session);
      
      // Save to shared localStorage for other components
      saveToSharedStorage(session);
      
      // Dispatch a custom event to notify other components
      const event = new CustomEvent('qosSessionsUpdated', {
        detail: { sessions: [session] }
      });
      document.dispatchEvent(event);
    } else {
      showStatusMessage(`Failed to activate QoS boost: ${data.error || data.message || 'Unknown error'}`, 'danger');
    }
  } catch (error) {
    console.error('Error activating QoS boost:', error);
    showStatusMessage(`Error: ${error.message}`, 'danger');
  }
}

/**
 * Handles scheduling a QoS boost
 */
async function handleScheduleQosBoost() {
  // Get the form data
  const duration = document.getElementById('duration').value;
  const appServerIpv4 = document.getElementById('app-server-ipv4').value;
  const qosProfileUuid = document.getElementById('qos-profile-uuid').value;
  const webhookUrl = document.getElementById('webhook-url').value;
  const startDate = document.getElementById('start-date').value;
  const startTime = document.getElementById('start-time').value;
  const endDate = document.getElementById('end-date').value;
  const endTime = document.getElementById('end-time').value;
  
  // Get selected devices
  const selectedDevices = [];
  document.querySelectorAll('input[name="device"]:checked').forEach(checkbox => {
    selectedDevices.push(checkbox.value);
  });
  
  if (selectedDevices.length === 0) {
    showStatusMessage('Please select at least one device', 'danger');
    return;
  }
  
  // Validate inputs
  if (!duration || !appServerIpv4 || !qosProfileUuid || !startDate || !startTime) {
    showStatusMessage('Please fill in all required fields', 'danger');
    return;
  }
  
  // Schedule the activation
  // This would typically store the schedule and set up a notification
  // For now, we'll just show a success message
  showStatusMessage(`QoS boost scheduled for ${startDate} ${startTime}`, 'success');
}

/**
 * Display a status message to the user
 * @param {string} message - The message to display
 * @param {string} type - The type of message (success, danger, warning, info)
 */
function showStatusMessage(message, type = 'info') {
  const statusContainer = document.getElementById('status-message');
  if (!statusContainer) {
    console.error('Status message container not found');
    return;
  }
  
  statusContainer.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show" role="alert">
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;
  
  // Scroll to the message
  statusContainer.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Store a session for reference
 * @param {Object} sessionData - The session data to store
 */
function storeSession(sessionData) {
  try {
    // Get existing sessions
    let sessions = JSON.parse(localStorage.getItem('qos_sessions') || '[]');
    
    // Add the new session
    sessions.push({
      ...sessionData,
      createdAt: new Date().toISOString()
    });
    
    // Store back to localStorage
    localStorage.setItem('qos_sessions', JSON.stringify(sessions));
  } catch (error) {
    console.error('Error storing session:', error);
  }
}

/**
 * Save session to shared localStorage for other components
 * @param {Object} sessionData - The session data to store
 */
function saveToSharedStorage(sessionData) {
  try {
    // Get existing sessions from the shared storage key
    let sessions = [];
    const savedSessions = localStorage.getItem('qnow_active_qos_sessions');
    if (savedSessions) {
      sessions = JSON.parse(savedSessions);
    }
    
    // Add the new session
    sessions.push(sessionData);
    
    // Store back to localStorage with the shared key
    localStorage.setItem('qnow_active_qos_sessions', JSON.stringify(sessions));
    console.log('Session saved to shared storage for persistence across pages');
  } catch (error) {
    console.error('Error saving to shared storage:', error);
  }
} 