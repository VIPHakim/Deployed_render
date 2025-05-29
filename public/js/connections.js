document.addEventListener('DOMContentLoaded', () => {
  // Only run if the connections container is present
  const connectionsContainer = document.getElementById('connections-container');
  if (!connectionsContainer) return;

  const contentArea = document.getElementById('connections-content-area');

  // Add storage for active sessions
  let activeQoSSessions = [];

  // Add storage for scheduled sessions
  let scheduledQoSTasks = [];

  // Function to save sessions to localStorage
  function saveActiveSessions() {
    localStorage.setItem('qnow_active_qos_sessions', JSON.stringify(activeQoSSessions));
    console.log(`Saved ${activeQoSSessions.length} QoS sessions to localStorage`);
    
    // Dispatch custom event to notify other components (like dashboard) that sessions have changed
    const event = new CustomEvent('qosSessionsUpdated', { 
      detail: { sessions: activeQoSSessions } 
    });
    document.dispatchEvent(event);
  }

  // Function to load sessions from localStorage
  function loadActiveSessions() {
    const savedSessions = localStorage.getItem('qnow_active_qos_sessions');
    if (savedSessions) {
      try {
        activeQoSSessions = JSON.parse(savedSessions);
        console.log(`Loaded ${activeQoSSessions.length} QoS sessions from localStorage`);
      } catch (error) {
        console.error('Error loading saved QoS sessions:', error);
        activeQoSSessions = [];
      }
    }
  }

  // Add function to save scheduled tasks
  function saveScheduledTasks() {
    localStorage.setItem('qnow_scheduled_qos_tasks', JSON.stringify(scheduledQoSTasks));
    console.log(`Saved ${scheduledQoSTasks.length} scheduled QoS tasks to localStorage`);
    
    // Dispatch custom event to notify dashboard of task changes
    const event = new CustomEvent('qosTasksUpdated', { 
      detail: { tasks: scheduledQoSTasks } 
    });
    document.dispatchEvent(event);
  }

  // Add function to load scheduled tasks
  function loadScheduledTasks() {
    const savedTasks = localStorage.getItem('qnow_scheduled_qos_tasks');
    if (savedTasks) {
      try {
        scheduledQoSTasks = JSON.parse(savedTasks);
        console.log(`Loaded ${scheduledQoSTasks.length} scheduled QoS tasks from localStorage`);
        // Set up timers for all scheduled tasks
        setupScheduledTaskTimers();
      } catch (error) {
        console.error('Error loading saved QoS tasks:', error);
        scheduledQoSTasks = [];
      }
    }
  }

  // Load sessions when the script initializes
  loadActiveSessions();
  loadScheduledTasks();

  // Function to refresh all session statuses
  async function refreshAllSessionStatuses() {
    if (activeQoSSessions.length === 0) return;
    
    console.log(`Refreshing statuses for ${activeQoSSessions.length} QoS sessions`);
    
    // Get token from sessionStorage
    let headers = { 'Content-Type': 'application/json' };
    const storedTokenData = sessionStorage.getItem('oauth_token');
    if (storedTokenData) {
      const tokenData = JSON.parse(storedTokenData);
      const accessToken = tokenData.access_token;
      headers['Authorization'] = `Bearer ${accessToken}`;
    } else {
      console.error('No authorization token found for status refresh');
      return;
    }
    
    const now = new Date().getTime();
    
    // Check each session status
    for (let i = 0; i < activeQoSSessions.length; i++) {
      const session = activeQoSSessions[i];
      try {
        const res = await fetch(`/api/qos/sessions/${session.sessionId}/status`, {
          method: 'GET',
          headers
        });
        
        if (res.ok) {
          const data = await res.json();
          // Update session status
          activeQoSSessions[i].qosStatus = data.qosStatus || activeQoSSessions[i].qosStatus;
          activeQoSSessions[i].isActive = 
            data.qosStatus === 'ACTIVE' || 
            data.qosStatus === 'AVAILABLE' || 
            data.qosStatus === 'REQUESTED';
          
          // Check for session expiration if it's active
          if (activeQoSSessions[i].isActive && !activeQoSSessions[i].expirationNotified) {
            // If we have timestamp and duration info, check if it's nearing expiration
            if (activeQoSSessions[i].timestamp && activeQoSSessions[i].duration) {
              const startTime = new Date(activeQoSSessions[i].timestamp).getTime();
              const expirationTime = startTime + (activeQoSSessions[i].duration * 1000);
              const timeRemaining = expirationTime - now;
              
              // If less than 45 seconds remaining, show notification
              if (timeRemaining > 0 && timeRemaining < 45000) {
                notifySessionExpiringSoon(activeQoSSessions[i]);
                activeQoSSessions[i].expirationNotified = true;
              }
            }
          }
        } else if (res.status === 404) {
          // Session not found - it might have been deleted externally
          activeQoSSessions[i].qosStatus = 'DELETED';
          activeQoSSessions[i].isActive = false;
        }
      } catch (error) {
        console.error(`Error refreshing status for session ${session.sessionId}:`, error);
      }
    }
    
    // Save updated sessions
    saveActiveSessions();

    // Function to clean up deleted or expired sessions
    cleanupSessions();
  }

  // Function to clean up deleted or expired sessions
  function cleanupSessions() {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    // Filter out sessions that are deleted or expired (older than 24 hours)
    const originalCount = activeQoSSessions.length;
    activeQoSSessions = activeQoSSessions.filter(session => {
      if (session.qosStatus === 'DELETED') {
        // Keep deleted sessions for a short time (1 hour) for user reference
        const sessionTime = new Date(session.timestamp || now);
        const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);
        return sessionTime > oneHourAgo;
      }
      
      // Keep all active sessions and recent inactive ones 
      if (session.isActive) return true;
      
      // For inactive sessions, check timestamp
      const sessionTime = new Date(session.timestamp || now);
      return sessionTime > oneDayAgo;
    });
    
    // If sessions were removed, save the updated list
    if (originalCount !== activeQoSSessions.length) {
      console.log(`Cleaned up ${originalCount - activeQoSSessions.length} old or deleted sessions`);
      saveActiveSessions();
    }
  }

  async function fetchGroups() {
    const res = await fetch('/api/groups');
    if (!res.ok) return [];
    return await res.json();
  }

  async function fetchDevices() {
    const res = await fetch('/api/devices');
    if (!res.ok) return [];
    return await res.json();
  }

  async function fetchGroupDevices(groupId) {
    const res = await fetch(`/api/groups/${groupId}/devices`);
    if (!res.ok) return [];
    return await res.json();
  }

  async function fetchMappings() {
    const res = await fetch('/api/qos-mappings');
    if (!res.ok) return {};
    return await res.json();
  }

  async function renderConnections() {
    console.log('renderConnections called');
    contentArea.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div><p>Loading groups and devices...</p></div>';
    const groups = await fetchGroups();
    const allDevices = await fetchDevices();
    if (!groups.length) {
      contentArea.innerHTML = '<div class="alert alert-info">No groups found. Please create a group first.</div>';
      return;
    }
    
    // Clean up old or deleted sessions before rendering
    cleanupSessions();
    
    // Initialize html variable
    let html = '';
    
    // Continue with existing HTML generation for groups
    for (const group of groups) {
      const groupDeviceIds = (await fetchGroupDevices(group.id)).map(d => d.id !== undefined ? d.id : d); // support both id or full object
      const groupDevices = allDevices.filter(device => groupDeviceIds.includes(device.id));
      console.log('Devices for group', group.name, groupDevices);
      
      // Get the IPs of all devices in this group
      const groupDeviceIPs = groupDevices.map(device => device.ipAddress).filter(ip => ip);
      
      // Filter sessions that belong to devices in this group
      const groupSessions = activeQoSSessions.filter(session => 
        groupDeviceIPs.includes(session.deviceIp)
      );
      
      // Sort sessions with active ones first, then by timestamp (newest first)
      if (groupSessions.length > 0) {
        groupSessions.sort((a, b) => {
          // Active sessions first
          if (a.isActive !== b.isActive) {
            return a.isActive ? -1 : 1;
          }
          // Then by timestamp (newest first)
          const timeA = new Date(a.timestamp || 0).getTime();
          const timeB = new Date(b.timestamp || 0).getTime();
          return timeB - timeA;
        });
      }
      
      html += `<div class="card mb-4">
        <div class="card-header bg-primary text-white">
          <h5 class="mb-0">${group.name}</h5>
        </div>
        <div class="card-body">`;
      
      // If there are sessions for this group, show them first
      if (groupSessions.length > 0) {
        html += `<div class="mb-4">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <h6 class="mb-0">Active QoS Sessions</h6>
            <div>
              <button class="btn btn-sm btn-outline-primary refresh-group-sessions-btn me-2" data-group-id="${group.id}">
                <i class="bi bi-arrow-clockwise"></i> Refresh
              </button>
            </div>
          </div>
          <div class="alert alert-info small mb-2">
            <i class="bi bi-info-circle"></i> QoS sessions will automatically show notifications when they're about to expire. 
            You can click the <strong>Extend</strong> button to add more time to an active session.
          </div>
          <div class="table-responsive">
            <table class="table table-sm table-hover">
              <thead>
                <tr>
                  <th>Device</th>
                  <th>Session ID</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>`;
                
        for (const session of groupSessions) {
          const device = allDevices.find(d => d.ipAddress === session.deviceIp);
          const deviceName = device ? device.name : session.deviceIp;
          const statusBadgeClass = getStatusBadgeClass(session.qosStatus);
          const createdTime = session.timestamp ? new Date(session.timestamp).toLocaleString() : 'Unknown';
          
          // Calculate time remaining for active sessions
          let timeRemainingHtml = '';
          if (session.isActive && session.timestamp && session.duration) {
            const startTime = new Date(session.timestamp).getTime();
            const expirationTime = startTime + (session.duration * 1000);
            const now = new Date().getTime();
            const timeRemaining = expirationTime - now;
            
            if (timeRemaining > 0) {
              const secondsRemaining = Math.floor(timeRemaining / 1000);
              const minutesRemaining = Math.floor(secondsRemaining / 60);
              const secondsDisplay = secondsRemaining % 60;
              const formattedSeconds = secondsDisplay < 10 ? `0${secondsDisplay}` : secondsDisplay;
              
              let badgeClass = 'bg-info';
              if (secondsRemaining < 30) {
                badgeClass = 'bg-danger';
              } else if (secondsRemaining < 60) {
                badgeClass = 'bg-warning';
              }
              
              timeRemainingHtml = `<span class="badge ${badgeClass} time-remaining-badge" data-session-id="${session.sessionId}">${minutesRemaining}m ${formattedSeconds}s Left</span>`;
            }
          }
          
          html += `<tr class="qos-session-item" data-session-id="${session.sessionId}">
            <td><b>${deviceName}</b></td>
            <td><span class="small text-secondary">${session.sessionId || 'N/A'}</span></td>
            <td>
              <span class="badge ${statusBadgeClass} session-status" data-session-id="${session.sessionId}">${session.qosStatus}</span>
              ${session.isActive ? `<span class="badge bg-success ms-1 active-indicator">Active</span>` : `<span class="badge bg-danger ms-1 active-indicator">Inactive</span>`}
              ${timeRemainingHtml}
            </td>
            <td><span class="small">${createdTime}</span></td>
            <td>
              <button class="btn btn-sm btn-outline-primary refresh-status-btn" data-session-id="${session.sessionId}">
                <i class="bi bi-arrow-clockwise"></i>
              </button>
              ${session.isActive ? `
                <button class="btn btn-sm btn-outline-success extend-session-btn" data-session-id="${session.sessionId}">
                  <i class="bi bi-lightning-charge"></i> Extend
                </button>
              ` : ''}
              <button class="btn btn-sm btn-outline-danger delete-session-btn" data-session-id="${session.sessionId}">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        }
        
        html += `</tbody>
            </table>
          </div>
        </div>`;
      }
        
      html += `<div><strong>Connectivity Profile:</strong> ${group.connectivityProfile}</div>
          <div class="row mb-2">
            <div class="col-md-3">
              <label class="form-label">Duration (seconds)</label>
              <input type="number" class="form-control qos-duration" data-group-id="${group.id}" value="600" min="1">
            </div>
            <div class="col-md-3">
              <label class="form-label">App Server IPv4</label>
              <input type="text" class="form-control qos-appserver-ip" data-group-id="${group.id}" value="172.20.120.84">
            </div>
            <div class="col-md-3">
              <label class="form-label">QoS Profile (UUID)</label>
              <input type="text" class="form-control qos-profile-uuid" data-group-id="${group.id}" value="">
            </div>
            <div class="col-md-3">
              <label class="form-label">Webhook URL</label>
              <input type="text" class="form-control qos-webhook-url" data-group-id="${group.id}" value="https://webhook.site/669c8490-2f35-4561-8a3f-6c89618332ed">
            </div>
          </div>
          <div class="mt-2"><strong>Devices:</strong></div>
          <div class="mb-2">
            <label><input type="checkbox" class="select-all-devices" data-group-id="${group.id}"> <strong>Select All Devices</strong></label>
          </div>
          <ul class="list-group mb-3" id="device-list-${group.id}">`;
      for (const device of groupDevices) {
        html += `<li class="list-group-item">
          <label class="d-flex align-items-center">
            <input type="checkbox" class="device-checkbox" data-group-id="${group.id}" data-device-id="${device.id}">
            <span class="ms-2">${device.name || 'Unnamed Device'} <span class="text-muted small">(${device.ipAddress || 'No IP'})</span></span>
          </label>
        </li>`;
      }
      html += `</ul>
          <div class="d-flex flex-wrap gap-2 align-items-center mb-2">
            <button class="btn btn-success activate-qos-btn" data-group-id="${group.id}"><i class="bi bi-lightning-charge"></i> Activate QoS Boost Now</button>
            <span class="ms-2">or schedule:</span>
            <input type="datetime-local" class="form-control form-control-sm schedule-start" data-group-id="${group.id}" style="max-width:180px;">
            <span>to</span>
            <input type="datetime-local" class="form-control form-control-sm schedule-end" data-group-id="${group.id}" style="max-width:180px;">
            <button class="btn btn-outline-primary schedule-qos-btn" data-group-id="${group.id}"><i class="bi bi-calendar-event"></i> Schedule QoS Boost</button>
          </div>
          <div class="qos-action-result text-success small" id="qos-action-result-${group.id}"></div>
        </div>
      </div>`;
    }
    contentArea.innerHTML = html;

    // Add select all logic
    document.querySelectorAll('.select-all-devices').forEach(selectAll => {
      selectAll.addEventListener('change', function() {
        const groupId = this.dataset.groupId;
        const checked = this.checked;
        document.querySelectorAll(`.device-checkbox[data-group-id='${groupId}']`).forEach(cb => {
          cb.checked = checked;
        });
      });
    });

    // Add Activate QoS Boost Now button logic (API integration)
    document.querySelectorAll('.activate-qos-btn').forEach(btn => {
      btn.addEventListener('click', async function() {
        const groupId = this.dataset.groupId;
        const selectedDevices = Array.from(document.querySelectorAll(`.device-checkbox[data-group-id='${groupId}']:checked`)).map(cb => cb.dataset.deviceId);
        const resultDiv = document.getElementById(`qos-action-result-${groupId}`);
        if (selectedDevices.length === 0) {
          resultDiv.textContent = 'Please select at least one device.';
          resultDiv.classList.remove('text-success');
          resultDiv.classList.add('text-danger');
          return;
        }
        const group = (await fetchGroups()).find(g => g.id == groupId);
        const allDevices = await fetchDevices();
        const mappings = await fetchMappings();
        // Get user input value, or use mapped value if blank
        let qosProfileInput = document.querySelector(`.qos-profile-uuid[data-group-id='${groupId}']`).value;
        if (!qosProfileInput) {
          qosProfileInput = mappings[group.connectivityProfile] || group.connectivityProfile;
        }
        const appServerIp = document.querySelector(`.qos-appserver-ip[data-group-id='${groupId}']`).value || '172.20.120.84';
        const duration = parseInt(document.querySelector(`.qos-duration[data-group-id='${groupId}']`).value) || 600;
        const webhookUrl = document.querySelector(`.qos-webhook-url[data-group-id='${groupId}']`).value || 'https://webhook.site/669c8490-2f35-4561-8a3f-6c89618332ed';
        let troubleshootSection = document.getElementById('troubleshoot-api-section');
        let troubleshootReq = document.getElementById('troubleshoot-api-call');
        let troubleshootRes = document.getElementById('troubleshoot-api-response');
        
        // Check if troubleshoot elements exist
        if (!troubleshootSection || !troubleshootReq || !troubleshootRes) {
          console.error('Troubleshoot elements not found in DOM:', {
            section: !!troubleshootSection,
            request: !!troubleshootReq,
            response: !!troubleshootRes
          });
        } else {
          console.log('Troubleshoot panel initialized successfully');
        troubleshootSection.style.display = 'block';
        troubleshootReq.textContent = '';
        troubleshootRes.textContent = '';
        }
        let allPayloads = [];
        let allResponses = [];
        let html = '';
        let qosProfileUuid = qosProfileInput;
        
        // List of known good profile names that we can use directly
        const knownGoodProfiles = ['high', 'low', 'middle', 'medium', 'verylow', 'TestProfile', 
                                   'profile-10M', 'profile-6M', 'profile-5M', 'profile-4M', 
                                   'profile-3M', 'profile-7M', 'test'];
        
        // Create a proper request payload that we'll show in the troubleshoot panel
        const requestPayload = {
          duration: duration,
          device: {
            ipv4Address: {
              publicAddress: allDevices.find(d => d.id == selectedDevices[0])?.ipAddress || '0.0.0.0',
              privateAddress: allDevices.find(d => d.id == selectedDevices[0])?.ipAddress || '0.0.0.0'
            }
          },
          applicationServer: {
            ipv4Address: appServerIp
          },
          devicePorts: {
            ports: [50984]
          },
          applicationServerPorts: {
            ports: [10000]
          },
          qosProfile: qosProfileInput,
          webhook: {
            notificationUrl: webhookUrl
          }
        };
        
        // Store the JSON string of the request payload
        const requestPayloadString = JSON.stringify(requestPayload, null, 2);
        
        // Safe way to set content
        function safeSetTroubleshootContent(req, res) {
          console.log("Setting troubleshoot content:", { req: !!req, res: !!res });
          if (troubleshootReq) troubleshootReq.textContent = req || '';
          if (troubleshootRes) troubleshootRes.textContent = res || '';
          
          // If troubleshoot elements don't exist, display in result div as fallback
          if (!troubleshootReq || !troubleshootRes) {
            resultDiv.innerHTML += `
              <div class="mt-3 p-2 bg-light">
                <h6>Request JSON:</h6>
                <pre style="max-height:100px;overflow:auto;">${req || 'Not available'}</pre>
                <h6>Response:</h6>
                <pre style="max-height:100px;overflow:auto;">${res || 'Not available'}</pre>
              </div>
            `;
          }
        }
        
        // Always show the request payload initially
        safeSetTroubleshootContent(requestPayloadString, '');
        
        // If the input is a known good profile, we can bypass the UUID lookup entirely
        if (knownGoodProfiles.includes(qosProfileInput)) {
          console.log(`Using known good profile directly: ${qosProfileInput}`);
          qosProfileUuid = qosProfileInput;
        }
        // If it's not a UUID format, try to find the profile UUID
        else if (qosProfileInput && !/^[0-9a-fA-F-]{36}$/.test(qosProfileInput)) {
          // Not a UUID, try to use global cache first
          let profiles = window.qosProfilesCache;
          console.log('QoS profiles in cache:', profiles ? profiles.length : 'none');
          
          if (!profiles || !Array.isArray(profiles) || profiles.length === 0) {
            // Fallback: fetch from backend
            try {
              const storedTokenData = sessionStorage.getItem('oauth_token');
              console.log('OAuth token in session storage:', storedTokenData ? 'present' : 'missing');
              
              if (!storedTokenData) {
                resultDiv.textContent = 'No authentication token found. Please use the "Get Token" button in the Dev Tools panel first.';
                resultDiv.classList.remove('text-success');
                resultDiv.classList.add('text-danger');
                safeSetTroubleshootContent(requestPayloadString, JSON.stringify({error: 'No authentication token found'}, null, 2));
                return;
              }
              const tokenData = JSON.parse(storedTokenData);
              const accessToken = tokenData.access_token;
              const response = await fetch('/api/qos-profiles', {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Accept': 'application/json'
                }
              });
              if (!response.ok) {
                resultDiv.textContent = 'Failed to fetch QoS profiles for name-to-UUID conversion.';
                resultDiv.classList.remove('text-success');
                resultDiv.classList.add('text-danger');
                safeSetTroubleshootContent(requestPayloadString, JSON.stringify({error: 'Failed to fetch QoS profiles', status: response.status}, null, 2));
                return;
              }
              profiles = await response.json();
              window.qosProfilesCache = profiles;
            } catch (err) {
              resultDiv.textContent = 'Error fetching QoS profiles for name-to-UUID conversion.';
              resultDiv.classList.remove('text-success');
              resultDiv.classList.add('text-danger');
              safeSetTroubleshootContent(requestPayloadString, JSON.stringify({error: err.message}, null, 2));
              return;
            }
          }
          // Try to find by name
          console.log(`Looking for QoS profile: "${qosProfileInput}" in ${profiles.length} profiles`);
          console.log(`Available profiles:`, profiles);
          
          // Try exact match first
          let found = profiles.find(p => p.name === qosProfileInput);
          
          // If not found, try case-insensitive match
          if (!found) {
            found = profiles.find(p => p.name.toLowerCase() === qosProfileInput.toLowerCase());
            console.log(`Trying case-insensitive match, found:`, found);
          }
          
          if (found) {
            // Log the full profile object for debugging
            console.log(`Found profile object:`, found);
            
            // Check what identifier fields are available
            console.log(`Profile identification fields: id=${found.id}, uuid=${found.uuid}, profileId=${found.profileId}`);
            
            // If any ID field exists, use it
            if (found.id || found.uuid || found.profileId) {
              console.log(`Using UUID: ${found.id || found.uuid || found.profileId}`);
            qosProfileUuid = found.id || found.uuid || found.profileId;
            } 
            // If no ID field but name exists, just use the name directly with the API
            else if (found.name) {
              console.log(`No UUID found, using name directly: ${found.name}`);
              qosProfileUuid = found.name;
            }
          } else {
            resultDiv.textContent = `QoS profile name "${qosProfileInput}" not found. Please enter a valid UUID or profile name.`;
            resultDiv.classList.remove('text-success');
            resultDiv.classList.add('text-danger');
            safeSetTroubleshootContent(requestPayloadString, JSON.stringify({
              error: `QoS profile name "${qosProfileInput}" not found`,
              availableProfiles: profiles.map(p => p.name)
            }, null, 2));
            return;
          }
        }
        for (const deviceId of selectedDevices) {
          const device = allDevices.find(d => d.id == deviceId);
          const payload = {
            duration: duration,
            device: {
              ipv4Address: {
                publicAddress: device.ipAddress,
                privateAddress: device.ipAddress
              }
            },
            applicationServer: {
              ipv4Address: appServerIp
            },
            devicePorts: {
              ports: [50984]
            },
            applicationServerPorts: {
              ports: [10000]
            },
            qosProfile: qosProfileUuid || qosProfileInput || group.connectivityProfile || 'low',
            webhook: {
              notificationUrl: webhookUrl
            }
          };
          console.log(`Creating QoS session with profile: ${payload.qosProfile}`);
          allPayloads.push(payload);
          try {
            // Get token from sessionStorage (as in qos-profiles.js)
            let headers = { 'Content-Type': 'application/json' };
            const storedTokenData = sessionStorage.getItem('oauth_token');
            if (storedTokenData) {
              const tokenData = JSON.parse(storedTokenData);
              const accessToken = tokenData.access_token;
              headers['Authorization'] = `Bearer ${accessToken}`;
            }
            const res = await fetch('/api/qos/sessions', {
              method: 'POST',
              headers,
              body: JSON.stringify(payload)
            });
            const data = await res.json();
            allResponses.push(data);
            if (res.ok) {
              const sessionId = data.sessionId || data.id || '';
              const qosStatus = data.qosStatus || 'REQUESTED';
              const statusBadgeClass = getStatusBadgeClass(qosStatus);
              
              // Store the session information for persistence
              activeQoSSessions.push({
                sessionId,
                deviceIp: device.ipAddress,
                deviceName: device.name || device.ipAddress,
                qosStatus,
                isActive: qosStatus === 'ACTIVE' || qosStatus === 'AVAILABLE' || qosStatus === 'REQUESTED',
                timestamp: new Date().toISOString(),
                duration: duration,
                expirationNotified: false
              });
              saveActiveSessions();
              
              html += `<div class="qos-session-item" data-session-id="${sessionId}">
                <b>${device.name || device.ipAddress}:</b> Success. 
                <span>Session ID: ${sessionId || 'N/A'}</span>
                <span class="badge ${statusBadgeClass} ms-2 session-status" data-session-id="${sessionId}">${qosStatus}</span>
                ${sessionId ? `
                  <button class="btn btn-sm btn-outline-primary ms-2 refresh-status-btn" data-session-id="${sessionId}">
                    <i class="bi bi-arrow-clockwise"></i>
                  </button>
                  <button class="btn btn-sm btn-outline-danger ms-2 delete-session-btn" data-session-id="${sessionId}">
                    <i class="bi bi-trash"></i> Delete
                  </button>
                ` : ''}
              </div>`;
            } else {
              html += `<div><b>${device.name || device.ipAddress}:</b> Error. ${data.error || 'Unknown error'}</div>`;
            }
          } catch (err) {
            allResponses.push({ error: err.message });
            html += `<div><b>${device.name || device.ipAddress}:</b> Error. ${err.message}</div>`;
          }
        }
        // At the end, update both troubleshoot panels
        // Remove any direct assignment and just use our safe method
        safeSetTroubleshootContent(JSON.stringify(allPayloads, null, 2), JSON.stringify(allResponses, null, 2));
        resultDiv.innerHTML = html;
      });
    });

    // Add event listener for Delete Session and Refresh Status buttons
    contentArea.addEventListener('click', async function(event) {
      // Handle Delete Session
      if (event.target.closest('.delete-session-btn')) {
        const deleteBtn = event.target.closest('.delete-session-btn');
        const sessionId = deleteBtn.dataset.sessionId;
        
        if (!sessionId) {
          alert('No session ID found');
          return;
        }
        
        // Confirm deletion
        if (!confirm(`Are you sure you want to delete session ${sessionId}?`)) {
          return;
        }
        
        try {
          // Show loading state
          const originalText = deleteBtn.innerHTML;
          deleteBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Deleting...';
          deleteBtn.disabled = true;
          
          // Get token from sessionStorage
          let headers = { 'Content-Type': 'application/json' };
          const storedTokenData = sessionStorage.getItem('oauth_token');
          if (storedTokenData) {
            const tokenData = JSON.parse(storedTokenData);
            const accessToken = tokenData.access_token;
            headers['Authorization'] = `Bearer ${accessToken}`;
            console.log(`Using token for delete: ${accessToken.substring(0, 15)}...`);
          } else {
            console.warn('No OAuth token found in session storage');
          }
          
          console.log(`Sending DELETE request to: /api/qos/sessions/${sessionId}`);
          console.log('Headers:', headers);
          
          // Make the DELETE request
          const res = await fetch(`/api/qos/sessions/${sessionId}`, {
            method: 'DELETE',
            headers
          });
          
          console.log(`Delete response status: ${res.status}`);
          
          // Show result
          if (res.ok || res.status === 404) {
            console.log('Session successfully deleted');
            // Remove the session from our stored sessions
            activeQoSSessions = activeQoSSessions.filter(s => s.sessionId !== sessionId);
            saveActiveSessions();
            // Re-render the UI to reflect the change
            renderConnections();
            return;
          } else {
            // Show error and reset button
            const data = await res.json();
            console.error('Error response from server:', data);
            
            // Create a more detailed error message
            let errorMsg = `Error deleting session: ${data.error || 'Unknown error'}`;
            
            // Add details if available
            if (data.details) {
              errorMsg += `\nDetails: ${typeof data.details === 'object' ? JSON.stringify(data.details) : data.details}`;
            }
            
            // Add status code if available
            if (data.statusCode) {
              errorMsg += `\nStatus code: ${data.statusCode}`;
            }
            
            // Add URL if available
            if (data.url) {
              errorMsg += `\nAPI URL: ${data.url}`;
            }
            
            // Add session ID
            if (data.sessionId) {
              errorMsg += `\nSession ID: ${data.sessionId}`;
            }
            
            alert(errorMsg);
            deleteBtn.innerHTML = originalText;
            deleteBtn.disabled = false;
          }
        } catch (err) {
          console.error('Error in delete session request:', err);
          alert(`Error deleting session: ${err.message}`);
          // Reset button state
          deleteBtn.innerHTML = originalText;
          deleteBtn.disabled = false;
        }
      }
      
      // Handle Refresh Status
      if (event.target.closest('.refresh-status-btn')) {
        const refreshBtn = event.target.closest('.refresh-status-btn');
        const sessionId = refreshBtn.dataset.sessionId;
        
        if (!sessionId) {
          return;
        }
        
        try {
          // Show loading state
          const originalText = refreshBtn.innerHTML;
          refreshBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
          refreshBtn.disabled = true;
          
          // Get token from sessionStorage
          let headers = { 'Content-Type': 'application/json' };
          const storedTokenData = sessionStorage.getItem('oauth_token');
          if (storedTokenData) {
            const tokenData = JSON.parse(storedTokenData);
            const accessToken = tokenData.access_token;
            headers['Authorization'] = `Bearer ${accessToken}`;
          }
          
          // Check session status
          const res = await fetch(`/api/qos/sessions/${sessionId}/status`, {
            method: 'GET',
            headers
          });
          
          if (res.ok) {
            const data = await res.json();
            const statusBadge = document.querySelector(`.session-status[data-session-id="${sessionId}"]`);
            if (statusBadge) {
              // Update status badge
              statusBadge.textContent = data.qosStatus || 'UNKNOWN';
              statusBadge.className = `badge ms-2 session-status ${getStatusBadgeClass(data.qosStatus)}`;
              
              // Add active/inactive indicator
              const isActive = data.active === true;
              
              // Find or create an active indicator
              let activeIndicator = statusBadge.parentNode.querySelector('.active-indicator');
              if (!activeIndicator) {
                activeIndicator = document.createElement('span');
                activeIndicator.className = 'active-indicator ms-2';
                statusBadge.parentNode.insertBefore(activeIndicator, statusBadge.nextSibling);
              }
              
              // Update the indicator
              if (isActive) {
                activeIndicator.innerHTML = '<span class="text-success"><i class="bi bi-check-circle-fill"></i> Active</span>';
              } else {
                activeIndicator.innerHTML = '<span class="text-secondary"><i class="bi bi-x-circle-fill"></i> Inactive</span>';
              }
            }
            
            // Update the session in storage
            const sessionIndex = activeQoSSessions.findIndex(s => s.sessionId === sessionId);
            if (sessionIndex >= 0) {
              activeQoSSessions[sessionIndex].qosStatus = data.qosStatus || 'UNKNOWN';
              activeQoSSessions[sessionIndex].isActive = data.qosStatus === 'ACTIVE' || data.qosStatus === 'AVAILABLE' || data.qosStatus === 'REQUESTED';
              saveActiveSessions();
            }
          } else {
            alert('Failed to refresh status');
          }
        } catch (err) {
          console.error('Error refreshing status:', err);
        } finally {
          // Reset button state
          refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i>';
          refreshBtn.disabled = false;
        }
      }

      // Handle Extend Session button
      if (event.target.closest('.extend-session-btn')) {
        const extendBtn = event.target.closest('.extend-session-btn');
        const sessionId = extendBtn.dataset.sessionId;
        
        if (!sessionId) {
          alert('No session ID found');
          return;
        }
        
        // Find the session in our active sessions
        const session = activeQoSSessions.find(s => s.sessionId === sessionId);
        if (session) {
          showSessionExtensionModal(session);
        } else {
          alert('Session information not found');
        }
      }

      // Handle Clear All Sessions button
      if (event.target.closest('.clear-all-sessions-btn')) {
        if (confirm('Are you sure you want to clear all session records? This will not delete the actual QoS sessions on the server.')) {
          // Clear all sessions from local storage
          activeQoSSessions = [];
          saveActiveSessions();
          renderConnections();
        }
      }

      // Handle Refresh All Sessions button
      if (event.target.closest('.refresh-all-sessions-btn')) {
        const button = event.target.closest('.refresh-all-sessions-btn');
        // Show loading state
        const originalText = button.innerHTML;
        button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Refreshing...';
        button.disabled = true;
        
        // Refresh all session statuses
        await refreshAllSessionStatuses();
        
        // Re-render connections
        renderConnections();
      }

      // Handle Refresh Group Sessions button
      if (event.target.closest('.refresh-group-sessions-btn')) {
        const button = event.target.closest('.refresh-group-sessions-btn');
        const groupId = button.dataset.groupId;
        
        // Show loading state
        const originalText = button.innerHTML;
        button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Refreshing...';
        button.disabled = true;
        
        try {
          // Get all devices for this group
          const groupDevices = await fetchGroupDevices(groupId);
          const allDevices = await fetchDevices();
          const groupDeviceObjects = allDevices.filter(device => 
            groupDevices.some(gd => (gd.id || gd) === device.id)
          );
          
          // Get the IPs of all devices in this group
          const groupDeviceIPs = groupDeviceObjects.map(device => device.ipAddress).filter(ip => ip);
          
          // Refresh only sessions for devices in this group
          let sessionsUpdated = 0;
          
          // Get token from sessionStorage
          let headers = { 'Content-Type': 'application/json' };
          const storedTokenData = sessionStorage.getItem('oauth_token');
          if (storedTokenData) {
            const tokenData = JSON.parse(storedTokenData);
            const accessToken = tokenData.access_token;
            headers['Authorization'] = `Bearer ${accessToken}`;
          } else {
            throw new Error('No authorization token found');
          }
          
          // Check each session status
          for (let i = 0; i < activeQoSSessions.length; i++) {
            const session = activeQoSSessions[i];
            if (groupDeviceIPs.includes(session.deviceIp)) {
              try {
                const res = await fetch(`/api/qos/sessions/${session.sessionId}/status`, {
                  method: 'GET',
                  headers
                });
                
                if (res.ok) {
                  const data = await res.json();
                  // Update session status
                  activeQoSSessions[i].qosStatus = data.qosStatus || activeQoSSessions[i].qosStatus;
                  activeQoSSessions[i].isActive = 
                    data.qosStatus === 'ACTIVE' || 
                    data.qosStatus === 'AVAILABLE' || 
                    data.qosStatus === 'REQUESTED';
                  sessionsUpdated++;
                } else if (res.status === 404) {
                  // Session not found - it might have been deleted externally
                  activeQoSSessions[i].qosStatus = 'DELETED';
                  activeQoSSessions[i].isActive = false;
                  sessionsUpdated++;
                }
              } catch (error) {
                console.error(`Error refreshing status for session ${session.sessionId}:`, error);
              }
            }
          }
          
          // Save updated sessions
          saveActiveSessions();
          
          // Re-render connections to show the updated sessions
          renderConnections();
          
          // Show success message
          if (sessionsUpdated > 0) {
            const successMsg = document.createElement('div');
            successMsg.className = 'alert alert-success alert-dismissible fade show mt-2';
            successMsg.innerHTML = `
              <strong>Success!</strong> Updated ${sessionsUpdated} session(s).
              <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            `;
            button.parentNode.parentNode.parentNode.appendChild(successMsg);
            
            // Auto dismiss after 3 seconds
            setTimeout(() => {
              successMsg.classList.remove('show');
              setTimeout(() => successMsg.remove(), 150);
            }, 3000);
          }
          
        } catch (error) {
          console.error('Error refreshing group sessions:', error);
          alert(`Error refreshing sessions: ${error.message}`);
        } finally {
          // Reset button state
          button.innerHTML = originalText;
          button.disabled = false;
        }
      }
    });

    // Add Schedule QoS Boost button logic (actual scheduling)
    document.querySelectorAll('.schedule-qos-btn').forEach(btn => {
      btn.addEventListener('click', async function() {
        const groupId = this.dataset.groupId;
        const selectedDevices = Array.from(document.querySelectorAll(`.device-checkbox[data-group-id='${groupId}']:checked`)).map(cb => cb.dataset.deviceId);
        const startInput = document.querySelector(`.schedule-start[data-group-id='${groupId}']`);
        const endInput = document.querySelector(`.schedule-end[data-group-id='${groupId}']`);
        const resultDiv = document.getElementById(`qos-action-result-${groupId}`);
        
        if (selectedDevices.length === 0) {
          resultDiv.textContent = 'Please select at least one device.';
          resultDiv.classList.remove('text-success');
          resultDiv.classList.add('text-danger');
          return;
        }
        
        if (!startInput.value || !endInput.value) {
          resultDiv.textContent = 'Please select both start and end time.';
          resultDiv.classList.remove('text-success');
          resultDiv.classList.add('text-danger');
          return;
        }
        
        const startTime = new Date(startInput.value);
        const endTime = new Date(endInput.value);
        
        if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
          resultDiv.textContent = 'Invalid date format.';
          resultDiv.classList.remove('text-success');
          resultDiv.classList.add('text-danger');
          return;
        }
        
        if (startTime >= endTime) {
          resultDiv.textContent = 'End time must be after start time.';
          resultDiv.classList.remove('text-success');
          resultDiv.classList.add('text-danger');
          return;
        }
        
        const now = new Date();
        if (startTime < now) {
          resultDiv.textContent = 'Start time must be in the future.';
          resultDiv.classList.remove('text-success');
          resultDiv.classList.add('text-danger');
          return;
        }
        
        // Get additional parameters
        const appServerIp = document.querySelector(`.qos-appserver-ip[data-group-id='${groupId}']`).value || '172.20.120.84';
        const qosProfileUuid = document.querySelector(`.qos-profile-uuid[data-group-id='${groupId}']`).value || '';
        const webhookUrl = document.querySelector(`.qos-webhook-url[data-group-id='${groupId}']`).value || 'https://webhook.site/669c8490-2f35-4561-8a3f-6c89618332ed';
        
        // Calculate duration in seconds based on start and end time
        const durationInSeconds = Math.round((endTime.getTime() - startTime.getTime()) / 1000);
        
        // Create scheduled task
        const task = {
          groupId,
          devices: selectedDevices,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          duration: durationInSeconds, // Use calculated duration based on time difference
          appServerIp,
          qosProfile: qosProfileUuid,
          webhookUrl,
          started: false,
          sessionIds: []
        };
        
        // Add to scheduled tasks
        scheduledQoSTasks.push(task);
        saveScheduledTasks();
        
        // Setup timers
        setupScheduledTaskTimers();
        
        resultDiv.innerHTML = `<div class="alert alert-success small">
          <i class="bi bi-calendar-check"></i> QoS Boost scheduled for ${selectedDevices.length} device(s) from 
          ${startTime.toLocaleString()} to ${endTime.toLocaleString()} (${Math.round(durationInSeconds/60)} minutes)
        </div>`;
        resultDiv.classList.remove('text-danger');
        resultDiv.classList.add('text-success');
        
        // Request notification permissions if needed
        if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
          Notification.requestPermission();
        }
      });
    });
  }

  // Only render when the tab is shown
  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#connections') {
      renderConnections();
      // Add refresh of all active session statuses
      setTimeout(refreshAllSessionStatuses, 1000);
      // Start dynamic timer updates
      startDynamicTimerUpdates();
    } else {
      // Only stop if we're navigating away from connections
      if (window.location.hash !== '#connections') {
        stopSessionMonitor();
        stopDynamicTimerUpdates();
      }
    }
  });

  // Initial render if already on the tab
  if (window.location.hash === '#connections') {
    renderConnections();
    // Add refresh of all active session statuses
    setTimeout(refreshAllSessionStatuses, 1000);
    // Start dynamic timer updates
    startDynamicTimerUpdates();
  }

  window.renderConnections = renderConnections;

  // Add function to setup timers for scheduled tasks
  function setupScheduledTaskTimers() {
    // Clear any existing timers
    scheduledQoSTasks.forEach(task => {
      if (task.startTimerId) clearTimeout(task.startTimerId);
      if (task.endTimerId) clearTimeout(task.endTimerId);
    });
    
    const now = new Date().getTime();
    
    // Set up new timers for each task
    scheduledQoSTasks.forEach((task, index) => {
      const startTime = new Date(task.startTime).getTime();
      const endTime = new Date(task.endTime).getTime();
      
      // Remove tasks that have already ended
      if (endTime < now) {
        scheduledQoSTasks.splice(index, 1);
        return;
      }
      
      // Set up start timer if start time is in the future
      if (startTime > now) {
        task.startTimerId = setTimeout(() => executeScheduledStart(task), startTime - now);
        console.log(`Scheduled QoS start for ${task.devices.length} device(s) in ${Math.round((startTime - now)/1000)} seconds`);
      } else if (!task.started) {
        // If start time has passed but task hasn't started, start it immediately
        console.log(`Starting overdue QoS task for ${task.devices.length} device(s) from ${new Date(startTime).toLocaleString()}`);
        executeScheduledStart(task);
      }
      
      // Set up end timer if the task has been started or will be started
      if (task.started || startTime > now) {
        task.endTimerId = setTimeout(() => executeScheduledEnd(task), endTime - now);
        console.log(`Scheduled QoS end in ${Math.round((endTime - now)/60000)} minutes`);
      }
    });
    
    // Save updated tasks
    saveScheduledTasks();
  }

  // Add function to execute scheduled start
  async function executeScheduledStart(task) {
    // Format duration for logging
    const hours = Math.floor(task.duration / 3600);
    const minutes = Math.floor((task.duration % 3600) / 60);
    const durationFormatted = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    
    console.log(`Executing scheduled QoS start for ${task.devices.length} device(s) with duration of ${durationFormatted}`, task);
    task.started = true;
    saveScheduledTasks();
    
    // Execute the QoS boost
    try {
      // Get the group and devices
      const groups = await fetchGroups();
      const allDevices = await fetchDevices();
      const mappings = await fetchMappings();
      const group = groups.find(g => g.id == task.groupId);
      
      if (!group) {
        console.error(`Group ${task.groupId} not found for scheduled task`);
        return;
      }
      
      // Prepare payload for each device
      let headers = { 'Content-Type': 'application/json' };
      const storedTokenData = sessionStorage.getItem('oauth_token');
      if (storedTokenData) {
        const tokenData = JSON.parse(storedTokenData);
        const accessToken = tokenData.access_token;
        headers['Authorization'] = `Bearer ${accessToken}`;
      } else {
        console.error('No OAuth token found for scheduled QoS task');
        return;
      }
      
      // Create sessions for each device
      const sessionIds = [];
      for (const deviceId of task.devices) {
        const device = allDevices.find(d => d.id == deviceId);
        if (!device || !device.ipAddress) {
          console.error(`Device ${deviceId} not found or has no IP address:`, device);
          continue;
        }
        
        // Get the QoS profile with proper mapping - IMPORTANT: This matches the manual activation logic
        let qosProfileUuid = task.qosProfile;
        if (!qosProfileUuid) {
          // If no explicit profile was provided, use the mapped value from group's connectivity profile
          qosProfileUuid = mappings[group.connectivityProfile] || 'low';
        }
        
        console.log(`Using QoS profile for scheduled task: '${qosProfileUuid}'`);
        
        // Use the list of known good profiles as in manual activation
        const knownGoodProfiles = ['high', 'low', 'middle', 'medium', 'verylow', 'TestProfile', 
                                   'profile-10M', 'profile-6M', 'profile-5M', 'profile-4M', 
                                   'profile-3M', 'profile-7M', 'test'];
        
        // If it's not a known good profile and not a UUID, try to find a proper mapping
        if (!knownGoodProfiles.includes(qosProfileUuid) && !/^[0-9a-fA-F-]{36}$/.test(qosProfileUuid)) {
          console.log(`Profile '${qosProfileUuid}' is not a known good profile or UUID, trying to map it`);
          // For now, just use 'low' as the fallback
          qosProfileUuid = 'low';
          console.log(`Mapped to safe default: '${qosProfileUuid}'`);
        }
        
        // Create the payload exactly matching the format of the manual activation
        const payload = {
          duration: parseInt(task.duration),
          device: {
            ipv4Address: {
              publicAddress: device.ipAddress,
              privateAddress: device.ipAddress
            }
          },
          applicationServer: {
            ipv4Address: task.appServerIp
          },
          devicePorts: {
            ports: [50984]
          },
          applicationServerPorts: {
            ports: [10000]
          },
          qosProfile: qosProfileUuid,
          webhook: {
            notificationUrl: task.webhookUrl
          }
        };
        
        console.log('Sending scheduled QoS payload:', JSON.stringify(payload, null, 2));
        
        try {
          const res = await fetch('/api/qos/sessions', {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
          });
          
          if (res.ok) {
            const data = await res.json();
            console.log('Scheduled QoS session created successfully:', data);
            const sessionId = data.sessionId || data.id || '';
            if (sessionId) {
              sessionIds.push(sessionId);
              
              // Store session in activeQoSSessions
              activeQoSSessions.push({
                sessionId,
                deviceIp: device.ipAddress,
                deviceName: device.name || device.ipAddress,
                qosStatus: data.qosStatus || 'REQUESTED',
                isActive: true,
                timestamp: new Date().toISOString(),
                duration: parseInt(task.duration),
                expirationNotified: false
              });
            }
          } else {
            const errorData = await res.json();
            console.error(`Error creating scheduled QoS session:`, errorData);
            
            // Try to get more detailed error info
            let errorMessage = `Failed to create scheduled QoS session: ${errorData.error || 'Unknown error'}`;
            if (errorData.details) {
              console.error('Error details:', errorData.details);
              errorMessage += ` - Details: ${JSON.stringify(errorData.details)}`;
            }
            
            // If notification is available, show error notification
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("QNow Platform - Error", {
                body: errorMessage
              });
            }
          }
        } catch (error) {
          console.error(`Error in scheduled QoS creation:`, error);
        }
      }
      
      // Update task with session IDs for deletion later
      task.sessionIds = sessionIds;
      saveScheduledTasks();
      saveActiveSessions();
      
      // Re-render if we're on the connections page
      if (window.location.hash === '#connections') {
        renderConnections();
      } else {
        // Create a notification
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("QNow Platform", {
            body: `Scheduled QoS boost activated for ${sessionIds.length} devices in group ${group.name}`
          });
        }
      }
      
    } catch (error) {
      console.error('Error executing scheduled QoS task:', error);
    }
  }

  // Add function to execute scheduled end
  async function executeScheduledEnd(task) {
    console.log(`Executing scheduled QoS end for task with ${task.sessionIds ? task.sessionIds.length : 0} sessions`);
    
    // Delete all sessions created by this task
    if (task.sessionIds && task.sessionIds.length > 0) {
      // Prepare headers
      let headers = { 'Content-Type': 'application/json' };
      const storedTokenData = sessionStorage.getItem('oauth_token');
      if (storedTokenData) {
        const tokenData = JSON.parse(storedTokenData);
        const accessToken = tokenData.access_token;
        headers['Authorization'] = `Bearer ${accessToken}`;
      } else {
        console.error('No OAuth token found for scheduled QoS end task');
      }
      
      // Delete each session
      for (const sessionId of task.sessionIds) {
        try {
          await fetch(`/api/qos/sessions/${sessionId}`, {
            method: 'DELETE',
            headers
          });
          
          // Update the session in activeQoSSessions
          const sessionIndex = activeQoSSessions.findIndex(s => s.sessionId === sessionId);
          if (sessionIndex >= 0) {
            activeQoSSessions[sessionIndex].qosStatus = 'DELETED';
            activeQoSSessions[sessionIndex].isActive = false;
          }
        } catch (error) {
          console.error(`Error deleting scheduled session ${sessionId}:`, error);
        }
      }
      
      // Save sessions
      saveActiveSessions();
      
      // Re-render if we're on the connections page
      if (window.location.hash === '#connections') {
        renderConnections();
      } else {
        // Create a notification
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("QNow Platform", {
            body: `Scheduled QoS boost ended for ${task.sessionIds.length} devices`
          });
        }
      }
    }
    
    // Remove this task
    const taskIndex = scheduledQoSTasks.findIndex(t => 
      t.startTime === task.startTime && 
      t.endTime === task.endTime && 
      t.groupId === task.groupId
    );
    
    if (taskIndex >= 0) {
      scheduledQoSTasks.splice(taskIndex, 1);
      saveScheduledTasks();
    }
  }

  // Add utility function for viewing scheduled tasks
  function getScheduledTasks() {
    console.log('Currently scheduled tasks:', scheduledQoSTasks);
    return scheduledQoSTasks;
  }

  // Make it available in the global scope for debugging
  window.getScheduledTasks = getScheduledTasks;

  // Function to notify user about session expiring soon
  function notifySessionExpiringSoon(session) {
    // Check if notifications are supported and permitted
    if ("Notification" in window && Notification.permission === "granted") {
      const secondsRemaining = Math.ceil((new Date(session.timestamp).getTime() + (session.duration * 1000) - new Date().getTime()) / 1000);
      
      const notification = new Notification("QoS Session Expiring Soon", {
        body: `Your QoS session for ${session.deviceName || session.deviceIp} will expire in approximately ${secondsRemaining} seconds. Click here to extend it.`,
        icon: "/favicon.ico",
        tag: `qos-expiring-${session.sessionId}`
      });
      
      // When notification is clicked, show extension modal
      notification.onclick = function() {
        showSessionExtensionModal(session);
        notification.close();
      };
    }
    
    // Also show an on-screen alert if we're on the connections page
    if (window.location.hash === '#connections') {
      const secondsRemaining = Math.ceil((new Date(session.timestamp).getTime() + (session.duration * 1000) - new Date().getTime()) / 1000);
      const alertId = `session-expiring-alert-${session.sessionId}`;
      // Check if alert already exists
      if (!document.getElementById(alertId)) {
        const alertHtml = `
          <div id="${alertId}" class="alert alert-warning alert-dismissible fade show" role="alert">
            <strong>Session Expiring!</strong> Your QoS session for ${session.deviceName || session.deviceIp} will expire in approximately ${secondsRemaining} seconds.
            <div class="mt-2">
              <button type="button" class="btn btn-sm btn-primary extend-session-btn" data-session-id="${session.sessionId}">
                <i class="bi bi-lightning-charge"></i> Extend Session
              </button>
              <span class="ms-2 small text-muted">Session ID: ${session.sessionId}</span>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
          </div>
        `;
        
        // Find an appropriate place to add the alert
        const alertContainer = document.getElementById('alert-container');
        if (alertContainer) {
          alertContainer.innerHTML += alertHtml;
        } else {
          // Fallback: add to content area
          const contentArea = document.getElementById('connections-content-area');
          if (contentArea) {
            contentArea.insertAdjacentHTML('beforebegin', alertHtml);
          }
        }
        
        // Set up the button event handler
        const extendBtn = document.querySelector(`#${alertId} .extend-session-btn`);
        if (extendBtn) {
          extendBtn.addEventListener('click', function() {
            showSessionExtensionModal(session);
          });
        }
      }
    }
  }

  // Function to show the session extension modal
  function showSessionExtensionModal(session) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('session-extension-modal');
    if (!modal) {
      const modalHtml = `
        <div class="modal fade" id="session-extension-modal" tabindex="-1" aria-labelledby="extension-modal-label" aria-hidden="true">
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title" id="extension-modal-label">Extend QoS Session</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                <p>Extend QoS session for <strong id="extension-device-name"></strong></p>
                <p class="text-muted">Session ID: <span id="extension-session-id" class="text-monospace"></span></p>
                <form>
                  <div class="mb-3">
                    <label for="extension-duration" class="form-label">Additional Duration (seconds)</label>
                    <input type="number" class="form-control" id="extension-duration" value="1200" min="60" max="86400">
                  </div>
                </form>
                <div id="extension-result" class="mt-3"></div>
                
                <!-- API Troubleshooting Section -->
                <div id="extension-troubleshooting" class="mt-4 border-top pt-3 d-none">
                  <h6><i class="bi bi-bug"></i> API Troubleshooting</h6>
                  <div class="row">
                    <div class="col-md-6">
                      <div class="card bg-light mb-3">
                        <div class="card-header">API Request</div>
                        <div class="card-body">
                          <pre id="extension-api-request" class="mb-0" style="max-height: 200px; overflow-y: auto; font-size: 12px;"></pre>
                        </div>
                      </div>
                    </div>
                    <div class="col-md-6">
                      <div class="card bg-light">
                        <div class="card-header">API Response</div>
                        <div class="card-body">
                          <pre id="extension-api-response" class="mb-0" style="max-height: 200px; overflow-y: auto; font-size: 12px;"></pre>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-primary" id="confirm-extension-btn">Extend Session</button>
              </div>
            </div>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      modal = document.getElementById('session-extension-modal');
    }
    
    // Set the session ID and device name
    const deviceNameEl = document.getElementById('extension-device-name');
    const sessionIdEl = document.getElementById('extension-session-id');
    
    if (deviceNameEl) {
      deviceNameEl.textContent = session.deviceName || session.deviceIp;
    }
    
    if (sessionIdEl) {
      sessionIdEl.textContent = session.sessionId;
    }
    
    // Reset troubleshooting section
    const troubleshootingSection = document.getElementById('extension-troubleshooting');
    const apiRequestEl = document.getElementById('extension-api-request');
    const apiResponseEl = document.getElementById('extension-api-response');
    
    if (troubleshootingSection) troubleshootingSection.classList.add('d-none');
    if (apiRequestEl) apiRequestEl.textContent = '';
    if (apiResponseEl) apiResponseEl.textContent = '';
    
    // Reset result area
    const resultDiv = document.getElementById('extension-result');
    if (resultDiv) resultDiv.innerHTML = '';
    
    // Set up the confirm button
    const confirmBtn = document.getElementById('confirm-extension-btn');
    if (confirmBtn) {
      // Remove any existing event listeners
      const newBtn = confirmBtn.cloneNode(true);
      confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
      
      // Add new event listener with this session
      newBtn.addEventListener('click', async function() {
        await extendSession(session.sessionId);
      });
    }
    
    // Show the modal
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
  }

  // Function to extend a session via API
  async function extendSession(sessionId) {
    const durationInput = document.getElementById('extension-duration');
    const resultDiv = document.getElementById('extension-result');
    const confirmBtn = document.getElementById('confirm-extension-btn');
    const troubleshootingSection = document.getElementById('extension-troubleshooting');
    const apiRequestEl = document.getElementById('extension-api-request');
    const apiResponseEl = document.getElementById('extension-api-response');
    
    if (!durationInput || !resultDiv || !confirmBtn) {
      console.error('Missing extension modal elements');
      return;
    }
    
    const additionalDuration = parseInt(durationInput.value) || 1200;
    
    // Show loading state
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Extending...';
    resultDiv.innerHTML = '<div class="alert alert-info">Extending session...</div>';
    
    // Hide troubleshooting section initially
    if (troubleshootingSection) troubleshootingSection.classList.add('d-none');
    if (apiRequestEl) apiRequestEl.textContent = '';
    if (apiResponseEl) apiResponseEl.textContent = '';
    
    try {
      // Get token from sessionStorage
      let headers = { 
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      };
      
      const storedTokenData = sessionStorage.getItem('oauth_token');
      if (storedTokenData) {
        const tokenData = JSON.parse(storedTokenData);
        const accessToken = tokenData.access_token;
        headers['Authorization'] = `Bearer ${accessToken}`;
      } else {
        throw new Error('No authorization token found');
      }
      
      // Create the payload using the field name expected by the Orange API
      const payload = {
        duration: additionalDuration,
        requestedAdditionalDuration: additionalDuration  // For the Orange API
      };
      
      console.log(`Sending extension request for session ${sessionId} with duration ${additionalDuration} seconds`);
      
      // Make the API call to extend the session
      const res = await fetch(`/api/qos/sessions/${sessionId}/extend`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        const data = await res.json();
        
        // Show troubleshooting data if available
        if (data.apiRequest || data.apiResponse) {
          if (troubleshootingSection) troubleshootingSection.classList.remove('d-none');
          
          if (apiRequestEl && data.apiRequest) {
            apiRequestEl.textContent = JSON.stringify(data.apiRequest, null, 2);
          }
          
          if (apiResponseEl && data.apiResponse) {
            apiResponseEl.textContent = JSON.stringify(data.apiResponse, null, 2);
          }
        }
        
        // Check if this was extended via the Orange API or just locally
        if (data.apiResponse) {
          resultDiv.innerHTML = '<div class="alert alert-success"><i class="bi bi-check-circle"></i> Session extended successfully on Orange API!</div>';
          console.log('Orange API extension successful:', data.apiResponse);
        } else if (data.warning) {
          resultDiv.innerHTML = `<div class="alert alert-warning"><i class="bi bi-exclamation-triangle"></i> Session extended locally but API update failed: ${data.error}</div>`;
          console.warn('Orange API extension failed but local update succeeded:', data);
          
          // Show error details in troubleshooting section
          if (troubleshootingSection) troubleshootingSection.classList.remove('d-none');
          if (apiResponseEl && data.apiError) {
            apiResponseEl.textContent = JSON.stringify(data.apiError, null, 2);
          }
        } else {
          resultDiv.innerHTML = '<div class="alert alert-success">Session extended successfully!</div>';
        }
        
        // Update the session in our local storage
        const sessionIndex = activeQoSSessions.findIndex(s => s.sessionId === sessionId);
        if (sessionIndex >= 0) {
          // Update duration, reset expiration notification flag
          if (!activeQoSSessions[sessionIndex].duration) {
            activeQoSSessions[sessionIndex].duration = additionalDuration;
          } else {
            activeQoSSessions[sessionIndex].duration += additionalDuration;
          }
          activeQoSSessions[sessionIndex].expirationNotified = false;
          saveActiveSessions();
        }
        
        // Refresh the UI if on connections page
        if (window.location.hash === '#connections') {
          setTimeout(() => {
            renderConnections();
          }, 2000);
        }
        
        // Don't close the modal automatically if we're showing troubleshooting info
        if (!data.apiRequest && !data.apiResponse) {
          // Close the modal after 2 seconds
          setTimeout(() => {
            const modal = bootstrap.Modal.getInstance(document.getElementById('session-extension-modal'));
            if (modal) {
              modal.hide();
            }
          }, 2000);
        }
      } else {
        // Handle error
        let errorMessage = 'Failed to extend session';
        let errorDetails = null;
        
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
          
          // If there's detailed API error information, show it
          if (errorData.apiError) {
            console.error('Orange API error details:', errorData.apiError);
            errorMessage += ` - API Error: ${errorData.apiError.message || 'Unknown API error'}`;
            errorDetails = errorData.apiError;
            
            // Show error details in troubleshooting section
            if (troubleshootingSection) troubleshootingSection.classList.remove('d-none');
            if (apiResponseEl) {
              apiResponseEl.textContent = JSON.stringify(errorData.apiError, null, 2);
            }
          }
        } catch (e) {
          console.error('Failed to parse error response:', e);
        }
        
        resultDiv.innerHTML = `<div class="alert alert-danger">Error: ${errorMessage}</div>`;
      }
    } catch (error) {
      console.error('Error extending session:', error);
      resultDiv.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
    } finally {
      // Reset button state
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = 'Extend Session';
    }
  }

  // Add global session check interval
  let sessionMonitorInterval;

  function startSessionMonitor() {
    // Clear any existing interval
    if (sessionMonitorInterval) {
      clearInterval(sessionMonitorInterval);
    }
    
    // Check for expiring sessions every 5 seconds
    sessionMonitorInterval = setInterval(refreshAllSessionStatuses, 5000);
    console.log('Session monitor started');
  }

  function stopSessionMonitor() {
    if (sessionMonitorInterval) {
      clearInterval(sessionMonitorInterval);
      sessionMonitorInterval = null;
      console.log('Session monitor stopped');
    }
  }

  // Only start the monitor when page loads if there are active sessions
  if (activeQoSSessions.some(s => s.isActive)) {
    startSessionMonitor();
  }

  // Add listeners for page visibility
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
      // Start monitoring sessions when page becomes visible
      if (activeQoSSessions.some(s => s.isActive)) {
        startSessionMonitor();
        // Also start dynamic timer updates
        startDynamicTimerUpdates();
      }
    } else {
      // Stop monitoring when page is hidden to save resources
      stopSessionMonitor();
      stopDynamicTimerUpdates();
    }
  });

  // Add listener for connection tab activation/deactivation
  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#connections') {
      renderConnections();
      // Start the session monitor
      startSessionMonitor();
    } else {
      // Only stop if we're navigating away from connections
      if (window.location.hash !== '#connections') {
        stopSessionMonitor();
      }
    }
  });

  // Add a function to update time remaining displays
  function updateRemainingTimeDisplays() {
    const now = new Date().getTime();
    const sessionElements = document.querySelectorAll('.qos-session-item');
    
    sessionElements.forEach(element => {
      const sessionId = element.dataset.sessionId;
      const sessionIndex = activeQoSSessions.findIndex(s => s.sessionId === sessionId);
      
      if (sessionIndex >= 0 && activeQoSSessions[sessionIndex].isActive) {
        const session = activeQoSSessions[sessionIndex];
        
        if (session.timestamp && session.duration) {
          const startTime = new Date(session.timestamp).getTime();
          const expirationTime = startTime + (session.duration * 1000);
          const timeRemaining = expirationTime - now;
          
          if (timeRemaining > 0) {
            const secondsRemaining = Math.floor(timeRemaining / 1000);
            const minutesRemaining = Math.floor(secondsRemaining / 60);
            const secondsDisplay = secondsRemaining % 60;
            
            // Format time display with leading zeros for seconds
            const formattedSeconds = secondsDisplay < 10 ? `0${secondsDisplay}` : secondsDisplay;
            const timeDisplay = `${minutesRemaining}m ${formattedSeconds}s Left`;
            
            // Update all time remaining elements for this session
            const timeElements = element.querySelectorAll('.time-remaining, .time-remaining-badge');
            
            timeElements.forEach(timeElement => {
              // Update the text content
              timeElement.textContent = timeDisplay;
              
              // Apply appropriate styling based on time remaining
              if (secondsRemaining < 30) {
                timeElement.className = timeElement.className.replace(/bg-\w+/g, 'bg-danger');
                
                // Add pulse animation for urgent countdown
                if (!timeElement.classList.contains('pulse-animation')) {
                  timeElement.classList.add('pulse-animation');
                }
              } else if (secondsRemaining < 60) {
                timeElement.className = timeElement.className.replace(/bg-\w+/g, 'bg-warning');
                // Remove pulse animation
                timeElement.classList.remove('pulse-animation');
              } else {
                timeElement.className = timeElement.className.replace(/bg-\w+/g, 'bg-info');
                // Remove pulse animation
                timeElement.classList.remove('pulse-animation');
              }
            });
          } else {
            // Time expired, update display
            const timeElements = element.querySelectorAll('.time-remaining, .time-remaining-badge');
            
            timeElements.forEach(timeElement => {
              timeElement.textContent = 'Expired';
              timeElement.className = timeElement.className.replace(/bg-\w+/g, 'bg-secondary');
              timeElement.classList.remove('pulse-animation');
            });
            
            // Also update session status if needed
            if (activeQoSSessions[sessionIndex].isActive) {
              const statusElements = element.querySelectorAll(`.session-status[data-session-id="${sessionId}"]`);
              statusElements.forEach(statusElement => {
                statusElement.textContent = 'EXPIRED';
                statusElement.className = 'badge bg-secondary session-status';
              });
              
              // Update the session object
              activeQoSSessions[sessionIndex].isActive = false;
              activeQoSSessions[sessionIndex].qosStatus = 'EXPIRED';
              
              // Save the updated sessions
              saveActiveSessions();
            }
          }
        }
      }
    });
  }

  // Update the timing display in the table for active sessions
  let timerUpdateInterval;

  function startDynamicTimerUpdates() {
    // Clear any existing interval first to avoid duplicate timers
    stopDynamicTimerUpdates();
    
    // Update the timers every second
    timerUpdateInterval = setInterval(updateRemainingTimeDisplays, 1000);
    console.log('Dynamic timer updates started');
  }

  function stopDynamicTimerUpdates() {
    if (timerUpdateInterval) {
      clearInterval(timerUpdateInterval);
      timerUpdateInterval = null;
      console.log('Dynamic timer updates stopped');
    }
  }

  // Ensure dynamic time updates are active when connections page is loaded
  if (typeof window.updateAllCountdowns === 'function') {
    setTimeout(window.updateAllCountdowns, 100);
  } else if (typeof updateAllCountdowns === 'function') {
    setTimeout(updateAllCountdowns, 100);
  } else {
    console.warn('Countdown update function not found. Dynamic timers may not work.');
  }
  
  // Start dynamic timer updates
  startDynamicTimerUpdates();
});

// Add a helper function to map QoS status to bootstrap badge classes
function getStatusBadgeClass(status) {
  switch (status) {
    case 'REQUESTED':
      return 'bg-warning text-dark';
    case 'AVAILABLE':
      return 'bg-success';
    case 'ACTIVE':
      return 'bg-success';
    case 'UNAVAILABLE':
      return 'bg-danger';
    case 'EXPIRED':
      return 'bg-secondary';
    case 'DELETED':
      return 'bg-secondary';
    default:
      return 'bg-info';
  }
}

// Function to activate a QoS boost
async function activateQosBoost(groupId) {
  try {
    document.getElementById('troubleshoot-api-section').style.display = 'none'; // Hide troubleshoot section
    const group = groups.find(g => g.id === groupId);
    
    // Get values from the form
    const duration = document.getElementById(`duration-${groupId}`).value;
    const appServerIpv4 = document.getElementById(`app-server-ipv4-${groupId}`).value;
    const qosProfileUuid = document.getElementById(`qos-profile-uuid-${groupId}`).value;
    const webhookUrl = document.getElementById(`webhook-url-${groupId}`).value;
    
    // Get selected devices
    const deviceCheckboxes = document.querySelectorAll(`input[type="checkbox"][name="device-${groupId}"]:checked`);
    if (deviceCheckboxes.length === 0) {
      showAlert(`Please select at least one device for ${group.name}`, 'warning');
      return;
    }
    
    const deviceIds = Array.from(deviceCheckboxes).map(checkbox => checkbox.value);
    
    // Validate required fields
    if (!duration || !appServerIpv4 || !qosProfileUuid) {
      showAlert('Please fill in all required fields', 'warning');
      return;
    }
    
    // Get the token
    const storedTokenData = localStorage.getItem('orange_api_token');
    if (!storedTokenData) {
      showAlert('No authorization token found. Please use the "Get Token" button in the Dev Tools panel first.', 'warning');
      return;
    }
    
    // Parse the token
    const tokenData = JSON.parse(storedTokenData);
    const accessToken = tokenData.access_token;
    
    // Show loading state
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'text-center py-3';
    loadingDiv.innerHTML = `
      <div class="spinner-border text-primary"></div>
      <p>Activating QoS boost for ${group.name}...</p>
    `;
    document.getElementById(`boost-form-${groupId}`).appendChild(loadingDiv);
    
    // Prepare request payload
    const payload = {
      duration: parseInt(duration),
      qosProfile: qosProfileUuid,
      deviceIds,
      ipv4Address: appServerIpv4
    };
    
    if (webhookUrl) {
      payload.webhook = {
        notificationUrl: webhookUrl
      };
    }
    
    // Set up troubleshoot content
    safeSetTroubleshootContent(JSON.stringify(payload, null, 2), 'Sending request...');
    document.getElementById('troubleshoot-api-section').style.display = 'block';
    
    // Call the API
    const response = await fetch('/api/qos/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    // Parse response
    const responseData = await response.json();
    safeSetTroubleshootContent(JSON.stringify(payload, null, 2), JSON.stringify(responseData, null, 2));
    
    // Remove loading state
    loadingDiv.remove();
    
    if (response.ok) {
      showAlert(`Successfully activated QoS boost for ${group.name}. Session ID: ${responseData.id}`, 'success');
      
      // Store the session information
      const selectedDevices = deviceCheckboxes.length === 1 ? 
        allDevices.find(d => d.id === deviceIds[0])?.name || 'Device' :
        `${deviceCheckboxes.length} devices in ${group.name}`;
        
      // Create a new session entry
      const session = {
        sessionId: responseData.id,
        deviceName: selectedDevices,
        qosStatus: 'ACTIVE',
        isActive: true,
        timestamp: new Date().toISOString(),
        duration: parseInt(duration),
        groupId,
        deviceIds,
        appServerIpv4,
        qosProfileUuid,
        webhookUrl,
        expirationNotified: false
      };
      
      // Add to the active sessions
      activeQoSSessions.push(session);
      
      // Save to localStorage
      saveActiveSessions();
      
      // Dispatch an event for the QoS session manager to pick up
      const sessionEvent = new CustomEvent('qosSessionCreated', {
        detail: { session }
      });
      document.dispatchEvent(sessionEvent);
    } else {
      showAlert(`Failed to activate QoS boost: ${responseData.error || responseData.message || 'Unknown error'}`, 'danger');
    }
  } catch (error) {
    console.error('Error activating QoS boost:', error);
    showAlert(`Error: ${error.message}`, 'danger');
  }
}

function renderSessionsSection(containerId) {
  // First check if we have any active sessions
  loadActiveSessions(); // Ensure we have the latest from localStorage
  
  // If no sessions, show a message
  if (activeQoSSessions.length === 0) {
    return `
      <div class="card mb-4">
        <div class="card-header d-flex justify-content-between align-items-center">
          <h6 class="mb-0">Active QoS Sessions</h6>
          <button class="btn btn-sm btn-outline-primary refresh-sessions-btn">
            <i class="bi bi-arrow-clockwise"></i> Refresh
          </button>
        </div>
        <div class="card-body">
          <div class="alert alert-info">
            <i class="bi bi-info-circle"></i> QoS sessions will automatically show notifications when they're about to expire.
            No active sessions found. Use the form above to activate a QoS boost.
          </div>
        </div>
      </div>
    `;
  }
  
  // Create session list
  let sessionsHtml = `
    <div class="card mb-4">
      <div class="card-header d-flex justify-content-between align-items-center">
        <h6 class="mb-0">Active QoS Sessions</h6>
        <button class="btn btn-sm btn-outline-primary refresh-sessions-btn">
          <i class="bi bi-arrow-clockwise"></i> Refresh
        </button>
      </div>
      <div class="card-body">
        <div class="alert alert-info">
          <i class="bi bi-info-circle"></i> QoS sessions will automatically show notifications when they're about to expire.
          You can click the <strong>Extend</strong> button to add more time to an active session.
        </div>
        <div class="table-responsive">
          <table class="table table-hover">
            <thead>
              <tr>
                <th>Device</th>
                <th>Session ID</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
  `;
  
  const now = new Date().getTime();
  
  // Add each session
  activeQoSSessions.forEach(session => {
    const isActive = session.isActive;
    const statusClass = getStatusBadgeClass(session.qosStatus);
    
    // Calculate remaining time
    let remainingTimeDisplay = '';
    if (isActive && session.timestamp && session.duration) {
      const startTime = new Date(session.timestamp).getTime();
      const expirationTime = startTime + (session.duration * 1000);
      const timeRemaining = expirationTime - now;
      
      if (timeRemaining > 0) {
        const minutesRemaining = Math.floor(timeRemaining / 60000);
        const secondsRemaining = Math.floor((timeRemaining % 60000) / 1000);
        remainingTimeDisplay = `${minutesRemaining}m ${secondsRemaining}s Left`;
      }
    }
    
    sessionsHtml += `
      <tr class="qos-session-item" data-session-id="${session.sessionId}">
        <td>${session.deviceName}</td>
        <td style="font-family: monospace;">${session.sessionId}</td>
        <td>
          <span class="session-status badge ${statusClass}">${session.qosStatus}</span>
          ${isActive ? `<span class="active-indicator badge bg-success ms-1">Active</span>` : ''}
          ${isActive && remainingTimeDisplay ? `<span class="badge bg-info ms-1 time-remaining">${remainingTimeDisplay}</span>` : ''}
        </td>
        <td>${new Date(session.timestamp).toLocaleString()}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary refresh-session-btn" data-session-id="${session.sessionId}">
            <i class="bi bi-arrow-clockwise"></i>
          </button>
          ${isActive ? `
            <button class="btn btn-sm btn-success extend-session-btn" data-session-id="${session.sessionId}">
              <i class="bi bi-plus-circle"></i> Extend
            </button>
          ` : ''}
          <button class="btn btn-sm btn-danger delete-session-btn" data-session-id="${session.sessionId}">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `;
  });
  
  sessionsHtml += `
            </tbody>
          </table>
        </div>
        <div class="text-end mt-3">
          <button class="btn btn-sm btn-outline-danger clear-all-sessions-btn">Clear Session Records</button>
        </div>
      </div>
    </div>
  `;
  
  return sessionsHtml;
} 