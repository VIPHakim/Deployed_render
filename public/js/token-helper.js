/**
 * QNow Platform - Token Helper
 * This script provides utilities for managing Orange API tokens
 */

document.addEventListener('DOMContentLoaded', () => {
  // Check for token in localStorage from dev-tools.html
  const storedToken = localStorage.getItem('orange_api_token');
  const statusContainer = document.getElementById('token-status');
  
  if (storedToken && statusContainer) {
    try {
      // Parse the token data
      const tokenData = JSON.parse(storedToken);
      
      // If we have a valid token, copy it to sessionStorage for the main app
      if (tokenData && tokenData.access_token) {
        sessionStorage.setItem('oauth_token', storedToken);
        
        const timestamp = localStorage.getItem('orange_api_token_timestamp');
        let expiryMessage = '';
        
        if (timestamp && tokenData.expires_in) {
          const expiryDate = new Date(parseInt(timestamp) + (tokenData.expires_in * 1000));
          const now = new Date();
          
          if (expiryDate > now) {
            const diffMs = expiryDate - now;
            const diffMins = Math.round(diffMs / 60000);
            expiryMessage = ` (expires in ${diffMins} minutes)`;
            statusContainer.classList.add('text-success');
            statusContainer.innerHTML = `
              <div class="alert alert-success">
                <strong><i class="bi bi-check-circle"></i> Token Ready</strong> 
                <p>Valid OAuth token found${expiryMessage}.</p>
                <button class="btn btn-sm btn-outline-secondary" id="view-token-btn">View Token</button>
              </div>
            `;
          } else {
            statusContainer.classList.add('text-danger');
            statusContainer.innerHTML = `
              <div class="alert alert-danger">
                <strong><i class="bi bi-exclamation-triangle"></i> Token Expired</strong>
                <p>Your token has expired. Please generate a new one from the <a href="/dev-tools.html">Developer Tools</a>.</p>
              </div>
            `;
          }
        } else {
          statusContainer.classList.add('text-success');
          statusContainer.innerHTML = `
            <div class="alert alert-success">
              <strong><i class="bi bi-check-circle"></i> Token Ready</strong>
              <p>Valid OAuth token found.</p>
              <button class="btn btn-sm btn-outline-secondary" id="view-token-btn">View Token</button>
            </div>
          `;
        }
        
        // Add event listener for view token button
        const viewTokenBtn = document.getElementById('view-token-btn');
        if (viewTokenBtn) {
          viewTokenBtn.addEventListener('click', () => {
            const tokenText = tokenData.access_token.substring(0, 20) + '...' + tokenData.access_token.substring(tokenData.access_token.length - 10);
            alert(`Token Preview: ${tokenText}\n\nToken Type: ${tokenData.token_type}\nExpires In: ${tokenData.expires_in} seconds`);
          });
        }
      }
    } catch (e) {
      console.error('Error parsing stored token:', e);
      statusContainer.classList.add('text-danger');
      statusContainer.innerHTML = `
        <div class="alert alert-danger">
          <strong><i class="bi bi-exclamation-triangle"></i> Token Error</strong>
          <p>Error reading OAuth token. Please generate a new one from the <a href="/dev-tools.html">Developer Tools</a>.</p>
        </div>
      `;
    }
  } else if (statusContainer) {
    statusContainer.classList.add('text-warning');
    statusContainer.innerHTML = `
      <div class="alert alert-warning">
        <strong><i class="bi bi-exclamation-triangle"></i> No Token Found</strong>
        <p>No OAuth token found. Please generate one from the <a href="/dev-tools.html">Developer Tools</a>.</p>
      </div>
    `;
  }
}); 