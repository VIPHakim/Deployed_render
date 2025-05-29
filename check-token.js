/**
 * Script to get available sessions and check token validity
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Try to get the token from local storage if it's saved
function getStoredToken() {
  try {
    const sessionStoragePath = path.join(__dirname, 'session-storage.json');
    if (fs.existsSync(sessionStoragePath)) {
      const sessionData = JSON.parse(fs.readFileSync(sessionStoragePath, 'utf8'));
      
      if (sessionData.oauth_token) {
        const tokenData = JSON.parse(sessionData.oauth_token);
        return tokenData.access_token;
      }
    }
    return null;
  } catch (err) {
    console.error('Error reading token from file:', err.message);
    return null;
  }
}

// Get token from command line argument or stored token
const token = process.argv[2] || getStoredToken();
if (!token) {
  console.error('No token found. Please provide a token as an argument: node check-token.js YOUR_TOKEN_HERE');
  process.exit(1);
}

async function checkToken() {
  console.log(`Using token: ${token.substring(0, 15)}...`);
  
  try {
    // Make a GET request to the QoS profiles API
    const apiUrl = 'https://api.orange.com/camara/quality-on-demand/orange-lab/v0/qos-profiles';
    console.log(`Sending GET request to: ${apiUrl}`);
    
    const response = await axios({
      method: 'GET',
      url: apiUrl,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
    
    console.log('Request successful!');
    console.log(`Status: ${response.status}`);
    console.log(`Found ${response.data.length} QoS profiles`);
    
    // List all profile names
    console.log('\nAvailable profiles:');
    response.data.forEach(profile => {
      console.log(`- ${profile.name} (${profile.id || profile.uuid || 'no ID'})`);
    });
    
    console.log('\nToken is valid and working!');
    
  } catch (error) {
    console.error('Error making request:');
    
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Status Text: ${error.response.statusText}`);
      console.error('Headers:', error.response.headers);
      console.error('Data:', error.response.data);
      
      if (error.response.status === 401) {
        console.error('Token appears to be invalid or expired');
      }
    } else {
      console.error('Error without response:', error.message);
    }
  }
}

// Run the check
checkToken(); 