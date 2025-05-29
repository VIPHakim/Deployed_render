/**
 * QoS Sessions Integration
 * Integrates the persistent QoS sessions manager with the existing QNow platform
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('Initializing QoS Sessions Integration');
  
  // Check if we're on a page that needs QoS session management
  const needsQoSManagement = checkIfPageNeedsQoSManagement();
  if (!needsQoSManagement) {
    console.log('This page does not need QoS session management');
    return;
  }
  
  // Create the session container if it doesn't exist
  createSessionContainerIfNeeded();
  
  // Load or initialize the QoS sessions manager
  initializeQoSSessionsManager();
  
  // Set up session event listeners
  setupSessionEventListeners();
  
  console.log('QoS Sessions Integration initialized');
});

/**
 * Check if the current page needs QoS session management
 */
function checkIfPageNeedsQoSManagement() {
  // Check URL, page title, or DOM elements to determine if this page needs management
  const pathName = window.location.pathname.toLowerCase();
  const pageTitle = document.title.toLowerCase();
  
  // If the URL or title contains specific keywords
  if (pathName.includes('qos') || 
      pathName.includes('connections') ||
      pageTitle.includes('qnow') || 
      pageTitle.includes('qos') || 
      pageTitle.includes('boost') ||
      pageTitle.includes('platform')) {
    return true;
  }
  
  // Check for specific DOM elements that indicate we need QoS management
  const qosElements = document.querySelectorAll(
    '#qos-container, .qos-session-container, [data-session-id], .qos-boost-btn, #activate-qos-btn'
  );
  
  if (qosElements.length > 0) {
    return true;
  }
  
  // Check for QNow branding
  const qnowBranding = document.querySelectorAll(
    '.qnow-logo, img[alt*="QNow"], .logo-circle'
  );
  
  if (qnowBranding.length > 0) {
    return true;
  }
  
  // If there's already a session in localStorage, we should manage it
  const savedSessions = localStorage.getItem('qnow_active_qos_sessions');
  if (savedSessions) {
    try {
      const sessions = JSON.parse(savedSessions);
      if (sessions && sessions.length > 0) {
        return true;
      }
    } catch (e) {
      console.warn('Error checking saved sessions', e);
    }
  }
  
  return false;
}

/**
 * Create the session container if it doesn't exist
 */
function createSessionContainerIfNeeded() {
  // Check if the container already exists
  if (document.querySelector('.qos-session-container')) {
    return;
  }
  
  // Check if we're on a page with specific structure
  const headerElement = document.querySelector('h1, h2, h3, .h1, .h2, .h3');
  
  if (headerElement) {
    const headerText = headerElement.textContent;
    const isBrandedPage = headerText.includes('QNow') || 
                          headerText.includes('Platform');
    
    if (isBrandedPage) {
      // We're on a branded page, let's create the container right after the header
      const header = headerElement.closest('.main-header, header, .header');
      if (header) {
        const container = document.createElement('div');
        container.className = 'qos-session-container';
        
        // Insert after the header
        if (header.nextSibling) {
          header.parentNode.insertBefore(container, header.nextSibling);
        } else {
          header.parentNode.appendChild(container);
        }
        
        console.log('Created QoS session container after header');
        return;
      }
    }
  }
  
  // Check for QNow logo
  const logo = document.querySelector('.qnow-logo, img[alt*="QNow"], .logo-circle');
  if (logo) {
    const logoContainer = logo.closest('.header, header, .logo-container, .navbar');
    if (logoContainer) {
      const container = document.createElement('div');
      container.className = 'qos-session-container';
      
      // Insert after the logo container
      if (logoContainer.nextSibling) {
        logoContainer.parentNode.insertBefore(container, logoContainer.nextSibling);
      } else {
        logoContainer.parentNode.appendChild(container);
      }
      
      console.log('Created QoS session container after logo');
      return;
    }
  }
  
  // Default fallback: create the container in main or body
  const mainContent = document.querySelector('main') || document.body;
  const container = document.createElement('div');
  container.className = 'qos-session-container';
  
  // Find a good position to insert the container
  const formContainer = document.querySelector('.form-container, form, .form');
  if (formContainer) {
    // Insert before the form
    formContainer.parentNode.insertBefore(container, formContainer);
  } else {
    // Insert at the beginning of main
    if (mainContent.firstChild) {
      mainContent.insertBefore(container, mainContent.firstChild);
    } else {
      mainContent.appendChild(container);
    }
  }
  
  console.log('Created QoS session container (fallback)');
}

/**
 * Initialize the QoS sessions manager
 */
function initializeQoSSessionsManager() {
  // Check if the script is already loaded
  if (typeof PersistentQoSSessionsManager !== 'undefined' && window.qosSessionManager) {
    console.log('QoS Session Manager already initialized');
    return;
  }
  
  // Load the persistent-qos-sessions.js script if it's not already loaded
  const scriptElement = document.querySelector('script[src*="persistent-qos-sessions.js"]');
  if (!scriptElement) {
    console.log('Loading persistent-qos-sessions.js script');
    const script = document.createElement('script');
    script.src = 'js/persistent-qos-sessions.js';
    script.onload = function() {
      console.log('persistent-qos-sessions.js loaded');
    };
    script.onerror = function() {
      console.error('Error loading persistent-qos-sessions.js');
    };
    document.head.appendChild(script);
  }
  
  // Load the QoS sessions CSS if it's not already loaded
  const cssElement = document.querySelector('link[href*="qos-sessions.css"]');
  if (!cssElement) {
    console.log('Loading qos-sessions.css stylesheet');
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'css/qos-sessions.css';
    document.head.appendChild(link);
  }
}

/**
 * Set up session event listeners
 */
function setupSessionEventListeners() {
  // Listen for form submission
  const qosForm = document.querySelector('#qos-form, form, .form-container');
  if (qosForm) {
    // Find activation button
    const activateBtn = document.querySelector('#activate-qos-btn, .activate-qos-btn, [data-action="activate-qos"]');
    if (activateBtn) {
      // Remove old listeners to avoid duplicates
      const oldBtn = activateBtn.cloneNode(true);
      activateBtn.parentNode.replaceChild(oldBtn, activateBtn);
      
      // Add listener for the activate button
      oldBtn.addEventListener('click', function(e) {
        // If there's a custom handler, we'll let it work
        if (typeof window.handleQoSActivation === 'function') {
          return;
        }
        
        // Prevent default only if there's no custom handler
        e.preventDefault();
        
        // Get form values
        const duration = document.querySelector('#duration')?.value || 600;
        const deviceIp = document.querySelector('#app-server-ip')?.value || '172.20.120.84';
        const deviceName = 'Orange Terminal Test'; // Default name
        const sessionId = 'sim-' + Math.random().toString(36).substring(2, 15);
        
        // Create simulated session
        const session = {
          sessionId,
          deviceIp,
          deviceName,
          qosStatus: 'REQUESTED',
          isActive: true,
          timestamp: new Date().toISOString(),
          duration: parseInt(duration, 10),
          expirationNotified: false
        };
        
        // Save to localStorage
        const savedSessions = localStorage.getItem('qnow_active_qos_sessions');
        try {
          const sessions = savedSessions ? JSON.parse(savedSessions) : [];
          sessions.push(session);
          localStorage.setItem('qnow_active_qos_sessions', JSON.stringify(sessions));
          
          // Trigger an event to let the manager know there's a new session
          const event = new CustomEvent('qosSessionsUpdated', {
            detail: { sessions, source: 'integration' }
          });
          document.dispatchEvent(event);
          
          console.log('Created and saved new QoS session:', session);
          alert('QoS session activated successfully!');
        } catch (e) {
          console.error('Error saving session:', e);
        }
      });
    }
  }
} 