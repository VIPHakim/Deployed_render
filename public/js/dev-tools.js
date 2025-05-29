/**
 * Dev Tools script
 * Contains developer utilities, API testing tools, etc.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const devToolsPanel = document.querySelector('.dev-tools-panel');
  const toggleDevToolsBtn = document.getElementById('toggle-dev-tools');
  const getTokenBtn = document.getElementById('get-token-btn');
  const tokenResult = document.getElementById('token-result');
  const tokenStatusDot = document.getElementById('token-status-dot');
  const tokenStatusText = document.getElementById('token-status-text');
  const tokenExpiryInfo = document.getElementById('token-expiry-info');
  const tokenExpiryTime = document.getElementById('token-expiry-time');
  
  // Token state
  let tokenData = null;
  let tokenExpiryTimer = null;
  
  // Check stored token on load
  checkStoredToken();
  
  // Toggle expanded state of dev tools panel
  if (toggleDevToolsBtn) {
    toggleDevToolsBtn.addEventListener('click', () => {
      devToolsPanel.classList.toggle('expanded');
      
      // Update icon based on state
      const icon = toggleDevToolsBtn.querySelector('i');
      if (devToolsPanel.classList.contains('expanded')) {
        icon.classList.remove('bi-arrows-collapse');
        icon.classList.add('bi-arrows-expand');
      } else {
        icon.classList.remove('bi-arrows-expand');
        icon.classList.add('bi-arrows-collapse');
      }
    });
  }
  
  // Get Token functionality
  if (getTokenBtn) {
    getTokenBtn.addEventListener('click', getOAuthToken);
  }
  
  /**
   * Fetches an OAuth token from Orange API
   */
  async function getOAuthToken() {
    // Show loading state
    getTokenBtn.disabled = true;
    getTokenBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Getting token...';
    tokenResult.value = 'Récupération du token en cours...';
    
    // Update status to orange (pending)
    updateTokenStatus('pending');
    
    try {
      // Use our backend proxy endpoint
      const response = await fetch('/api/dev/get-token');
      
      if (!response.ok) {
        throw new Error(`Erreur: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      tokenData = data;
      
      // Store token in session storage
      storeToken(data);
      
      // Format and display the token information
      let formattedResult = JSON.stringify(data, null, 2);
      tokenResult.value = formattedResult;
      
      // Update token status to valid
      updateTokenStatus('valid');
      
      // Start token expiry countdown
      startExpiryTimer(data.expires_in);
      
      // Show success message
      console.log('Token récupéré avec succès:', data);
    } catch (error) {
      console.error('Erreur lors de la récupération du token:', error);
      
      // Update token status to invalid
      updateTokenStatus('invalid');
      
      // Show error and manual command
      tokenResult.value = `Erreur: ${error.message}\n\nSi la récupération échoue, vous pouvez utiliser cette commande manuellement:\n\ncurl -X POST \\\n-H "Authorization: Basic ZjF5UWt1ZkxwY2dTQzBZWkhWOXRwTkJ4ZVNBakZOUGQ6VUpYbjV5Rk8zR1hyN01vY1o1elBsZnhaQzJKcElxZzNnMGZJbGdPUGIxZzk=" \\\n-H "Content-Type: application/x-www-form-urlencoded" \\\n-H "Accept: application/json" \\\n-d "grant_type=client_credentials" \\\nhttps://api.orange.com/oauth/v3/token`;
    } finally {
      // Reset button state
      getTokenBtn.disabled = false;
      getTokenBtn.innerHTML = 'Get Token';
    }
  }
  
  /**
   * Updates the token status indicator
   * @param {string} status - 'valid', 'invalid', 'expiring', or 'pending'
   */
  function updateTokenStatus(status) {
    // First, remove all status classes
    tokenStatusDot.classList.remove('status-red', 'status-green', 'status-orange');
    
    // Set the appropriate status
    switch (status) {
      case 'valid':
        tokenStatusDot.classList.add('status-green');
        tokenStatusText.textContent = 'Token valide';
        tokenExpiryInfo.style.display = 'block';
        break;
      case 'expiring':
        tokenStatusDot.classList.add('status-orange');
        tokenStatusText.textContent = 'Token expirant';
        tokenExpiryInfo.style.display = 'block';
        break;
      case 'pending':
        tokenStatusDot.classList.add('status-orange');
        tokenStatusText.textContent = 'Récupération...';
        tokenExpiryInfo.style.display = 'none';
        break;
      case 'invalid':
      default:
        tokenStatusDot.classList.add('status-red');
        tokenStatusText.textContent = 'Pas de token';
        tokenExpiryInfo.style.display = 'none';
        break;
    }
  }
  
  /**
   * Starts the token expiry countdown timer
   * @param {number} expiresIn - Seconds until token expiry
   */
  function startExpiryTimer(expiresIn) {
    // Clear any existing timer
    if (tokenExpiryTimer) {
      clearInterval(tokenExpiryTimer);
    }
    
    // Calculate expiry time
    const expiryTime = new Date();
    expiryTime.setSeconds(expiryTime.getSeconds() + expiresIn);
    
    // Update timer every second
    tokenExpiryTimer = setInterval(() => {
      const now = new Date();
      const timeLeft = Math.max(0, Math.floor((expiryTime - now) / 1000));
      
      if (timeLeft <= 0) {
        // Token has expired
        clearInterval(tokenExpiryTimer);
        tokenExpiryTimer = null;
        updateTokenStatus('invalid');
        tokenExpiryInfo.style.display = 'none';
        return;
      }
      
      // Format remaining time as HH:MM:SS
      const hours = Math.floor(timeLeft / 3600);
      const minutes = Math.floor((timeLeft % 3600) / 60);
      const seconds = timeLeft % 60;
      const formattedTime = 
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      // Update the expiry time display
      tokenExpiryTime.textContent = formattedTime;
      
      // Change status to orange when less than 5 minutes remaining
      if (timeLeft < 300 && tokenStatusDot.classList.contains('status-green')) {
        updateTokenStatus('expiring');
      }
    }, 1000);
  }
  
  /**
   * Stores the token in session storage
   * @param {Object} token - The token data to store
   */
  function storeToken(token) {
    try {
      // Add a timestamp to track when the token was obtained
      const tokenStorage = {
        ...token,
        obtainedAt: new Date().getTime()
      };
      
      // Store in session storage (will be cleared when browser is closed)
      sessionStorage.setItem('oauth_token', JSON.stringify(tokenStorage));
    } catch (error) {
      console.error('Error storing token:', error);
    }
  }
  
  /**
   * Checks for a stored token and restores it if valid
   */
  function checkStoredToken() {
    try {
      const storedTokenData = sessionStorage.getItem('oauth_token');
      
      if (!storedTokenData) {
        return;
      }
      
      const parsedToken = JSON.parse(storedTokenData);
      const obtainedAt = parsedToken.obtainedAt || 0;
      const expiresIn = parsedToken.expires_in || 3600;
      const now = new Date().getTime();
      
      // Calculate how many seconds have passed since the token was obtained
      const secondsPassed = Math.floor((now - obtainedAt) / 1000);
      
      // Check if the token is still valid
      if (secondsPassed < expiresIn) {
        // Token is still valid
        tokenData = parsedToken;
        
        // Display token in the text area
        tokenResult.value = JSON.stringify(parsedToken, null, 2);
        
        // Update status to valid
        updateTokenStatus('valid');
        
        // Start timer with remaining time
        const remainingTime = expiresIn - secondsPassed;
        startExpiryTimer(remainingTime);
        
        console.log('Restored valid token from session storage');
      } else {
        // Token has expired, remove from storage
        sessionStorage.removeItem('oauth_token');
        console.log('Removed expired token from session storage');
      }
    } catch (error) {
      console.error('Error checking stored token:', error);
    }
  }
}); 