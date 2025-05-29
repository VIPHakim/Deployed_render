/**
 * QNow Platform - QoS Profiles Viewer
 * Handles fetching and displaying QoS profiles using localStorage token
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const refreshProfilesBtn = document.getElementById('refresh-qos-profiles-btn');
  const qosProfilesContainer = document.getElementById('qos-profiles-container');
  const statusMessageContainer = document.getElementById('status-message');
  
  // Initialize
  loadQosProfiles();
  
  // Event listener for refresh button
  if (refreshProfilesBtn) {
    refreshProfilesBtn.addEventListener('click', loadQosProfiles);
  }
  
  /**
   * Fetches QoS profiles from the Orange API using localStorage token
   */
  async function loadQosProfiles() {
    try {
      showStatusMessage('Loading QoS profiles...', 'info');
      
      // Get token from localStorage
      const storedToken = localStorage.getItem('orange_api_token');
      if (!storedToken) {
        showStatusMessage('No authentication token found. Please use the Developer Tools to get a token first.', 'danger');
        return;
      }
      
      // Parse the token
      const tokenData = JSON.parse(storedToken);
      const accessToken = tokenData.access_token;
      
      // Call the API to get QoS profiles
      const response = await fetch('/api/qos-profiles', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });
      
      // Check for API response headers that indicate fallback
      const isFallback = response.headers.get('X-Using-Fallback') === 'true';
      
      // Parse response
      const profiles = await response.json();
      
      if (!profiles || profiles.length === 0) {
        showStatusMessage('No QoS profiles found.', 'warning');
        return;
      }
      
      // Check for specific data patterns that might indicate this is fallback data
      const mightBeFallbackData = profiles.some(p => 
        p.name === "STANDARD_QOS" || 
        p.name === "PREMIUM_QOS" || 
        p.name === "GAMING_QOS"
      );
      
      // Render profiles
      renderQosProfiles(profiles);
      
      // Show appropriate status message based on whether fallback data was used
      if (isFallback || mightBeFallbackData) {
        showFallbackNotification(profiles.length);
      } else {
        showStatusMessage(`${profiles.length} QoS profiles loaded successfully from Orange API.`, 'success');
      }
      
      // Store profiles globally for use elsewhere
      window.qosProfilesCache = profiles;
      
      return profiles;
    } catch (error) {
      console.error('Error loading QoS profiles:', error);
      showStatusMessage(`Failed to load QoS profiles: ${error.message}`, 'danger');
    }
  }
  
  /**
   * Shows a prominent notification that fallback profiles are being used
   * @param {number} count - Number of profiles loaded
   */
  function showFallbackNotification(count) {
    // Show status message
    showStatusMessage(`
      <strong>Using stored QoS profiles!</strong> 
      Unable to connect to Orange API. Displaying ${count} locally stored profiles instead.
      <br>
      <small>To use live API data, check your connection and token, then click "Refresh Profiles".</small>
    `, 'warning', false); // Don't auto-dismiss this message
    
    // Add a visual indicator on the refresh button
    const refreshBtn = document.getElementById('refresh-qos-profiles-btn');
    if (refreshBtn) {
      refreshBtn.classList.add('btn-warning');
      refreshBtn.classList.remove('btn-outline-primary');
      
      // Restore original button style when clicked
      refreshBtn.addEventListener('click', function onceListener() {
        refreshBtn.classList.remove('btn-warning');
        refreshBtn.classList.add('btn-outline-primary');
        refreshBtn.removeEventListener('click', onceListener);
      }, { once: true });
    }
  }
  
  /**
   * Renders QoS profiles in the UI
   * @param {Array} profiles - The profiles to render
   */
  function renderQosProfiles(profiles) {
    // Get the profiles container
    const profilesGrid = document.getElementById('qos-profiles-grid');
    if (!profilesGrid) return;
    
    // Clear existing profiles
    profilesGrid.innerHTML = '';
    
    // Render each profile
    profiles.forEach(profile => {
      const profileCard = document.createElement('div');
      profileCard.className = 'col-lg-4 col-md-6 mb-4';
      
      // Format rates for display
      const maxUpstream = formatRate(profile.maxUpstreamRate);
      const maxDownstream = formatRate(profile.maxDownstreamRate);
      
      // Determine status class
      const statusClass = profile.status === 'ACTIVE' ? 'badge bg-success' : 'badge bg-warning';
      
      profileCard.innerHTML = `
        <div class="card h-100">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h5 class="card-title mb-0">${profile.name}</h5>
            <span class="${statusClass}">${profile.status}</span>
          </div>
          <div class="card-body">
            <p class="card-text">${profile.description || 'No description provided'}</p>
            <ul class="list-group list-group-flush">
              <li class="list-group-item d-flex justify-content-between align-items-center">
                Max Upstream Rate
                <span class="badge bg-primary rounded-pill">${maxUpstream}</span>
              </li>
              <li class="list-group-item d-flex justify-content-between align-items-center">
                Max Downstream Rate
                <span class="badge bg-primary rounded-pill">${maxDownstream}</span>
              </li>
            </ul>
          </div>
          <div class="card-footer">
            <button class="btn btn-sm btn-outline-primary view-details-btn" 
                    data-profile-name="${profile.name}">
              View Details
            </button>
          </div>
        </div>
      `;
      
      profilesGrid.appendChild(profileCard);
      
      // Add event listener for view details button
      const detailsBtn = profileCard.querySelector('.view-details-btn');
      detailsBtn.addEventListener('click', () => showProfileDetails(profile));
    });
    
    // Add event listeners for view details buttons
    document.querySelectorAll('.view-details-btn').forEach(btn => {
      const profileName = btn.getAttribute('data-profile-name');
      const profile = profiles.find(p => p.name === profileName);
      if (profile) {
        btn.addEventListener('click', () => showProfileDetails(profile));
      }
    });
  }
  
  /**
   * Formats a rate object for display
   * @param {Object} rateObj - The rate object from the API
   * @returns {string} Formatted rate string
   */
  function formatRate(rateObj) {
    if (!rateObj) return 'N/A';
    
    if (rateObj.unit === 'bps') {
      if (rateObj.value >= 1000000000) {
        return `${(rateObj.value / 1000000000).toFixed(2)} Gbps`;
      } else if (rateObj.value >= 1000000) {
        return `${(rateObj.value / 1000000).toFixed(2)} Mbps`;
      } else if (rateObj.value >= 1000) {
        return `${(rateObj.value / 1000).toFixed(2)} Kbps`;
      }
      return `${rateObj.value} bps`;
    }
    
    return `${rateObj.value} ${rateObj.unit || 'bps'}`;
  }
  
  /**
   * Shows detailed information for a QoS profile
   * @param {Object} profile - The profile to display
   */
  function showProfileDetails(profile) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('profile-details-modal');
    if (!modal) {
      const modalElement = document.createElement('div');
      modalElement.className = 'modal fade';
      modalElement.id = 'profile-details-modal';
      modalElement.tabIndex = '-1';
      modalElement.setAttribute('aria-labelledby', 'profileDetailsModalLabel');
      modalElement.setAttribute('aria-hidden', 'true');
      
      modalElement.innerHTML = `
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="profileDetailsModalLabel">Profile Details</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body" id="profile-details-content">
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(modalElement);
      modal = modalElement;
    }
    
    // Update modal content
    const modalContent = document.getElementById('profile-details-content');
    modalContent.innerHTML = `
      <h4>${profile.name}</h4>
      <p>${profile.description || 'No description provided'}</p>
      <div class="table-responsive">
        <table class="table table-bordered">
          <tbody>
            <tr>
              <th>Status</th>
              <td><span class="badge ${profile.status === 'ACTIVE' ? 'bg-success' : 'bg-warning'}">${profile.status}</span></td>
            </tr>
            <tr>
              <th>Max Upstream Rate</th>
              <td>${formatRate(profile.maxUpstreamRate)}</td>
            </tr>
            <tr>
              <th>Max Downstream Rate</th>
              <td>${formatRate(profile.maxDownstreamRate)}</td>
            </tr>
            <tr>
              <th>Target Min Upstream Rate</th>
              <td>${formatRate(profile.targetMinUpstreamRate)}</td>
            </tr>
            <tr>
              <th>Max Upstream Burst Rate</th>
              <td>${formatRate(profile.maxUpstreamBurstRate) || 'N/A'}</td>
            </tr>
            <tr>
              <th>Max Downstream Burst Rate</th>
              <td>${formatRate(profile.maxDownstreamBurstRate) || 'N/A'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
    
    // Show the modal
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
  }
  
  /**
   * Displays a status message
   * @param {string} message - The message to display
   * @param {string} type - The message type (success, danger, warning, info)
   * @param {boolean} autoDismiss - Whether to auto-dismiss the message (default: true)
   */
  function showStatusMessage(message, type = 'info', autoDismiss = true) {
    if (!statusMessageContainer) return;
    
    statusMessageContainer.innerHTML = `
      <div class="alert alert-${type} alert-dismissible fade show" role="alert">
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>
    `;
    
    // Auto-hide success and info messages after 5 seconds if autoDismiss is true
    if (autoDismiss && (type === 'success' || type === 'info')) {
      setTimeout(() => {
        const alert = statusMessageContainer.querySelector('.alert');
        if (alert) {
          const bsAlert = new bootstrap.Alert(alert);
          bsAlert.close();
        }
      }, 5000);
    }
  }
}); 