/**
 * Fichier JavaScript principal
 * Contient les fonctionnalités communes et l'initialisation de l'application
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('Application initialisée');
  
  // Vérification de la disponibilité de Bootstrap
  if (typeof bootstrap === 'undefined') {
    console.error('Bootstrap n\'est pas disponible! Vérifiez l\'inclusion du script bootstrap.bundle.min.js');
  } else {
    console.log('Bootstrap est disponible');
  }
  
  // Mobile Sidebar Toggle functionality
  const toggleSidebarBtn = document.getElementById('toggle-sidebar');
  const sidebar = document.querySelector('.sidebar');
  const mainContent = document.querySelector('.main-content');
  
  // Create overlay for mobile sidebar
  const overlay = document.createElement('div');
  overlay.className = 'mobile-nav-overlay';
  document.body.appendChild(overlay);
  
  if (toggleSidebarBtn && sidebar) {
    toggleSidebarBtn.addEventListener('click', () => {
      sidebar.classList.toggle('show');
      overlay.classList.toggle('show');
    });
    
    // Close sidebar when clicking on overlay
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('show');
      overlay.classList.remove('show');
    });
    
    // Close sidebar when window is resized to larger breakpoint
    window.addEventListener('resize', () => {
      if (window.innerWidth >= 992) {
        sidebar.classList.remove('show');
        overlay.classList.remove('show');
      }
    });
  }
  
  // Gestionnaire d'événements pour les liens du menu
  const handleNavigation = () => {
    // Récupérer le hash de l'URL
    let hash = window.location.hash;
    if (!hash) {
      // Par défaut, afficher la page locations
      hash = '#locations';
      window.location.hash = hash;
    }
    
    // Trouver le lien correspondant et simuler un clic
    const navLink = document.querySelector(`.sidebar-menu .nav-link[href="${hash}"]`);
    if (navLink) {
      navLink.click();
    }
  };
  
  // Exécuter la navigation au chargement
  handleNavigation();
  
  // Écouter les changements d'URL
  window.addEventListener('hashchange', handleNavigation);
  
  // Close sidebar when clicking on sidebar links on mobile
  const sidebarLinks = document.querySelectorAll('.sidebar-menu .nav-link');
  sidebarLinks.forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth < 992) {
        sidebar.classList.remove('show');
        overlay.classList.remove('show');
      }
    });
  });
});

/**
 * Active l'élément de menu correspondant à la page actuelle
 */
function activateCurrentMenuItem() {
  // Obtenir l'URL actuelle
  const currentUrl = window.location.href;
  const hash = window.location.hash || '#locations'; // Par défaut, afficher la page des emplacements
  
  // Retirer la classe active de tous les éléments de menu
  document.querySelectorAll('.sidebar .nav-item').forEach(item => {
    item.classList.remove('active');
  });
  
  // Trouver l'élément de menu correspondant à la page actuelle et l'activer
  const activeMenuItem = document.querySelector(`.sidebar .nav-link[href="${hash}"]`);
  if (activeMenuItem) {
    activeMenuItem.closest('.nav-item').classList.add('active');
  }
  
  // Gérer les changements de hash
  window.addEventListener('hashchange', () => {
    const newHash = window.location.hash;
    
    // Retirer la classe active de tous les éléments de menu
    document.querySelectorAll('.sidebar .nav-item').forEach(item => {
      item.classList.remove('active');
    });
    
    // Activer le nouvel élément de menu
    const newActiveMenuItem = document.querySelector(`.sidebar .nav-link[href="${newHash}"]`);
    if (newActiveMenuItem) {
      newActiveMenuItem.closest('.nav-item').classList.add('active');
    }
    
    // Afficher le contenu correspondant (à implémenter pour les autres sections)
    showContentForHash(newHash);
  });
  
  // Afficher initialement le contenu correspondant au hash actuel
  showContentForHash(hash);
}

/**
 * Affiche le contenu correspondant au hash dans l'URL
 * @param {string} hash - Le hash de l'URL (#dashboard, #locations, etc.)
 */
function showContentForHash(hash) {
  console.log('Showing content for hash:', hash);
  
  // Masquer tous les conteneurs de contenu
  const contentContainers = document.querySelectorAll('.content-container');
  contentContainers.forEach(container => {
    container.style.display = 'none';
    console.log('Hidden container:', container.id);
  });
  
  // Hide floating action button by default
  const groupFab = document.getElementById('group-fab');
  if (groupFab) {
    groupFab.style.display = 'none';
  }
  
  // Mettre à jour le titre de la page
  const headerTitle = document.querySelector('.header h1');
  if (headerTitle) {
    headerTitle.textContent = hash.substring(1).charAt(0).toUpperCase() + hash.substring(2);
    console.log('Updated page title to:', headerTitle.textContent);
  }
  
  // Afficher le conteneur de contenu correspondant au hash
  switch (hash) {
    case '#locations':
      const locationsContainer = document.getElementById('locations-container');
      if (locationsContainer) {
        locationsContainer.style.display = 'block';
        console.log('Showing locations container');
        
        // Make sure dashboard content is explicitly hidden
        const dashboardContainer = document.getElementById('dashboard-container');
        if (dashboardContainer) {
          dashboardContainer.style.display = 'none';
          console.log('Hiding dashboard container when showing locations');
        }
        
        // Redimensionner la carte si nécessaire
        if (window.locationsMap) {
          setTimeout(() => window.locationsMap.invalidateSize(), 100);
        }
      }
      break;
    
    case '#groups':
      const groupsContainer = document.getElementById('groups-container');
      if (groupsContainer) {
        groupsContainer.style.display = 'block';
        console.log('Showing groups container');
        
        // Show the floating action button for groups
        if (groupFab) {
          groupFab.style.display = 'block';
          console.log('Made floating action button visible');
        }
        
        // Force the Add Group button to be visible and styled properly
        const addGroupBtn = document.getElementById('add-group-btn');
        if (addGroupBtn) {
          // Ensure it's fully visible and styled
          addGroupBtn.style.display = 'inline-flex';
          addGroupBtn.style.visibility = 'visible';
          addGroupBtn.style.opacity = '1';
          addGroupBtn.style.zIndex = '100';
          
          // Add a highlight animation to draw attention
          addGroupBtn.classList.add('btn-highlight');
          
          console.log('Made add-group-btn visible with styles:', {
            display: addGroupBtn.style.display,
            visibility: addGroupBtn.style.visibility,
            opacity: addGroupBtn.style.opacity,
            zIndex: addGroupBtn.style.zIndex
          });
          
          // Add a click event to ensure it's clickable
          const existingListener = addGroupBtn._hasClickListener;
          if (!existingListener) {
            addGroupBtn.addEventListener('click', () => {
              console.log('Add Group button clicked via main.js handler');
              // If showAddGroupModal is available from groups.js, call it
              if (typeof showAddGroupModal === 'function') {
                showAddGroupModal();
              } else {
                console.error('showAddGroupModal function not found');
              }
            });
            addGroupBtn._hasClickListener = true;
          }
        } else {
          console.error('add-group-btn not found');
        }
      } else {
        console.error('groups-container not found');
      }
      break;
    
    case '#devices':
      const devicesContainer = document.getElementById('devices-container');
      if (devicesContainer) {
        devicesContainer.style.display = 'block';
        console.log('Showing devices container');
      }
      break;
    
    case '#dashboard':
    case '#connections':
    case '#history':
    case '#support':
      // À implémenter pour les autres sections
      console.log('Section not yet implemented:', hash);
      break;
    
    case '#connections':
      // Hide all main content containers
      document.querySelectorAll('.content-container').forEach(el => el.style.display = 'none');
      const connectionsContainer = document.getElementById('connections-container');
      if (connectionsContainer) {
        connectionsContainer.style.display = 'block';
        console.log('Showing connections container');
        if (typeof window.renderConnections === 'function') {
          window.renderConnections();
        }
      }
      break;
    
    default:
      // Par défaut, afficher la page des emplacements
      const defaultContainer = document.getElementById('locations-container');
      if (defaultContainer) {
        defaultContainer.style.display = 'block';
        console.log('Showing default container (locations)');
      }
      break;
  }
}

/**
 * Initialise les tooltips Bootstrap
 */
function initializeTooltips() {
  // S'assurer que Bootstrap est chargé
  if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
      return new bootstrap.Tooltip(tooltipTriggerEl);
    });
  }
} 