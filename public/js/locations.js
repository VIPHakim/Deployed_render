/**
 * Gestion des emplacements (Locations)
 * Ce script gère la visualisation, l'ajout, la modification et la suppression des emplacements
 * en utilisant les API REST du serveur
 */

// Initialisation de la page
document.addEventListener('DOMContentLoaded', () => {
  // Éléments du DOM
  const toggleAddPanelBtn = document.getElementById('toggle-add-panel');
  const closeAddPanelBtn = document.getElementById('close-add-panel');
  const addPanel = document.getElementById('add-panel');
  const mainPanel = document.getElementById('main-panel');
  const locationForm = document.getElementById('location-form');
  const locationFormTitle = document.getElementById('location-form-title');
  const latitudeInput = document.getElementById('latitude');
  const longitudeInput = document.getElementById('longitude');
  const locationNameInput = document.getElementById('location-name');
  const locationsTableBody = document.getElementById('locations-table-body');
  const locationSearch = document.getElementById('location-search');
  const searchBtn = document.getElementById('search-btn');
  const coordinatesSearch = document.getElementById('coordinates-search');
  const coordinatesSearchBtn = document.getElementById('coordinates-search-btn');
  const locationsMapElement = document.getElementById('locations-map');
  
  // Créer un élément pour les suggestions de recherche
  const searchSuggestions = document.createElement('div');
  searchSuggestions.className = 'search-suggestions';
  searchSuggestions.style.display = 'none';
  if (locationSearch) {
    locationSearch.parentNode.appendChild(searchSuggestions);
  }
  
  // Créer un élément pour les suggestions de recherche de coordonnées
  const coordinatesSuggestions = document.createElement('div');
  coordinatesSuggestions.className = 'search-suggestions';
  coordinatesSuggestions.style.display = 'none';
  if (coordinatesSearch) {
    coordinatesSearch.parentNode.appendChild(coordinatesSuggestions);
  }

  // État de l'application
  let locations = [];
  let filteredLocations = [];
  let currentLocationId = null;
  let locationsMap = null;
  let locationMarkers = [];
  let searchResultMarkers = []; // Pour stocker les marqueurs de résultats de recherche
  let tempMarker = null; // Marqueur temporaire pour l'ajout d'un nouvel emplacement

  // Initialiser la carte des emplacements
  function initializeLocationsMap() {
    if (!locationsMapElement) {
      console.error('Élément de carte introuvable');
      return;
    }
    
    console.log('Initialisation de la carte des emplacements...');
    
    // Créer la carte centrée sur la France
    locationsMap = L.map('locations-map').setView([46.603354, 1.888334], 5);
    
    // Ajouter le layer de tuiles OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(locationsMap);
    
    console.log('Carte initialisée avec succès');
    
    // Ajouter un gestionnaire d'événements de clic pour définir les coordonnées
    locationsMap.on('click', function(e) {
      console.log('Clic sur la carte:', e.latlng);
      if (addPanel.style.display === 'block') {
        const { lat, lng } = e.latlng;
        latitudeInput.value = lat;
        longitudeInput.value = lng;
        
        // Ajouter un marqueur temporaire
        if (tempMarker) {
          tempMarker.setLatLng(e.latlng);
        } else {
          tempMarker = L.marker(e.latlng, {
            icon: L.divIcon({
              className: 'temp-marker',
              html: '<i class="bi bi-geo-alt-fill text-success"></i>',
              iconSize: [25, 25],
              iconAnchor: [12, 25]
            })
          }).addTo(locationsMap);
        }
      }
    });
    
    // S'assurer que la carte se redimensionne correctement
    setTimeout(() => {
      locationsMap.invalidateSize();
      console.log('Carte redimensionnée');
    }, 100);
    
    // Ajouter les marqueurs des emplacements
    updateMapMarkers();
  }

  // Mettre à jour les marqueurs sur la carte des emplacements
  function updateMapMarkers() {
    if (!locationsMap) return;
    
    // Supprimer les marqueurs existants
    locationMarkers.forEach(marker => locationsMap.removeLayer(marker));
    locationMarkers = [];
    
    // Ajouter les nouveaux marqueurs
    const locationsToShow = filteredLocations.length > 0 ? filteredLocations : locations;
    
    if (locationsToShow.length === 0) {
      // Si aucun emplacement, centrer sur la France
      locationsMap.setView([46.603354, 1.888334], 5);
      return;
    }
    
    const bounds = L.latLngBounds();
    
    locationsToShow.forEach(location => {
      const marker = L.marker([location.latitude, location.longitude])
        .bindPopup(`
          <div class="location-popup">
            <h5>${location.name}</h5>
            <p>Latitude: ${location.latitude}<br>Longitude: ${location.longitude}</p>
            <div class="d-flex">
              <button class="btn btn-sm btn-outline-primary me-2 popup-edit-btn" data-id="${location.id}">Edit</button>
              <button class="btn btn-sm btn-outline-danger me-2 popup-delete-btn" data-id="${location.id}">Delete</button>
              <button class="btn btn-sm btn-outline-info popup-show-groups-btn" data-id="${location.id}">Show Groups</button>
            </div>
          </div>
        `)
        .addTo(locationsMap);
      
      // Ajouter un gestionnaire d'événements pour le popup
      marker.on('popupopen', () => {
        console.log('Popup opened for location:', location);
        
        // Gestionnaire pour le bouton Edit
        const editBtn = document.querySelector(`.popup-edit-btn[data-id="${location.id}"]`);
        if (editBtn) {
          editBtn.addEventListener('click', () => {
            console.log('Edit button clicked for location:', location);
            showEditPanel(location);
          });
        }
        
        // Gestionnaire pour le bouton Delete
        const deleteBtn = document.querySelector(`.popup-delete-btn[data-id="${location.id}"]`);
        if (deleteBtn) {
          deleteBtn.addEventListener('click', () => {
            console.log('Delete button clicked for location:', location);
            if (confirm('Are you sure you want to delete this location?')) {
              deleteLocation(location.id);
            }
          });
        }
        
        // Gestionnaire pour le bouton Show Groups
        const showGroupsBtn = document.querySelector(`.popup-show-groups-btn[data-id="${location.id}"]`);
        if (showGroupsBtn) {
          showGroupsBtn.addEventListener('click', () => {
            console.log('Show Groups button clicked for location:', location);
            showLocationGroups(location.id);
          });
        }
      });
      
      locationMarkers.push(marker);
      bounds.extend([location.latitude, location.longitude]);
    });
    
    // Ajuster la vue de la carte pour inclure tous les marqueurs
    if (locationsToShow.length > 0) {
      locationsMap.fitBounds(bounds, { padding: [50, 50] });
    }
  }

  // Rechercher des emplacements
  function searchLocations(query) {
    if (!query.trim()) {
      filteredLocations = [];
      renderLocations();
      updateMapMarkers();
      return;
    }
    
    // Recherche dans la base de données locale
    query = query.toLowerCase().trim();
    filteredLocations = locations.filter(location => 
      location.name.toLowerCase().includes(query)
    );
    
    renderLocations();
    updateMapMarkers();
    
    // Recherche via Nominatim (OpenStreetMap)
    searchNominatim(query);
  }

  // Rechercher des lieux via Nominatim (OpenStreetMap)
  function searchNominatim(query) {
    // Supprimer les marqueurs de recherche précédents
    searchResultMarkers.forEach(marker => locationsMap.removeLayer(marker));
    searchResultMarkers = [];
    
    // URL de l'API Nominatim
    const apiUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`;
    
    // Afficher un indicateur de chargement
    const searchInput = document.getElementById('location-search');
    searchInput.classList.add('loading');
    
    fetch(apiUrl)
      .then(response => response.json())
      .then(data => {
        // Supprimer l'indicateur de chargement
        searchInput.classList.remove('loading');
        
        if (data.length === 0) {
          console.log('No results found via Nominatim');
          return;
        }
        
        // Créer des limites pour ajuster la vue de la carte
        const bounds = L.latLngBounds();
        
        // Ajouter des marqueurs pour chaque résultat
        data.forEach(result => {
          const lat = parseFloat(result.lat);
          const lon = parseFloat(result.lon);
          const marker = L.marker([lat, lon], {
            icon: L.divIcon({
              className: 'search-result-marker',
              html: '<i class="bi bi-geo-alt-fill text-danger"></i>',
              iconSize: [25, 25],
              iconAnchor: [12, 25],
              popupAnchor: [0, -25]
            })
          }).addTo(locationsMap);
          
          // Créer un popup avec les informations et un bouton pour ajouter l'emplacement
          const popupContent = `
            <div class="search-result-popup">
              <h5>${result.display_name.split(',')[0]}</h5>
              <p>${result.display_name}</p>
              <button class="btn btn-sm btn-primary add-location-btn" 
                data-lat="${lat}" 
                data-lon="${lon}" 
                data-name="${result.display_name.split(',')[0]}">
                Add this location
              </button>
            </div>
          `;
          
          marker.bindPopup(popupContent);
          marker.on('click', () => {
            marker.openPopup();
          });
          
          searchResultMarkers.push(marker);
          bounds.extend([lat, lon]);
        });
        
        // Ajuster la vue de la carte pour montrer tous les résultats
        if (searchResultMarkers.length > 0) {
          locationsMap.fitBounds(bounds, { padding: [50, 50] });
          
          // Ouvrir le premier marqueur par défaut
          searchResultMarkers[0].openPopup();
        }
        
        // Ajouter des gestionnaires d'événements pour les boutons "Ajouter cet emplacement"
        setTimeout(() => {
          document.querySelectorAll('.add-location-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
              const lat = parseFloat(e.target.dataset.lat);
              const lon = parseFloat(e.target.dataset.lon);
              const name = e.target.dataset.name;
              
              // Options:
              // 1. Ajout direct
              // addLocation({ name, latitude: lat, longitude: lon });
              
              // 2. Préremplir le formulaire
              showAddPanel();
              locationNameInput.value = name;
              latitudeInput.value = lat;
              longitudeInput.value = lon;
              
              // Ajouter un marqueur temporaire
              if (tempMarker) {
                tempMarker.setLatLng([lat, lon]);
              } else {
                tempMarker = L.marker([lat, lon], {
                  icon: L.divIcon({
                    className: 'temp-marker',
                    html: '<i class="bi bi-geo-alt-fill text-success"></i>',
                    iconSize: [25, 25],
                    iconAnchor: [12, 25]
                  })
                }).addTo(locationsMap);
              }
              
              // Fermer le popup
              locationsMap.closePopup();
            });
          });
        }, 100);
      })
      .catch(error => {
        searchInput.classList.remove('loading');
        console.error('Error during Nominatim search:', error);
      });
  }

  // Recherche de coordonnées pour le formulaire d'ajout
  function searchCoordinatesNominatim(query) {
    // URL de l'API Nominatim
    const apiUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    
    // Afficher un indicateur de chargement
    coordinatesSearch.classList.add('loading');
    
    fetch(apiUrl)
      .then(response => response.json())
      .then(data => {
        coordinatesSearch.classList.remove('loading');
        
        if (data.length === 0) {
          alert('No location found');
          return;
        }
        
        const result = data[0];
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);
        
        // Remplir les champs de coordonnées
        latitudeInput.value = lat;
        longitudeInput.value = lon;
        
        // Zoomer sur la position
        locationsMap.setView([lat, lon], 13);
        
        // Ajouter un marqueur temporaire
        if (tempMarker) {
          tempMarker.setLatLng([lat, lon]);
        } else {
          tempMarker = L.marker([lat, lon], {
            icon: L.divIcon({
              className: 'temp-marker',
              html: '<i class="bi bi-geo-alt-fill text-success"></i>',
              iconSize: [25, 25],
              iconAnchor: [12, 25]
            })
          }).addTo(locationsMap);
        }
      })
      .catch(error => {
        coordinatesSearch.classList.remove('loading');
        console.error('Error during coordinate search:', error);
      });
  }

  // Récupérer tous les emplacements depuis l'API
  async function fetchLocations() {
    try {
      console.log('Récupération des emplacements...');
      const response = await fetch('/api/locations');
      if (!response.ok) {
        throw new Error('Error retrieving locations');
      }
      locations = await response.json();
      console.log('Emplacements récupérés:', locations);
      renderLocations();
      
      // Initialiser la carte des emplacements après avoir chargé les données
      if (!locationsMap) {
        console.log('Initialisation de la carte après chargement des données');
        initializeLocationsMap();
      } else {
        updateMapMarkers();
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Unable to retrieve locations. Please try again later.');
      
      // En cas d'erreur, initialiser quand même la carte
      if (!locationsMap) {
        console.log('Initialisation de la carte après erreur');
        initializeLocationsMap();
      }
    }
  }

  // Afficher le panneau d'ajout d'emplacement
  function showAddPanel() {
    addPanel.style.display = 'block';
    mainPanel.classList.remove('col-md-12');
    mainPanel.classList.add('col-md-8');
    
    // Mise à jour du titre
    locationFormTitle.textContent = 'Add New Location';
    
    // Réinitialiser le formulaire
    locationForm.reset();
    currentLocationId = null;
    
    // Supprimer le marqueur temporaire s'il existe
    if (tempMarker) {
      locationsMap.removeLayer(tempMarker);
      tempMarker = null;
    }
    
    // Redimensionner la carte après changement d'affichage
    setTimeout(() => {
      locationsMap.invalidateSize();
    }, 100);
  }

  // Afficher le panneau d'édition d'un emplacement existant
  function showEditPanel(location) {
    showAddPanel(); // Réutiliser la fonction d'affichage du panneau
    
    // Mise à jour du titre
    locationFormTitle.textContent = 'Edit Location';
    
    // Remplir le formulaire avec les données de l'emplacement
    locationNameInput.value = location.name;
    latitudeInput.value = location.latitude;
    longitudeInput.value = location.longitude;
    currentLocationId = location.id;
    
    // Ajouter un marqueur temporaire
    const lat = parseFloat(location.latitude);
    const lon = parseFloat(location.longitude);
    
    tempMarker = L.marker([lat, lon], {
      icon: L.divIcon({
        className: 'temp-marker',
        html: '<i class="bi bi-geo-alt-fill text-success"></i>',
        iconSize: [25, 25],
        iconAnchor: [12, 25]
      })
    }).addTo(locationsMap);
    
    // Zoomer sur l'emplacement
    locationsMap.setView([lat, lon], 13);
  }

  // Cacher le panneau d'ajout/édition
  function hideAddPanel() {
    addPanel.style.display = 'none';
    mainPanel.classList.remove('col-md-8');
    mainPanel.classList.add('col-md-12');
    
    // Supprimer le marqueur temporaire s'il existe
    if (tempMarker) {
      locationsMap.removeLayer(tempMarker);
      tempMarker = null;
    }
    
    // Redimensionner la carte après changement d'affichage
    setTimeout(() => {
      locationsMap.invalidateSize();
    }, 100);
  }

  // Ajouter un nouvel emplacement via l'API
  async function addLocation(location) {
    try {
      console.log('Tentative d\'ajout d\'emplacement:', location);
      
      // S'assurer que les données sont au bon format
      const formattedLocation = {
        name: location.name.trim(),
        latitude: parseFloat(location.latitude),
        longitude: parseFloat(location.longitude)
      };
      
      console.log('Données formatées:', formattedLocation);
      
      const response = await fetch('/api/locations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formattedLocation)
      });
      
      console.log('Réponse de l\'API:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('Détails de l\'erreur:', errorData);
        throw new Error(`Error adding the location: ${response.status} ${response.statusText}`);
      }
      
      const responseData = await response.json();
      console.log('Emplacement ajouté avec succès:', responseData);
      
      await fetchLocations(); // Rafraîchir la liste
      hideAddPanel();
    } catch (error) {
      console.error('Erreur détaillée:', error);
      alert('Unable to add the location. Please try again later.');
    }
  }

  // Mettre à jour un emplacement existant via l'API
  async function updateLocation(id, updatedLocation) {
    try {
      console.log('Updating location:', { id, updatedLocation });
      
      // Ensure the data is properly formatted
      const formattedLocation = {
        name: updatedLocation.name.trim(),
        latitude: parseFloat(updatedLocation.latitude),
        longitude: parseFloat(updatedLocation.longitude)
      };
      
      console.log('Formatted location data:', formattedLocation);
      
      const response = await fetch(`/api/locations/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formattedLocation)
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('Error details:', errorData);
        throw new Error(`Error updating the location: ${response.status} ${response.statusText}`);
      }
      
      const responseData = await response.json();
      console.log('Location updated successfully:', responseData);
      
      await fetchLocations(); // Refresh the list
      hideAddPanel();
    } catch (error) {
      console.error('Detailed error:', error);
      alert('Unable to update the location. Please try again later.');
    }
  }

  // Supprimer un emplacement via l'API
  async function deleteLocation(id) {
    try {
      const response = await fetch(`/api/locations/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Error deleting the location');
      }
      
      await fetchLocations(); // Rafraîchir la liste
    } catch (error) {
      console.error('Error:', error);
      alert('Unable to delete the location. Please try again later.');
    }
  }

  // Afficher les emplacements dans le tableau
  function renderLocations() {
    locationsTableBody.innerHTML = '';
    
    // Utiliser les emplacements filtrés s'ils existent, sinon tous les emplacements
    const locationsToShow = filteredLocations.length > 0 ? filteredLocations : locations;
    
    locationsToShow.forEach(location => {
      const row = document.createElement('tr');
      row.dataset.id = location.id;
      row.innerHTML = `
        <td>${location.name}</td>
        <td>${location.latitude}</td>
        <td>${location.longitude}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary edit-btn" data-id="${location.id}">Edit</button>
          <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${location.id}">Delete</button>
          <button class="btn btn-sm btn-outline-info show-groups-btn" data-id="${location.id}">Show Groups</button>
        </td>
      `;
      locationsTableBody.appendChild(row);
      
      // Ajouter un gestionnaire d'événements pour mettre en surbrillance le marqueur correspondant
      row.addEventListener('click', () => {
        // Supprimer la classe active de toutes les lignes
        document.querySelectorAll('#locations-table-body tr').forEach(r => r.classList.remove('table-active'));
        // Ajouter la classe active à cette ligne
        row.classList.add('table-active');
        
        // Trouver le marqueur correspondant et ouvrir son popup
        if (locationsMap) {
          const marker = locationMarkers.find((m, index) => locationsToShow[index].id === location.id);
          if (marker) {
            marker.openPopup();
            locationsMap.setView(marker.getLatLng(), 13);
          }
        }
      });
    });
    
    // Ajouter les gestionnaires d'événements aux boutons
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation(); // Empêcher la propagation vers la ligne du tableau
        const locationId = e.target.dataset.id;
        const location = locations.find(loc => 
          loc.id === locationId || loc.id === parseInt(locationId) || loc.id === locationId.toString()
        );
        if (location) {
          showEditPanel(location);
        }
      });
    });
    
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation(); // Empêcher la propagation vers la ligne du tableau
        const locationId = e.target.dataset.id;
        if (confirm('Are you sure you want to delete this location?')) {
          deleteLocation(locationId);
        }
      });
    });
    
    // Ajouter les gestionnaires d'événements pour afficher les groupes
    document.querySelectorAll('.show-groups-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation(); // Empêcher la propagation vers la ligne du tableau
        const locationId = e.target.dataset.id;
        showLocationGroups(locationId);
      });
    });
  }

  // Nouvelle fonction pour afficher les groupes d'un emplacement
  async function showLocationGroups(locationId) {
    try {
      // Récupérer les groupes pour cet emplacement
      const response = await fetch(`/api/locations/${locationId}/groups`);
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      const groups = await response.json();
      
      // Créer ou obtenir le modal
      let modalElement = document.getElementById('location-groups-modal');
      if (!modalElement) {
        modalElement = document.createElement('div');
        modalElement.id = 'location-groups-modal';
        modalElement.className = 'modal fade';
        modalElement.setAttribute('tabindex', '-1');
        modalElement.innerHTML = `
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Groups at <span id="modal-location-name"></span></h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                <div id="groups-list" class="list-group">
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

      // Mettre à jour le contenu du modal
      const location = locations.find(loc => loc.id === parseInt(locationId));
      const locationName = document.getElementById('modal-location-name');
      const groupsList = document.getElementById('groups-list');
      
      if (location) {
        locationName.textContent = location.name;
      }

      if (groups.length === 0) {
        groupsList.innerHTML = `
          <div class="text-center text-muted p-3">
            <i class="bi bi-info-circle"></i>
            <p>No groups found for this location</p>
          </div>
        `;
      } else {
        groupsList.innerHTML = groups.map(group => `
          <div class="list-group-item">
            <div class="d-flex justify-content-between align-items-center">
              <div>
                <h6 class="mb-1">${group.name}</h6>
                <p class="mb-1 small text-muted">Profile: ${group.connectivityProfile}</p>
                <p class="mb-0 small text-muted">Created: ${new Date(group.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <span class="badge bg-primary">
                  <i class="bi bi-device-hdd"></i>
                  ${group.devices ? group.devices.length : 0} Devices
                </span>
              </div>
            </div>
          </div>
        `).join('');
      }

      // Afficher le modal
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
    } catch (error) {
      console.error('Error loading location groups:', error);
      alert('Unable to load groups for this location. Please try again later.');
    }
  }

  // Gestionnaire pour la soumission du formulaire d'emplacement
  function handleLocationFormSubmit(e) {
    e.preventDefault();
    
    const name = locationNameInput.value.trim();
    const latitude = parseFloat(latitudeInput.value);
    const longitude = parseFloat(longitudeInput.value);
    
    console.log('Soumission du formulaire d\'emplacement:', { name, latitude, longitude, currentLocationId });
    
    if (!name || isNaN(latitude) || isNaN(longitude)) {
      alert('Please fill in all fields correctly.');
      return;
    }
    
    const locationData = { name, latitude, longitude };
    
    if (currentLocationId) {
      console.log('Mise à jour de l\'emplacement ID:', currentLocationId);
      updateLocation(currentLocationId, locationData);
    } else {
      console.log('Ajout d\'un nouvel emplacement');
      addLocation(locationData);
    }
  }

  // Gestionnaire pour la recherche principale
  function handleSearch() {
    const query = locationSearch.value;
    searchLocations(query);
  }

  // Gestionnaire pour la recherche de coordonnées
  function handleCoordinatesSearch() {
    const query = coordinatesSearch.value;
    if (query.trim()) {
      searchCoordinatesNominatim(query);
    }
  }

  // Recherche d'autocomplétion via Nominatim
  function searchAutocomplete(query, suggestionsElement, isCoordinatesSearch = false) {
    if (!query.trim() || query.length < 2) {
      suggestionsElement.style.display = 'none';
      return;
    }

    // URL de l'API Nominatim pour l'autocomplétion
    const apiUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`;
    
    fetch(apiUrl)
      .then(response => response.json())
      .then(data => {
        if (data.length === 0) {
          suggestionsElement.style.display = 'none';
          return;
        }
        
        // Afficher les suggestions
        suggestionsElement.innerHTML = '';
        data.forEach(result => {
          const suggestionItem = document.createElement('div');
          suggestionItem.className = 'suggestion-item';
          suggestionItem.textContent = result.display_name.split(',')[0];
          suggestionItem.title = result.display_name;
          
          suggestionItem.addEventListener('click', () => {
            if (isCoordinatesSearch) {
              coordinatesSearch.value = result.display_name.split(',')[0];
              searchCoordinatesNominatim(result.display_name);
            } else {
              locationSearch.value = result.display_name.split(',')[0];
              searchLocations(result.display_name);
            }
            suggestionsElement.style.display = 'none';
          });
          
          suggestionsElement.appendChild(suggestionItem);
        });
        
        suggestionsElement.style.display = 'block';
      })
      .catch(error => {
        console.error('Error during autocomplete search:', error);
        suggestionsElement.style.display = 'none';
      });
  }

  // Gestionnaires d'événements
  toggleAddPanelBtn.addEventListener('click', showAddPanel);
  closeAddPanelBtn.addEventListener('click', hideAddPanel);
  locationForm.addEventListener('submit', handleLocationFormSubmit);
  
  searchBtn.addEventListener('click', handleSearch);
  locationSearch.addEventListener('keypress', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  });
  
  // Ajouter l'événement d'autocomplétion sur la saisie
  locationSearch.addEventListener('input', () => {
    searchAutocomplete(locationSearch.value, searchSuggestions);
  });
  
  // Masquer les suggestions lorsque l'on clique ailleurs
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-area')) {
      searchSuggestions.style.display = 'none';
    }
    if (!e.target.closest('#add-panel .input-group')) {
      coordinatesSuggestions.style.display = 'none';
    }
  });
  
  coordinatesSearchBtn.addEventListener('click', handleCoordinatesSearch);
  coordinatesSearch.addEventListener('keypress', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCoordinatesSearch();
    }
  });
  
  // Ajouter l'événement d'autocomplétion sur la saisie des coordonnées
  coordinatesSearch.addEventListener('input', () => {
    searchAutocomplete(coordinatesSearch.value, coordinatesSuggestions, true);
  });

  // Initialiser l'affichage des emplacements
  console.log('Initialisation de l\'application...');
  fetchLocations();
  
  // Initialiser la carte si elle n'est pas chargée après un délai
  setTimeout(() => {
    if (!locationsMap) {
      console.log('Initialisation forcée de la carte');
      initializeLocationsMap();
    }
  }, 1000);

  // Fonction pour afficher le modal de création de groupe
  function showCreateGroupModal(location) {
    console.log('Afficher le modal de création de groupe pour l\'emplacement:', location);
    
    // Vérifier si un modal existe déjà, sinon le créer
    let modalElement = document.getElementById('create-group-modal');
    
    if (!modalElement) {
      console.log('Création du modal...');
      modalElement = document.createElement('div');
      modalElement.id = 'create-group-modal';
      modalElement.className = 'modal fade';
      modalElement.setAttribute('tabindex', '-1');
      modalElement.setAttribute('aria-labelledby', 'createGroupModalLabel');
      modalElement.setAttribute('aria-hidden', 'true');
      
      modalElement.innerHTML = `
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="createGroupModalLabel">Create Group at <span id="modal-location-name"></span></h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <form id="create-group-form">
                <input type="hidden" id="group-location-id">
                <div class="row">
                  <div class="col-md-6">
                    <div class="mb-3">
                      <label for="group-name" class="form-label">Group Name</label>
                      <input type="text" class="form-control" id="group-name" required>
                    </div>
                    <div class="mb-3">
                      <label class="form-label">Connectivity Profile</label>
                      <div class="form-check">
                        <input class="form-check-input" type="radio" name="connectivity-profile" id="profile-safety" value="Safety" checked>
                        <label class="form-check-label" for="profile-safety">
                          Safety
                        </label>
                      </div>
                      <div class="form-check">
                        <input class="form-check-input" type="radio" name="connectivity-profile" id="profile-pos" value="POS">
                        <label class="form-check-label" for="profile-pos">
                          POS (Point of Sale)
                        </label>
                      </div>
                      <div class="form-check">
                        <input class="form-check-input" type="radio" name="connectivity-profile" id="profile-xr" value="XR">
                        <label class="form-check-label" for="profile-xr">
                          XR (Extended Reality)
                        </label>
                      </div>
                      <div class="form-check">
                        <input class="form-check-input" type="radio" name="connectivity-profile" id="profile-broadcasting" value="Broadcasting">
                        <label class="form-check-label" for="profile-broadcasting">
                          Broadcasting
                        </label>
                      </div>
                    </div>
                  </div>
                  <div class="col-md-6">
                    <div class="mb-3">
                      <label class="form-label">Available Devices</label>
                      <div class="input-group mb-3">
                        <input type="text" class="form-control" placeholder="Search devices" id="device-search">
                        <button class="btn btn-outline-secondary" type="button" id="search-device-btn">
                          <i class="bi bi-search"></i>
                        </button>
                      </div>
                      <div class="device-list-container border rounded p-2" style="height: 200px; overflow-y: auto;">
                        <div id="available-devices-list">
                          <div class="d-flex justify-content-center align-items-center h-100">
                            <div class="text-center text-muted">
                              <i class="bi bi-devices fs-2"></i>
                              <p>Loading devices...</p>
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
              <button type="button" class="btn btn-primary" id="save-group-btn">Save Group</button>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(modalElement);
      console.log('Modal ajouté au document');
      
      // Ajouter un gestionnaire d'événements pour enregistrer le groupe
      document.getElementById('save-group-btn').addEventListener('click', saveGroup);
      console.log('Gestionnaire d\'événement pour saveGroup ajouté');

      // Ajouter un gestionnaire pour la recherche de dispositifs
      const searchDeviceBtn = document.getElementById('search-device-btn');
      const deviceSearchInput = document.getElementById('device-search');
      
      if (searchDeviceBtn && deviceSearchInput) {
        // Add input event for real-time search
        deviceSearchInput.addEventListener('input', (e) => {
          const query = e.target.value;
          console.log('Real-time search input:', query);
          searchDevices(query);
        });
        
        // Keep the click handler for the search button
        searchDeviceBtn.addEventListener('click', () => {
          const query = deviceSearchInput.value;
          console.log('Search button clicked with query:', query);
          searchDevices(query);
        });
      }
    }
    
    // Mettre à jour les informations du modal
    document.getElementById('modal-location-name').textContent = location.name;
    document.getElementById('group-location-id').value = location.id;
    document.getElementById('group-name').value = ''; // Réinitialiser le nom du groupe
    
    // Charger les dispositifs disponibles
    loadAvailableDevices();
    
    // Vérifier si le bootstrap est disponible
    if (typeof bootstrap === 'undefined') {
      console.error('Bootstrap n\'est pas disponible. Vérifiez que le script bootstrap.bundle.min.js est bien chargé.');
      console.error('Type de bootstrap:', typeof bootstrap);
      alert('Une erreur est survenue. Bootstrap n\'est pas disponible. Veuillez vérifier la console pour plus de détails.');
      return;
    }
    
    try {
      // Afficher le modal
      console.log('Tentative d\'affichage du modal...');
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
      console.log('Modal affiché avec succès');
    } catch (error) {
      console.error('Erreur lors de l\'affichage du modal:', error);
      console.error('Stack trace:', error.stack);
      alert('Une erreur est survenue lors de l\'affichage du formulaire de création de groupe.');
    }
  }

  // Fonction pour charger les dispositifs disponibles
  async function loadAvailableDevices() {
    const devicesList = document.getElementById('available-devices-list');
    if (!devicesList) return;
    
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
      
      const devices = await response.json();
      console.log('Dispositifs récupérés:', devices);
      
      if (devices.length === 0) {
        devicesList.innerHTML = `
          <div class="d-flex justify-content-center align-items-center h-100">
            <div class="text-center text-muted">
              <i class="bi bi-exclamation-circle fs-2"></i>
              <p>No devices found</p>
            </div>
          </div>
        `;
        return;
      }
      
      // Afficher la liste des dispositifs
      devicesList.innerHTML = '';
      
      // Ajouter une ligne d'en-tête
      const headerElement = document.createElement('div');
      headerElement.className = 'device-header d-flex justify-content-between mb-2 border-bottom pb-2 fw-bold small';
      headerElement.innerHTML = `
        <span>Name</span>
        <span>IP / MSISDN</span>
      `;
      devicesList.appendChild(headerElement);
      
      // Regrouper les dispositifs par type
      const devicesByType = {};
      devices.forEach(device => {
        if (!devicesByType[device.type]) {
          devicesByType[device.type] = [];
        }
        devicesByType[device.type].push(device);
      });
      
      // Afficher les dispositifs par type
      for (const type in devicesByType) {
        // Ajouter un en-tête de section pour le type
        const typeHeaderElement = document.createElement('div');
        typeHeaderElement.className = 'type-header fw-bold mt-3 mb-2';
        typeHeaderElement.textContent = type;
        devicesList.appendChild(typeHeaderElement);
        
        // Ajouter les dispositifs de ce type
        devicesByType[type].forEach(device => {
          const deviceElement = document.createElement('div');
          deviceElement.className = 'form-check mb-2';
          
          // Déterminer la classe de couleur en fonction du statut
          let statusClass = '';
          if (device.status === 'active') {
            statusClass = 'text-success';
          } else if (device.status === 'inactive') {
            statusClass = 'text-danger';
          } else if (device.status === 'maintenance') {
            statusClass = 'text-warning';
          }
          
          deviceElement.innerHTML = `
            <div class="d-flex align-items-center w-100 border rounded p-2 ${device.status !== 'active' ? 'bg-light' : ''}">
              <input class="form-check-input device-checkbox me-2" type="checkbox" value="${device.id}" id="device-${device.id}">
              <label class="form-check-label d-flex justify-content-between w-100" for="device-${device.id}">
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
      console.error('Error loading devices:', error);
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

  // Fonction pour rechercher des dispositifs
  function searchDevices(query) {
    console.log('Searching devices with query:', query);
    const devicesList = document.getElementById('available-devices-list');
    const deviceElements = devicesList.querySelectorAll('.form-check');
    const typeHeaders = devicesList.querySelectorAll('.type-header');
    
    if (!query || !query.trim()) {
      // Si la recherche est vide, afficher tous les dispositifs et les en-têtes de type
      deviceElements.forEach(element => {
        element.style.display = '';
      });
      typeHeaders.forEach(header => {
        header.style.display = '';
      });
      return;
    }
    
    // Filtrer les dispositifs en fonction de la recherche
    query = query.toLowerCase().trim();
    
    // Cacher tous les en-têtes de type d'abord
    typeHeaders.forEach(header => {
      header.style.display = 'none';
    });
    
    let typesWithVisibleDevices = new Set();
    let visibleDevicesCount = 0;
    
    // Filtrer les dispositifs
    deviceElements.forEach(element => {
      const deviceContent = element.textContent.toLowerCase();
      const deviceLabel = element.querySelector('label');
      
      if (!deviceLabel) {
        element.style.display = 'none';
        return;
      }
      
      // Get all searchable text content
      const deviceName = (deviceLabel.querySelector('div > div:first-child')?.textContent || '').toLowerCase();
      const deviceIP = (deviceLabel.querySelector('.text-muted:first-child')?.textContent || '').toLowerCase();
      const deviceMSISDN = (deviceLabel.querySelector('.text-muted:last-child')?.textContent || '').toLowerCase();
      const deviceStatus = (deviceLabel.querySelector('.small:not(.text-muted)')?.textContent || '').toLowerCase();
      
      // Get device type from the closest previous type header
      let typeHeader = element.previousElementSibling;
      while (typeHeader && !typeHeader.classList.contains('type-header')) {
        typeHeader = typeHeader.previousElementSibling;
      }
      const deviceType = typeHeader ? typeHeader.textContent.toLowerCase() : '';
      
      // Check if any field matches the search query
      if (deviceName.includes(query) || 
          deviceIP.includes(query) || 
          deviceMSISDN.includes(query) ||
          deviceStatus.includes(query) || 
          deviceType.includes(query)) {
        element.style.display = '';
        visibleDevicesCount++;
        
        if (typeHeader) {
          typesWithVisibleDevices.add(typeHeader.textContent);
        }
      } else {
        element.style.display = 'none';
      }
    });
    
    // Show type headers that have visible devices
    typeHeaders.forEach(header => {
      if (typesWithVisibleDevices.has(header.textContent)) {
        header.style.display = '';
      }
    });
    
    // Show a message if no devices were found
    const noResultsMessage = devicesList.querySelector('.no-results-message');
    if (visibleDevicesCount === 0) {
      if (!noResultsMessage) {
        const messageElement = document.createElement('div');
        messageElement.className = 'no-results-message text-center text-muted my-3';
        messageElement.innerHTML = `
          <i class="bi bi-search"></i>
          <p>No devices found matching "${query}"</p>
        `;
        devicesList.appendChild(messageElement);
      }
    } else if (noResultsMessage) {
      noResultsMessage.remove();
    }
  }
  
  // Fonction pour enregistrer un nouveau groupe
  function saveGroup() {
    console.log('Fonction saveGroup appelée');
    
    const locationId = parseInt(document.getElementById('group-location-id').value);
    const groupName = document.getElementById('group-name').value.trim();
    const connectivityProfile = document.querySelector('input[name="connectivity-profile"]:checked').value;
    
    // Récupérer les dispositifs sélectionnés
    const selectedDevices = [];
    document.querySelectorAll('.device-checkbox:checked').forEach(checkbox => {
      selectedDevices.push(parseInt(checkbox.value));
    });
    
    console.log('Données du groupe extraites:', { locationId, groupName, connectivityProfile, selectedDevices });
    
    if (!groupName) {
      console.error('Nom de groupe manquant');
      alert('Please enter a group name');
      return;
    }
    
    // Objet de données du groupe
    const groupData = {
      locationId,
      name: groupName,
      connectivityProfile,
      devices: selectedDevices
    };
    
    console.log('Création du groupe avec les données:', groupData);
    
    // Appel à l'API pour créer un groupe
    createGroup(groupData);
    
    try {
      // Fermer le modal
      console.log('Tentative de fermeture du modal...');
      const modalElement = document.getElementById('create-group-modal');
      const modal = bootstrap.Modal.getInstance(modalElement);
      if (modal) {
        modal.hide();
        console.log('Modal fermé avec succès');
      } else {
        console.error('Impossible de trouver l\'instance du modal');
      }
    } catch (error) {
      console.error('Erreur lors de la fermeture du modal:', error);
    }
  }

  // Fonction pour créer un groupe via l'API
  async function createGroup(groupData) {
    try {
      console.log('Envoi des données de groupe à l\'API:', groupData);
      console.log('URL de l\'endpoint:', '/api/groups');
      console.log('Méthode:', 'POST');
      console.log('Données JSON:', JSON.stringify(groupData, null, 2));
      
      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(groupData)
      });
      
      console.log('Réponse de l\'API - Status:', response.status);
      console.log('Réponse de l\'API - StatusText:', response.statusText);
      console.log('Réponse de l\'API - Headers:', Object.fromEntries([...response.headers]));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Texte d\'erreur complet:', errorText);
        try {
          // Essayer de parser le texte d'erreur comme JSON
          const errorData = JSON.parse(errorText);
          console.error('Erreur JSON parsée:', errorData);
        } catch (parseError) {
          console.error('Impossible de parser le texte d\'erreur comme JSON');
        }
        throw new Error(`Error creating the group: ${response.status} ${response.statusText}`);
      }
      
      const responseData = await response.json();
      console.log('Groupe créé avec succès:', responseData);
      
      // Afficher une notification de succès
      alert(`Group "${responseData.name}" created successfully with ${responseData.connectivityProfile} profile`);
      
      // Mettre à jour l'affichage des groupes (à implémenter plus tard)
      // fetchGroups(groupData.locationId);
      
    } catch (error) {
      console.error('Erreur détaillée lors de la création du groupe:', error);
      console.error('Stack trace:', error.stack);
      alert('Unable to create group. Please try again later.');
    }
  }
}); 