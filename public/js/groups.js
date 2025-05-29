/**
 * Gestion des groupes (Groups)
 * Ce script gère l'affichage et la gestion des groupes créés pour chaque emplacement
 */

// Initialisation de la page
document.addEventListener('DOMContentLoaded', () => {
  console.log('Groups.js: DOM loaded');
  
  // Éléments du DOM
  const groupsContainer = document.getElementById('groups-container');
  const addGroupBtn = document.getElementById('add-group-btn');
  const floatingAddGroupBtn = document.getElementById('floating-add-group-btn');
  
  console.log('Groups.js: groupsContainer element found:', !!groupsContainer);
  console.log('Groups.js: addGroupBtn element found:', !!addGroupBtn);
  console.log('Groups.js: floatingAddGroupBtn element found:', !!floatingAddGroupBtn);
  
  if (addGroupBtn) {
    console.log('Groups.js: Add Group button attributes:', {
      id: addGroupBtn.id,
      classList: Array.from(addGroupBtn.classList),
      style: addGroupBtn.style.cssText,
      parentNode: addGroupBtn.parentNode.tagName,
      display: window.getComputedStyle(addGroupBtn).display
    });
    
    // Ensure the button is properly styled and visible
    addGroupBtn.style.display = 'inline-flex';
    addGroupBtn.style.alignItems = 'center';
    addGroupBtn.style.visibility = 'visible';
    
    console.log('Groups.js: Button styles updated');
  } else {
    console.error('Groups.js: Add Group button not found in DOM!');
  }
  
  // État de l'application
  let groups = [];
  let locations = [];
  let devices = [];
  let currentGroupId = null;
  
  // Récupérer tous les emplacements depuis l'API
  async function fetchLocations() {
    try {
      const response = await fetch('/api/locations');
      if (!response.ok) {
        throw new Error('Error retrieving locations');
      }
      locations = await response.json();
      console.log('Emplacements récupérés:', locations);
    } catch (error) {
      console.error('Error:', error);
      showAlert('Unable to retrieve locations. Please try again later.', 'danger');
    }
  }
  
  // Récupérer tous les groupes depuis l'API
  async function fetchGroups() {
    try {
      const response = await fetch('/api/groups');
      if (!response.ok) {
        throw new Error('Error retrieving groups');
      }
      groups = await response.json();
      console.log('Groupes récupérés:', groups);
      renderGroups();
    } catch (error) {
      console.error('Error:', error);
      showAlert('Unable to retrieve groups. Please try again later.', 'danger');
    }
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
  
  // Supprimer un groupe via l'API
  async function deleteGroup(groupId) {
    try {
      console.log(`Deleting group ${groupId}...`);
      const response = await fetch(`/api/groups/${groupId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('Error response:', errorData);
        throw new Error(`Failed to delete group: ${errorData}`);
      }
      
      // Remove the group from the local array, handling both string and number IDs
      groups = groups.filter(group => 
        !(group.id === groupId || group.id === parseInt(groupId) || group.id === groupId.toString())
      );
      
      // Re-render the groups display
      renderGroups();
      showAlert('Group successfully deleted', 'success');
    } catch (error) {
      console.error('Error deleting group:', error);
      showAlert('Failed to delete group. Please try again.', 'danger');
    }
  }
  
  // Mettre à jour un groupe via l'API
  async function updateGroup(groupId, updatedData) {
    try {
      console.log(`Updating group ${groupId}...`, updatedData);
      const response = await fetch(`/api/groups/${groupId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedData)
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to update group: ${errorData}`);
      }
      
      const updatedGroup = await response.json();
      console.log('Groupe mis à jour avec succès:', updatedGroup);
      
      // Mettre à jour la liste des groupes
      const groupIndex = groups.findIndex(g => g.id === groupId);
      if (groupIndex !== -1) {
        groups[groupIndex] = updatedGroup;
      }
      
      renderGroups();
      showAlert('Group successfully updated', 'success');
      
      // Fermer le modal d'édition
      const modalElement = document.getElementById('edit-group-modal');
      if (modalElement) {
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) {
          modal.hide();
        }
      }
    } catch (error) {
      console.error('Error updating group:', error);
      showAlert('Failed to update group. Please try again.', 'danger');
    }
  }
  
  // Afficher les groupes organisés par emplacement
  function renderGroups() {
    if (!groupsContainer) return;
    
    // Find or create the content area (separate from the header with buttons)
    let groupsContentArea = document.getElementById('groups-content-area');
    if (!groupsContentArea) {
      // First clear everything except the actions header
      const actionsDiv = groupsContainer.querySelector('.actions');
      const alertDiv = groupsContainer.querySelector('.alert');
      
      // Save the actions header
      const headerContent = actionsDiv ? actionsDiv.outerHTML : '';
      const alertContent = alertDiv ? alertDiv.outerHTML : '';
      
      // Create a content area for dynamic content
      groupsContainer.innerHTML = headerContent + alertContent + '<div id="groups-content-area"></div>';
      groupsContentArea = document.getElementById('groups-content-area');
    }
    
    // Clear just the content area
    groupsContentArea.innerHTML = '';
    
    // Si aucun groupe, afficher un message
    if (groups.length === 0) {
      groupsContentArea.innerHTML = `
        <div class="alert alert-info">
          No groups have been created yet. Create a group from the Locations tab.
        </div>
      `;
      return;
    }
    
    // Organiser les groupes par emplacement
    const groupsByLocation = {};
    
    groups.forEach(group => {
      if (!groupsByLocation[group.locationId]) {
        groupsByLocation[group.locationId] = [];
      }
      groupsByLocation[group.locationId].push(group);
    });
    
    // Créer une carte pour chaque emplacement
    for (const locationId in groupsByLocation) {
      const location = locations.find(loc => loc.id === parseInt(locationId)) || { name: 'Unknown Location' };
      const locationGroups = groupsByLocation[locationId];
      
      const locationCard = document.createElement('div');
      locationCard.className = 'card mb-4';
      locationCard.innerHTML = `
        <div class="card-header bg-primary text-white">
          <h5 class="mb-0">${location.name}</h5>
        </div>
        <div class="card-body">
          <div class="row" id="groups-row-${locationId}"></div>
        </div>
      `;
      
      groupsContentArea.appendChild(locationCard);
      
      const groupsRow = document.getElementById(`groups-row-${locationId}`);
      
      // Ajouter chaque groupe
      locationGroups.forEach(group => {
        const groupCol = document.createElement('div');
        groupCol.className = 'col-md-4 mb-3';
        
        // Déterminer la classe de couleur en fonction du profil de connectivité
        let profileColorClass = 'bg-secondary';
        if (group.connectivityProfile === 'Safety') {
          profileColorClass = 'bg-danger';
        } else if (group.connectivityProfile === 'POS') {
          profileColorClass = 'bg-success';
        } else if (group.connectivityProfile === 'XR') {
          profileColorClass = 'bg-info';
        } else if (group.connectivityProfile === 'Broadcasting') {
          profileColorClass = 'bg-warning';
        }
        
        groupCol.innerHTML = `
          <div class="card h-100">
            <div class="card-header d-flex justify-content-between align-items-center ${profileColorClass} text-white">
              <h6 class="mb-0">${group.name}</h6>
              <div class="dropdown">
                <button class="btn btn-sm btn-light" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                  <i class="bi bi-three-dots-vertical"></i>
                </button>
                <ul class="dropdown-menu">
                  <li><a class="dropdown-item" href="#" data-group-id="${group.id}" data-action="edit">Edit</a></li>
                  <li><a class="dropdown-item" href="#" data-group-id="${group.id}" data-action="delete">Delete</a></li>
                  <li><hr class="dropdown-divider"></li>
                  <li><a class="dropdown-item" href="#" data-group-id="${group.id}" data-action="view-devices">View Devices</a></li>
                </ul>
              </div>
            </div>
            <div class="card-body">
              <p><strong>Profile:</strong> ${group.connectivityProfile}</p>
              <div class="d-flex justify-content-between align-items-center mb-2">
                <span><small class="text-muted">Created: ${new Date(group.createdAt).toLocaleString()}</small></span>
                <span class="badge bg-primary device-count-badge" data-group-id="${group.id}">
                  <i class="bi bi-device-hdd"></i> Loading...
                </span>
              </div>
              <button class="btn btn-sm btn-outline-primary view-devices-btn w-100" data-group-id="${group.id}">
                <i class="bi bi-device-hdd me-1"></i> View Devices
              </button>
            </div>
          </div>
        `;
        
        groupsRow.appendChild(groupCol);
      });
    }
    
    // After all group cards are created, update device counts
    groups.forEach(group => {
      updateGroupDeviceCount(group.id);
    });
    
    // Ajouter des gestionnaires d'événements pour les actions
    document.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        const groupId = parseInt(e.target.dataset.groupId);
        
        if (confirm('Are you sure you want to delete this group?')) {
          deleteGroup(groupId);
        }
      });
    });
    
    document.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        
        // Trouver l'élément avec data-group-id en remontant dans l'arbre DOM si nécessaire
        const target = e.target.closest('[data-group-id]');
        if (!target) {
          console.error('Could not find group ID in clicked element or its parents');
          showAlert('Error: Could not identify the group to edit', 'danger');
          return;
        }

        const groupId = target.dataset.groupId;
        console.log('Edit clicked for group ID:', groupId);
        
        if (!groupId) {
          console.error('Invalid group ID:', groupId);
          showAlert('Error: Invalid group ID', 'danger');
          return;
        }

        try {
          // Trouver d'abord le groupe dans la liste locale
          const group = groups.find(g => g.id.toString() === groupId.toString());
          
          if (!group) {
            console.error('Group not found in local data:', groupId);
            showAlert('Error: Group not found', 'danger');
            return;
          }

          // Utiliser directement les données du groupe local
          await showEditGroupModal(group);
        } catch (error) {
          console.error('Error preparing group edit:', error);
          showAlert(`Error: ${error.message}`, 'danger');
        }
      });
    });

    document.querySelectorAll('[data-action="view-devices"]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        const groupId = parseInt(e.target.dataset.groupId);
        showGroupDevices(groupId);
      });
    });

    document.querySelectorAll('.view-devices-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        const groupId = parseInt(e.target.dataset.groupId);
        showGroupDevices(groupId);
      });
    });
  }
  
  // Function to show the edit group modal
  async function showEditGroupModal(group) {
    console.log('Showing edit modal for group:', group);
    
    try {
      // Validate group data
      if (!group || typeof group !== 'object') {
        throw new Error('Invalid group object');
      }

      if (!group.id || !group.name || !group.locationId) {
        console.error('Missing required group properties:', group);
        throw new Error('Group data is incomplete');
      }
      
      // Check if a modal exists, if not create it
      let modalElement = document.getElementById('edit-group-modal');
      
      if (!modalElement) {
        console.log('Creating edit modal...');
        modalElement = document.createElement('div');
        modalElement.id = 'edit-group-modal';
        modalElement.className = 'modal fade';
        modalElement.setAttribute('tabindex', '-1');
        
        modalElement.innerHTML = `
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title" id="edit-group-modal-title">Edit Group</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                <form id="edit-group-form">
                  <input type="hidden" id="edit-group-id">
                  <input type="hidden" id="edit-location-id">
                  
                  <div class="mb-3">
                    <label for="edit-group-name" class="form-label">Group Name</label>
                    <input type="text" class="form-control" id="edit-group-name" required>
                  </div>
                  
                  <div class="mb-3">
                    <label class="form-label">Connectivity Profile</label>
                    <div class="d-flex gap-3">
                      <div class="form-check">
                        <input class="form-check-input" type="radio" name="edit-connectivity-profile" value="Safety" id="edit-profile-safety">
                        <label class="form-check-label" for="edit-profile-safety">Safety</label>
                      </div>
                      <div class="form-check">
                        <input class="form-check-input" type="radio" name="edit-connectivity-profile" value="POS" id="edit-profile-pos">
                        <label class="form-check-label" for="edit-profile-pos">POS</label>
                      </div>
                      <div class="form-check">
                        <input class="form-check-input" type="radio" name="edit-connectivity-profile" value="XR" id="edit-profile-xr">
                        <label class="form-check-label" for="edit-profile-xr">XR</label>
                      </div>
                      <div class="form-check">
                        <input class="form-check-input" type="radio" name="edit-connectivity-profile" value="Broadcasting" id="edit-profile-broadcasting">
                        <label class="form-check-label" for="edit-profile-broadcasting">Broadcasting</label>
                      </div>
                    </div>
                  </div>
                  
                  <div class="mb-3">
                    <label class="form-label">Devices</label>
                    <div class="input-group mb-3">
                      <input type="text" class="form-control" id="edit-device-search" placeholder="Search devices...">
                      <button class="btn btn-outline-secondary" type="button" id="edit-search-device-btn">
                        <i class="bi bi-search"></i>
                      </button>
                    </div>
                    <div class="device-list-container border rounded p-2" style="height: 300px; overflow-y: auto;">
                      <div id="edit-devices-list">
                        <!-- Devices will be loaded here -->
                      </div>
                    </div>
                  </div>
                </form>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-primary" id="save-edit-group-btn">Save Changes</button>
              </div>
            </div>
          </div>
        `;
        
        document.body.appendChild(modalElement);
      }
      
      // Update the form with group data
      const groupIdInput = document.getElementById('edit-group-id');
      const locationIdInput = document.getElementById('edit-location-id');
      const groupNameInput = document.getElementById('edit-group-name');
      const modalTitle = document.getElementById('edit-group-modal-title');
      
      if (!groupIdInput || !locationIdInput || !groupNameInput || !modalTitle) {
        throw new Error('Required form elements not found');
      }
      
      groupIdInput.value = group.id;
      locationIdInput.value = group.locationId;
      groupNameInput.value = group.name || '';
      modalTitle.textContent = `Edit Group: ${group.name}`;
      
      // Set the correct connectivity profile radio button
      const profileRadio = document.querySelector(`input[name="edit-connectivity-profile"][value="${group.connectivityProfile}"]`);
      if (profileRadio) {
        profileRadio.checked = true;
      }
      
      // Initialize the modal if not already initialized
      let modal = bootstrap.Modal.getInstance(modalElement);
      if (!modal) {
        modal = new bootstrap.Modal(modalElement);
      }
      
      // Add event listener for the save button
      const saveButton = document.getElementById('save-edit-group-btn');
      if (saveButton) {
        saveButton.addEventListener('click', saveEditedGroup);
      }
      
      // Show the modal
      modal.show();
      
      // Load devices for the location
      await loadDevicesForEdit(group);
      
      // Add search functionality
      const searchInput = document.getElementById('edit-device-search');
      const searchBtn = document.getElementById('edit-search-device-btn');
      
      if (searchInput && searchBtn) {
        const handleSearch = () => {
          const searchTerm = searchInput.value.toLowerCase();
          const deviceElements = document.querySelectorAll('#edit-devices-list .list-group-item');
          
          deviceElements.forEach(element => {
            const deviceName = element.querySelector('.device-name').textContent.toLowerCase();
            const deviceIp = element.querySelector('.device-ip').textContent.toLowerCase();
            
            if (deviceName.includes(searchTerm) || deviceIp.includes(searchTerm)) {
              element.style.display = '';
            } else {
              element.style.display = 'none';
            }
          });
        };
        
        searchInput.addEventListener('input', handleSearch);
        searchBtn.addEventListener('click', handleSearch);
      }
      
    } catch (error) {
      console.error('Error showing edit modal:', error);
      showAlert(`Error: ${error.message}`, 'danger');
    }
  }
  
  // Function to load devices for editing
  async function loadDevicesForEdit(group) {
    if (!group || !group.id || !group.locationId) {
      console.error('Invalid group data for loading devices:', group);
      showAlert('Error: Cannot load devices due to invalid group data', 'danger');
      return;
    }

    const devicesList = document.getElementById('edit-devices-list');
    if (!devicesList) {
      console.error('Devices list container not found');
      return;
    }
    
    try {
      // Show loading indicator
      devicesList.innerHTML = `
        <div class="d-flex justify-content-center align-items-center h-100">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
        </div>
      `;
      
      // Fetch all devices for the location
      const locationDevicesResponse = await fetch(`/api/locations/${group.locationId}/devices`);
      if (!locationDevicesResponse.ok) {
        throw new Error(`Error fetching location devices: ${locationDevicesResponse.status}`);
      }
      const locationDevices = await locationDevicesResponse.json();
      
      // Fetch current group devices
      const groupDevicesResponse = await fetch(`/api/groups/${group.id}/devices`);
      if (!groupDevicesResponse.ok) {
        console.warn('Could not fetch current group devices:', groupDevicesResponse.statusText);
      }
      const groupDevices = groupDevicesResponse.ok ? await groupDevicesResponse.json() : [];
      
      // If no devices available
      if (locationDevices.length === 0) {
        devicesList.innerHTML = `
          <div class="d-flex justify-content-center align-items-center h-100">
            <div class="text-center text-muted">
              <i class="bi bi-exclamation-circle fs-2"></i>
              <p>No devices available for this location</p>
            </div>
          </div>
        `;
        return;
      }
      
      // Clear the list
      devicesList.innerHTML = '';
      
      // Organize devices by type
      const devicesByType = {};
      locationDevices.forEach(device => {
        const type = device.type || 'Other';
        if (!devicesByType[type]) {
          devicesByType[type] = [];
        }
        devicesByType[type].push(device);
      });
      
      // Create device groups by type
      for (const type in devicesByType) {
        const typeHeading = document.createElement('h6');
        typeHeading.className = 'mb-2 mt-2';
        typeHeading.textContent = `${type} (${devicesByType[type].length})`;
        devicesList.appendChild(typeHeading);
        
        devicesByType[type].forEach(device => {
          // Check if device is in the group
          const isSelected = groupDevices.some(gd => 
            gd.id === device.id || 
            (typeof gd === 'number' && gd === device.id) || 
            (gd.deviceId === device.id)
          );
          
          const deviceElement = document.createElement('div');
          deviceElement.className = 'mb-2';
          
          let statusClass = 'text-success';
          if (device.status === 'inactive') {
            statusClass = 'text-danger';
          } else if (device.status === 'maintenance') {
            statusClass = 'text-warning';
          }
          
          deviceElement.innerHTML = `
            <div class="d-flex align-items-center w-100 border rounded p-2 ${device.status !== 'active' ? 'bg-light' : ''}">
              <input class="form-check-input device-checkbox me-2" type="checkbox" value="${device.id}" 
                     id="edit-device-${device.id}" ${isSelected ? 'checked' : ''}>
              <label class="form-check-label d-flex justify-content-between w-100" for="edit-device-${device.id}">
                <div>
                  <div class="device-name">${device.name || 'Unnamed Device'}</div>
                  <div class="small ${statusClass}">
                    <i class="bi bi-circle-fill me-1"></i>${device.status}
                  </div>
                </div>
                <div class="text-end">
                  <div class="small text-muted device-ip">${device.ipAddress || 'No IP'}</div>
                  <div class="small text-muted">${device.msisdn || 'No MSISDN'}</div>
                </div>
              </label>
            </div>
          `;
          devicesList.appendChild(deviceElement);
        });
      }
      
    } catch (error) {
      console.error('Error loading devices:', error);
      devicesList.innerHTML = `
        <div class="alert alert-danger m-3">
          Error loading devices: ${error.message}
        </div>
      `;
    }
  }

  // Function to save edited group
  async function saveEditedGroup() {
    try {
      console.log('Saving group modifications...');
      
      // Get form values
      const groupId = document.getElementById('edit-group-id').value;
      const locationId = document.getElementById('edit-location-id').value;
      const name = document.getElementById('edit-group-name').value.trim();
      const connectivityProfileElement = document.querySelector('input[name="edit-connectivity-profile"]:checked');
      
      console.log('Retrieved form values:', { groupId, locationId, name });
      
      // Validate required fields
      if (!groupId || !locationId || !name || !connectivityProfileElement) {
        console.error('Missing required fields:', { groupId, locationId, name, connectivityProfile: connectivityProfileElement?.value });
        showAlert('Please fill in all required fields', 'warning');
        return;
      }
      
      const connectivityProfile = connectivityProfileElement.value;
      
      // Get selected devices
      const selectedDevices = Array.from(document.querySelectorAll('#edit-devices-list .device-checkbox:checked'))
        .map(checkbox => parseInt(checkbox.value))
        .filter(id => !isNaN(id));
      
      console.log('Selected devices:', selectedDevices);
      
      // Disable save button and show loading state
      const saveButton = document.getElementById('save-edit-group-btn');
      const originalText = saveButton.textContent;
      saveButton.disabled = true;
      saveButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Saving...';
      
      // Update group data object
      const groupData = {
        locationId: parseInt(locationId),
        name,
        connectivityProfile,
        devices: selectedDevices
      };
      
      console.log('Sending update request with data:', groupData);
      
      // Update the group
      await updateGroup(groupId, groupData);
      
      // Success case is handled in updateGroup function
      
    } catch (error) {
      console.error('Error saving group:', error);
      showAlert('Failed to save group changes: ' + error.message, 'danger');
    } finally {
      // Re-enable save button and restore text
      const saveButton = document.getElementById('save-edit-group-btn');
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = 'Save Changes';
      }
    }
  }
  
  // Créer un nouveau groupe via l'API
  async function createGroup(groupData) {
    try {
      console.log('Tentative de création d\'un groupe:', groupData);
      
      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(groupData)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erreur lors de la création du groupe:', errorText);
        throw new Error('Error creating the group');
      }
      
      const newGroup = await response.json();
      console.log('Groupe créé avec succès:', newGroup);
      
      // Mettre à jour la liste des groupes
      groups.push(newGroup);
      renderGroups();
      
      showAlert('Group successfully created', 'success');
      
      // Fermer le modal d'ajout
      const modalElement = document.getElementById('add-group-modal');
      if (modalElement) {
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) {
          modal.hide();
        }
      }
      
      return newGroup;
    } catch (error) {
      console.error('Error:', error);
      showAlert('Unable to create the group. Please try again later.', 'danger');
      return null;
    }
  }
  
  // Fonction pour afficher le modal d'ajout de groupe
  function showAddGroupModal() {
    console.log('Affichage du modal d\'ajout de groupe');
    
    // Vérifier si un modal existe déjà, sinon le créer
    let modalElement = document.getElementById('add-group-modal');
    
    if (!modalElement) {
      console.log('Création du modal d\'ajout...');
      modalElement = document.createElement('div');
      modalElement.id = 'add-group-modal';
      modalElement.className = 'modal fade';
      modalElement.setAttribute('tabindex', '-1');
      modalElement.setAttribute('aria-labelledby', 'addGroupModalLabel');
      modalElement.setAttribute('aria-hidden', 'true');
      
      modalElement.innerHTML = `
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="addGroupModalLabel">Add New Group</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <div id="add-group-alert" class="alert alert-danger" style="display: none;"></div>
              <form id="add-group-form">
                <div class="row">
                  <div class="col-md-6">
                    <div class="mb-3">
                      <label for="add-location-select" class="form-label">Location*</label>
                      <select class="form-select" id="add-location-select" required>
                        <option value="">Select a location</option>
                      </select>
                      <div class="invalid-feedback">Please select a location</div>
                    </div>
                    <div class="mb-3">
                      <label for="add-group-name" class="form-label">Group Name*</label>
                      <input type="text" class="form-control" id="add-group-name" required>
                      <div class="invalid-feedback">Please enter a group name</div>
                    </div>
                    <div class="mb-3">
                      <label class="form-label">Connectivity Profile*</label>
                      <div class="form-check">
                        <input class="form-check-input" type="radio" name="add-connectivity-profile" id="add-profile-safety" value="Safety" checked>
                        <label class="form-check-label" for="add-profile-safety">
                          Safety
                        </label>
                      </div>
                      <div class="form-check">
                        <input class="form-check-input" type="radio" name="add-connectivity-profile" id="add-profile-pos" value="POS">
                        <label class="form-check-label" for="add-profile-pos">
                          POS (Point of Sale)
                        </label>
                      </div>
                      <div class="form-check">
                        <input class="form-check-input" type="radio" name="add-connectivity-profile" id="add-profile-xr" value="XR">
                        <label class="form-check-label" for="add-profile-xr">
                          XR (Extended Reality)
                        </label>
                      </div>
                      <div class="form-check">
                        <input class="form-check-input" type="radio" name="add-connectivity-profile" id="add-profile-broadcasting" value="Broadcasting">
                        <label class="form-check-label" for="add-profile-broadcasting">
                          Broadcasting
                        </label>
                      </div>
                    </div>
                  </div>
                  <div class="col-md-6">
                    <div class="mb-3">
                      <label class="form-label">Devices</label>
                      <div class="input-group mb-3">
                        <input type="text" class="form-control" placeholder="Search devices" id="add-device-search">
                        <button class="btn btn-outline-secondary" type="button" id="add-search-device-btn">
                          <i class="bi bi-search"></i>
                        </button>
                      </div>
                      <div class="device-list-container border rounded p-2" style="height: 200px; overflow-y: auto;">
                        <div id="add-devices-list">
                          <div class="d-flex justify-content-center align-items-center h-100">
                            <div class="text-center text-muted">
                              <i class="bi bi-devices fs-2"></i>
                              <p>Select a location first</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-primary" id="create-group-btn">
                <span id="create-group-text">Create Group</span>
                <span id="create-group-spinner" class="spinner-border spinner-border-sm d-none" role="status" aria-hidden="true"></span>
              </button>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(modalElement);
      console.log('Modal d\'ajout ajouté au document');
      
      // Ajouter un gestionnaire d'événements pour créer le groupe
      document.getElementById('create-group-btn').addEventListener('click', saveNewGroup);
      console.log('Gestionnaire d\'événement pour saveNewGroup ajouté');
      
      // Ajouter un gestionnaire pour la recherche de dispositifs
      const searchDeviceBtn = document.getElementById('add-search-device-btn');
      const deviceSearchInput = document.getElementById('add-device-search');
      
      if (searchDeviceBtn && deviceSearchInput) {
        searchDeviceBtn.addEventListener('click', () => searchDevices(deviceSearchInput.value, 'add'));
        deviceSearchInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            searchDevices(deviceSearchInput.value, 'add');
          }
        });
      }
      
      // Ajouter un gestionnaire pour le changement de location
      const locationSelect = document.getElementById('add-location-select');
      if (locationSelect) {
        locationSelect.addEventListener('change', function() {
          loadDevicesForAdd(this.value);
        });
      }
    }
    
    // Remplir le sélecteur de locations
    const locationSelect = document.getElementById('add-location-select');
    locationSelect.innerHTML = '<option value="">Select a location</option>';
    
    if (locations.length > 0) {
      locations.forEach(location => {
        const option = document.createElement('option');
        option.value = location.id;
        option.textContent = location.name;
        locationSelect.appendChild(option);
      });
    } else {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No locations available';
      option.disabled = true;
      locationSelect.appendChild(option);
    }
    
    // Réinitialiser le formulaire
    document.getElementById('add-group-form').reset();
    document.getElementById('add-group-alert').style.display = 'none';
    document.getElementById('add-profile-safety').checked = true;
    
    // Réinitialiser les états de validation
    document.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
    
    // Afficher le modal
    try {
      console.log('Tentative d\'affichage du modal d\'ajout...');
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
      console.log('Modal d\'ajout affiché avec succès');
    } catch (error) {
      console.error('Erreur lors de l\'affichage du modal d\'ajout:', error);
      console.error('Stack trace:', error.stack);
      showAlert('An error occurred while displaying the add group form.', 'danger');
    }
  }
  
  // Fonction pour charger les dispositifs pour l'ajout
  async function loadDevicesForAdd(locationId) {
    const devicesList = document.getElementById('add-devices-list');
    if (!devicesList) return;
    
    if (!locationId) {
      devicesList.innerHTML = `
        <div class="d-flex justify-content-center align-items-center h-100">
          <div class="text-center text-muted">
            <i class="bi bi-devices fs-2"></i>
            <p>Select a location first</p>
          </div>
        </div>
      `;
      return;
    }
    
    try {
      // Afficher un indicateur de chargement
      devicesList.innerHTML = `
        <div class="d-flex justify-content-center align-items-center h-100">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
        </div>
      `;
      
      // Récupérer les dispositifs depuis l'API
      const response = await fetch('/api/devices');
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      devices = await response.json();
      console.log('Dispositifs récupérés pour ajout:', devices);
      
      // Vider le conteneur
      devicesList.innerHTML = '';
      
      // Si aucun dispositif
      if (devices.length === 0) {
        devicesList.innerHTML = `
          <div class="d-flex justify-content-center align-items-center h-100">
            <div class="text-center text-muted">
              <i class="bi bi-exclamation-circle fs-2"></i>
              <p>No devices available</p>
            </div>
          </div>
        `;
        return;
      }
      
      // Organiser les dispositifs par type
      const devicesByType = {};
      
      devices.forEach(device => {
        if (!devicesByType[device.type]) {
          devicesByType[device.type] = [];
        }
        devicesByType[device.type].push(device);
      });
      
      // Créer les groupes de dispositifs
      for (const type in devicesByType) {
        const typeHeading = document.createElement('h6');
        typeHeading.className = 'mb-2 mt-2';
        typeHeading.textContent = `${type} (${devicesByType[type].length})`;
        devicesList.appendChild(typeHeading);
        
        devicesByType[type].forEach(device => {
          const deviceElement = document.createElement('div');
          deviceElement.className = 'mb-2';
          
          let statusClass = 'text-success';
          if (device.status === 'inactive') {
            statusClass = 'text-danger';
          } else if (device.status === 'maintenance') {
            statusClass = 'text-warning';
          }
          
          deviceElement.innerHTML = `
            <div class="d-flex align-items-center w-100 border rounded p-2 ${device.status !== 'active' ? 'bg-light' : ''}">
              <input class="form-check-input add-device-checkbox me-2" type="checkbox" value="${device.id}" id="add-device-${device.id}">
              <label class="form-check-label d-flex justify-content-between w-100" for="add-device-${device.id}">
                <div>
                  <div>${device.name || 'Unnamed Device'}</div>
                  <div class="small ${statusClass}">
                    <i class="bi bi-circle-fill me-1"></i>${device.status}
                  </div>
                </div>
                <div class="text-end">
                  <div class="small text-muted">${device.ipAddress || 'No IP'}</div>
                  <div class="small text-muted">${device.msisdn || 'No MSISDN'}</div>
                </div>
              </label>
            </div>
          `;
          devicesList.appendChild(deviceElement);
        });
      }
    } catch (error) {
      console.error('Error loading devices for add:', error);
      devicesList.innerHTML = `
        <div class="d-flex justify-content-center align-items-center h-100">
          <div class="text-center text-danger">
            <i class="bi bi-exclamation-triangle fs-2"></i>
            <p>Error loading devices</p>
          </div>
        </div>
      `;
    }
  }
  
  // Fonction pour enregistrer un nouveau groupe
  function saveNewGroup() {
    console.log('Sauvegarde du nouveau groupe...');
    
    // Récupérer les valeurs du formulaire
    const locationSelect = document.getElementById('add-location-select');
    const nameInput = document.getElementById('add-group-name');
    const locationId = locationSelect.value;
    const name = nameInput.value.trim();
    const connectivityProfile = document.querySelector('input[name="add-connectivity-profile"]:checked').value;
    
    // Validation des champs
    let isValid = true;
    
    // Vérifier la location
    if (!locationId) {
      locationSelect.classList.add('is-invalid');
      isValid = false;
    } else {
      locationSelect.classList.remove('is-invalid');
    }
    
    // Vérifier le nom
    if (!name) {
      nameInput.classList.add('is-invalid');
      isValid = false;
    } else {
      nameInput.classList.remove('is-invalid');
    }
    
    if (!isValid) {
      // Afficher une alerte dans le modal
      const modalAlert = document.getElementById('add-group-alert');
      modalAlert.textContent = 'Please fill in all required fields.';
      modalAlert.style.display = 'block';
      return;
    }
    
    // Récupérer les dispositifs sélectionnés
    const selectedDevices = [];
    document.querySelectorAll('.add-device-checkbox:checked').forEach(checkbox => {
      selectedDevices.push(parseInt(checkbox.value));
    });
    
    console.log('Données extraites pour la création du groupe:', { locationId, name, connectivityProfile, selectedDevices });
    
    // Masquer l'alerte
    document.getElementById('add-group-alert').style.display = 'none';
    
    // Afficher l'indicateur de chargement
    const saveBtn = document.getElementById('create-group-btn');
    const saveText = document.getElementById('create-group-text');
    const saveSpinner = document.getElementById('create-group-spinner');
    
    saveBtn.disabled = true;
    saveText.textContent = 'Creating...';
    saveSpinner.classList.remove('d-none');
    
    // Objet de données pour la création
    const groupData = {
      locationId: parseInt(locationId),
      name,
      connectivityProfile,
      devices: selectedDevices
    };
    
    // Créer le groupe
    createGroup(groupData)
      .finally(() => {
        // Restaurer le bouton
        saveBtn.disabled = false;
        saveText.textContent = 'Create Group';
        saveSpinner.classList.add('d-none');
      });
  }
  
  // Initialiser la page
  async function initialize() {
    await fetchLocations();
    await fetchGroups();
  }
  
  // Démarrer l'initialisation
  initialize();
  
  // Gestionnaires d'événements
  if (addGroupBtn) {
    addGroupBtn.addEventListener('click', showAddGroupModal);
  }
  
  if (floatingAddGroupBtn) {
    floatingAddGroupBtn.addEventListener('click', () => {
      console.log('Floating Add Group button clicked');
      showAddGroupModal();
    });
  }

  // Fonction pour afficher les dispositifs d'un groupe
  async function showGroupDevices(groupId) {
    try {
      console.log('Affichage des dispositifs du groupe:', groupId);
      
      // Récupérer les dispositifs du groupe
      const response = await fetch(`/api/groups/${groupId}/devices`);
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const groupDevices = await response.json();
      console.log('Dispositifs du groupe récupérés:', groupDevices);
      
      // Trouver le groupe dans la liste des groupes
      const group = groups.find(g => g.id === groupId);
      if (!group) {
        throw new Error('Group not found');
      }
      
      // Vérifier si un modal existe déjà, sinon le créer
      let modalElement = document.getElementById('group-devices-modal');
      
      if (!modalElement) {
        console.log('Création du modal de dispositifs du groupe...');
        modalElement = document.createElement('div');
        modalElement.id = 'group-devices-modal';
        modalElement.className = 'modal fade';
        modalElement.setAttribute('tabindex', '-1');
        modalElement.setAttribute('aria-labelledby', 'groupDevicesModalLabel');
        modalElement.setAttribute('aria-hidden', 'true');
        
        modalElement.innerHTML = `
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title" id="groupDevicesModalLabel">Group Devices</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                <div id="group-devices-list">
                  <div class="d-flex justify-content-center">
                    <div class="spinner-border text-primary" role="status">
                      <span class="visually-hidden">Loading...</span>
                    </div>
                  </div>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
              </div>
            </div>
          </div>
        `;
        
        document.body.appendChild(modalElement);
      }
      
      // Mettre à jour le titre
      document.getElementById('groupDevicesModalLabel').textContent = `Devices in ${group.name}`;
      
      // Initialiser le contenu
      const devicesList = document.getElementById('group-devices-list');
      
      if (groupDevices.length === 0) {
        devicesList.innerHTML = `
          <div class="alert alert-info">
            <i class="bi bi-info-circle"></i> No devices in this group.
          </div>
        `;
      } else {
        // Récupérer les dispositifs complets
        const devicesResponse = await fetch('/api/devices');
        if (!devicesResponse.ok) {
          throw new Error(`Error: ${devicesResponse.status}`);
        }
        
        const allDevices = await devicesResponse.json();
        
        // Filtrer pour obtenir uniquement les dispositifs du groupe
        const devicesInGroup = allDevices.filter(device => 
          groupDevices.some(gd => 
            (gd.id === device.id) || 
            (typeof gd === 'number' && gd === device.id) || 
            (gd.deviceId === device.id)
          )
        );
        
        console.log('Dispositifs filtrés dans le groupe:', devicesInGroup);
        
        // Construire la liste des dispositifs
        let devicesHtml = `
          <div class="table-responsive">
            <table class="table table-hover">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>IP Address</th>
                  <th>MSISDN</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
        `;
        
        devicesInGroup.forEach(device => {
          // Déterminer la classe de couleur en fonction du statut
          let statusClass = 'text-success';
          if (device.status === 'inactive') {
            statusClass = 'text-danger';
          } else if (device.status === 'maintenance') {
            statusClass = 'text-warning';
          }
          
          devicesHtml += `
            <tr>
              <td>${device.name || 'Unnamed Device'}</td>
              <td>${device.type || 'N/A'}</td>
              <td>${device.ipAddress || 'N/A'}</td>
              <td>${device.msisdn || 'N/A'}</td>
              <td class="${statusClass}">
                <i class="bi bi-circle-fill me-1"></i>${device.status || 'unknown'}
              </td>
            </tr>
          `;
        });
        
        devicesHtml += `
              </tbody>
            </table>
          </div>
        `;
        
        devicesList.innerHTML = devicesHtml;
      }
      
      // Afficher le modal
      try {
        console.log('Tentative d\'affichage du modal de dispositifs...');
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
        console.log('Modal de dispositifs affiché avec succès');
      } catch (error) {
        console.error('Erreur lors de l\'affichage du modal de dispositifs:', error);
        console.error('Stack trace:', error.stack);
        showAlert('An error occurred while displaying the devices list.', 'danger');
      }
    } catch (error) {
      console.error('Error displaying group devices:', error);
      showAlert(`Unable to retrieve devices for this group: ${error.message}`, 'danger');
    }
  }

  // Add this function to update device counts
  async function updateGroupDeviceCount(groupId) {
    try {
      const response = await fetch(`/api/groups/${groupId}/devices`);
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const groupDevices = await response.json();
      const count = groupDevices.length;
      
      // Update all badges for this group
      document.querySelectorAll(`.device-count-badge[data-group-id="${groupId}"]`).forEach(badge => {
        badge.innerHTML = `<i class="bi bi-device-hdd"></i> ${count} device${count !== 1 ? 's' : ''}`;
      });
    } catch (error) {
      console.error(`Error fetching device count for group ${groupId}:`, error);
      document.querySelectorAll(`.device-count-badge[data-group-id="${groupId}"]`).forEach(badge => {
        badge.innerHTML = `<i class="bi bi-device-hdd"></i> ?`;
      });
    }
  }
}); 