/**
 * Test script to directly delete a session at the Orange API
 * Usage: node test-delete-session.js YOUR_TOKEN_HERE
 */

const axios = require('axios');

// Get token from command line argument
const token = process.argv[2];
if (!token) {
  console.error('Please provide a token as an argument: node test-delete-session.js YOUR_TOKEN_HERE');
  process.exit(1);
}

// The session ID to delete (replace with your session ID)
const sessionId = '32b98683-7b26-4489-bcb4-dadf8127dee8';  // Use the session ID from your error
const apiUrl = `https://api.orange.com/camara/quality-on-demand/orange-lab/v0/sessions/${sessionId}`;

async function testDeleteSession() {
  console.log(`Testing deletion of session: ${sessionId}`);
  console.log(`Using provided token: ${token.substring(0, 15)}...`);
  
  try {
    // Send DELETE request to Orange API
    console.log(`Sending DELETE request to: ${apiUrl}`);
    try {
      const response = await axios({
        method: 'DELETE',
        url: apiUrl,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      
      console.log('Delete successful!');
      console.log(`Status: ${response.status}`);
      if (response.data) {
        console.log('Response data:', response.data);
      }
      
    } catch (deleteError) {
      console.error('Delete request failed:');
      if (deleteError.response) {
        console.error(`Status: ${deleteError.response.status}`);
        console.error(`Status Text: ${deleteError.response.statusText}`);
        console.error('Headers:', deleteError.response.headers);
        console.error('Data:', deleteError.response.data);
        
        // If it's a 404 Not Found, the session might already be deleted
        if (deleteError.response.status === 404) {
          console.log('The session does not exist (404) - it might already be deleted');
        }
      } else {
        console.error('Error without response:', deleteError.message);
      }
    }
    
  } catch (error) {
    console.error('General error:', error.message);
  }
}

// Run the test
testDeleteSession(); 