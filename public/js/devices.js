/**
 * Gestion des dispositifs (Devices)
 * Ce script gère l'affichage, l'ajout, la modification et la suppression des dispositifs
 * ainsi que l'importation via fichier CSV
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('Devices.js: DOM is loaded, starting initialization');
  
  // Éléments du DOM
  const devicesContainer = document.getElementById('devices-container');
  const devicesTableBody = document.getElementById('devices-table-body');
  const addDeviceBtn = document.getElementById('add-device-btn');
  const importDevicesBtn = document.getElementById('import-devices-btn');
  const deviceSearchInput = document.getElementById('device-search');
  const deviceSearchBtn = document.getElementById('device-search-btn');
  
  // Log DOM elements for debugging
  console.log('Devices DOM elements found:', {
    devicesContainer: !!devicesContainer,
    devicesTableBody: !!devicesTableBody,
    addDeviceBtn: !!addDeviceBtn,
    importDevicesBtn: !!importDevicesBtn,
    deviceSearchInput: !!deviceSearchInput,
    deviceSearchBtn: !!deviceSearchBtn
  });

  // If devicesTableBody is not found, we have a serious problem
  if (!devicesTableBody) {
    console.error('CRITICAL ERROR: devices-table-body not found in the DOM. Device list cannot be rendered.');
  }
  
  // État de l'application
  let devices = [];
  let filteredDevices = [];
  let searchTerm = '';
  
  // Récupérer tous les dispositifs depuis l'API
  async function fetchDevices(force = false, locationId = null) {
    try {
      // Si nous avons déjà des dispositifs et que nous ne forçons pas le rafraîchissement
      if (devices.length > 0 && !force) {
        console.log('Using cached devices:', devices.length);
        filterAndRenderDevices();
        return devices;
      }
      
      console.log('Fetching devices from API');
      
      // Build URL with optional locationId filter
      let url = '/api/devices';
      if (locationId) {
        url += `?locationId=${locationId}`;
      } else if (window.currentLocationId) {
        url += `?locationId=${window.currentLocationId}`;
      }
      
      const response = await fetch(url);
      console.log('API response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`Error retrieving devices. Status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Raw API response data:', data);
      
      if (!Array.isArray(data)) {
        console.error('API response is not an array:', data);
        throw new Error('Invalid response format: expected an array of devices');
      }
      
      devices = data;
      console.log('Devices retrieved from API:', devices.length);
      filterAndRenderDevices();
      
      // Dispatch an event to notify that devices have been loaded (even if empty)
      document.dispatchEvent(new Event('devicesLoaded'));
      
      return devices;
    } catch (error) {
      console.error('Error fetching devices:', error);
      showAlert('Unable to retrieve devices. Please try again later.', 'danger');
      return [];
    }
  }
  
  // Filtrer les appareils en fonction du terme de recherche
  function filterDevices() {
    if (!searchTerm || searchTerm.trim() === '') {
      filteredDevices = [...devices];
      return;
    }
    
    const term = searchTerm.toLowerCase().trim();
    filteredDevices = devices.filter(device => 
      device.name.toLowerCase().includes(term) ||
      device.type.toLowerCase().includes(term) ||
      (device.ipAddress && device.ipAddress.toLowerCase().includes(term)) ||
      (device.msisdn && device.msisdn.toLowerCase().includes(term))
    );
  }
  
  // Fonction combinée pour filtrer et afficher les appareils
  function filterAndRenderDevices() {
    filterDevices();
    renderDevices();
  }
  
  // Afficher une alerte
  function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.role = 'alert';
    alertDiv.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    // Ajouter l'alerte au conteneur
    const alertContainer = document.getElementById('alert-container');
    if (alertContainer) {
      alertContainer.appendChild(alertDiv);
      
      // Supprimer automatiquement l'alerte après 5 secondes
      setTimeout(() => {
        alertDiv.classList.remove('show');
        setTimeout(() => alertDiv.remove(), 150);
      }, 5000);
    }
  }
  
  // Afficher les dispositifs dans le tableau
  function renderDevices() {
    if (!devicesTableBody) return;
    
    // Vider le tableau
    devicesTableBody.innerHTML = '';
    
    // Utilisez les appareils filtrés au lieu de tous les appareils
    const devicesToRender = filteredDevices;
    
    if (devicesToRender.length === 0) {
      // Afficher un message si aucun dispositif
      const emptyRow = document.createElement('tr');
      if (searchTerm && searchTerm.trim() !== '') {
        emptyRow.innerHTML = `
          <td colspan="6" class="text-center">
            <p class="my-3 text-muted">No devices matching "${searchTerm}" found.</p>
          </td>
        `;
      } else {
        emptyRow.innerHTML = `
          <td colspan="6" class="text-center">
            <p class="my-3 text-muted">No devices found. Add a new device or import devices from CSV.</p>
          </td>
        `;
      }
      devicesTableBody.appendChild(emptyRow);
      
      // Dispatch an event to notify that devices have been loaded (even if empty)
      document.dispatchEvent(new Event('devicesLoaded'));
      return;
    }
    
    // Trier les dispositifs par type puis par nom
    devicesToRender.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type.localeCompare(b.type);
      }
      return a.name.localeCompare(b.name);
    });
    
    // Ajouter chaque dispositif au tableau
    devicesToRender.forEach(device => {
      const row = document.createElement('tr');
      
      // Add data attributes for device status manager
      row.setAttribute('data-device-id', device.id);
      row.setAttribute('data-device-name', device.name);
      
      // Définir la classe de style en fonction du statut
      if (device.status === 'inactive') {
        row.classList.add('table-danger');
      } else if (device.status === 'maintenance') {
        row.classList.add('table-warning');
      }
      
      row.innerHTML = `
        <td>${device.name}</td>
        <td>${device.type}</td>
        <td>${device.ipAddress || '<em class="text-muted">Not set</em>'}</td>
        <td>${device.msisdn || '<em class="text-muted">Not set</em>'}</td>
        <td class="device-status-cell">
          <span class="badge ${getStatusBadgeClass(device.status)}">${device.status}</span>
        </td>
        <td>
          <button class="btn btn-sm btn-outline-primary edit-device-btn" data-id="${device.id}">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger delete-device-btn" data-id="${device.id}">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      `;
      
      devicesTableBody.appendChild(row);
    });
    
    // Ajouter les gestionnaires d'événements aux boutons d'action
    document.querySelectorAll('.edit-device-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const deviceId = parseInt(e.currentTarget.dataset.id);
        const device = devices.find(d => d.id === deviceId);
        if (device) {
          showEditDeviceModal(device);
        }
      });
    });
    
    document.querySelectorAll('.delete-device-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const deviceId = parseInt(e.currentTarget.dataset.id);
        if (confirm('Are you sure you want to delete this device?')) {
          deleteDevice(deviceId);
        }
      });
    });
    
    // Dispatch an event to notify that devices have been rendered
    document.dispatchEvent(new CustomEvent('devicesRendered', { detail: { devices: devicesToRender } }));
  }
  
  // Obtenir la classe de badge en fonction du statut
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
  
  // Supprimer un dispositif via l'API
  async function deleteDevice(deviceId) {
    try {
      const response = await fetch(`/api/devices/${deviceId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Error deleting the device');
      }
      
      // Mettre à jour la liste des dispositifs
      devices = devices.filter(device => device.id !== deviceId);
      filterAndRenderDevices();
      
      showAlert('Device successfully deleted.', 'success');
    } catch (error) {
      console.error('Error:', error);
      showAlert('Unable to delete the device. Please try again later.', 'danger');
    }
  }
  
  // Ajouter un nouveau dispositif via l'API
  async function addDevice(deviceData) {
    try {
      console.log('Sending device data to server:', deviceData);
      
      // Check if server is reachable first
      try {
        const pingResponse = await fetch('/api/devices', { method: 'GET' });
        console.log('Server ping status:', pingResponse.status, pingResponse.ok ? 'Server is reachable' : 'Server issue detected');
      } catch (pingError) {
        console.error('Server ping failed, connectivity issue detected:', pingError);
        throw new Error('Cannot connect to server. Please check your network connection or if the server is running.');
      }
      
      console.log('Attempting to send POST request to /api/devices');
      const response = await fetch('/api/devices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(deviceData)
      });
      
      console.log('POST response received:', response.status, response.statusText);
      
      if (!response.ok) {
        let errorMessage = '';
        try {
          const errorData = await response.text();
          console.error('Error response body:', errorData);
          try {
            const errorJson = JSON.parse(errorData);
            errorMessage = errorJson.error || 'Unknown server error';
          } catch (jsonError) {
            errorMessage = errorData || 'Unknown server error';
          }
        } catch (readError) {
          console.error('Could not read error response:', readError);
          errorMessage = 'Could not read error details from server';
        }
        
        console.error('Server error details:', {
          status: response.status, 
          statusText: response.statusText,
          errorMessage
        });
        
        if (response.status === 0 || !window.navigator.onLine) {
          throw new Error('Network connection error. Please check your internet connection.');
        } else if (response.status === 500) {
          throw new Error(`Server error: ${errorMessage}`);
        } else {
          throw new Error(`Error adding the device: ${errorMessage || response.statusText}`);
        }
      }
      
      let newDevice;
      try {
        newDevice = await response.json();
        console.log('Device successfully added, server returned:', newDevice);
      } catch (parseError) {
        console.error('Error parsing success response:', parseError);
        throw new Error('Server returned an invalid response. Device may or may not have been added.');
      }
      
      // Forcer le rafraîchissement des dispositifs pour mettre à jour l'affichage
      await fetchDevices(true);
      
      showAlert('Device successfully added.', 'success');
      return true;
    } catch (error) {
      console.error('Error adding device:', error);
      showAlert(`Unable to add the device: ${error.message}`, 'danger');
      return false;
    }
  }
  
  // Mettre à jour un dispositif existant via l'API
  async function updateDevice(deviceId, deviceData) {
    try {
      console.log('Updating device:', deviceId, deviceData);
      
      const response = await fetch(`/api/devices/${deviceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(deviceData)
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('Server error:', response.status, response.statusText);
        console.error('Error details:', errorData);
        
        if (response.status === 0 || !window.navigator.onLine) {
          throw new Error('Network connection error. Please check your internet connection.');
        } else if (response.status === 404) {
          throw new Error('Device not found. It may have been deleted.');
        } else if (response.status === 500) {
          throw new Error('Server error. The server could not process your request.');
        } else {
          throw new Error(`Error updating the device: ${response.status} ${response.statusText}`);
        }
      }
      
      const updatedDevice = await response.json();
      console.log('Device successfully updated:', updatedDevice);
      
      // Forcer le rafraîchissement des dispositifs pour mettre à jour l'affichage
      await fetchDevices(true);
      
      showAlert('Device successfully updated.', 'success');
      return true;
    } catch (error) {
      console.error('Error updating device:', error);
      showAlert(`Unable to update the device: ${error.message}`, 'danger');
      return false;
    }
  }
  
  // Importer des dispositifs à partir d'un fichier CSV ou d'un texte
  async function importDevicesFromCSV(csvContent) {
    try {
      console.log('Importing devices from CSV content...');
      
      // Check if there's content to import
      if (!csvContent || csvContent.trim() === '') {
        throw new Error('No CSV content provided');
      }
      
      showAlert('Processing device import...', 'info');
      
      // Send the CSV content to the server
      const response = await fetch('/api/devices/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ csvContent })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error:', response.status, response.statusText);
        console.error('Error details:', errorText);
        
        throw new Error(`Import failed: ${errorText}`);
      }
      
      const result = await response.json();
      console.log('Import successful:', result);
      
      // Refresh the devices list
      await fetchDevices(true);
      
      showAlert(`${result.devices.length} devices imported successfully`, 'success');
      return result.devices;
    } catch (error) {
      console.error('Error importing devices:', error);
      showAlert(`Import failed: ${error.message}`, 'danger');
      return [];
    }
  }
  
  // Afficher le modal d'ajout de dispositif
  function showAddDeviceModal() {
    // Vérifier si un modal existe déjà, sinon le créer
    let modalElement = document.getElementById('device-modal');
    
    if (!modalElement) {
      modalElement = document.createElement('div');
      modalElement.id = 'device-modal';
      modalElement.className = 'modal fade';
      modalElement.setAttribute('tabindex', '-1');
      modalElement.setAttribute('aria-labelledby', 'deviceModalLabel');
      modalElement.setAttribute('aria-hidden', 'true');
      
      modalElement.innerHTML = `
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="deviceModalLabel">Add New Device</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <div id="device-modal-alert" class="alert alert-danger" style="display: none;"></div>
              <form id="device-form">
                <input type="hidden" id="device-id">
                <div class="mb-3">
                  <label for="device-location" class="form-label">Location*</label>
                  <select class="form-select" id="device-location" required>
                    <option value="">Select a location</option>
                  </select>
                  <div class="invalid-feedback">Location is required</div>
                </div>
                <div class="mb-3">
                  <label for="device-name" class="form-label">Name*</label>
                  <input type="text" class="form-control" id="device-name" required>
                  <div class="invalid-feedback">Name is required</div>
                </div>
                <div class="mb-3">
                  <label for="device-type" class="form-label">Type*</label>
                  <select class="form-select" id="device-type" required>
                    <option value="">Select a type</option>
                    <option value="Camera">Camera</option>
                    <option value="POS">POS</option>
                    <option value="XR">XR</option>
                    <option value="Broadcasting">Broadcasting</option>
                    <option value="Safety">Safety</option>
                    <option value="Other">Other</option>
                  </select>
                  <div class="invalid-feedback">Type is required</div>
                </div>
                <div class="mb-3">
                  <label for="device-ip-address" class="form-label">IP Address</label>
                  <input type="text" class="form-control" id="device-ip-address" placeholder="192.168.1.100">
                </div>
                <div class="mb-3">
                  <label for="device-msisdn" class="form-label">MSISDN</label>
                  <input type="text" class="form-control" id="device-msisdn" placeholder="33612345678">
                </div>
                <div class="mb-3">
                  <label for="device-status" class="form-label">Status</label>
                  <select class="form-select" id="device-status">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-primary" id="save-device-btn">
                <span id="save-device-text">Save Device</span>
                <span id="save-device-spinner" class="spinner-border spinner-border-sm d-none" role="status" aria-hidden="true"></span>
              </button>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(modalElement);
      
      // Ajouter un gestionnaire d'événements pour enregistrer le dispositif
      document.getElementById('save-device-btn').addEventListener('click', saveDevice);
    }
    
    // Load locations into dropdown
    loadLocationsDropdown();
    
    // Réinitialiser le formulaire
    document.getElementById('deviceModalLabel').textContent = 'Add New Device';
    document.getElementById('device-id').value = '';
    document.getElementById('device-form').reset();
    document.getElementById('device-status').value = 'active'; // Par défaut
    
    // Set default location if one is selected
    if (window.currentLocationId) {
      document.getElementById('device-location').value = window.currentLocationId;
    }
    
    document.getElementById('device-modal-alert').style.display = 'none'; // Masquer les alertes
    
    // Réinitialiser les états de validation
    document.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
    
    // Afficher le modal
    try {
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
    } catch (error) {
      console.error('Error displaying modal:', error);
      showAlert('An error occurred while displaying the form.', 'danger');
    }
  }
  
  // Function to load locations into dropdown
  async function loadLocationsDropdown() {
    try {
      const response = await fetch('/api/locations');
      if (!response.ok) {
        throw new Error('Failed to fetch locations');
      }
      
      const locations = await response.json();
      const dropdown = document.getElementById('device-location');
      
      // Clear existing options except the first one
      const defaultOption = dropdown.options[0];
      dropdown.innerHTML = '';
      dropdown.appendChild(defaultOption);
      
      // Add locations to dropdown
      locations.forEach(location => {
        const option = document.createElement('option');
        option.value = location.id;
        option.textContent = location.name;
        dropdown.appendChild(option);
      });
    } catch (error) {
      console.error('Error loading locations:', error);
      showAlert('Unable to load locations', 'danger');
    }
  }
  
  // Afficher le modal d'édition de dispositif
  function showEditDeviceModal(device) {
    // Utiliser le même modal que pour l'ajout
    let modalElement = document.getElementById('device-modal');
    
    if (!modalElement) {
      // Si le modal n'existe pas encore, le créer d'abord
      showAddDeviceModal();
      modalElement = document.getElementById('device-modal');
    }
    
    // Load locations if needed
    loadLocationsDropdown().then(() => {
      // Mettre à jour le titre et charger les données du dispositif
      document.getElementById('deviceModalLabel').textContent = `Edit Device: ${device.name}`;
      document.getElementById('device-id').value = device.id;
      document.getElementById('device-name').value = device.name;
      document.getElementById('device-type').value = device.type;
      document.getElementById('device-ip-address').value = device.ipAddress || '';
      document.getElementById('device-msisdn').value = device.msisdn || '';
      document.getElementById('device-status').value = device.status || 'active';
      document.getElementById('device-location').value = device.locationId || '';
    });
    
    // Afficher le modal
    try {
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
    } catch (error) {
      console.error('Error displaying modal:', error);
      showAlert('An error occurred while displaying the form.', 'danger');
    }
  }
  
  // Afficher le modal d'importation CSV
  function showImportCSVModal() {
    // Vérifier si un modal existe déjà, sinon le créer
    let modalElement = document.getElementById('import-csv-modal');
    
    if (!modalElement) {
      modalElement = document.createElement('div');
      modalElement.id = 'import-csv-modal';
      modalElement.className = 'modal fade';
      modalElement.setAttribute('tabindex', '-1');
      modalElement.setAttribute('aria-labelledby', 'importCSVModalLabel');
      modalElement.setAttribute('aria-hidden', 'true');
      
      modalElement.innerHTML = `
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="importCSVModalLabel">Import Devices from CSV</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <div class="mb-3">
                <label for="csv-file" class="form-label">CSV File</label>
                <input class="form-control" type="file" id="csv-file" accept=".csv">
              </div>
              <div class="alert alert-info">
                <h6>CSV Format</h6>
                <p class="mb-1">The CSV file should have the following headers:</p>
                <ul class="mb-0">
                  <li><strong>name</strong> (required)</li>
                  <li><strong>type</strong> (required)</li>
                  <li>ipAddress</li>
                  <li>msisdn</li>
                  <li>status</li>
                </ul>
              </div>
              <div class="mb-3">
                <label for="csv-example" class="form-label">Example</label>
                <pre class="form-control" id="csv-example" style="height: 100px;">name,type,ipAddress,msisdn,status
Camera 1,Camera,192.168.1.100,33612345678,active
POS Terminal 2,POS,192.168.1.101,33612345679,active
VR Headset 1,XR,192.168.1.102,,inactive</pre>
              </div>
              <div class="mb-3">
                <label for="csv-content" class="form-label">Or paste CSV content here</label>
                <textarea class="form-control" id="csv-content" rows="5" placeholder="Paste CSV content here..."></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-primary" id="import-csv-btn">Import</button>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(modalElement);
      
      // Ajouter un gestionnaire d'événements pour importer le CSV
      document.getElementById('import-csv-btn').addEventListener('click', handleCSVImport);
      
      // Ajouter un gestionnaire pour le fichier CSV
      document.getElementById('csv-file').addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = event => {
            document.getElementById('csv-content').value = event.target.result;
          };
          reader.readAsText(file);
        }
      });
    }
    
    // Réinitialiser le formulaire
    document.getElementById('csv-file').value = '';
    document.getElementById('csv-content').value = '';
    
    // Afficher le modal
    try {
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
    } catch (error) {
      console.error('Error displaying modal:', error);
      showAlert('An error occurred while displaying the import form.', 'danger');
    }
  }
  
  // Gérer l'importation CSV
  async function handleCSVImport() {
    const csvContent = document.getElementById('csv-content').value.trim();
    
    if (!csvContent) {
      showAlert('Please upload a CSV file or paste CSV content.', 'warning');
      return;
    }
    
    const success = await importDevicesFromCSV(csvContent);
    
    if (success) {
      // Fermer le modal
      const modalElement = document.getElementById('import-csv-modal');
      const modal = bootstrap.Modal.getInstance(modalElement);
      if (modal) {
        modal.hide();
      }
    }
  }
  
  // Enregistrer un dispositif (nouveau ou mis à jour)
  async function saveDevice() {
    // Récupérer les valeurs du formulaire
    const deviceId = document.getElementById('device-id').value;
    const nameInput = document.getElementById('device-name');
    const typeInput = document.getElementById('device-type');
    const locationInput = document.getElementById('device-location');
    const ipAddress = document.getElementById('device-ip-address').value.trim();
    const msisdn = document.getElementById('device-msisdn').value.trim();
    const status = document.getElementById('device-status').value;
    
    const name = nameInput.value.trim();
    const type = typeInput.value;
    const locationId = locationInput.value;
    
    // Validation des champs
    let isValid = true;
    
    // Vérifier le nom
    if (!name) {
      nameInput.classList.add('is-invalid');
      isValid = false;
    } else {
      nameInput.classList.remove('is-invalid');
    }
    
    // Vérifier le type
    if (!type) {
      typeInput.classList.add('is-invalid');
      isValid = false;
    } else {
      typeInput.classList.remove('is-invalid');
    }
    
    // Vérifier l'emplacement
    if (!locationId) {
      locationInput.classList.add('is-invalid');
      isValid = false;
    } else {
      locationInput.classList.remove('is-invalid');
    }
    
    if (!isValid) {
      // Afficher une alerte dans le modal
      const modalAlert = document.getElementById('device-modal-alert');
      modalAlert.textContent = 'Please fill in all required fields.';
      modalAlert.style.display = 'block';
      return;
    }
    
    // Masquer l'alerte
    document.getElementById('device-modal-alert').style.display = 'none';
    
    // Afficher l'indicateur de chargement
    const saveBtn = document.getElementById('save-device-btn');
    const saveText = document.getElementById('save-device-text');
    const saveSpinner = document.getElementById('save-device-spinner');
    
    saveBtn.disabled = true;
    saveText.textContent = deviceId ? 'Updating...' : 'Adding...';
    saveSpinner.classList.remove('d-none');
    
    const deviceData = { name, type, ipAddress, msisdn, status, locationId };
    let success = false;
    
    try {
      if (deviceId) {
        // Mise à jour d'un dispositif existant
        success = await updateDevice(parseInt(deviceId), deviceData);
      } else {
        // Ajout d'un nouveau dispositif
        success = await addDevice(deviceData);
      }
      
      if (success) {
        // Fermer le modal
        const modalElement = document.getElementById('device-modal');
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) {
          modal.hide();
        }
      } else {
        // Afficher l'erreur dans le modal
        const modalAlert = document.getElementById('device-modal-alert');
        modalAlert.textContent = 'An error occurred. Check the console for details.';
        modalAlert.style.display = 'block';
      }
    } catch (error) {
      console.error('Error saving device:', error);
      // Afficher l'erreur dans le modal
      const modalAlert = document.getElementById('device-modal-alert');
      modalAlert.textContent = error.message || 'An unexpected error occurred.';
      modalAlert.style.display = 'block';
    } finally {
      // Restaurer le bouton
      saveBtn.disabled = false;
      saveText.textContent = 'Save Device';
      saveSpinner.classList.add('d-none');
    }
  }
  
  // Fonction pour gérer l'upload d'un fichier CSV
  async function handleCSVFileUpload(file) {
    if (!file) {
      console.error('No file provided');
      return;
    }
    
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      showAlert('Please select a valid CSV file.', 'warning');
      return;
    }
    
    try {
      const reader = new FileReader();
      
      // Use a promise to handle the FileReader
      const csvContent = await new Promise((resolve, reject) => {
        reader.onload = e => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Error reading file'));
        reader.readAsText(file);
      });
      
      // Import the devices with the CSV content
      await importDevicesFromCSV(csvContent);
      
      // Close the modal if it's open
      const importModal = bootstrap.Modal.getInstance(document.getElementById('import-csv-modal'));
      if (importModal) {
        importModal.hide();
      }
    } catch (error) {
      console.error('Error handling CSV upload:', error);
      showAlert(`File upload error: ${error.message}`, 'danger');
    }
  }
  
  // Gestionnaires d'événements
  if (addDeviceBtn) {
    console.log('Attaching event listener to Add Device button');
    addDeviceBtn.addEventListener('click', showAddDeviceModal);
  } else {
    console.error('Add Device button not found');
  }
  
  if (importDevicesBtn) {
    console.log('Attaching event listener to Import Devices button');
    importDevicesBtn.addEventListener('click', showImportCSVModal);
  } else {
    console.error('Import Devices button not found');
  }
  
  // Try finding the refresh button
  const refreshQosStatusBtn = document.getElementById('refresh-qos-status-btn');
  if (refreshQosStatusBtn) {
    console.log('Attaching event listener to Refresh QoS Status button');
    refreshQosStatusBtn.addEventListener('click', () => {
      console.log('QoS Status refresh button clicked, refreshing devices');
      fetchDevices(true);
    });
  } else {
    console.error('Refresh QoS Status button not found');
  }
  
  // Initialisation
  function initialize() {
    // Vérifier si les éléments DOM existent
    if (!devicesContainer) {
      console.error('Devices container not found, DOM elements may not be loaded yet');
      // Try again after a short delay
      setTimeout(initialize, 500);
      return;
    }
    
    console.log('Initializing devices module...');
    
    // Load locations for the filter dropdown
    loadLocationFilterDropdown();
    
    // Add event listener for location filter
    const locationFilter = document.getElementById('device-location-filter');
    if (locationFilter) {
      locationFilter.addEventListener('change', () => {
        const locationId = locationFilter.value;
        window.currentLocationId = locationId ? parseInt(locationId) : null;
        console.log(`Location filter changed to: ${window.currentLocationId}`);
        fetchDevices(true, window.currentLocationId);
      });
    }
    
    // Force an immediate device load when the page loads
    console.log('Current hash:', window.location.hash);
    
    // Initial load of devices with force=true
    console.log('Performing initial force load of devices');
    setTimeout(() => fetchDevices(true), 100);
    
    // Récupérer les dispositifs lors du chargement de la page
    window.addEventListener('hashchange', () => {
      if (window.location.hash === '#devices') {
        console.log('Hash changed to #devices, fetching devices with force=true');
        fetchDevices(true); // Force refresh when navigating to devices tab
      }
    });
    
    // Set up an interval to retry loading devices if the list is empty
    const retryInterval = setInterval(() => {
      if (window.location.hash === '#devices' && (!devices || devices.length === 0)) {
        console.log('Retry loading devices due to empty list');
        fetchDevices(true);
      } else if (devices && devices.length > 0) {
        // Clear interval once devices are loaded
        clearInterval(retryInterval);
      }
    }, 2000);
    
    // Add handler for the QoS Status refresh button
    const refreshQosStatusBtn = document.getElementById('refresh-qos-status-btn');
    if (refreshQosStatusBtn) {
      refreshQosStatusBtn.addEventListener('click', () => {
        console.log('QoS Status refresh button clicked, refreshing devices');
        fetchDevices(true);
      });
    }
    
    // Ajouter un gestionnaire d'événements pour le bouton d'ajout de dispositif
    if (addDeviceBtn) {
      addDeviceBtn.addEventListener('click', showAddDeviceModal);
    }
    
    // Ajouter un gestionnaire d'événements pour le bouton d'importation CSV
    if (importDevicesBtn) {
      importDevicesBtn.addEventListener('click', showImportCSVModal);
    }
    
    // Ajouter un gestionnaire d'événements pour la recherche
    if (deviceSearchBtn) {
      deviceSearchBtn.addEventListener('click', () => {
        searchTerm = deviceSearchInput.value;
        filterAndRenderDevices();
      });
    }
    
    // Ajouter un gestionnaire d'événements pour la recherche en temps réel
    if (deviceSearchInput) {
      deviceSearchInput.addEventListener('input', () => {
        searchTerm = deviceSearchInput.value;
        filterAndRenderDevices();
      });
      
      // Permettre la recherche en appuyant sur Entrée
      deviceSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          searchTerm = deviceSearchInput.value;
          filterAndRenderDevices();
        }
      });
    }
    
    console.log('Devices module initialization complete');
  }
  
  // Function to load locations into the filter dropdown
  async function loadLocationFilterDropdown() {
    try {
      const response = await fetch('/api/locations');
      if (!response.ok) {
        throw new Error('Failed to fetch locations');
      }
      
      const locations = await response.json();
      const dropdown = document.getElementById('device-location-filter');
      
      if (!dropdown) {
        console.error('Location filter dropdown not found');
        return;
      }
      
      // Clear existing options except the first one
      const defaultOption = dropdown.options[0];
      dropdown.innerHTML = '';
      dropdown.appendChild(defaultOption);
      
      // Add locations to dropdown
      locations.forEach(location => {
        const option = document.createElement('option');
        option.value = location.id;
        option.textContent = location.name;
        dropdown.appendChild(option);
      });
      
      console.log(`Loaded ${locations.length} locations for filter dropdown`);
    } catch (error) {
      console.error('Error loading locations for filter:', error);
    }
  }
  
  // Démarrer l'initialisation
  initialize();
}); 