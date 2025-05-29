/**
 * QNow Platform Server
 * Serves static files and handles API requests
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const logApiCall = require('./debug-tool');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for JSON parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuration for Orange API
const ORANGE_API_CONFIG = {
  baseUrl: 'https://api.orange.com',
  qosProfilesEndpoint: '/camara/quality-on-demand/orange-lab/v0/qos-profiles',
  tokenEndpoint: '/oauth/v3/token',
  clientId: process.env.ORANGE_CLIENT_ID || 'f1yQkufLpcgSC0YZHv9tpNBxeSAjFNPd',
  clientSecret: process.env.ORANGE_CLIENT_SECRET || 'UJXn5yFO3GXr7MocZ5zPlfrXC2JpIqg3g0fIlgOPb1g9'
};

// Flag to control direct API calls vs mock data
const USE_MOCK_DATA = false; // We want to use real API

// Add Orange API integration - Device Reachability Status
const ORANGE_TOKEN_URL = 'https://api.orange.com/oauth/v3/token';
const ORANGE_REACHABILITY_URL = 'https://api.orange.com/camara/orange-lab/device-reachability-status/v0/retrieve';
const ORANGE_AUTH = 'Basic ZjF5UWt1ZkxwY2dTQzBZWkhWOXRwTkJ4ZVNBakZOUGQ6VUpYbjV5Rk8zR1hyN01vY1o1elBsZnhaQzJKcElxZzNnMGZJbGdPUGIxZzk=';

// Function to get Orange API token
async function getOrangeApiToken() {
  try {
    console.log('Getting Orange API token...');
    console.log('Calling Orange API at URL:', ORANGE_TOKEN_URL);
    
    const response = await axios.post(ORANGE_TOKEN_URL, 
      'grant_type=client_credentials', 
      {
        headers: {
          'Authorization': 'Basic ZjF5UWt1ZkxwY2dTQzBZWkhWOXRwTkJ4ZVNBakZOUGQ6VUpYbjV5Rk8zR1hyN01vY1o1elBsZnhaQzJKcElxZzNnMGZJbGdPUGIxZzk=',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      }
    );
    
    if (response.status === 200 && response.data && response.data.access_token) {
      console.log('Successfully obtained Orange API token');
      console.log('Token type:', response.data.token_type);
      console.log('Expires in:', response.data.expires_in, 'seconds');
      console.log('Token preview:', response.data.access_token.substring(0, 10) + '...');
      return response.data;
    } else {
      console.error('Error getting Orange API token:', response.status, response.data);
      return null;
    }
  } catch (error) {
    console.error('Error getting Orange API token:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    return null;
  }
}

// Function to check device reachability
async function checkDeviceReachability(phoneNumber, token) {
  try {
    // Make sure phone number is in international format with + prefix
    if (!phoneNumber.startsWith('+')) {
      phoneNumber = '+' + phoneNumber;
    }
    
    console.log(`Checking reachability for device: ${phoneNumber}`);
    
    const response = await axios.post(ORANGE_REACHABILITY_URL, 
      {
        device: {
          phoneNumber: phoneNumber
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      }
    );
    
    if (response.status === 200) {
      console.log(`Device ${phoneNumber} reachability:`, response.data);
      return response.data;
    } else {
      console.error(`Error checking reachability for ${phoneNumber}:`, response.status, response.data);
      return null;
    }
  } catch (error) {
    console.error(`Error checking reachability for ${phoneNumber}:`, error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    return null;
  }
}

// Function to get QoS profiles from Orange API
async function getQosProfilesFromOrangeApi(accessToken) {
  try {
    console.log('Calling Orange API for QoS profiles with provided token');
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'Cache-Control': 'no-cache'
    };
    
    const url = `${ORANGE_API_CONFIG.baseUrl}${ORANGE_API_CONFIG.qosProfilesEndpoint}`;
    console.log(`API Request: GET ${url}`);
    
    const response = await axios({
      method: 'get',
      url: url,
      headers: headers
    });
    
    console.log('Orange API QoS profiles received successfully');
    logApiCall('/api/qos/profiles', 'GET', null, headers, null, response.data);
    return response.data;
  } catch (error) {
    console.error('Error getting QoS profiles from Orange API:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    logApiCall('/api/qos/profiles', 'GET', null, { 'Authorization': `Bearer ${accessToken}` }, null, error);
    throw error;
  }
}

// Function to get QoS sessions from Orange API
async function getQosSessionsFromOrangeApi(accessToken) {
  try {
    console.log('Calling Orange API for QoS sessions');
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    };
    
    const url = `${ORANGE_API_CONFIG.baseUrl}/camara/quality-on-demand/orange-lab/v0/sessions`;
    console.log(`API Request: GET ${url}`);
    
    const response = await axios({
      method: 'get',
      url: url,
      headers: headers
    });
    
    console.log('Orange API QoS sessions received successfully');
    logApiCall('/api/qos/sessions', 'GET', null, headers, null, response.data);
    return response.data;
  } catch (error) {
    console.error('Error getting QoS sessions from Orange API:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    logApiCall('/api/qos/sessions', 'GET', null, { 'Authorization': `Bearer ${accessToken}` }, null, error);
    throw error;
  }
}

// Function to get session status from Orange API
async function getSessionStatusFromOrangeApi(accessToken, sessionId) {
  try {
    // Ensure sessionId is in UUID format
    if (!isValidUUID(sessionId)) {
      console.error('Invalid session ID format:', sessionId);
      throw new Error('Invalid session ID format');
    }

    console.log(`Calling Orange API for session status: ${sessionId}`);
    const response = await axios({
      method: 'get',
      url: `${ORANGE_API_CONFIG.baseUrl}/camara/quality-on-demand/orange-lab/v0/sessions/${sessionId}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });
    
    console.log('Orange API session status received successfully');
    logApiCall(`/api/qos/sessions/${sessionId}/status`, 'GET', sessionId, { 'Authorization': `Bearer ${accessToken}` }, null, response.data);
    return response.data;
  } catch (error) {
    console.error('Error getting session status from Orange API:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    logApiCall(`/api/qos/sessions/${sessionId}/status`, 'GET', sessionId, { 'Authorization': `Bearer ${accessToken}` }, null, error);
    throw error;
  }
}

// Helper function to validate UUID format
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Helper function to read JSON data files
function readJsonFile(filename) {
  try {
    const filePath = path.join(__dirname, 'data', filename);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    return [];
  } catch (err) {
    console.error(`Error reading ${filename}:`, err);
    return [];
  }
}

// Helper function to write JSON data files
function writeJsonFile(filename, data) {
  try {
    const filePath = path.join(__dirname, 'data', filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error writing ${filename}:`, err);
    return false;
  }
}

// Default QoS profiles directly from Orange API
const orangeApiProfiles = [
  {
    "name": "TestProfile",
    "description": "TestProfile",
    "status": "ACTIVE",
    "maxUpstreamRate": {
      "value": 4,
      "unit": "kbps"
    },
    "maxDownstreamRate": {
      "value": 4,
      "unit": "kbps"
    },
    "minDuration": {
      "value": 60,
      "unit": "Seconds"
    },
    "maxDuration": {
      "value": 1000,
      "unit": "Seconds"
    },
    "priority": 0
  },
  {
    "name": "middle",
    "description": "Middle bandwith 2048000",
    "status": "ACTIVE",
    "maxUpstreamRate": {
      "value": 2048000,
      "unit": "kbps"
    },
    "maxDownstreamRate": {
      "value": 2048000,
      "unit": "kbps"
    },
    "minDuration": {
      "value": 60,
      "unit": "Seconds"
    },
    "maxDuration": {
      "value": 86400,
      "unit": "Seconds"
    },
    "priority": 0
  },
  {
    "name": "high",
    "description": "profile of 10Mbps",
    "status": "ACTIVE",
    "maxUpstreamRate": {
      "value": 10240000,
      "unit": "kbps"
    },
    "maxDownstreamRate": {
      "value": 10240000,
      "unit": "kbps"
    },
    "minDuration": {
      "value": 60,
      "unit": "Seconds"
    },
    "maxDuration": {
      "value": 86400,
      "unit": "Seconds"
    },
    "priority": 0
  },
  {
    "name": "low",
    "description": "low bandwith 2048000",
    "status": "ACTIVE",
    "maxUpstreamRate": {
      "value": 2048000,
      "unit": "kbps"
    },
    "maxDownstreamRate": {
      "value": 2048000,
      "unit": "kbps"
    },
    "minDuration": {
      "value": 60,
      "unit": "Seconds"
    },
    "maxDuration": {
      "value": 86400,
      "unit": "Seconds"
    },
    "priority": 0
  },
  {
    "name": "verylow",
    "description": "very bandwith 128000",
    "status": "ACTIVE",
    "maxUpstreamRate": {
      "value": 128000,
      "unit": "kbps"
    },
    "maxDownstreamRate": {
      "value": 128000,
      "unit": "kbps"
    },
    "minDuration": {
      "value": 60,
      "unit": "Seconds"
    },
    "maxDuration": {
      "value": 86400,
      "unit": "Seconds"
    },
    "priority": 0
  },
  {
    "name": "profile-10M",
    "description": "profile of 10Mbps",
    "status": "ACTIVE",
    "maxUpstreamRate": {
      "value": 10240000,
      "unit": "kbps"
    },
    "maxDownstreamRate": {
      "value": 10240000,
      "unit": "kbps"
    },
    "minDuration": {
      "value": 60,
      "unit": "Seconds"
    },
    "maxDuration": {
      "value": 86400,
      "unit": "Seconds"
    },
    "priority": 0
  },
  {
    "name": "profile-6M",
    "description": "profile of 6 Mbps",
    "status": "ACTIVE",
    "maxUpstreamRate": {
      "value": 6144000,
      "unit": "kbps"
    },
    "maxDownstreamRate": {
      "value": 6144000,
      "unit": "kbps"
    },
    "minDuration": {
      "value": 60,
      "unit": "Seconds"
    },
    "maxDuration": {
      "value": 86400,
      "unit": "Seconds"
    },
    "priority": 0
  },
  {
    "name": "profile-4M",
    "description": "profile of 4 Mbps",
    "status": "ACTIVE",
    "maxUpstreamRate": {
      "value": 4096000,
      "unit": "kbps"
    },
    "maxDownstreamRate": {
      "value": 4096000,
      "unit": "kbps"
    },
    "minDuration": {
      "value": 60,
      "unit": "Seconds"
    },
    "maxDuration": {
      "value": 86400,
      "unit": "Seconds"
    },
    "priority": 0
  },
  {
    "name": "profile-3M",
    "description": "profile of 3Mbps",
    "status": "ACTIVE",
    "maxUpstreamRate": {
      "value": 3072000,
      "unit": "kbps"
    },
    "maxDownstreamRate": {
      "value": 3072000,
      "unit": "kbps"
    },
    "minDuration": {
      "value": 60,
      "unit": "Seconds"
    },
    "maxDuration": {
      "value": 86400,
      "unit": "Seconds"
    },
    "priority": 0
  },
  {
    "name": "profile-5M",
    "description": "profile of 5 Mbps",
    "status": "ACTIVE",
    "maxUpstreamRate": {
      "value": 5120000,
      "unit": "kbps"
    },
    "maxDownstreamRate": {
      "value": 5120000,
      "unit": "kbps"
    },
    "minDuration": {
      "value": 60,
      "unit": "Seconds"
    },
    "maxDuration": {
      "value": 86400,
      "unit": "Seconds"
    },
    "priority": 0
  },
  {
    "name": "medium",
    "description": "profile of 5 Mbps",
    "status": "ACTIVE",
    "maxUpstreamRate": {
      "value": 5120000,
      "unit": "kbps"
    },
    "maxDownstreamRate": {
      "value": 5120000,
      "unit": "kbps"
    },
    "minDuration": {
      "value": 60,
      "unit": "Seconds"
    },
    "maxDuration": {
      "value": 86400,
      "unit": "Seconds"
    },
    "priority": 0
  },
  {
    "name": "test",
    "description": "profile of 1 Mbps",
    "status": "ACTIVE",
    "maxUpstreamRate": {
      "value": 1024000,
      "unit": "kbps"
    },
    "maxDownstreamRate": {
      "value": 1024000,
      "unit": "kbps"
    },
    "minDuration": {
      "value": 60,
      "unit": "Seconds"
    },
    "maxDuration": {
      "value": 86400,
      "unit": "Seconds"
    },
    "priority": 0
  },
  {
    "name": "profile-7M",
    "description": "profile of 7168000 kbps",
    "status": "ACTIVE",
    "maxUpstreamRate": {
      "value": 7168000,
      "unit": "kbps"
    },
    "maxDownstreamRate": {
      "value": 7168000,
      "unit": "kbps"
    },
    "minDuration": {
      "value": 60,
      "unit": "Seconds"
    },
    "maxDuration": {
      "value": 86400,
      "unit": "Seconds"
    },
    "priority": 0
  }
];

// Default QoS mappings
const defaultQosMappings = {
  Safety: "TestProfile",
  POS: "high",
  XR: "high",
  Broadcasting: null
};

// Ensure log file exists with initial content
fs.writeFileSync(path.join(__dirname, 'api-debug.log'), JSON.stringify({
  timestamp: new Date().toISOString(),
  endpoint: '/api/init',
  method: 'INIT',
  sessionId: null,
  headers: {},
  body: null,
  response: { status: 'Server started' }
}, null, 2), 'utf8');

// Redirect root to login page
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// API route for OAuth token (supports both GET and POST)
app.get('/api/oauth/token', (req, res) => {
  // Simulate a token response
  res.json({
    access_token: 'simulated_access_token',
    token_type: 'Bearer',
    expires_in: 3600,
    scope: 'qos_profiles qos_sessions'
  });
});

// Also handle POST requests for OAuth token
app.post('/api/oauth/token', (req, res) => {
  // Simulate a token response
  res.json({
    access_token: 'simulated_access_token',
    token_type: 'Bearer',
    expires_in: 3600,
    scope: 'qos_profiles qos_sessions'
  });
});

// API endpoint for dev tools to get token
app.get('/api/dev/get-token', async (req, res) => {
  try {
    // Check if the request specifically asks for a simulated token
    const tokenType = req.query.type || 'real';
    
    if (tokenType === 'simulated') {
      // Return a simulated token if specifically requested
      console.log('Returning simulated token as requested');
      res.json({
        access_token: 'dev_simulated_access_token_' + Date.now(),
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'qos_profiles qos_sessions'
      });
    } else {
      // Get a real token from Orange API by default
      const tokenData = await getOrangeApiToken();
      
      if (tokenData && tokenData.access_token) {
        console.log('Successfully obtained real Orange API token for dev tools');
        console.log('Token preview:', tokenData.access_token.substring(0, 10) + '...' + tokenData.access_token.slice(-5));
        res.json(tokenData);
      } else {
        console.error('Failed to get token from Orange API');
        res.status(500).json({
          error: 'Failed to obtain token from Orange API',
          message: 'No token received from service'
        });
      }
    }
  } catch (error) {
    console.error('Error getting token:', error);
    res.status(500).json({
      error: 'Failed to obtain token',
      message: error.message
    });
  }
});

// QoS Profiles API with slash
app.get('/api/qos/profiles', async (req, res) => {
  try {
    // Get the authorization header from the client request
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No valid authorization header provided, falling back to stored profiles');
      // Set header to indicate we're using fallback data
      res.set('X-Using-Fallback', 'true');
      return res.json(orangeApiProfiles);
    }
    
    // Extract token from the header
    const clientToken = authHeader.split(' ')[1];
    console.log('Using client token for Orange API call');
    
    // Call the Orange API directly using the client's token
    try {
      const response = await axios({
        method: 'get',
        url: `${ORANGE_API_CONFIG.baseUrl}${ORANGE_API_CONFIG.qosProfilesEndpoint}`,
        headers: {
          'Authorization': `Bearer ${clientToken}`,
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      
      console.log(`Retrieved QoS profiles from Orange API using client token`);
      // Set header to indicate we're using live data
      res.set('X-Using-Fallback', 'false');
      return res.json(response.data);
    } catch (apiError) {
      console.error('Error calling Orange API directly:', apiError.message);
      if (apiError.response) {
        console.error('API Response data:', apiError.response.data);
        console.error('API Response status:', apiError.response.status);
      }
      // Fall back to stored profiles
      console.log('Falling back to stored profiles due to API error');
      // Set header to indicate we're using fallback data
      res.set('X-Using-Fallback', 'true');
      return res.json(orangeApiProfiles);
    }
  } catch (error) {
    console.error('Error in QoS/profiles endpoint:', error.message);
    // Fallback to stored profiles if the API call fails
    console.log('Falling back to stored profiles due to error');
    // Set header to indicate we're using fallback data
    res.set('X-Using-Fallback', 'true');
    res.json(orangeApiProfiles);
  }
});

// Alternative URL for QoS Profiles (with hyphen instead of slash)
app.get('/api/qos-profiles', async (req, res) => {
  try {
    // Get the authorization header from the client request
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No valid authorization header provided, falling back to stored profiles');
      // Set header to indicate we're using fallback data
      res.set('X-Using-Fallback', 'true');
      return res.json(orangeApiProfiles);
    }
    
    // Extract token from the header
    const clientToken = authHeader.split(' ')[1];
    console.log('Using client token for Orange API call');
    
    // Call the Orange API directly using the client's token
    try {
      const response = await axios({
        method: 'get',
        url: `${ORANGE_API_CONFIG.baseUrl}${ORANGE_API_CONFIG.qosProfilesEndpoint}`,
        headers: {
          'Authorization': `Bearer ${clientToken}`,
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      
      console.log(`Retrieved QoS profiles from Orange API using client token`);
      // Set header to indicate we're using live data
      res.set('X-Using-Fallback', 'false');
      return res.json(response.data);
    } catch (apiError) {
      console.error('Error calling Orange API directly:', apiError.message);
      if (apiError.response) {
        console.error('API Response data:', apiError.response.data);
        console.error('API Response status:', apiError.response.status);
      }
      // Fall back to stored profiles
      console.log('Falling back to stored profiles due to API error');
      // Set header to indicate we're using fallback data
      res.set('X-Using-Fallback', 'true');
      return res.json(orangeApiProfiles);
    }
  } catch (error) {
    console.error('Error in QoS-profiles endpoint:', error.message);
    // Fallback to stored profiles if the API call fails
    console.log('Falling back to stored profiles due to error');
    // Set header to indicate we're using fallback data
    res.set('X-Using-Fallback', 'true');
    res.json(orangeApiProfiles);
  }
});

// QoS Mappings API
app.get('/api/qos/mappings', (req, res) => {
  // Check if we have mappings saved, if not use defaults
  let mappings = readJsonFile('qos_mappings.json');
  if (!mappings || Object.keys(mappings).length === 0) {
    mappings = defaultQosMappings;
    writeJsonFile('qos_mappings.json', mappings);
  }
  res.json(mappings);
});

// Alternative URL for QoS Mappings (with hyphen instead of slash)
app.get('/api/qos-mappings', (req, res) => {
  // Check if we have mappings saved, if not use defaults
  let mappings = readJsonFile('qos_mappings.json');
  if (!mappings || Object.keys(mappings).length === 0) {
    mappings = defaultQosMappings;
    writeJsonFile('qos_mappings.json', mappings);
  }
  res.json(mappings);
});

// Update QoS Mappings
app.post('/api/qos/mappings', (req, res) => {
  let mappings = readJsonFile('qos_mappings.json') || {};
  
  // Check if we're using the special format from qos-profiles.js
  if (req.body.profile && req.body.qosProfile) {
    const { profile, qosProfile } = req.body;
    mappings[profile] = qosProfile;
  } else {
    // Otherwise update all mappings
    mappings = { ...mappings, ...req.body };
  }
  
  writeJsonFile('qos_mappings.json', mappings);
  res.json({ success: true, mappings });
});

// Alternative URL for updating QoS Mappings (with hyphen instead of slash)
app.post('/api/qos-mappings', (req, res) => {
  let mappings = readJsonFile('qos_mappings.json') || {};
  
  // Check if we're using the special format from qos-profiles.js
  if (req.body.profile && req.body.qosProfile) {
    const { profile, qosProfile } = req.body;
    mappings[profile] = qosProfile;
  } else {
    // Otherwise update all mappings
    mappings = { ...mappings, ...req.body };
  }
  
  writeJsonFile('qos_mappings.json', mappings);
  res.json({ success: true, mappings });
});

// Delete a mapping
app.delete('/api/qos-mappings/:profile', (req, res) => {
  const profile = req.params.profile;
  let mappings = readJsonFile('qos_mappings.json') || {};
  
  if (mappings[profile]) {
    delete mappings[profile];
    writeJsonFile('qos_mappings.json', mappings);
  }
  
  res.json({ success: true, mappings });
});

// QoS Sessions API
app.get('/api/qos/sessions', async (req, res) => {
  try {
    // Get the authorization header from the client request
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No valid authorization header provided for sessions, returning empty array');
      return res.json([]);
    }
    
    // Extract token from the header
    const clientToken = authHeader.split(' ')[1];
    console.log('Using client token for Orange Sessions API call');
    
    // Call the Orange API directly using the client's token
    try {
      const response = await axios({
        method: 'get',
        url: `${ORANGE_API_CONFIG.baseUrl}/camara/quality-on-demand/orange-lab/v0/sessions`,
        headers: {
          'Authorization': `Bearer ${clientToken}`,
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      
      console.log(`Retrieved QoS sessions from Orange API using client token`);
      return res.json(response.data);
    } catch (apiError) {
      console.error('Error calling Orange Sessions API directly:', apiError.message);
      if (apiError.response) {
        console.error('API Response data:', apiError.response.data);
        console.error('API Response status:', apiError.response.status);
      }
      // Return empty array as fallback
      return res.json([]);
    }
  } catch (error) {
    console.error('Error fetching sessions from Orange API:', error.message);
    // Return empty array as fallback
    res.json([]);
  }
});

// Alternative URL for QoS Sessions (with hyphen instead of slash)
app.get('/api/qos-sessions', async (req, res) => {
  try {
    // Get the authorization header from the client request
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No valid authorization header provided for sessions, returning empty array');
      return res.json([]);
    }
    
    // Extract token from the header
    const clientToken = authHeader.split(' ')[1];
    console.log('Using client token for Orange Sessions API call');
    
    // Call the Orange API directly using the client's token
    try {
      const response = await axios({
        method: 'get',
        url: `${ORANGE_API_CONFIG.baseUrl}/camara/quality-on-demand/orange-lab/v0/sessions`,
        headers: {
          'Authorization': `Bearer ${clientToken}`,
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      
      console.log(`Retrieved QoS sessions from Orange API using client token`);
      return res.json(response.data);
    } catch (apiError) {
      console.error('Error calling Orange Sessions API directly:', apiError.message);
      if (apiError.response) {
        console.error('API Response data:', apiError.response.data);
        console.error('API Response status:', apiError.response.status);
      }
      // Return empty array as fallback
      return res.json([]);
    }
  } catch (error) {
    console.error('Error fetching sessions from Orange API:', error.message);
    // Return empty array as fallback
    res.json([]);
  }
});

// Session status endpoint
app.get('/api/qos/sessions/:sessionId/status', async (req, res) => {
  const sessionId = req.params.sessionId;
  
  try {
    // Get a token for the Orange API
    const tokenData = await getOrangeApiToken();
    console.log('Got Orange API token for session status');
    
    // Call the Orange API for session status
    const sessionStatus = await getSessionStatusFromOrangeApi(tokenData.access_token, sessionId);
    console.log(`Retrieved status for session ${sessionId} from Orange API`);
    
    // Return the session status from the real API
    res.json(sessionStatus);
  } catch (error) {
    console.error(`Error fetching status for session ${sessionId} from Orange API:`, error.message);
    
    // Return 404 if session not found
    if (error.response && error.response.status === 404) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Return a generic error response
    res.status(500).json({ error: 'Failed to fetch session status' });
  }
});

// Alternative URL for session status (with hyphen instead of slash)
app.get('/api/qos-sessions/:sessionId/status', async (req, res) => {
  const sessionId = req.params.sessionId;
  
  try {
    // Get a token for the Orange API
    const tokenData = await getOrangeApiToken();
    console.log('Got Orange API token for session status');
    
    // Call the Orange API for session status
    const sessionStatus = await getSessionStatusFromOrangeApi(tokenData.access_token, sessionId);
    console.log(`Retrieved status for session ${sessionId} from Orange API`);
    
    // Return the session status from the real API
    res.json(sessionStatus);
  } catch (error) {
    console.error(`Error fetching status for session ${sessionId} from Orange API:`, error.message);
    
    // Return 404 if session not found
    if (error.response && error.response.status === 404) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Return a generic error response
    res.status(500).json({ error: 'Failed to fetch session status' });
  }
});

// Create QoS Session
app.post('/api/qos/sessions', async (req, res) => {
  try {
    // Generate a proper UUID for the session ID
    const generateUUID = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0,
              v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };
    
    // Extract the client's token if provided
    const authHeader = req.headers.authorization;
    let accessToken = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.split(' ')[1];
      console.log('Using client token for creating QoS session');
    }
    
    // Prepare the session data
    const sessionData = {
      ...req.body
    };
    
    if (!accessToken) {
      // If no token provided, just create a local session
      console.log('No valid authorization token provided, creating local session only');
      
      // Create a local session with generated UUID
      const localSessionData = {
        id: generateUUID(),
        sessionId: generateUUID(), // Include both formats for compatibility
        ...sessionData,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        isLocalOnly: true
      };
      
      console.log(`Created new local QoS session with ID: ${localSessionData.id}`);
      
      // Store session data
      const sessions = readJsonFile('qos_sessions.json') || [];
      sessions.push(localSessionData);
      writeJsonFile('qos_sessions.json', sessions);
      
      return res.status(201).json(localSessionData);
    }
    
    // Using the client's token to create a session with Orange API
    try {
      const apiSessionData = await createSessionWithOrangeApi(accessToken, sessionData);
      console.log(`Successfully created Orange API session: ${apiSessionData.id}`);
      
      // Store the session info locally too
      const sessions = readJsonFile('qos_sessions.json') || [];
      sessions.push({
        ...apiSessionData,
        createdAt: new Date().toISOString(),
        createdWithRealToken: true
      });
      writeJsonFile('qos_sessions.json', sessions);
      
      return res.status(201).json(apiSessionData);
    } catch (apiError) {
      console.error('Error creating session with Orange API:', apiError.message);
      
      // Fallback to local session if API call fails
      const fallbackSessionData = {
        id: generateUUID(),
        sessionId: generateUUID(),
        ...sessionData,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        apiError: apiError.message,
        isLocalOnly: true
      };
      
      console.log(`Created fallback local QoS session with ID: ${fallbackSessionData.id}`);
      
      // Store session data
      const sessions = readJsonFile('qos_sessions.json') || [];
      sessions.push(fallbackSessionData);
      writeJsonFile('qos_sessions.json', sessions);
      
      return res.status(201).json({
        ...fallbackSessionData,
        warning: 'Created local session only due to API error',
        apiErrorMessage: apiError.message
      });
    }
  } catch (error) {
    console.error('Error creating QoS session:', error);
    res.status(500).json({ error: 'Failed to create QoS session', message: error.message });
  }
});

// Function to delete a session from Orange API
async function deleteSessionFromOrangeApi(accessToken, sessionId) {
  try {
    // Ensure sessionId is in UUID format
    if (!isValidUUID(sessionId)) {
      console.error('Invalid session ID format:', sessionId);
      throw new Error('Invalid session ID format');
    }

    console.log(`Calling Orange API to delete session: ${sessionId}`);
    console.log(`Using token: ${accessToken.substring(0, 10)}...${accessToken.slice(-5)}`);
    
    // Log the full request details for debugging
    const url = `${ORANGE_API_CONFIG.baseUrl}/camara/quality-on-demand/orange-lab/v0/sessions/${sessionId}`;
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    };
    
    console.log(`DELETE Request URL: ${url}`);
    console.log('Headers:', JSON.stringify(headers, null, 2));
    
    const response = await axios({
      method: 'delete',
      url: url,
      headers: headers
    });
    
    console.log('Orange API session deletion successful');
    logApiCall(`/api/qos/sessions/${sessionId}`, 'DELETE', sessionId, headers, null, response.data || { success: true });
    return true;
  } catch (error) {
    console.error('Error deleting session from Orange API:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    logApiCall(`/api/qos/sessions/${sessionId}`, 'DELETE', sessionId, { 'Authorization': `Bearer ${accessToken}` }, null, error);
    throw error;
  }
}

// Delete QoS Session
app.delete('/api/qos/sessions/:id', async (req, res) => {
  const sessionId = req.params.id;
  
  try {
    // First update our local storage
    const sessions = readJsonFile('qos_sessions.json') || [];
    const updatedSessions = sessions.filter(session => session.id !== sessionId);
    writeJsonFile('qos_sessions.json', updatedSessions);
    
    // Try to delete from Orange API if the session ID is in UUID format
    if (isValidUUID(sessionId)) {
      try {
        // Get the authorization header from the client request
        const authHeader = req.headers.authorization;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
          // Extract token from the header
          const clientToken = authHeader.split(' ')[1];
          console.log('Using provided token for Orange API deletion:', clientToken.substring(0, 10) + '...');
          
          // Call the Orange API with the client's token
          await deleteSessionFromOrangeApi(clientToken, sessionId);
          console.log(`Successfully deleted session ${sessionId} from Orange API`);
          
          return res.json({ 
            success: true, 
            message: 'Session deleted from both local storage and Orange API'
          });
        } else {
          // No valid client token, try with our own token
          console.log('No authorization header found, getting a new token');
          const tokenData = await getOrangeApiToken();
          console.log('Got new token for deletion:', tokenData.access_token.substring(0, 10) + '...');
          await deleteSessionFromOrangeApi(tokenData.access_token, sessionId);
          console.log(`Successfully deleted session ${sessionId} from Orange API using server token`);
          
          return res.json({ 
            success: true, 
            message: 'Session deleted from both local storage and Orange API using server token'
          });
        }
      } catch (apiError) {
        console.error('Failed to delete session from Orange API:', apiError.message);
        // Return success for local deletion only
        return res.json({ 
          success: true, 
          warning: 'Session was deleted from local storage but deletion from Orange API failed',
          error: apiError.message
        });
      }
    } else {
      console.log(`Session ID ${sessionId} is not in UUID format, only deleted locally`);
    }
    
    // Return success for local deletion only
    res.json({ success: true });
  } catch (error) {
    console.error('Error in delete session endpoint:', error);
    res.status(500).json({ error: 'Failed to delete session', message: error.message });
  }
});

// Extend QoS Session
app.post('/api/qos/sessions/:sessionId/extend', async (req, res) => {
  const sessionId = req.params.sessionId;
  const duration = req.body.duration || 600; // Default to 10 minutes if no duration specified
  
  console.log(`Extending session ${sessionId} with additional duration: ${duration} seconds`);
  
  // Get existing sessions from local storage
  const sessions = readJsonFile('qos_sessions.json') || [];
  
  // Find the session by either id or sessionId field
  const sessionIndex = sessions.findIndex(s => 
    s.id === sessionId || 
    s.sessionId === sessionId
  );
  
  // First update our local session data
  if (sessionIndex !== -1) {
    // Update the session
    const session = sessions[sessionIndex];
    
    // If the session already has a duration, add to it
    if (session.duration) {
      session.duration += parseInt(duration);
    } else {
      session.duration = parseInt(duration);
    }
    
    session.extended = true;
    session.lastExtended = new Date().toISOString();
    
    // Update in the array
    sessions[sessionIndex] = session;
    
    // Save back to file
    writeJsonFile('qos_sessions.json', sessions);
    
    console.log(`Session ${sessionId} extended successfully in local storage with duration: ${session.duration} seconds`);
  } else {
    console.log(`Session ${sessionId} not found in local storage`);
  }
  
  // Also try to extend the session with the Orange API if it's a UUID format
  try {
    // Get the authorization header from the client request
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No valid authorization header provided for session extension');
      if (sessionIndex === -1) {
        return res.status(404).json({ error: 'Session not found', sessionId });
      } else {
        // Return success for local extension only
        return res.json({ 
          success: true, 
          session: sessions[sessionIndex],
          message: `Session extended by ${duration} seconds (local only)`
        });
      }
    }
    
    // Extract token from the header
    const accessToken = authHeader.split(' ')[1];
    console.log('Using provided access token for Orange API extension call');
    
    // Determine the correct sessionId format for the API
    let apiSessionId = sessionId;
    
    // If the session exists locally, use the proper UUID format for API
    if (sessionIndex !== -1) {
      const session = sessions[sessionIndex];
      // Prefer sessionId if available, otherwise use id
      apiSessionId = session.sessionId || session.id;
    }
    
    // If the sessionId is in the format 'session_TIMESTAMP', we can't call the Orange API directly
    if (apiSessionId.startsWith('session_')) {
      console.log(`Session ID ${apiSessionId} is in local format, cannot extend with Orange API`);
      
      if (sessionIndex === -1) {
        return res.status(404).json({ error: 'Session not found', sessionId });
      } else {
        // Return success for local extension only
        return res.json({ 
          success: true, 
          session: sessions[sessionIndex],
          message: `Session extended by ${duration} seconds (local only)`
        });
      }
    }
    
    // For UUID formatted sessionIds, attempt to call the Orange API
    console.log(`Calling Orange API to extend session: ${apiSessionId}`);
    
    // Prepare the payload for Orange API
    const apiPayload = {
      requestedAdditionalDuration: parseInt(duration)
    };
    
    // Save API request details for troubleshooting
    const apiRequestDetails = {
      url: `${ORANGE_API_CONFIG.baseUrl}/camara/quality-on-demand/orange-lab/v0/sessions/${apiSessionId}/extend`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.substring(0, 10)}...${accessToken.slice(-5)}`, // Truncated for security
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      data: apiPayload
    };
    
    console.log('API Request Details:', JSON.stringify(apiRequestDetails, null, 2));
    
    // Call the Orange API with the proper parameter name: 'requestedAdditionalDuration'
    const response = await axios({
      method: 'post',
      url: `${ORANGE_API_CONFIG.baseUrl}/camara/quality-on-demand/orange-lab/v0/sessions/${apiSessionId}/extend`,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      data: apiPayload
    });
    
    console.log(`Orange API extension response:`, response.data);
    
    // Combine the local and API responses
    const responseData = {
      success: true,
      apiRequest: apiRequestDetails,
      apiResponse: response.data,
      localSession: sessionIndex !== -1 ? sessions[sessionIndex] : null,
      message: `Session extended by ${duration} seconds (API success)`
    };
    
    return res.json(responseData);
  } catch (error) {
    console.error('Error extending session with Orange API:', error.message);
    if (error.response) {
      console.error('API Response data:', error.response.data);
      console.error('API Response status:', error.response.status);
    }
    
    // If the local update succeeded, still return success but with a warning
    if (sessionIndex !== -1) {
      return res.json({ 
        success: true, 
        warning: 'API extension failed but local session was updated',
        error: error.message,
        apiError: error.response ? error.response.data : null,
        session: sessions[sessionIndex],
        message: `Session extended by ${duration} seconds (local only)`
      });
    } else {
      return res.status(500).json({ 
        error: 'Failed to extend session', 
        apiError: error.response ? error.response.data : null,
        message: error.message 
      });
    }
  }
});

// API endpoints for locations
app.get('/api/locations', (req, res) => {
  const locations = readJsonFile('locations.json');
  res.json(locations);
});

app.post('/api/locations', (req, res) => {
  const locations = readJsonFile('locations.json');
  const newLocation = {
    id: Date.now().toString(),
    ...req.body
  };
  locations.push(newLocation);
  writeJsonFile('locations.json', locations);
  res.status(201).json(newLocation);
});

app.put('/api/locations/:id', (req, res) => {
  const locations = readJsonFile('locations.json');
  const id = req.params.id;
  const index = locations.findIndex(loc => 
    loc.id === id || loc.id === parseInt(id) || loc.id === id.toString()
  );
  
  if (index === -1) {
    return res.status(404).json({ error: 'Location not found' });
  }
  
  const updatedLocation = {
    ...locations[index],
    ...req.body,
    id: locations[index].id // Preserve the original ID format
  };
  
  locations[index] = updatedLocation;
  writeJsonFile('locations.json', locations);
  res.json(updatedLocation);
});

app.delete('/api/locations/:id', (req, res) => {
  const locations = readJsonFile('locations.json');
  const id = req.params.id;
  const newLocations = locations.filter(loc => 
    !(loc.id === id || loc.id === parseInt(id) || loc.id === id.toString())
  );
  
  if (locations.length === newLocations.length) {
    return res.status(404).json({ error: 'Location not found' });
  }
  
  writeJsonFile('locations.json', newLocations);
  res.json({ success: true });
});

// API endpoints for groups
app.get('/api/groups', (req, res) => {
  const groups = readJsonFile('groups.json');
  res.json(groups);
});

app.post('/api/groups', (req, res) => {
  const groups = readJsonFile('groups.json');
  const newGroup = {
    id: Date.now().toString(),
    ...req.body
  };
  groups.push(newGroup);
  writeJsonFile('groups.json', groups);
  res.status(201).json(newGroup);
});

// API endpoint for devices in a group
app.get('/api/groups/:groupId/devices', (req, res) => {
  const groupId = req.params.groupId;
  const allDevices = readJsonFile('devices.json') || [];
  const groupDevices = readJsonFile('group_devices.json') || [];
  
  // Find the device IDs that belong to this group
  const deviceIdsInGroup = groupDevices
    .filter(gd => gd.groupId === groupId || gd.groupId === parseInt(groupId))
    .map(gd => gd.deviceId);
  
  // Get the full device objects for these IDs
  const devicesInGroup = allDevices.filter(device => 
    deviceIdsInGroup.includes(device.id) || deviceIdsInGroup.includes(parseInt(device.id))
  );
  
  res.json(devicesInGroup);
});

// API endpoint to add a device to a group
app.post('/api/groups/:groupId/devices', (req, res) => {
  const groupId = req.params.groupId;
  const { deviceId } = req.body;
  
  // Make sure group exists
  const groups = readJsonFile('groups.json') || [];
  const groupExists = groups.some(g => g.id === groupId || g.id === parseInt(groupId));
  
  if (!groupExists) {
    return res.status(404).json({ error: 'Group not found' });
  }
  
  // Make sure device exists
  const devices = readJsonFile('devices.json') || [];
  const deviceExists = devices.some(d => d.id === deviceId || d.id === parseInt(deviceId));
  
  if (!deviceExists) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  // Add the device to the group
  const groupDevices = readJsonFile('group_devices.json') || [];
  
  // Check if the device is already in the group
  const alreadyExists = groupDevices.some(gd => 
    (gd.groupId === groupId || gd.groupId === parseInt(groupId)) && 
    (gd.deviceId === deviceId || gd.deviceId === parseInt(deviceId))
  );
  
  if (alreadyExists) {
    return res.status(409).json({ error: 'Device already in this group' });
  }
  
  // Add the relationship
  groupDevices.push({
    id: Date.now().toString(),
    groupId,
    deviceId
  });
  
  writeJsonFile('group_devices.json', groupDevices);
  
  // Return the updated list of devices in the group
  const deviceIdsInGroup = groupDevices
    .filter(gd => gd.groupId === groupId || gd.groupId === parseInt(groupId))
    .map(gd => gd.deviceId);
  
  const devicesInGroup = devices.filter(device => 
    deviceIdsInGroup.includes(device.id) || deviceIdsInGroup.includes(parseInt(device.id))
  );
  
  res.status(201).json(devicesInGroup);
});

// API endpoint to remove a device from a group
app.delete('/api/groups/:groupId/devices/:deviceId', (req, res) => {
  const { groupId, deviceId } = req.params;
  
  let groupDevices = readJsonFile('group_devices.json') || [];
  
  // Filter out the relationship we want to delete
  const updatedGroupDevices = groupDevices.filter(gd => 
    !(
      (gd.groupId === groupId || gd.groupId === parseInt(groupId)) && 
      (gd.deviceId === deviceId || gd.deviceId === parseInt(deviceId))
    )
  );
  
  // If no change, the relationship didn't exist
  if (updatedGroupDevices.length === groupDevices.length) {
    return res.status(404).json({ error: 'Device not found in this group' });
  }
  
  writeJsonFile('group_devices.json', updatedGroupDevices);
  res.json({ success: true });
});

// API endpoints for devices
app.get('/api/devices', (req, res) => {
  const devices = readJsonFile('devices.json');
  res.json(devices);
});

// Add device creation endpoint
app.post('/api/devices', (req, res) => {
  try {
    const devices = readJsonFile('devices.json') || [];
    const newDevice = {
      id: Date.now(), // Use timestamp as ID
      ...req.body
    };
    
    // Validate required fields
    if (!newDevice.name || !newDevice.type) {
      return res.status(400).json({ error: 'Name and type are required fields' });
    }
    
    // Set default status if not provided
    if (!newDevice.status) {
      newDevice.status = 'active';
    }
    
    devices.push(newDevice);
    writeJsonFile('devices.json', devices);
    
    res.status(201).json(newDevice);
  } catch (error) {
    console.error('Error creating device:', error);
    res.status(500).json({ error: 'Failed to create device', details: error.message });
  }
});

// Add device update endpoint
app.put('/api/devices/:id', (req, res) => {
  try {
    const deviceId = parseInt(req.params.id);
    const devices = readJsonFile('devices.json') || [];
    const deviceIndex = devices.findIndex(d => d.id === deviceId);
    
    if (deviceIndex === -1) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    // Update device properties while keeping the same ID
    const updatedDevice = {
      ...devices[deviceIndex],
      ...req.body,
      id: deviceId
    };
    
    devices[deviceIndex] = updatedDevice;
    writeJsonFile('devices.json', devices);
    
    res.json(updatedDevice);
  } catch (error) {
    console.error('Error updating device:', error);
    res.status(500).json({ error: 'Failed to update device', details: error.message });
  }
});

// Add device deletion endpoint
app.delete('/api/devices/:id', (req, res) => {
  try {
    const deviceId = parseInt(req.params.id);
    const devices = readJsonFile('devices.json') || [];
    const initialLength = devices.length;
    
    // Filter out the device to be deleted
    const updatedDevices = devices.filter(device => device.id !== deviceId);
    
    // Check if any device was removed
    if (updatedDevices.length === initialLength) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    writeJsonFile('devices.json', updatedDevices);
    
    res.json({ success: true, message: 'Device deleted successfully' });
  } catch (error) {
    console.error('Error deleting device:', error);
    res.status(500).json({ error: 'Failed to delete device', details: error.message });
  }
});

// Endpoint for token status check
app.get('/api/token/status', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      status: 'error',
      message: 'No valid authorization token provided'
    });
  }
  
  // Extract token
  const token = authHeader.split(' ')[1];
  
  // Here we're just checking if the token exists
  // In a real application, you might validate it further
  res.json({
    status: 'success',
    message: 'Valid token found',
    tokenPreview: `${token.substring(0, 10)}...${token.substring(token.length - 5)}`
  });
});

// Endpoint to verify if token is real or simulated
app.get('/api/token/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      status: 'error',
      message: 'No valid authorization token provided'
    });
  }
  
  // Extract token
  const token = authHeader.split(' ')[1];
  
  // Check if token is simulated (starts with dev_simulated_)
  const isSimulated = token.startsWith('dev_simulated_');
  
  res.json({
    status: 'success',
    tokenType: isSimulated ? 'simulated' : 'real',
    isReal: !isSimulated,
    tokenPreview: `${token.substring(0, 10)}...${token.substring(token.length - 5)}`
  });
});

// API endpoint to get Orange API token
app.get('/api/orange-token', async (req, res) => {
  try {
    const tokenData = await getOrangeApiToken();
    if (tokenData) {
      res.json(tokenData);
    } else {
      res.status(500).json({ error: 'Failed to get Orange API token' });
    }
  } catch (error) {
    console.error('Error in orange-token API:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to check device reachability
app.post('/api/device-reachability', async (req, res) => {
  try {
    const { phoneNumber, accessToken } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }
    
    if (!accessToken) {
      return res.status(400).json({ error: 'Access token is required' });
    }
    
    const reachabilityData = await checkDeviceReachability(phoneNumber, accessToken);
    if (reachabilityData) {
      res.json(reachabilityData);
    } else {
      res.status(500).json({ error: 'Failed to check device reachability' });
    }
  } catch (error) {
    console.error('Error in device-reachability API:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to update device status
app.post('/api/devices/:id/update-status', async (req, res) => {
  try {
    const deviceId = req.params.id;
    const { status } = req.body;
    
    if (!deviceId || !status) {
      return res.status(400).json({ error: 'Device ID and status are required' });
    }
    
    // Find the device in the devices array
    const deviceIndex = devices.findIndex(d => d.id === deviceId);
    if (deviceIndex === -1) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    // Update the device status
    devices[deviceIndex].status = status;
    
    res.json({ success: true, device: devices[deviceIndex] });
  } catch (error) {
    console.error('Error updating device status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Function to create a session with Orange API
async function createSessionWithOrangeApi(accessToken, sessionData) {
  try {
    // Prepare headers for API call
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    };
    
    const url = `${ORANGE_API_CONFIG.baseUrl}/camara/quality-on-demand/orange-lab/v0/sessions`;
    console.log(`Calling Orange API to create session`);
    console.log(`API Request: POST ${url}`);
    
    const response = await axios({
      method: 'post',
      url: url,
      headers: headers,
      data: sessionData
    });
    
    console.log('Orange API session creation successful');
    logApiCall('/api/qos/sessions', 'POST', null, headers, sessionData, response.data);
    return response.data;
  } catch (error) {
    console.error('Error creating session with Orange API:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    logApiCall('/api/qos/sessions', 'POST', null, { 'Authorization': `Bearer ${accessToken}` }, sessionData, error);
    throw error;
  }
}

// Get groups for a specific location
app.get('/api/locations/:id/groups', (req, res) => {
  try {
    const locationId = req.params.id;
    const groups = readJsonFile('groups.json');
    
    // Filter groups to only include those belonging to this location
    const locationGroups = groups.filter(group => 
      group.locationId === parseInt(locationId) || 
      group.locationId === locationId || 
      group.locationId === locationId.toString()
    );
    
    // Sort groups by creation date, newest first
    locationGroups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json(locationGroups);
  } catch (error) {
    console.error('Error getting location groups:', error);
    res.status(500).json({ error: 'Unable to get groups for this location' });
  }
});

// Delete a group
app.delete('/api/groups/:id', (req, res) => {
  try {
    const groupId = req.params.id;
    const groups = readJsonFile('groups.json') || [];
    const initialLength = groups.length;
    
    // Filter out the group to be deleted
    const updatedGroups = groups.filter(group => 
      !(group.id === groupId || group.id === parseInt(groupId) || group.id === groupId.toString())
    );
    
    // Check if any group was removed
    if (updatedGroups.length === initialLength) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    // Also remove any group-device associations
    const groupDevices = readJsonFile('group_devices.json') || [];
    const updatedGroupDevices = groupDevices.filter(gd => 
      !(gd.groupId === groupId || gd.groupId === parseInt(groupId) || gd.groupId === groupId.toString())
    );
    
    // Save the updated data
    writeJsonFile('groups.json', updatedGroups);
    writeJsonFile('group_devices.json', updatedGroupDevices);
    
    res.json({ success: true, message: 'Group deleted successfully' });
  } catch (error) {
    console.error('Error deleting group:', error);
    res.status(500).json({ error: 'Failed to delete group', details: error.message });
  }
});

// Update a group
app.put('/api/groups/:id', (req, res) => {
  try {
    const groupId = req.params.id;
    const groups = readJsonFile('groups.json') || [];
    const groupIndex = groups.findIndex(g => 
      g.id === groupId || 
      g.id === parseInt(groupId) || 
      g.id === groupId.toString()
    );
    
    if (groupIndex === -1) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    // Update group while preserving its ID and creation date
    const updatedGroup = {
      ...groups[groupIndex],
      ...req.body,
      id: groups[groupIndex].id,
      createdAt: groups[groupIndex].createdAt
    };
    
    groups[groupIndex] = updatedGroup;
    
    // Update group-device associations if devices were provided
    if (req.body.devices) {
      const groupDevices = readJsonFile('group_devices.json') || [];
      
      // Remove all existing associations for this group
      const filteredGroupDevices = groupDevices.filter(gd => 
        !(gd.groupId === groupId || 
          gd.groupId === parseInt(groupId) || 
          gd.groupId === groupId.toString())
      );
      
      // Add new associations
      const newAssociations = req.body.devices.map(deviceId => ({
        groupId: groupId,
        deviceId: deviceId
      }));
      
      // Save updated associations
      writeJsonFile('group_devices.json', [...filteredGroupDevices, ...newAssociations]);
    }
    
    // Save updated groups
    writeJsonFile('groups.json', groups);
    
    res.json(updatedGroup);
  } catch (error) {
    console.error('Error updating group:', error);
    res.status(500).json({ error: 'Failed to update group', details: error.message });
  }
});

// Get devices for a location
app.get('/api/locations/:id/devices', (req, res) => {
  try {
    const locationId = req.params.id;
    const devices = readJsonFile('devices.json') || [];
    
    // Filter devices by location
    const locationDevices = devices.filter(device => 
      device.locationId === locationId || 
      device.locationId === parseInt(locationId) || 
      device.locationId === locationId.toString()
    );
    
    res.json(locationDevices);
  } catch (error) {
    console.error('Error getting location devices:', error);
    res.status(500).json({ error: 'Failed to get location devices', details: error.message });
  }
});

// Get devices for a group
app.get('/api/groups/:id/devices', (req, res) => {
  try {
    const groupId = req.params.id;
    const groupDevices = readJsonFile('group_devices.json') || [];
    const devices = readJsonFile('devices.json') || [];
    
    // Get device IDs for this group
    const deviceIds = groupDevices
      .filter(gd => 
        gd.groupId === groupId || 
        gd.groupId === parseInt(groupId) || 
        gd.groupId === groupId.toString()
      )
      .map(gd => gd.deviceId);
    
    // Get full device details
    const fullDevices = devices.filter(device => 
      deviceIds.includes(device.id) || 
      deviceIds.includes(device.id.toString()) || 
      deviceIds.includes(parseInt(device.id))
    );
    
    res.json(fullDevices);
  } catch (error) {
    console.error('Error getting group devices:', error);
    res.status(500).json({ error: 'Failed to get group devices', details: error.message });
  }
});

// Get a specific group by ID
app.get('/api/groups/:id', (req, res) => {
  try {
    const groupId = req.params.id;
    const groups = readJsonFile('groups.json') || [];
    
    // Find the group, handling different ID formats
    const group = groups.find(g => 
      g.id === groupId || 
      g.id === parseInt(groupId) || 
      g.id === groupId.toString()
    );
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    res.json(group);
  } catch (error) {
    console.error('Error getting group:', error);
    res.status(500).json({ error: 'Failed to get group', details: error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`QNow Platform server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT}/ in your browser`);
});

app.get('/api/debug/latest-log', (req, res) => {
  try {
    const logFilePath = path.join(__dirname, 'api-debug.log');
    
    if (!fs.existsSync(logFilePath)) {
      // Create default log file if it doesn't exist
      const defaultLog = {
        timestamp: new Date().toISOString(),
        endpoint: '/api/init',
        method: 'INIT',
        sessionId: null,
        headers: {},
        body: null,
        response: { status: 'No API calls logged yet' }
      };
      fs.writeFileSync(logFilePath, JSON.stringify(defaultLog, null, 2), 'utf8');
      return res.json(defaultLog);
    }
    
    // Read the log file
    const logData = fs.readFileSync(logFilePath, 'utf8');
    
    if (!logData || logData.trim() === '') {
      // Return empty data if file is empty
      const emptyLog = {
        timestamp: new Date().toISOString(),
        endpoint: '/api/init',
        method: 'INIT',
        sessionId: null,
        headers: {},
        body: null,
        response: { status: 'No API calls logged yet' }
      };
      return res.json(emptyLog);
    }
    
    try {
      // Safely try to parse the log data
      const logEntry = JSON.parse(logData);
      return res.json(logEntry);
    } catch (parseError) {
      console.error('Error parsing log file:', parseError);
      
      // If parsing fails, return a fallback log and reset the file
      const fallbackLog = {
        timestamp: new Date().toISOString(),
        endpoint: '/api/recovery',
        method: 'GET',
        sessionId: null,
        headers: {},
        body: null,
        response: { 
          status: 'Log file was corrupted and has been reset',
          error: parseError.message
        }
      };
      
      // Reset the log file with valid content
      fs.writeFileSync(logFilePath, JSON.stringify(fallbackLog, null, 2), 'utf8');
      
      // Return the fallback response
      return res.json(fallbackLog);
    }
  } catch (err) {
    console.error('Error reading log file:', err);
    res.status(500).json({ 
      error: 'Failed to read log file',
      message: err.message
    });
  }
}); 