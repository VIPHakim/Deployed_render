/**
 * Live Countdown for QoS Sessions
 * Updates the time remaining counter for active QoS sessions in real-time
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('Initializing Live Countdown');
  
  // Start the countdown timer
  startCountdown();
  
  // Update countdown when sessions are updated
  document.addEventListener('qosSessionsUpdated', () => {
    // Wait a moment for the DOM to be updated
    setTimeout(updateAllCountdowns, 100);
  });
  
  // Update when switching to connections tab
  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#connections') {
      updateAllCountdowns();
    }
  });
});

// Update interval in milliseconds
const UPDATE_INTERVAL = 1000; // 1 second
let countdownInterval = null;

/**
 * Start the countdown timer
 */
function startCountdown() {
  // Clear any existing interval
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
  
  // Set up the interval
  countdownInterval = setInterval(updateAllCountdowns, UPDATE_INTERVAL);
  
  // Run once immediately
  updateAllCountdowns();
}

/**
 * Update all countdown elements
 */
function updateAllCountdowns() {
  // Get all time remaining elements - include all possible class names
  const timeElements = document.querySelectorAll('.time-remaining, .time-remaining-badge, .badge[class*="time-remaining"]');
  
  if (timeElements.length === 0) {
    return;
  }
  
  // Get the current time
  const now = new Date().getTime();
  
  // Update each element
  timeElements.forEach(element => {
    // Find the session item - support different container structures
    const sessionItem = element.closest('.qos-session-item') || element.closest('[data-session-id]');
    if (!sessionItem) return;
    
    const sessionId = sessionItem.dataset.sessionId;
    if (!sessionId) return;
    
    // Try to get the session data from localStorage
    try {
      const savedSessions = localStorage.getItem('qnow_active_qos_sessions');
      if (!savedSessions) return;
      
      const sessions = JSON.parse(savedSessions);
      const session = sessions.find(s => s.sessionId === sessionId);
      
      if (!session || !session.timestamp || !session.duration) return;
      
      // Calculate remaining time
      const startTime = new Date(session.timestamp).getTime();
      const expirationTime = startTime + (session.duration * 1000);
      const timeRemaining = expirationTime - now;
      
      if (timeRemaining <= 0) {
        // Session expired
        element.textContent = 'Expired';
        element.classList.remove('bg-info', 'bg-warning');
        element.classList.add('bg-secondary');
        // Remove any animation
        element.classList.remove('pulse-animation');
      } else {
        // Update the display
        const minutes = Math.floor(timeRemaining / 60000);
        const seconds = Math.floor((timeRemaining % 60000) / 1000);
        // Format with leading zeros for seconds
        const formattedSeconds = seconds < 10 ? `0${seconds}` : seconds;
        
        element.textContent = `${minutes}m ${formattedSeconds}s Left`;
        
        // Add visual indication when time is running low
        if (timeRemaining < 30000) { // Less than 30 seconds
          element.classList.remove('bg-info', 'bg-warning');
          element.classList.add('bg-danger');
          
          // Add pulse animation if not already added
          if (!element.classList.contains('pulse-animation')) {
            element.classList.add('pulse-animation');
          }
        } else if (timeRemaining < 60000) { // Less than 1 minute
          element.classList.remove('bg-info', 'bg-danger');
          element.classList.add('bg-warning');
          
          // Add pulse animation if not already added
          if (!element.classList.contains('pulse-animation')) {
            element.classList.add('pulse-animation');
          }
        } else {
          element.classList.remove('bg-warning', 'bg-danger', 'pulse-animation');
          element.classList.add('bg-info');
        }
      }
    } catch (error) {
      console.error('Error updating countdown:', error);
    }
  });
}

// Add CSS for pulse animation
document.addEventListener('DOMContentLoaded', () => {
  // Create style element
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.6; }
      100% { opacity: 1; }
    }
    
    .pulse-animation {
      animation: pulse 1s infinite;
    }
  `;
  document.head.appendChild(style);
}); 