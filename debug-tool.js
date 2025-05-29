const fs = require('fs');
const path = require('path');

// Log file path
const logFilePath = path.join(__dirname, 'api-debug.log');

// Function to log API calls
function logApiCall(endpoint, method, sessionId, headers, body, response) {
  try {
    // Ensure we don't log sensitive auth info
    const safeHeaders = { ...headers };
    if (safeHeaders && safeHeaders.Authorization) {
      const authParts = safeHeaders.Authorization.split(' ');
      if (authParts.length > 1) {
        const token = authParts[1];
        safeHeaders.Authorization = `Bearer ${token.substring(0, 5)}...${token.slice(-5)}`;
      }
    }
    
    // Handle errors in response
    let safeResponse = {};
    if (response instanceof Error) {
      safeResponse = {
        error: true,
        message: response.message
      };
      
      if (response.response) {
        safeResponse.statusCode = response.response.status;
        safeResponse.data = response.response.data;
      }
    } else {
      safeResponse = response || {};
    }
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      endpoint,
      method,
      sessionId,
      headers: safeHeaders || {},
      body,
      response: safeResponse
    };

    // First, ensure the log entry is valid JSON by converting it
    const logString = JSON.stringify(logEntry, null, 2);
    
    // Write the file with explicit encoding options to prevent BOM and encoding issues
    // Use { encoding: 'utf8', flag: 'w' } to overwrite the file completely
    fs.writeFileSync(logFilePath, logString, { encoding: 'utf8', flag: 'w' });
    
    // Verify the file was written correctly by reading it back
    try {
      const verifyData = fs.readFileSync(logFilePath, 'utf8');
      JSON.parse(verifyData); // Test parsing to ensure it's valid JSON
      console.log(`API call logged: ${method} ${endpoint}`);
    } catch (verifyErr) {
      console.error('Verification of log file failed, attempting recovery:', verifyErr);
      // If verification fails, write a clean, simple log
      const fallbackLog = {
        timestamp: new Date().toISOString(),
        endpoint,
        method,
        sessionId,
        headers: {},
        message: "Original log failed verification - recovery log"
      };
      fs.writeFileSync(logFilePath, JSON.stringify(fallbackLog, null, 2), { encoding: 'utf8', flag: 'w' });
    }
  } catch (err) {
    console.error('Error writing to log file:', err);
    // Create a simple fallback log
    try {
      const fallbackLog = {
        timestamp: new Date().toISOString(),
        endpoint: endpoint || '/unknown',
        method: method || 'UNKNOWN',
        message: "Error in original logging - fallback log created"
      };
      fs.writeFileSync(logFilePath, JSON.stringify(fallbackLog, null, 2), { encoding: 'utf8', flag: 'w' });
    } catch (fallbackErr) {
      console.error('Even fallback logging failed:', fallbackErr);
    }
  }
}

module.exports = logApiCall; 