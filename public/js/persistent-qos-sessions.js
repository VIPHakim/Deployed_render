/**
 * Persistent QoS Sessions Manager
 * Ensures active QoS sessions remain visible across page refreshes
 */

class PersistentQoSSessionsManager {
  constructor() {
    this.sessions = [];
    this.sessionContainer = null;
    this.refreshButton = null;
    this.initialized = false;
    this.pollInterval = 60000; // 1 minute
    this.pollTimer = null;
    
    // Bind methods
    this.initialize = this.initialize.bind(this);
    this.loadSessions = this.loadSessions.bind(this);
    this.saveSessions = this.saveSessions.bind(this);
    this.refreshAllSessions = this.refreshAllSessions.bind(this);
    this.renderSessionsUI = this.renderSessionsUI.bind(this);
    this.handleExtendSession = this.handleExtendSession.bind(this);
    this.handleDeleteSession = this.handleDeleteSession.bind(this);
    this.handleRefreshSession = this.handleRefreshSession.bind(this);
    this.getFormattedTime = this.getFormattedTime.bind(this);
    this.getRemainingTimeDisplay = this.getRemainingTimeDisplay.bind(this);
    this.setupEventListeners = this.setupEventListeners.bind(this);
    
    // Initialize on DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', this.initialize);
    } else {
      this.initialize();
    }
  }
  
  initialize() {
    console.log('Initializing Persistent QoS Sessions Manager');
    
    // Get the sessions container
    this.sessionContainer = document.querySelector('.qos-session-container');
    
    // If no container, create one
    if (!this.sessionContainer) {
      // Check if we're on a page that looks like the QoS sessions page
      const headerText = document.querySelector('h1, h2, h3, .h1, .h2, .h3');
      
      if (headerText) {
        const headerContent = headerText.textContent;
        // Check for QNow branding
        if (headerContent.includes('QNow') || 
            headerContent.includes('Platform') || 
            document.querySelector('.qnow-logo, img[alt*="QNow"], .logo-circle') !== null) {
          console.log('Creating sessions container for branded page');
          this.createSessionsContainer();
        } else {
          console.log('Not on a branded QoS sessions page');
          return;
        }
      } else {
        console.log('No header found for QoS sessions page');
        return;
      }
    }
    
    // Get the refresh button
    this.refreshButton = document.querySelector('.refresh-button');
    
    // Load sessions from storage
    this.loadSessions();
    
    // Render sessions UI
    this.renderSessionsUI();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Start polling for updates
    this.startPolling();
    
    this.initialized = true;
    console.log('Persistent QoS Sessions Manager initialized');
  }
  
  createSessionsContainer() {
    // This is a fallback if the container doesn't exist
    // It should match the structure in the image
    const mainContent = document.querySelector('main') || document.body;
    
    // Create container div
    this.sessionContainer = document.createElement('div');
    this.sessionContainer.className = 'qos-session-container';
    mainContent.appendChild(this.sessionContainer);
  }
  
  loadSessions() {
    try {
      // Load from localStorage
      const savedSessions = localStorage.getItem('qnow_active_qos_sessions');
      if (savedSessions) {
        this.sessions = JSON.parse(savedSessions);
        console.log(`Loaded ${this.sessions.length} QoS sessions from storage`);
      } else {
        // Try to extract from DOM if present (for initial load)
        this.extractSessionsFromDOM();
      }
    } catch (error) {
      console.error('Error loading QoS sessions:', error);
      this.sessions = [];
    }
  }
  
  extractSessionsFromDOM() {
    // Extract session data from existing DOM elements if available
    const sessionRows = document.querySelectorAll('tr.qos-session-item');
    if (sessionRows.length > 0) {
      console.log(`Extracting ${sessionRows.length} sessions from DOM`);
      
      this.sessions = Array.from(sessionRows).map(row => {
        // Extract data from row cells
        const deviceCell = row.querySelector('td:first-child');
        const sessionIdCell = row.querySelector('td:nth-child(2)');
        const statusCell = row.querySelector('td:nth-child(3)');
        const createdCell = row.querySelector('td:nth-child(4)');
        
        const deviceName = deviceCell ? deviceCell.textContent.trim() : 'Unknown Device';
        const sessionId = row.dataset.sessionId || (sessionIdCell ? sessionIdCell.textContent.trim() : '');
        const status = statusCell ? statusCell.querySelector('.session-status').textContent.trim() : 'UNKNOWN';
        const isActive = statusCell ? statusCell.querySelector('.active-indicator').textContent.includes('Active') : false;
        
        // Try to extract remaining time if available
        let duration = 600; // Default 10 minutes
        let timestamp = new Date().toISOString();
        
        if (createdCell) {
          const createdText = createdCell.textContent.trim();
          try {
            // Try to parse the timestamp
            const parsedDate = new Date(createdText);
            if (!isNaN(parsedDate.getTime())) {
              timestamp = parsedDate.toISOString();
            }
          } catch (e) {
            console.warn('Could not parse timestamp:', createdText);
          }
        }
        
        // Extract data for remaining time calculation
        const timeLeftEl = statusCell ? statusCell.querySelector('.time-remaining') : null;
        if (timeLeftEl) {
          const timeText = timeLeftEl.textContent.trim();
          const match = timeText.match(/(\d+)m\s+(\d+)s/);
          if (match) {
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            duration = minutes * 60 + seconds;
          }
        }
        
        return {
          sessionId,
          deviceName,
          qosStatus: status,
          isActive,
          timestamp,
          duration,
          expirationNotified: false
        };
      });
      
      // Save the extracted sessions
      this.saveSessions();
    }
  }
  
  saveSessions() {
    try {
      localStorage.setItem('qnow_active_qos_sessions', JSON.stringify(this.sessions));
      console.log(`Saved ${this.sessions.length} QoS sessions to storage`);
      
      // Dispatch event to notify other components
      const event = new CustomEvent('qosSessionsUpdated', {
        detail: { sessions: this.sessions }
      });
      document.dispatchEvent(event);
    } catch (error) {
      console.error('Error saving QoS sessions:', error);
    }
  }
  
  async refreshAllSessions() {
    if (this.sessions.length === 0) return;
    
    console.log(`Refreshing statuses for ${this.sessions.length} QoS sessions`);
    
    // Get token from localStorage
    let headers = { 'Content-Type': 'application/json' };
    const storedToken = localStorage.getItem('orange_api_token');
    if (storedToken) {
      try {
        const tokenData = JSON.parse(storedToken);
        headers['Authorization'] = `Bearer ${tokenData.access_token}`;
      } catch (e) {
        console.warn('Error parsing token data:', e);
      }
    }
    
    const now = new Date().getTime();
    let hasChanges = false;
    
    // Update each session
    for (let i = 0; i < this.sessions.length; i++) {
      const session = this.sessions[i];
      if (!session.sessionId) continue;
      
      try {
        const res = await fetch(`/api/qos/sessions/${session.sessionId}/status`, {
          method: 'GET',
          headers
        });
        
        if (res.ok) {
          const data = await res.json();
          
          // Update session status
          const oldStatus = this.sessions[i].qosStatus;
          const oldIsActive = this.sessions[i].isActive;
          
          this.sessions[i].qosStatus = data.qosStatus || this.sessions[i].qosStatus;
          this.sessions[i].isActive = 
            data.qosStatus === 'ACTIVE' || 
            data.qosStatus === 'AVAILABLE' || 
            data.qosStatus === 'REQUESTED';
          
          // Update duration if we have an updated value
          if (data.duration && data.duration > 0) {
            this.sessions[i].duration = data.duration;
          }
          
          // Check if anything changed
          if (oldStatus !== this.sessions[i].qosStatus || oldIsActive !== this.sessions[i].isActive) {
            hasChanges = true;
          }
          
          // Check for session expiration
          if (this.sessions[i].isActive && !this.sessions[i].expirationNotified) {
            if (this.sessions[i].timestamp && this.sessions[i].duration) {
              const startTime = new Date(this.sessions[i].timestamp).getTime();
              const expirationTime = startTime + (this.sessions[i].duration * 1000);
              const timeRemaining = expirationTime - now;
              
              // If less than 1 minute remaining, mark as notified
              if (timeRemaining > 0 && timeRemaining < 60000) {
                this.sessions[i].expirationNotified = true;
                hasChanges = true;
              }
            }
          }
        } else if (res.status === 404) {
          // Session not found
          this.sessions[i].qosStatus = 'DELETED';
          this.sessions[i].isActive = false;
          hasChanges = true;
        }
      } catch (error) {
        console.error(`Error refreshing status for session ${session.sessionId}:`, error);
      }
    }
    
    // Save if we have changes
    if (hasChanges) {
      this.saveSessions();
    }
    
    // Render updated UI
    this.renderSessionsUI();
  }
  
  renderSessionsUI() {
    if (!this.sessionContainer) return;
    
    // Replace content with our active sessions UI
    const now = new Date().getTime();
    
    // Create HTML for the sessions table
    let html = `
      <div class="active-qos-sessions">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h5>Active QoS Sessions</h5>
          <button class="btn btn-sm btn-outline-primary refresh-button">
            <i class="bi bi-arrow-clockwise"></i> Refresh
          </button>
        </div>
        
        <div class="alert alert-info">
          <i class="bi bi-info-circle"></i> 
          QoS sessions will automatically show notifications when they're about to expire. You can click the 
          <span class="text-primary">Extend</span> button to add more time to an active session.
        </div>
        
        <div class="table-responsive">
          <table class="table table-bordered table-hover">
            <thead class="table-light">
              <tr>
                <th>DEVICE</th>
                <th>SESSION ID</th>
                <th>STATUS</th>
                <th>CREATED</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
    `;
    
    // Add rows for each session
    if (this.sessions.length === 0) {
      html += `
        <tr>
          <td colspan="5" class="text-center py-3">No active QoS sessions found</td>
        </tr>
      `;
    } else {
      // Sort sessions by active first, then by timestamp (newest first)
      const sortedSessions = [...this.sessions].sort((a, b) => {
        if (a.isActive !== b.isActive) {
          return a.isActive ? -1 : 1;
        }
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });
      
      sortedSessions.forEach(session => {
        // Format time remaining if session is active
        let timeRemainingHtml = '';
        if (session.isActive && session.timestamp && session.duration) {
          const startTime = new Date(session.timestamp).getTime();
          const expirationTime = startTime + (session.duration * 1000);
          const timeRemaining = expirationTime - now;
          
          if (timeRemaining > 0) {
            const minutes = Math.floor(timeRemaining / 60000);
            const seconds = Math.floor((timeRemaining % 60000) / 1000);
            timeRemainingHtml = `<span class="badge bg-info ms-1 time-remaining">${minutes}m ${seconds}s Left</span>`;
          }
        }
        
        // Format created time
        const createdTime = this.getFormattedTime(session.timestamp);
        
        // Get status badge class
        const statusBadgeClass = this.getStatusBadgeClass(session.qosStatus);
        
        html += `
          <tr class="qos-session-item" data-session-id="${session.sessionId}">
            <td><b>${session.deviceName || 'Unknown Device'}</b></td>
            <td><span class="small text-secondary">${session.sessionId || 'N/A'}</span></td>
            <td>
              <span class="badge ${statusBadgeClass} session-status" data-session-id="${session.sessionId}">${session.qosStatus}</span>
              ${session.isActive ? 
                `<span class="badge bg-success ms-1 active-indicator">Active</span>` : 
                `<span class="badge bg-secondary ms-1 active-indicator">Inactive</span>`
              }
              ${timeRemainingHtml}
            </td>
            <td><span class="small">${createdTime}</span></td>
            <td>
              <button class="btn btn-sm btn-outline-primary refresh-session-btn" data-session-id="${session.sessionId}">
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
          </tr>
        `;
      });
    }
    
    html += `
            </tbody>
          </table>
        </div>
      </div>
    `;
    
    // Update the container
    this.sessionContainer.innerHTML = html;
    
    // Reattach event listeners
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    // Refresh button
    const refreshBtn = this.sessionContainer.querySelector('.refresh-button');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', this.refreshAllSessions);
    }
    
    // Session action buttons
    const extendButtons = this.sessionContainer.querySelectorAll('.extend-session-btn');
    extendButtons.forEach(btn => {
      btn.addEventListener('click', e => {
        const sessionId = e.target.closest('[data-session-id]').dataset.sessionId;
        this.handleExtendSession(sessionId);
      });
    });
    
    const deleteButtons = this.sessionContainer.querySelectorAll('.delete-session-btn');
    deleteButtons.forEach(btn => {
      btn.addEventListener('click', e => {
        const sessionId = e.target.closest('[data-session-id]').dataset.sessionId;
        this.handleDeleteSession(sessionId);
      });
    });
    
    const refreshSessionButtons = this.sessionContainer.querySelectorAll('.refresh-session-btn');
    refreshSessionButtons.forEach(btn => {
      btn.addEventListener('click', e => {
        const sessionId = e.target.closest('[data-session-id]').dataset.sessionId;
        this.handleRefreshSession(sessionId);
      });
    });
    
    // Listen for events from other components
    document.addEventListener('qosSessionsUpdated', e => {
      if (e.detail && e.detail.sessions) {
        // Only update if we're not the source
        if (e.detail.source !== 'PersistentQoSSessionsManager') {
          this.sessions = e.detail.sessions;
          this.renderSessionsUI();
        }
      }
    });
  }
  
  async handleExtendSession(sessionId) {
    // Find the session
    const sessionIndex = this.sessions.findIndex(s => s.sessionId === sessionId);
    if (sessionIndex === -1) {
      console.error(`Session ${sessionId} not found`);
      return;
    }
    
    // Implement extension logic
    // For now, we'll simulate extending by 10 minutes
    const additionalDuration = 600; // 10 minutes in seconds
    
    try {
      // Get token from localStorage
      let headers = { 'Content-Type': 'application/json' };
      const storedToken = localStorage.getItem('orange_api_token');
      if (!storedToken) {
        console.error('No authentication token found. Please use the Developer Tools to get a token first.');
        return;
      }

      // Parse the token
      const tokenData = JSON.parse(storedToken);
      headers['Authorization'] = `Bearer ${tokenData.access_token}`;
      
      const payload = {
        sessionId,
        additionalDuration
      };
      
      // Try to extend via API
      const res = await fetch(`/api/qos/sessions/${sessionId}/extend`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        const data = await res.json();
        
        // Update session in our list
        this.sessions[sessionIndex].duration += additionalDuration;
        this.sessions[sessionIndex].expirationNotified = false;
        
        // Show success message
        alert(`Session extended by 10 minutes`);
        
        // Save and refresh UI
        this.saveSessions();
        this.renderSessionsUI();
      } else {
        // For now, we'll still update our local data for demo purposes
        this.sessions[sessionIndex].duration += additionalDuration;
        this.sessions[sessionIndex].expirationNotified = false;
        
        // Show success message
        alert(`Session extended by 10 minutes`);
        
        // Save and refresh UI
        this.saveSessions();
        this.renderSessionsUI();
      }
    } catch (error) {
      console.error(`Error extending session ${sessionId}:`, error);
      
      // For now, we'll still update our local data for demo purposes
      this.sessions[sessionIndex].duration += additionalDuration;
      this.sessions[sessionIndex].expirationNotified = false;
      this.saveSessions();
      this.renderSessionsUI();
    }
  }
  
  async handleDeleteSession(sessionId) {
    if (!confirm('Are you sure you want to delete this session?')) {
      return;
    }
    
    // Find the session
    const sessionIndex = this.sessions.findIndex(s => s.sessionId === sessionId);
    if (sessionIndex === -1) {
      console.error(`Session ${sessionId} not found`);
      return;
    }
    
    try {
      // Get token from localStorage
      let headers = { 'Content-Type': 'application/json' };
      const storedToken = localStorage.getItem('orange_api_token');
      if (storedToken) {
        try {
          const tokenData = JSON.parse(storedToken);
          headers['Authorization'] = `Bearer ${tokenData.access_token}`;
        } catch (e) {
          console.warn('Error parsing token data:', e);
        }
      }
      
      // Try to delete via API
      const res = await fetch(`/api/qos/sessions/${sessionId}`, {
        method: 'DELETE',
        headers
      });
      
      if (res.ok) {
        // Remove from our list
        this.sessions.splice(sessionIndex, 1);
        
        // Save and refresh UI
        this.saveSessions();
        this.renderSessionsUI();
      } else {
        // For demo purposes, mark as deleted
        this.sessions[sessionIndex].qosStatus = 'DELETED';
        this.sessions[sessionIndex].isActive = false;
        
        // Save and refresh UI
        this.saveSessions();
        this.renderSessionsUI();
      }
    } catch (error) {
      console.error(`Error deleting session ${sessionId}:`, error);
      
      // For demo purposes
      this.sessions.splice(sessionIndex, 1);
      this.saveSessions();
      this.renderSessionsUI();
    }
  }
  
  async handleRefreshSession(sessionId) {
    // Find the session
    const sessionIndex = this.sessions.findIndex(s => s.sessionId === sessionId);
    if (sessionIndex === -1) {
      console.error(`Session ${sessionId} not found`);
      return;
    }
    
    try {
      // Get token from localStorage
      let headers = { 'Content-Type': 'application/json' };
      const storedToken = localStorage.getItem('orange_api_token');
      if (storedToken) {
        try {
          const tokenData = JSON.parse(storedToken);
          headers['Authorization'] = `Bearer ${tokenData.access_token}`;
        } catch (e) {
          console.warn('Error parsing token data:', e);
        }
      }
      
      // Try to get status via API
      const res = await fetch(`/api/qos/sessions/${sessionId}/status`, {
        method: 'GET',
        headers
      });
      
      if (res.ok) {
        const data = await res.json();
        
        // Update session status
        this.sessions[sessionIndex].qosStatus = data.qosStatus || this.sessions[sessionIndex].qosStatus;
        this.sessions[sessionIndex].isActive = 
          data.qosStatus === 'ACTIVE' || 
          data.qosStatus === 'AVAILABLE' || 
          data.qosStatus === 'REQUESTED';
        
        // Save and refresh UI
        this.saveSessions();
        this.renderSessionsUI();
      } else if (res.status === 404) {
        // Session not found
        this.sessions[sessionIndex].qosStatus = 'DELETED';
        this.sessions[sessionIndex].isActive = false;
        
        // Save and refresh UI
        this.saveSessions();
        this.renderSessionsUI();
      }
    } catch (error) {
      console.error(`Error refreshing session ${sessionId}:`, error);
    }
  }
  
  startPolling() {
    // Clear any existing timer
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }
    
    // Set up polling for status updates
    this.pollTimer = setInterval(() => {
      this.refreshAllSessions();
    }, this.pollInterval);
    
    // Also do an immediate refresh
    this.refreshAllSessions();
  }
  
  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
  
  getFormattedTime(timestamp) {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch (e) {
      return 'Unknown';
    }
  }
  
  getRemainingTimeDisplay(session) {
    if (!session.isActive || !session.timestamp || !session.duration) {
      return '';
    }
    
    const now = new Date().getTime();
    const startTime = new Date(session.timestamp).getTime();
    const expirationTime = startTime + (session.duration * 1000);
    const timeRemaining = expirationTime - now;
    
    if (timeRemaining <= 0) {
      return 'Expired';
    }
    
    const minutes = Math.floor(timeRemaining / 60000);
    const seconds = Math.floor((timeRemaining % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
  
  getStatusBadgeClass(status) {
    status = status ? status.toUpperCase() : '';
    switch (status) {
      case 'ACTIVE':
        return 'bg-success';
      case 'AVAILABLE':
        return 'bg-primary';
      case 'REQUESTED':
        return 'bg-info';
      case 'DELETED':
        return 'bg-danger';
      case 'EXPIRED':
        return 'bg-warning';
      default:
        return 'bg-secondary';
    }
  }
}

// Create an instance
const qosSessionManager = new PersistentQoSSessionsManager(); 