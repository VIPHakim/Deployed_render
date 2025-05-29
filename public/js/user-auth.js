/**
 * User Authentication Management
 * Handles user session, display and logout
 */

document.addEventListener('DOMContentLoaded', function() {
  // Initialize user display and logout functionality
  initUserAuth();
});

function initUserAuth() {
  // Check if user is logged in
  const isLoggedIn = sessionStorage.getItem('isLoggedIn');
  const username = sessionStorage.getItem('username');
  
  if (isLoggedIn !== 'true') {
    // Redirect to login page if not logged in
    window.location.href = 'login.html';
    return;
  }
  
  // Display username
  const usernameDisplay = document.getElementById('username-display');
  if (usernameDisplay && username) {
    usernameDisplay.textContent = username;
  }
  
  // Setup logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
      // Clear session storage
      sessionStorage.removeItem('isLoggedIn');
      sessionStorage.removeItem('username');
      
      // Redirect to login page
      window.location.href = 'login.html';
    });
  }
}

// Add this function to check login status on any page
function checkLoginStatus() {
  const isLoggedIn = sessionStorage.getItem('isLoggedIn');
  
  if (isLoggedIn !== 'true') {
    // Redirect to login page
    window.location.href = 'login.html';
    return false;
  }
  
  return true;
} 