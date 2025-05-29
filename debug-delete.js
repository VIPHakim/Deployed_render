/**
 * Debug script to investigate session deletion issues in QNow Platform
 */

const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// The session ID to delete (replace with your session ID)
const sessionId = '32b98683-7b26-4489-bcb4-dadf8127dee8';  // Use the session ID from your error

// Test using direct axios method for token
async function testWithAxiosToken() {
  console.log('\n=== TESTING WITH AXIOS TOKEN ===');
  
  try {
    console.log('Getting token with axios...');
    const clientId = 'f1yQkufLpcgSC0YZHV9tpNBxeSAjFNPd';
    const clientSecret = 'UJXn5yFO3GXr7MocZ5zPlMasIxaC2JpIqg3g0fIlgOPb1g9';
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    const tokenResponse = await axios({
      method: 'post',
      url: 'https://api.orange.com/oauth/v3/token',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      data: 'grant_type=client_credentials'
    });
    
    const token = tokenResponse.data.access_token;
    console.log(`Got token with axios: ${token.substring(0, 15)}...`);
    
    // Try delete with this token
    await testDelete(token, 'axios token');
    
  } catch (error) {
    console.error('Error with axios token method:', error.message);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Data:', error.response.data);
    }
  }
}

// Test using curl method for token
async function testWithCurlToken() {
  console.log('\n=== TESTING WITH CURL TOKEN ===');
  
  try {
    console.log('Getting token with curl...');
    const curlCommand = `curl -X POST -H "Authorization: Basic ZjF5UWt1ZkxwY2dTQzBZWkhWOXRwTkJ4ZVNBakZOUGQ6VUpYbjV5Rk8zR1hyN01vY1o1elBsZnhaQzJKcElxZzNnMGZJbGdPUGIxZzk=" -H "Content-Type: application/x-www-form-urlencoded" -H "Accept: application/json" -d "grant_type=client_credentials" https://api.orange.com/oauth/v3/token`;
    
    const { stdout, stderr } = await execPromise(curlCommand);
    
    if (stderr && !stderr.includes('  % Total')) {
      console.warn('Stderr from curl:', stderr);
    }
    
    const tokenData = JSON.parse(stdout);
    const token = tokenData.access_token;
    console.log(`Got token with curl: ${token.substring(0, 15)}...`);
    
    // Try delete with this token
    await testDelete(token, 'curl token');
    
  } catch (error) {
    console.error('Error with curl token method:', error.message);
  }
}

// Test delete with the given token
async function testDelete(token, tokenSource) {
  console.log(`\nTesting DELETE with ${tokenSource}...`);
  
  const apiUrl = `https://api.orange.com/camara/quality-on-demand/orange-lab/v0/sessions/${sessionId}`;
  console.log(`URL: ${apiUrl}`);
  
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
    
    console.log(`DELETE successful with ${tokenSource}!`);
    console.log(`Status: ${response.status}`);
    if (response.data) {
      console.log('Response data:', response.data);
    }
    
  } catch (error) {
    console.error(`DELETE failed with ${tokenSource}:`);
    
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Status Text: ${error.response.statusText}`);
      
      if (error.response.status === 404) {
        console.log('The session does not exist (404) - it might already be deleted');
        return true; // Consider this a success
      }
      
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
    
    return false;
  }
  
  return true;
}

// Test manually provided token
async function testWithManualToken(token) {
  if (token) {
    console.log('\n=== TESTING WITH MANUAL TOKEN ===');
    console.log(`Using provided token: ${token.substring(0, 15)}...`);
    await testDelete(token, 'manual token');
  }
}

// Check if token is provided via command line
const manualToken = process.argv[2];

// Run all tests
async function runTests() {
  console.log('=== STARTING DEBUG TESTS ===');
  console.log(`Session ID: ${sessionId}`);
  
  await testWithAxiosToken();
  await testWithCurlToken();
  if (manualToken) {
    await testWithManualToken(manualToken);
  }
  
  console.log('\n=== DEBUG TESTS COMPLETE ===');
}

runTests(); 