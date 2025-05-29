/**
 * Device Search Functionality
 * This script adds search functionality to the devices page
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('Initializing devices search functionality');
  
  // Only initialize once the main devices script has loaded
  window.addEventListener('devicesLoaded', () => {
    console.log('Devices loaded event received, initializing search');
    initDevicesSearch();
  });
  
  // Check if we're already on devices page with data loaded
  if (window.location.hash === '#devices') {
    setTimeout(() => {
      const rows = document.querySelectorAll('#devices-table-body tr');
      if (rows.length > 0 && rows[0].className !== 'no-results-row') {
        console.log('Devices already loaded, initializing search directly');
        initDevicesSearch();
      }
    }, 1000); // Give some time for the table to be populated
  }
  
  function initDevicesSearch() {
    // Get search elements
    const deviceSearchInput = document.getElementById('device-search');
    const deviceSearchBtn = document.getElementById('device-search-btn');
    
    if (!deviceSearchInput || !deviceSearchBtn) {
      console.error('Search elements not found in the DOM');
      return;
    }
    
    console.log('Search elements found, setting up search functionality');
    
    // Variables to store devices data
    let allDevices = [];
    
    // Function to filter devices based on search term
    function filterDevices(searchTerm) {
      console.log(`Filtering devices with search term: "${searchTerm}"`);
      
      // Get all current devices from table rows
      allDevices = collectDevicesFromTable();
      console.log(`Collected ${allDevices.length} devices from table`);
      
      if (!searchTerm || searchTerm.trim() === '') {
        // If no search term, show all devices
        updateDeviceRows(allDevices);
        return;
      }
      
      const term = searchTerm.toLowerCase().trim();
      const filteredDevices = allDevices.filter(device => 
        device.name.toLowerCase().includes(term) ||
        device.type.toLowerCase().includes(term) ||
        (device.ipAddress && device.ipAddress.toLowerCase().includes(term)) ||
        (device.msisdn && device.msisdn.toLowerCase().includes(term))
      );
      
      console.log(`Found ${filteredDevices.length} devices matching search term`);
      updateDeviceRows(filteredDevices);
    }
    
    // Function to update row visibility based on filtered devices
    function updateDeviceRows(devices) {
      const devicesTableBody = document.getElementById('devices-table-body');
      if (!devicesTableBody) {
        console.error('Devices table body not found');
        return;
      }
      
      // Store current rows
      const rows = Array.from(devicesTableBody.querySelectorAll('tr'));
      console.log(`Found ${rows.length} rows in the table`);
      
      if (devices.length === 0) {
        // Hide all rows
        rows.forEach(row => {
          if (!row.classList.contains('no-results-row')) {
            row.style.display = 'none';
          }
        });
        
        // Show or create "no results" message
        const existingNoResultsRow = devicesTableBody.querySelector('.no-results-row');
        
        if (existingNoResultsRow) {
          existingNoResultsRow.style.display = '';
          const messageParagraph = existingNoResultsRow.querySelector('p');
          if (messageParagraph) {
            messageParagraph.textContent = `No devices matching "${deviceSearchInput.value}" found.`;
          }
        } else {
          // Create a "no results" message
          const noResultsRow = document.createElement('tr');
          noResultsRow.className = 'no-results-row';
          noResultsRow.innerHTML = `
            <td colspan="6" class="text-center">
              <p class="my-3 text-muted">No devices matching "${deviceSearchInput.value}" found.</p>
            </td>
          `;
          devicesTableBody.appendChild(noResultsRow);
        }
        return;
      }
      
      // If we have results, remove any "no results" message
      const noResultsRow = devicesTableBody.querySelector('.no-results-row');
      if (noResultsRow) {
        noResultsRow.style.display = 'none';
      }
      
      // Get device IDs to show
      const deviceIds = new Set(devices.map(device => device.id));
      
      // Show/hide rows based on filter
      let visibleCount = 0;
      rows.forEach(row => {
        // Skip the no-results-row
        if (row.classList.contains('no-results-row')) return;
        
        const deviceId = parseInt(row.getAttribute('data-device-id'));
        
        if (deviceIds.has(deviceId)) {
          row.style.display = '';
          visibleCount++;
        } else {
          row.style.display = 'none';
        }
      });
      
      console.log(`Made ${visibleCount} rows visible out of ${rows.length}`);
    }
    
    // Function to collect all devices from the table
    function collectDevicesFromTable() {
      const devicesTableBody = document.getElementById('devices-table-body');
      if (!devicesTableBody) {
        console.error('Devices table body not found when collecting devices');
        return [];
      }
      
      const devices = [];
      const rows = devicesTableBody.querySelectorAll('tr:not(.no-results-row)');
      
      rows.forEach(row => {
        // Skip if this is a message row
        if (row.classList.contains('no-results-row')) return;
        
        const deviceId = row.getAttribute('data-device-id');
        if (!deviceId) {
          console.warn('Row without device-id attribute found:', row);
          return;
        }
        
        const cols = row.querySelectorAll('td');
        if (cols.length < 5) {
          console.warn('Row with insufficient columns found:', row);
          return;
        }
        
        const device = {
          id: parseInt(deviceId),
          name: cols[0].textContent.trim(),
          type: cols[1].textContent.trim(),
          ipAddress: cols[2].textContent.trim().replace('Not set', ''),
          msisdn: cols[3].textContent.trim().replace('Not set', ''),
          status: cols[4].querySelector('.badge')?.textContent.trim() || 'unknown'
        };
        
        devices.push(device);
      });
      
      return devices;
    }
    
    // Handle search button click
    deviceSearchBtn.addEventListener('click', () => {
      console.log('Search button clicked');
      filterDevices(deviceSearchInput.value);
    });
    
    // Handle search input changes (real-time filtering)
    deviceSearchInput.addEventListener('input', () => {
      console.log('Search input changed');
      filterDevices(deviceSearchInput.value);
    });
    
    // Allow search by pressing Enter
    deviceSearchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        console.log('Enter key pressed in search input');
        e.preventDefault();
        filterDevices(deviceSearchInput.value);
      }
    });
    
    // Set up a MutationObserver to detect when the table changes
    const observer = new MutationObserver((mutations) => {
      console.log('Table mutation detected');
      let shouldRefresh = false;
      
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          shouldRefresh = true;
          break;
        }
      }
      
      if (shouldRefresh && deviceSearchInput.value.trim() !== '') {
        console.log('Table changed, reapplying search filter');
        setTimeout(() => filterDevices(deviceSearchInput.value), 200);
      }
    });
    
    const devicesTableBody = document.getElementById('devices-table-body');
    if (devicesTableBody) {
      observer.observe(devicesTableBody, { childList: true, subtree: true });
      console.log('MutationObserver set up for devices table');
    }
    
    console.log('Device search functionality initialized successfully');
  }
}); 