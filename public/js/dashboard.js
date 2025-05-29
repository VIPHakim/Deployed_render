/**
 * Dashboard functionality for QNow Platform
 * This handles the dashboard UI, statistics, and map visualization
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('Dashboard.js: Initializing dashboard functionality');
  
  // DOM elements
  const dashboardContainer = document.getElementById('dashboard-container');
  const dashboardMap = document.getElementById('dashboard-map');
  const activeDevicesEl = document.getElementById('dashboard-active-devices');
  const locationsEl = document.getElementById('dashboard-locations');
  const qosProfilesEl = document.getElementById('dashboard-qos-profiles');
  const networkStatusEl = document.getElementById('dashboard-network-status');
  const refreshMapBtn = document.getElementById('refresh-map-btn');
  
  // Map instance
  let map = null;
  let deviceMarkers = [];
  
  // Initialize dashboard when it becomes visible
  window.renderDashboard = async function() {
    try {
      console.log('Rendering dashboard...');
      
      // Initialize data
      await Promise.all([
        fetchDashboardStats(),
        initializeMap()
      ]);
      
      console.log('Dashboard rendered successfully');
    } catch (error) {
      console.error('Error rendering dashboard:', error);
      showAlert('Unable to load dashboard data. Please try again later.', 'danger');
    }
  };
  
  // Fetch and update dashboard statistics
  async function fetchDashboardStats() {
    try {
      console.log('Fetching dashboard statistics...');
      
      // Fetch devices
      const devicesResponse = await fetch('/api/devices');
      const devices = await devicesResponse.json();
      const activeDevices = devices.filter(d => d.status === 'active').length;
      
      // Fetch locations
      const locationsResponse = await fetch('/api/locations');
      const locations = await locationsResponse.json();
      
      // Fetch QoS profiles (if available)
      let qosProfiles = [];
      try {
        const qosResponse = await fetch('/api/qos-profiles');
        if (qosResponse.ok) {
          qosProfiles = await qosResponse.json();
        }
      } catch (error) {
        console.warn('QoS profiles could not be loaded:', error);
        qosProfiles = [];
      }
      
      // Update UI
      activeDevicesEl.textContent = activeDevices;
      locationsEl.textContent = locations.length;
      qosProfilesEl.textContent = qosProfiles.length || '4'; // Fallback to default value
      
      // Calculate device distribution for display
      updateDeviceDistribution(devices);
      
      return {
        devices,
        locations,
        qosProfiles
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw error;
    }
  }
  
  // Update device distribution stats in the map overlay
  function updateDeviceDistribution(devices) {
    const distribution = {};
    
    // Count devices by type
    devices.forEach(device => {
      if (!distribution[device.type]) {
        distribution[device.type] = 0;
      }
      distribution[device.type]++;
    });
    
    // Update the UI
    const distributionContainer = document.getElementById('dashboard-device-distribution');
    if (distributionContainer) {
      let html = '';
      
      // Define colors for different device types
      const typeColors = {
        'Camera': 'primary',
        'POS': 'success',
        'XR': 'danger',
        'Broadcasting': 'info',
        'Safety': 'warning',
        'Other': 'secondary'
      };
      
      // Create HTML for each device type
      Object.keys(distribution).forEach(type => {
        const color = typeColors[type] || 'secondary';
        html += `
          <div class="d-flex justify-content-between mb-2">
            <span>${type}</span>
            <span class="badge bg-${color}">${distribution[type]}</span>
          </div>
        `;
      });
      
      distributionContainer.innerHTML = html || '<p class="text-muted">No devices found</p>';
    }
  }
  
  // Initialize the map with locations and devices
  async function initializeMap() {
    if (!dashboardMap) {
      console.error('Dashboard map element not found');
      return;
    }
    
    try {
      // Fetch data needed for the map
      const [devicesResponse, locationsResponse] = await Promise.all([
        fetch('/api/devices'),
        fetch('/api/locations')
      ]);
      
      const devices = await devicesResponse.json();
      const locations = await locationsResponse.json();
      
      // Create or update map
      if (!map) {
        // Initialize the map
        map = L.map(dashboardMap, {
          zoomControl: true,
          attributionControl: false
        });
        
        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19
        }).addTo(map);
        
        // Add attribution in a better position
        L.control.attribution({
          position: 'bottomright'
        }).addAttribution('© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>').addTo(map);
      } else {
        // Clear existing markers
        deviceMarkers.forEach(marker => marker.remove());
        deviceMarkers = [];
      }
      
      // If no locations, center on a default location
      if (locations.length === 0) {
        map.setView([48.8566, 2.3522], 10); // Paris coordinates
        return;
      }
      
      // Create markers for each location with its devices
      const bounds = L.latLngBounds();
      
      locations.forEach(location => {
        // Add location to bounds
        const latLng = L.latLng(location.latitude, location.longitude);
        bounds.extend(latLng);
        
        // Get devices for this location
        const locationDevices = devices.filter(d => d.locationId === location.id);
        
        // Create location marker
        const locationMarker = L.marker(latLng, {
          icon: L.divIcon({
            className: 'location-marker',
            html: `<i class="bi bi-geo-alt-fill" style="color: #3498db; font-size: 24px;"></i>`,
            iconSize: [24, 24],
            iconAnchor: [12, 24]
          })
        }).addTo(map);
        
        // Add location popup
        locationMarker.bindPopup(`
          <div class="location-popup">
            <h5>${location.name}</h5>
            <p><strong>Devices:</strong> ${locationDevices.length}</p>
            <p>
              <strong>Active:</strong> ${locationDevices.filter(d => d.status === 'active').length} |
              <strong>Inactive:</strong> ${locationDevices.filter(d => d.status === 'inactive').length} |
              <strong>Maintenance:</strong> ${locationDevices.filter(d => d.status === 'maintenance').length}
            </p>
          </div>
        `);
        
        // Add device markers around the location
        const radius = 0.002; // Approximately 200m radius
        locationDevices.forEach((device, index) => {
          // Calculate position around the location (in a circle)
          const angle = (360 / locationDevices.length) * index * (Math.PI / 180);
          const deviceLat = location.latitude + radius * Math.cos(angle);
          const deviceLng = location.longitude + radius * Math.sin(angle);
          
          // Determine icon based on device type and status
          let iconClass = 'bi-device-hdd';
          let iconColor = '#3498db';
          
          // Assign icon based on device type
          switch (device.type) {
            case 'Camera':
              iconClass = 'bi-camera-video';
              iconColor = '#3498db'; // Blue
              break;
            case 'POS':
              iconClass = 'bi-credit-card';
              iconColor = '#2ecc71'; // Green
              break;
            case 'XR':
              iconClass = 'bi-badge-vr';
              iconColor = '#9b59b6'; // Purple
              break;
            case 'Broadcasting':
              iconClass = 'bi-broadcast';
              iconColor = '#1abc9c'; // Teal
              break;
            case 'Safety':
              iconClass = 'bi-shield';
              iconColor = '#e67e22'; // Orange
              break;
            default:
              iconClass = 'bi-device-hdd';
              iconColor = '#7f8c8d'; // Gray
          }
          
          // Change color based on status
          if (device.status === 'inactive') {
            iconColor = '#e74c3c'; // Red
          } else if (device.status === 'maintenance') {
            iconColor = '#f39c12'; // Yellow
          }
          
          // Create device marker
          const deviceMarker = L.marker([deviceLat, deviceLng], {
            icon: L.divIcon({
              className: 'device-marker',
              html: `<i class="bi ${iconClass}" style="color: ${iconColor}; font-size: 18px;"></i>`,
              iconSize: [18, 18],
              iconAnchor: [9, 9]
            })
          }).addTo(map);
          
          // Add device popup
          deviceMarker.bindPopup(`
            <div class="device-popup">
              <h5>${device.name}</h5>
              <p><strong>Type:</strong> ${device.type}</p>
              <p><strong>Status:</strong> <span class="badge ${getStatusBadgeClass(device.status)}">${device.status}</span></p>
              <p><strong>IP:</strong> ${device.ipAddress || 'N/A'}</p>
            </div>
          `);
          
          // Store marker for later removal
          deviceMarkers.push(deviceMarker);
        });
      });
      
      // Adjust map view to show all locations
      map.fitBounds(bounds, {
        padding: [30, 30]
      });
      
      // Handle window resize for map
      window.addEventListener('resize', () => {
        if (map) {
          setTimeout(() => map.invalidateSize(), 100);
        }
      });
      
      // Ensure map is properly sized after display
      setTimeout(() => {
        if (map) {
          map.invalidateSize();
        }
      }, 300);
      
    } catch (error) {
      console.error('Error initializing map:', error);
      throw error;
    }
  }
  
  // Get the badge class based on status
  function getStatusBadgeClass(status) {
    switch(status) {
      case 'active':
        return 'bg-success';
      case 'inactive':
        return 'bg-danger';
      case 'maintenance':
        return 'bg-warning';
      default:
        return 'bg-secondary';
    }
  }
  
  // Show an alert message
  function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.role = 'alert';
    alertDiv.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    // Add the alert to the container
    const alertContainer = document.getElementById('alert-container');
    if (alertContainer) {
      alertContainer.appendChild(alertDiv);
      
      // Automatically remove the alert after 5 seconds
      setTimeout(() => {
        alertDiv.classList.remove('show');
        setTimeout(() => alertDiv.remove(), 150);
      }, 5000);
    }
  }
  
  // Handle refresh map button
  if (refreshMapBtn) {
    refreshMapBtn.addEventListener('click', async () => {
      try {
        refreshMapBtn.disabled = true;
        await Promise.all([
          fetchDashboardStats(),
          initializeMap()
        ]);
        showAlert('Dashboard data refreshed successfully', 'success');
      } catch (error) {
        console.error('Error refreshing map:', error);
        showAlert('Error refreshing map data', 'danger');
      } finally {
        refreshMapBtn.disabled = false;
      }
    });
  }
  
  // Add dashboard link click handler to initialize on first load
  const dashboardLink = document.querySelector('.nav-link[href="#dashboard"]');
  if (dashboardLink) {
    dashboardLink.addEventListener('click', function() {
      setTimeout(window.renderDashboard, 100);
    });
  }
}); 