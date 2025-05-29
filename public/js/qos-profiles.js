/**
 * QoS Profiles Management
 * Ce script gère l'affichage et la récupération des profils de qualité de service (QoS)
 * depuis l'API Orange
 */

document.addEventListener('DOMContentLoaded', () => {
  // Éléments du DOM
  const qosProfilesContainer = document.getElementById('qos-profiles-container');
  const qosProfilesGrid = document.getElementById('qos-profiles-grid');
  const refreshQosProfilesBtn = document.getElementById('refresh-qos-profiles-btn');
  const qosProfilesLoading = document.querySelector('.qos-profiles-loading');
  const qosProfilesError = document.getElementById('qos-profiles-error');
  
  // URL de l'API Orange pour les profils QoS
  const QOS_PROFILES_API_URL = 'https://api.orange.com/camara/quality-on-demand/orange-lab/v0/qos-profiles';
  
  // Listener pour le menu QoS Profiles
  const qosProfilesLink = document.querySelector('.nav-link[href="#qos-profiles"]');
  if (qosProfilesLink) {
    qosProfilesLink.addEventListener('click', () => {
      // Charger les profils QoS lors de la navigation vers cette page
      fetchQosProfiles();
    });
  }
  
  // Bouton de rafraîchissement
  if (refreshQosProfilesBtn) {
    refreshQosProfilesBtn.addEventListener('click', fetchQosProfiles);
  }
  
  /**
   * Récupère les profils QoS depuis l'API Orange
   */
  async function fetchQosProfiles() {
    try {
      // Vérifier si nous avons un token stocké dans la session
      const storedTokenData = sessionStorage.getItem('oauth_token');
      if (!storedTokenData) {
        showError('No authentication token found. Please use the "Get Token" button in the Dev Tools panel first.');
        return;
      }
      
      // Récupérer le token
      const tokenData = JSON.parse(storedTokenData);
      const accessToken = tokenData.access_token;
      
      // Afficher l'indicateur de chargement
      showLoading(true);
      hideError();
      
      // Appeler notre API backend qui fera l'appel à l'API Orange
      const response = await fetch('/api/qos-profiles', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        let errorMessage = '';
        let errorDetails = '';
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || `HTTP Error: ${response.status}`;
          errorDetails = errorData.description || errorData.rawOutput || '';
          
          // Gestion spécifique de l'erreur 404
          if (response.status === 404) {
            errorMessage = 'API endpoint not found: QoS Profiles';
            errorDetails = 'The Orange API endpoint for QoS profiles is not available. This may be because you need access to the Orange lab environment, or the API version may have changed.';
          }
        } catch (e) {
          errorMessage = `HTTP Error: ${response.status} ${response.statusText}`;
        }
        
        // Afficher l'erreur détaillée avec solution possible
        const fullErrorMessage = errorDetails 
          ? `${errorMessage}. ${errorDetails}`
          : errorMessage;
        
        throw new Error(fullErrorMessage);
      }
      
      const qosProfiles = await response.json();
      console.log('QoS Profiles received:', qosProfiles);
      window.qosProfilesCache = qosProfiles; // Store globally for use in other tabs
      
      // Afficher les profils
      renderQosProfiles(qosProfiles);
      
      // Masquer l'indicateur de chargement
      showLoading(false);
    } catch (error) {
      console.error('Error fetching QoS profiles:', error);
      showError(`Failed to fetch QoS profiles: ${error.message}`);
      showLoading(false);
      
      // Si l'appel API échoue, utiliser les données simulées comme fallback
      console.log('Falling back to mock data');
      const mockProfiles = await fetchMockQosProfiles();
      renderQosProfiles(mockProfiles);
    }
  }
  
  /**
   * Récupère des données simulées de profils QoS
   * Cette fonction est utilisée comme fallback si l'appel API réel échoue
   * @returns {Promise<Array>} - Une promesse résolvant vers un tableau de profils QoS
   */
  async function fetchMockQosProfiles() {
    // Simuler un délai réseau
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Données simulées basées sur la documentation de l'API
    return [
      {
        name: "STANDARD_QOS",
        description: "Standard Quality of Service for general use cases",
        status: "ACTIVE",
        targetMinUpstreamRate: {
          value: 5,
          unit: "Mbps"
        },
        maxUpstreamRate: {
          value: 10,
          unit: "Mbps"
        },
        maxDownstreamRate: {
          value: 20,
          unit: "Mbps"
        },
        maxUpstreamBurstRate: {
          value: 15,
          unit: "Mbps"
        },
        maxDownstreamBurstRate: {
          value: 30,
          unit: "Mbps"
        },
        minUpstreamPriority: 3,
        minDownstreamPriority: 3
      },
      {
        name: "PREMIUM_QOS",
        description: "Premium Quality of Service for real-time applications",
        status: "ACTIVE",
        targetMinUpstreamRate: {
          value: 10,
          unit: "Mbps"
        },
        maxUpstreamRate: {
          value: 25,
          unit: "Mbps"
        },
        maxDownstreamRate: {
          value: 50,
          unit: "Mbps"
        },
        maxUpstreamBurstRate: {
          value: 35,
          unit: "Mbps"
        },
        maxDownstreamBurstRate: {
          value: 70,
          unit: "Mbps"
        },
        minUpstreamPriority: 1,
        minDownstreamPriority: 1
      },
      {
        name: "GAMING_QOS",
        description: "Optimized for low latency gaming experience",
        status: "ACTIVE",
        targetMinUpstreamRate: {
          value: 8,
          unit: "Mbps"
        },
        maxUpstreamRate: {
          value: 15,
          unit: "Mbps"
        },
        maxDownstreamRate: {
          value: 30,
          unit: "Mbps"
        },
        maxUpstreamBurstRate: {
          value: 20,
          unit: "Mbps"
        },
        maxDownstreamBurstRate: {
          value: 40,
          unit: "Mbps"
        },
        minUpstreamPriority: 2,
        minDownstreamPriority: 2
      },
      {
        name: "LEGACY_BASIC_QOS",
        description: "Legacy basic QoS profile - no longer supported",
        status: "DEPRECATED",
        targetMinUpstreamRate: {
          value: 2,
          unit: "Mbps"
        },
        maxUpstreamRate: {
          value: 5,
          unit: "Mbps"
        },
        maxDownstreamRate: {
          value: 10,
          unit: "Mbps"
        },
        maxUpstreamBurstRate: {
          value: 8,
          unit: "Mbps"
        },
        maxDownstreamBurstRate: {
          value: 15,
          unit: "Mbps"
        },
        minUpstreamPriority: 4,
        minDownstreamPriority: 4
      },
      {
        name: "BUSINESS_QOS",
        description: "Business-grade QoS for enterprise applications",
        status: "ACTIVE",
        targetMinUpstreamRate: {
          value: 15,
          unit: "Mbps"
        },
        maxUpstreamRate: {
          value: 30,
          unit: "Mbps"
        },
        maxDownstreamRate: {
          value: 60,
          unit: "Mbps"
        },
        maxUpstreamBurstRate: {
          value: 40,
          unit: "Mbps"
        },
        maxDownstreamBurstRate: {
          value: 80,
          unit: "Mbps"
        },
        minUpstreamPriority: 1,
        minDownstreamPriority: 1
      }
    ];
  }
  
  /**
   * Gère l'affichage des profils QoS dans l'interface
   * @param {Array} profiles - Les profils QoS à afficher
   */
  function renderQosProfiles(profiles) {
    if (!qosProfilesGrid) return;
    
    // Vider la grille
    qosProfilesGrid.innerHTML = '';
    
    if (!profiles || profiles.length === 0) {
      qosProfilesGrid.innerHTML = `
        <div class="col-12 text-center py-5">
          <p class="text-muted">No QoS profiles found. Please try again later.</p>
        </div>
      `;
      return;
    }
    
    // Créer une carte pour chaque profil
    profiles.forEach(profile => {
      const statusClass = getStatusClass(profile.status);
      const name = profile.name || 'Unknown Profile';
      const description = profile.description || 'No description available';
      const status = profile.status || 'INACTIVE';
      const maxUpstreamRate = extractRateInfo(profile.maxUpstreamRate);
      const maxDownstreamRate = extractRateInfo(profile.maxDownstreamRate);
      const maxUpstreamBurstRate = extractRateInfo(profile.maxUpstreamBurstRate);
      const maxDownstreamBurstRate = extractRateInfo(profile.maxDownstreamBurstRate);
      
      // Find if this profile is mapped to any connectivity profile
      const mappedTo = Object.entries(mappingsCache).find(([_, qosProfile]) => qosProfile === name)?.[0] || '';
      
      const profileCard = document.createElement('div');
      profileCard.className = 'col-md-6 col-lg-4';
      profileCard.innerHTML = `
        <div class="card qos-profile-card">
          <div class="card-header">
            ${name}
            <span class="qos-profile-status ${statusClass.toLowerCase()}">${status}</span>
          </div>
          <div class="card-body">
            <div class="qos-profile-detail">
              <div class="qos-profile-detail-label">Description</div>
              <div class="qos-profile-detail-value">${description}</div>
            </div>
            <div class="qos-profile-detail">
              <div class="qos-profile-detail-label">Max Upstream Rate</div>
              <div class="qos-profile-detail-value">${maxUpstreamRate}</div>
            </div>
            <div class="qos-profile-detail">
              <div class="qos-profile-detail-label">Max Downstream Rate</div>
              <div class="qos-profile-detail-value">${maxDownstreamRate}</div>
            </div>
            <div class="qos-profile-detail">
              <div class="qos-profile-detail-label">Max Upstream Burst Rate</div>
              <div class="qos-profile-detail-value">${maxUpstreamBurstRate}</div>
            </div>
            <div class="qos-profile-detail">
              <div class="qos-profile-detail-label">Max Downstream Burst Rate</div>
              <div class="qos-profile-detail-value">${maxDownstreamBurstRate}</div>
            </div>
            <div class="mt-3">
              <label for="mapping-select-${name}" class="form-label">Map to Connectivity Profile</label>
              <select class="form-select mapping-select" id="mapping-select-${name}" data-profile-name="${name}">
                <option value="">Select...</option>
                ${CONNECTIVITY_PROFILES.map(opt => `<option value="${opt}" ${opt === mappedTo ? 'selected' : ''}>${opt}</option>`).join('')}
              </select>
              <button class="btn btn-sm btn-outline-success mt-2 map-profile-btn" data-profile-name="${name}">
                ${mappedTo ? 'Update Mapping' : 'Map to Profile'}
              </button>
            </div>
          </div>
        </div>
      `;
      qosProfilesGrid.appendChild(profileCard);
    });

    // Add event listeners for mapping buttons
    document.querySelectorAll('.map-profile-btn').forEach(btn => {
      btn.addEventListener('click', async e => {
        const profileName = e.currentTarget.dataset.profileName;
        const select = document.querySelector(`#mapping-select-${profileName}`);
        const selectedValue = select ? select.value : '';
        
        if (selectedValue) {
          btn.disabled = true;
          btn.textContent = 'Mapping...';
          try {
            await setMapping(selectedValue, profileName);
            // Update the button text
            btn.textContent = 'Update Mapping';
          } catch (error) {
            console.error('Error setting mapping:', error);
            showError('Failed to set mapping. Please try again.');
          } finally {
            btn.disabled = false;
          }
        } else {
          showError('Please select a connectivity profile to map.');
        }
      });
    });

    // Add event listeners for select changes
    document.querySelectorAll('.mapping-select').forEach(select => {
      select.addEventListener('change', e => {
        const profileName = e.target.dataset.profileName;
        const btn = document.querySelector(`.map-profile-btn[data-profile-name="${profileName}"]`);
        if (btn) {
          btn.textContent = e.target.value ? 'Update Mapping' : 'Map to Profile';
        }
      });
    });
  }
  
  /**
   * Extrait les informations de débit à partir d'un objet de taux qui peut avoir différents formats
   * @param {Object|null} rateObj - L'objet contenant les informations de débit
   * @returns {string} - Une chaîne formatée représentant le débit
   */
  function extractRateInfo(rateObj) {
    if (!rateObj) return 'N/A';
    
    // Format pour nos données simulées: { value: 10, unit: "Mbps" }
    if (rateObj.value !== undefined && rateObj.unit) {
      return `${rateObj.value} ${rateObj.unit}`;
    }
    
    // Format possible de l'API réelle où la valeur et l'unité pourraient être dans des propriétés différentes
    if (rateObj.rate !== undefined) {
      const unit = rateObj.unit || 'bps';
      return `${rateObj.rate} ${unit}`;
    }
    
    // Si c'est juste un nombre
    if (typeof rateObj === 'number') {
      return `${rateObj} bps`;
    }
    
    // Si c'est une chaîne
    if (typeof rateObj === 'string') {
      return rateObj;
    }
    
    // Format inconnu
    return JSON.stringify(rateObj);
  }
  
  /**
   * Affiche les détails d'un profil QoS dans un modal
   * @param {Object} profile - Le profil QoS à afficher en détail
   */
  function showProfileDetails(profile) {
    // Vérifier si un modal existe déjà, sinon le créer
    let modalElement = document.getElementById('qos-profile-modal');
    
    if (!modalElement) {
      modalElement = document.createElement('div');
      modalElement.id = 'qos-profile-modal';
      modalElement.className = 'modal fade';
      modalElement.setAttribute('tabindex', '-1');
      modalElement.setAttribute('aria-labelledby', 'qosProfileModalLabel');
      modalElement.setAttribute('aria-hidden', 'true');
      
      modalElement.innerHTML = `
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="qosProfileModalLabel">QoS Profile Details</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body" id="qos-profile-modal-body">
              <!-- Le contenu sera généré dynamiquement -->
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
    const modalBody = document.getElementById('qos-profile-modal-body');
    const statusClass = getStatusClass(profile.status);
    
    modalBody.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h4>${profile.name}</h4>
        <span class="qos-profile-status ${statusClass.toLowerCase()}">${profile.status}</span>
      </div>
      <p class="mb-4">${profile.description}</p>
      
      <h5 class="border-bottom pb-2 mb-3">Bandwidth Parameters</h5>
      <div class="row mb-4">
        <div class="col-md-6">
          <div class="card mb-3">
            <div class="card-header">Upstream</div>
            <div class="card-body">
              <ul class="list-group list-group-flush">
                <li class="list-group-item d-flex justify-content-between align-items-center">
                  Target Min Rate
                  <span>${profile.targetMinUpstreamRate.value} ${profile.targetMinUpstreamRate.unit}</span>
                </li>
                <li class="list-group-item d-flex justify-content-between align-items-center">
                  Max Rate
                  <span>${profile.maxUpstreamRate.value} ${profile.maxUpstreamRate.unit}</span>
                </li>
                <li class="list-group-item d-flex justify-content-between align-items-center">
                  Max Burst Rate
                  <span>${profile.maxUpstreamBurstRate.value} ${profile.maxUpstreamBurstRate.unit}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="card mb-3">
            <div class="card-header">Downstream</div>
            <div class="card-body">
              <ul class="list-group list-group-flush">
                <li class="list-group-item d-flex justify-content-between align-items-center">
                  Target Min Rate
                  <span>N/A</span>
                </li>
                <li class="list-group-item d-flex justify-content-between align-items-center">
                  Max Rate
                  <span>${profile.maxDownstreamRate.value} ${profile.maxDownstreamRate.unit}</span>
                </li>
                <li class="list-group-item d-flex justify-content-between align-items-center">
                  Max Burst Rate
                  <span>${profile.maxDownstreamBurstRate.value} ${profile.maxDownstreamBurstRate.unit}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      
      <h5 class="border-bottom pb-2 mb-3">Priority Settings</h5>
      <div class="row">
        <div class="col-md-6">
          <div class="card mb-3">
            <div class="card-body">
              <h6 class="card-title">Upstream Priority</h6>
              <p class="card-text">${getPriorityLabel(profile.minUpstreamPriority)}</p>
              <div class="progress">
                <div class="progress-bar progress-bar-striped" role="progressbar" 
                  style="width: ${getPriorityPercentage(profile.minUpstreamPriority)}%" 
                  aria-valuenow="${profile.minUpstreamPriority}" 
                  aria-valuemin="1" 
                  aria-valuemax="5">
                  ${profile.minUpstreamPriority}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="card mb-3">
            <div class="card-body">
              <h6 class="card-title">Downstream Priority</h6>
              <p class="card-text">${getPriorityLabel(profile.minDownstreamPriority)}</p>
              <div class="progress">
                <div class="progress-bar progress-bar-striped" role="progressbar" 
                  style="width: ${getPriorityPercentage(profile.minDownstreamPriority)}%" 
                  aria-valuenow="${profile.minDownstreamPriority}" 
                  aria-valuemin="1" 
                  aria-valuemax="5">
                  ${profile.minDownstreamPriority}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Afficher le modal
    const modal = new bootstrap.Modal(modalElement);
    modal.show();
  }
  
  /**
   * Obtient la classe CSS pour le statut d'un profil
   * @param {string} status - Le statut du profil
   * @returns {string} - La classe CSS correspondante
   */
  function getStatusClass(status) {
    switch (status) {
      case 'ACTIVE':
        return 'active';
      case 'INACTIVE':
        return 'inactive';
      case 'DEPRECATED':
        return 'deprecated';
      default:
        return 'inactive';
    }
  }
  
  /**
   * Convertit un niveau de priorité en libellé lisible
   * @param {number} priority - Le niveau de priorité (1-5)
   * @returns {string} - Le libellé de priorité
   */
  function getPriorityLabel(priority) {
    switch (priority) {
      case 1:
        return 'Highest Priority';
      case 2:
        return 'High Priority';
      case 3:
        return 'Medium Priority';
      case 4:
        return 'Low Priority';
      case 5:
        return 'Lowest Priority';
      default:
        return 'Unknown Priority';
    }
  }
  
  /**
   * Convertit un niveau de priorité en pourcentage pour la barre de progression
   * @param {number} priority - Le niveau de priorité (1-5)
   * @returns {number} - Le pourcentage (100% pour priorité 1, 20% pour priorité 5)
   */
  function getPriorityPercentage(priority) {
    // Inverser l'échelle car 1 est la plus haute priorité
    return (6 - priority) * 20;
  }
  
  /**
   * Affiche ou masque l'indicateur de chargement
   * @param {boolean} show - True pour afficher, false pour masquer
   */
  function showLoading(show) {
    if (qosProfilesLoading) {
      qosProfilesLoading.style.display = show ? 'block' : 'none';
    }
  }
  
  /**
   * Affiche un message d'erreur
   * @param {string} message - Le message d'erreur à afficher
   */
  function showError(message) {
    if (qosProfilesError) {
      qosProfilesError.textContent = message;
      qosProfilesError.style.display = 'block';
      
      // Ajouter une classe pour mettre en évidence l'erreur
      qosProfilesError.classList.add('error-shake');
      
      // Retirer la classe après l'animation
      setTimeout(() => {
        qosProfilesError.classList.remove('error-shake');
      }, 1000);
    }
  }
  
  /**
   * Masque le message d'erreur
   */
  function hideError() {
    if (qosProfilesError) {
      qosProfilesError.style.display = 'none';
    }
  }

  // --- Mapping logic (backend-persisted) ---
  const CONNECTIVITY_PROFILES = ['Safety', 'POS', 'XR', 'Broadcasting'];
  let mappingsCache = {};

  async function fetchMappings() {
    try {
      const res = await fetch('/api/qos-mappings');
      if (!res.ok) throw new Error('Failed to fetch mappings');
      mappingsCache = await res.json();
      console.log('[QoS] fetchMappings response:', mappingsCache);
    } catch (e) {
      console.error('[QoS] fetchMappings error:', e);
      mappingsCache = {};
    }
  }
  async function setMapping(profile, qosProfile) {
    console.log(`[QoS] setMapping: Sending mapping { profile: ${profile}, qosProfile: ${qosProfile} }`);
    const res = await fetch('/api/qos-mappings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, qosProfile })
    });
    const data = await res.json();
    console.log('[QoS] setMapping response:', data);
    await fetchMappings();
    renderMappingsUI();
  }
  async function removeMapping(profile) {
    await fetch(`/api/qos-mappings/${encodeURIComponent(profile)}`, { method: 'DELETE' });
    await fetchMappings();
    renderMappingsUI();
  }
  function getMappedQosProfile(connectivityProfile) {
    return mappingsCache[connectivityProfile] || null;
  }

  // --- Render mappings UI ---
  function renderMappingsUI() {
    let container = document.getElementById('qos-mappings-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'qos-mappings-container';
      container.className = 'mb-4';
      qosProfilesContainer.insertBefore(container, qosProfilesContainer.firstChild.nextSibling);
    }

    const mappings = mappingsCache;
    let html = `
      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <h5 class="mb-0">Current Connectivity Profile Mappings</h5>
          <button class="btn btn-sm btn-outline-primary" onclick="fetchMappings().then(renderMappingsUI)">
            <i class="bi bi-arrow-clockwise"></i> Refresh
          </button>
        </div>
        <div class="card-body">
          <ul class="list-group mb-2">
    `;

    CONNECTIVITY_PROFILES.forEach(profile => {
      const mapped = mappings[profile];
      html += `
        <li class="list-group-item d-flex justify-content-between align-items-center">
          <div>
            <strong>${profile}</strong>
            ${mapped 
              ? `<span class="ms-2 badge bg-primary">→ ${mapped}</span>`
              : '<span class="ms-2 text-muted">(not mapped)</span>'
            }
          </div>
          <div>
            ${mapped 
              ? `<button class="btn btn-sm btn-outline-danger remove-mapping-btn" data-profile="${profile}">
                  <i class="bi bi-trash"></i> Remove
                </button>`
              : ''
            }
          </div>
        </li>`;
    });

    html += `
          </ul>
          <div class="text-muted small">
            <i class="bi bi-info-circle"></i> 
            Mappings define which QoS profile is applied to each connectivity profile.
            Changes are applied immediately.
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;

    // Add remove handlers
    container.querySelectorAll('.remove-mapping-btn').forEach(btn => {
      btn.addEventListener('click', async e => {
        const profile = e.currentTarget.dataset.profile;
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Removing...';
        
        try {
          await removeMapping(profile);
          // Update the corresponding select in the profile cards
          const mappedQosProfile = mappingsCache[profile];
          if (mappedQosProfile) {
            const select = document.querySelector(`#mapping-select-${mappedQosProfile}`);
            if (select) {
              select.value = '';
              const updateBtn = document.querySelector(`.map-profile-btn[data-profile-name="${mappedQosProfile}"]`);
              if (updateBtn) {
                updateBtn.textContent = 'Map to Profile';
              }
            }
          }
        } catch (error) {
          console.error('Error removing mapping:', error);
          showError('Failed to remove mapping. Please try again.');
          btn.disabled = false;
          btn.innerHTML = '<i class="bi bi-trash"></i> Remove';
        }
      });
    });
  }

  // On load, fetch mappings and render
  fetchMappings().then(renderMappingsUI);

  // Expose getMappedQosProfile globally for use in other scripts
  window.getMappedQosProfile = getMappedQosProfile;
}); 