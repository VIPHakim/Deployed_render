/**
 * QNow Platform - Application serveur
 * Cette application permet de gérer les API réseau et Quality on Demand (QoD)
 */

const express = require('express');
const bodyParser = require('body-parser');
const OrangeQoDClient = require('./adaptive_qos_client');
const app = express();
const port = process.env.PORT || 3000;
const fs = require('fs');
const { exec } = require('child_process');
const axios = require('axios');

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Middleware with detailed logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  
  // Log request body for POST/PUT requests
  if ((req.method === 'POST' || req.method === 'PUT') && req.body) {
    console.log('Request body:', JSON.stringify(req.body, null, 2));
  }
  
  // Intercept the response to log status code
  const originalSend = res.send;
  res.send = function(body) {
    console.log(`${new Date().toISOString()} - Response for ${req.method} ${req.url} - Status: ${res.statusCode}`);
    return originalSend.call(this, body);
  };
  
  next();
});

// Instanciation du client QoD
const qodClient = new OrangeQoDClient(
  process.env.ORANGE_CLIENT_ID || 'f1yQkufLpcgSC0YZHV9tpNBxeSAjFNPd',
  process.env.ORANGE_CLIENT_SECRET || 'UJXn5yFO3GXr7MocZ5zPlMasIxaC2JpIqg3g0fIlgOPb1g9'
);

// Stockage des sessions actives par utilisateur
const userSessions = new Map();

// Chemins des fichiers de données
const DATA_DIR = './data';
const LOCATIONS_FILE = `${DATA_DIR}/locations.json`;
const GROUPS_FILE = `${DATA_DIR}/groups.json`;
const DEVICES_FILE = `${DATA_DIR}/devices.json`;
const GROUP_DEVICES_FILE = `${DATA_DIR}/group_devices.json`;
const QOS_MAPPINGS_FILE = `${DATA_DIR}/qos_mappings.json`;

// Créer le répertoire de données s'il n'existe pas
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log(`Répertoire de données créé: ${DATA_DIR}`);
}

// Fonction pour sauvegarder les données dans un fichier
function saveDataToFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`Données sauvegardées dans ${filePath}`);
  } catch (error) {
    console.error(`Erreur lors de la sauvegarde des données dans ${filePath}:`, error);
  }
}

// Fonction pour charger les données depuis un fichier
function loadDataFromFile(filePath, defaultData = []) {
  try {
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      console.log(`Données chargées depuis ${filePath}: ${data.length} enregistrements`);
      return data;
    }
    console.log(`Fichier ${filePath} non trouvé, utilisation des données par défaut`);
    return defaultData;
  } catch (error) {
    console.error(`Erreur lors du chargement des données depuis ${filePath}:`, error);
    return defaultData;
  }
}

// Charger les données au démarrage
let locations = loadDataFromFile(LOCATIONS_FILE, [
  { id: 1, name: 'Parc des Princes', latitude: 48.84191232492012, longitude: 2.2555938711142582 },
  { id: 2, name: 'Marseille Stadium', latitude: 43.2698398353519, longitude: 5.396735832225621 }
]);
let groups = loadDataFromFile(GROUPS_FILE, []);
let devices = loadDataFromFile(DEVICES_FILE, [
  { 
    id: 1, 
    name: 'IP Camera 1', 
    type: 'Camera', 
    ipAddress: '192.168.1.101', 
    msisdn: '33612345001', 
    status: 'active',
    locationId: 1 
  },
  { 
    id: 2, 
    name: 'IP Camera 2', 
    type: 'Camera', 
    ipAddress: '192.168.1.102', 
    msisdn: '33612345002', 
    status: 'active',
    locationId: 1 
  },
  { 
    id: 3, 
    name: 'POS Terminal 1', 
    type: 'POS', 
    ipAddress: '192.168.1.201', 
    msisdn: '33612345003', 
    status: 'active',
    locationId: 1 
  },
  { 
    id: 4, 
    name: 'XR Headset', 
    type: 'XR', 
    ipAddress: '192.168.1.301', 
    msisdn: '33612345004', 
    status: 'inactive',
    locationId: 2 
  },
  { 
    id: 5, 
    name: 'Broadcasting Unit', 
    type: 'Broadcasting', 
    ipAddress: '192.168.1.401', 
    msisdn: '33612345005', 
    status: 'active',
    locationId: 2 
  },
  { 
    id: 6, 
    name: 'Safety Beacon 1', 
    type: 'Safety', 
    ipAddress: '192.168.1.501', 
    msisdn: '33612345006', 
    status: 'active',
    locationId: 1 
  },
  { 
    id: 7, 
    name: 'Safety Beacon 2', 
    type: 'Safety', 
    ipAddress: '192.168.1.502', 
    msisdn: '33612345007', 
    status: 'maintenance',
    locationId: 2 
  }
]);
let groupDeviceAssociations = loadDataFromFile(GROUP_DEVICES_FILE, []);

// Sauvegarder les données initiales si elles n'existent pas
if (!fs.existsSync(LOCATIONS_FILE)) {
  saveDataToFile(LOCATIONS_FILE, locations);
}
if (!fs.existsSync(GROUPS_FILE)) {
  saveDataToFile(GROUPS_FILE, groups);
}
if (!fs.existsSync(DEVICES_FILE)) {
  saveDataToFile(DEVICES_FILE, devices);
}
if (!fs.existsSync(GROUP_DEVICES_FILE)) {
  saveDataToFile(GROUP_DEVICES_FILE, groupDeviceAssociations);
}

// Helper functions to generate next ID
function getNextId(collection) {
  if (collection.length === 0) return 1;
  const maxId = Math.max(...collection.map(item => item.id));
  return maxId + 1;
}

// QoS Connectivity Profile Mappings (persisted)
function loadQosMappings() {
  try {
    if (fs.existsSync(QOS_MAPPINGS_FILE)) {
      return JSON.parse(fs.readFileSync(QOS_MAPPINGS_FILE, 'utf8'));
    }
    return {};
  } catch (e) {
    console.error('Erreur lors du chargement des mappings QoS:', e);
    return {};
  }
}
function saveQosMappings(mappings) {
  try {
    fs.writeFileSync(QOS_MAPPINGS_FILE, JSON.stringify(mappings, null, 2));
  } catch (e) {
    console.error('Erreur lors de la sauvegarde des mappings QoS:', e);
  }
}
let qosMappings = loadQosMappings();

// API Routes
// ===============================================

// Endpoint pour obtenir tous les emplacements
app.get('/api/locations', (req, res) => {
  res.json(locations);
});

// Endpoint pour obtenir un emplacement par ID
app.get('/api/locations/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const location = locations.find(loc => loc.id === id);
  
  if (!location) {
    return res.status(404).json({ error: 'Emplacement non trouvé' });
  }
  
  res.json(location);
});

// Endpoint pour créer un nouvel emplacement
app.post('/api/locations', (req, res) => {
  try {
    console.log('Requête reçue pour créer un emplacement. Corps de la requête:', req.body);
    
    const { name, latitude, longitude } = req.body;
    
    if (!name || !latitude || !longitude) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Generate next ID
    const id = getNextId(locations);
    
    // Create new location
    const newLocation = {
      id,
      name,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude)
    };
    
    console.log('Nouvel emplacement à ajouter:', newLocation);
    
    locations.push(newLocation);
    saveDataToFile(LOCATIONS_FILE, locations);
    
    console.log('Emplacement ajouté avec succès, liste mise à jour:', locations.length, 'emplacements');
    
    res.status(201).json(newLocation);
  } catch (error) {
    console.error('Erreur lors de l\'ajout de l\'emplacement:', error);
    res.status(500).json({ error: 'Erreur interne du serveur lors de l\'ajout de l\'emplacement' });
  }
});

// Endpoint pour mettre à jour un emplacement
app.put('/api/locations/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const { name, latitude, longitude } = req.body;
  
  const locationIndex = locations.findIndex(loc => loc.id === id);
  
  if (locationIndex === -1) {
    return res.status(404).json({ error: 'Emplacement non trouvé' });
  }
  
  const updatedLocation = {
    id,
    name: name || locations[locationIndex].name,
    latitude: latitude !== undefined ? parseFloat(latitude) : locations[locationIndex].latitude,
    longitude: longitude !== undefined ? parseFloat(longitude) : locations[locationIndex].longitude
  };
  
  locations[locationIndex] = updatedLocation;
  saveDataToFile(LOCATIONS_FILE, locations);
  
  res.json(updatedLocation);
});

// Endpoint pour supprimer un emplacement
app.delete('/api/locations/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const locationIndex = locations.findIndex(loc => loc.id === id);
  
  if (locationIndex === -1) {
    return res.status(404).json({ error: 'Emplacement non trouvé' });
  }
  
  locations.splice(locationIndex, 1);
  saveDataToFile(LOCATIONS_FILE, locations);
  
  res.status(204).send();
});

// Endpoint pour obtenir tous les groupes
app.get('/api/groups', (req, res) => {
  res.json(groups);
});

// Endpoint pour obtenir les groupes d'un emplacement spécifique
app.get('/api/locations/:locationId/groups', (req, res) => {
  const locationId = parseInt(req.params.locationId);
  const locationGroups = groups.filter(group => group.locationId === locationId);
  res.json(locationGroups);
});

// Endpoint pour obtenir tous les dispositifs
app.get('/api/devices', (req, res) => {
  console.log(`GET /api/devices - Current device count: ${devices.length}`);
  
  // Check if locationId filter is provided
  const locationId = req.query.locationId ? parseInt(req.query.locationId) : null;
  
  // Check if devices array is properly loaded
  if (!Array.isArray(devices)) {
    console.error('Devices is not an array:', devices);
    
    // Try to reload from file
    try {
      devices = loadDataFromFile(DEVICES_FILE, []);
      console.log(`Reloaded ${devices.length} devices from file`);
    } catch (err) {
      console.error('Failed to reload devices from file:', err);
    }
  }
  
  // Force reload if still empty
  if (!devices.length) {
    console.warn('Devices array is empty, trying to reload from file');
    devices = loadDataFromFile(DEVICES_FILE, [
      { 
        id: 1, 
        name: 'IP Camera 1', 
        type: 'Camera', 
        ipAddress: '192.168.1.101', 
        msisdn: '33612345001', 
        status: 'active',
        locationId: 1
      },
      { 
        id: 2, 
        name: 'IP Camera 2', 
        type: 'Camera', 
        ipAddress: '192.168.1.102', 
        msisdn: '33612345002', 
        status: 'active',
        locationId: 1
      }
    ]);
    
    // Save the data back to the file if we had to use the default data
    if (devices.length > 0) {
      console.log('Saving default devices to file');
      saveDataToFile(DEVICES_FILE, devices);
    }
  }
  
  // Filter devices by locationId if provided
  let filteredDevices = devices;
  if (locationId) {
    console.log(`Filtering devices by locationId: ${locationId}`);
    filteredDevices = devices.filter(device => device.locationId === locationId);
    console.log(`Found ${filteredDevices.length} devices for location ${locationId}`);
  }
  
  console.log(`Sending ${filteredDevices.length} devices to client`);
  res.json(filteredDevices);
});

// Endpoint pour obtenir les dispositifs d'un emplacement
app.get('/api/locations/:locationId/devices', (req, res) => {
  const locationId = parseInt(req.params.locationId);
  
  // Verify the location exists
  const location = locations.find(loc => loc.id === locationId);
  if (!location) {
    return res.status(404).json({ error: 'Location not found' });
  }
  
  // Filter devices by locationId
  const locationDevices = devices.filter(device => device.locationId === locationId);
  
  console.log(`Found ${locationDevices.length} devices for location ${locationId}`);
  res.json(locationDevices);
});

// Endpoint pour obtenir un dispositif par ID
app.get('/api/devices/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const device = devices.find(d => d.id === id);
  
  if (!device) {
    return res.status(404).json({ error: 'Dispositif non trouvé' });
  }
  
  res.json(device);
});

// Endpoint pour créer un nouveau dispositif
app.post('/api/devices', (req, res) => {
  console.log('Requête reçue pour créer un dispositif. Corps de la requête:', req.body);
  
  try {
    const { name, type, ipAddress, msisdn, status, locationId } = req.body;
    
    if (!name || !type || !locationId) {
      console.error('Données incomplètes:', { name, type, locationId });
      return res.status(400).json({ error: 'Le nom, le type et l\'emplacement sont requis' });
    }
    
    // Verify the location exists
    const parsedLocationId = parseInt(locationId);
    const location = locations.find(loc => loc.id === parsedLocationId);
    if (!location) {
      console.error('Emplacement non trouvé pour l\'ID:', parsedLocationId);
      return res.status(404).json({ error: 'Location not found' });
    }
    
    // Generate next ID
    const id = getNextId(devices);
    
    // Create new device
    const newDevice = {
      id,
      name,
      type,
      ipAddress: ipAddress || '',
      msisdn: msisdn || '',
      status: status || 'inactive',
      locationId: parsedLocationId,
      createdAt: new Date().toISOString()
    };
    
    console.log('Nouveau dispositif à ajouter:', newDevice);
    
    // Sauvegarder le nouveau dispositif
    try {
      devices.push(newDevice);
      saveDataToFile(DEVICES_FILE, devices);
      console.log('Dispositif ajouté avec succès, nombre total:', devices.length);
      
      return res.status(201).json(newDevice);
    } catch (saveError) {
      console.error('Erreur lors de l\'ajout du dispositif dans le tableau:', saveError);
      return res.status(500).json({ error: 'Erreur lors de l\'enregistrement du dispositif' });
    }
  } catch (error) {
    console.error('Erreur détaillée lors de la création du dispositif:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ error: 'Erreur interne du serveur lors de la création du dispositif' });
  }
});

// Endpoint pour importer des dispositifs
app.post('/api/devices/import', (req, res) => {
  console.log('Requête reçue pour importer des dispositifs. Corps de la requête:', req.body);
  
  try {
    const { csvContent } = req.body;
    
    if (!csvContent) {
      console.error('Contenu CSV manquant');
      return res.status(400).json({ error: 'CSV content is required' });
    }
    
    // Importer les dispositifs
    const importedDevices = importDevicesFromCSV(csvContent);
    
    if (importedDevices.length === 0) {
      console.error('Aucun dispositif valide trouvé dans le CSV');
      return res.status(400).json({ error: 'No valid devices found in CSV' });
    }
    
    // Ajouter les dispositifs importés
    devices.push(...importedDevices);
    saveDataToFile(DEVICES_FILE, devices);
    
    console.log(`${importedDevices.length} dispositifs importés avec succès`);
    
    res.status(201).json({ 
      message: `${importedDevices.length} devices imported successfully`,
      devices: importedDevices
    });
    
  } catch (error) {
    console.error('Erreur lors de l\'importation CSV:', error);
    res.status(500).json({ error: 'Error importing devices' });
  }
});

// Endpoint pour mettre à jour un dispositif
app.put('/api/devices/:id', (req, res) => {
  console.log('Requête reçue pour mettre à jour un dispositif. Corps de la requête:', req.body);
  
  try {
    const id = parseInt(req.params.id);
    const { name, type, ipAddress, msisdn, status, locationId } = req.body;
    
    // Vérifier que le dispositif existe
    const deviceIndex = devices.findIndex(d => d.id === id);
    
    if (deviceIndex === -1) {
      console.error('Dispositif non trouvé pour l\'ID:', id);
      return res.status(404).json({ error: 'Dispositif non trouvé' });
    }
    
    if (!name || !type || !locationId) {
      console.error('Données incomplètes:', { name, type, locationId });
      return res.status(400).json({ error: 'Le nom, le type et l\'emplacement du dispositif sont requis' });
    }
    
    // Verify the location exists
    const parsedLocationId = parseInt(locationId);
    const location = locations.find(loc => loc.id === parsedLocationId);
    if (!location) {
      console.error('Emplacement non trouvé pour l\'ID:', parsedLocationId);
      return res.status(404).json({ error: 'Location not found' });
    }
    
    // Mettre à jour le dispositif
    const updatedDevice = {
      ...devices[deviceIndex],
      name,
      type,
      ipAddress: ipAddress || devices[deviceIndex].ipAddress,
      msisdn: msisdn || devices[deviceIndex].msisdn,
      status: status || devices[deviceIndex].status,
      locationId: parsedLocationId,
      updatedAt: new Date().toISOString()
    };
    
    devices[deviceIndex] = updatedDevice;
    saveDataToFile(DEVICES_FILE, devices);
    
    console.log('Dispositif mis à jour:', updatedDevice);
    
    res.json(updatedDevice);
  } catch (error) {
    console.error('Erreur détaillée lors de la mise à jour du dispositif:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ error: 'Erreur interne du serveur lors de la mise à jour du dispositif' });
  }
});

// Endpoint pour supprimer un dispositif
app.delete('/api/devices/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    // Vérifier que le dispositif existe
    const deviceIndex = devices.findIndex(d => d.id === id);
    
    if (deviceIndex === -1) {
      return res.status(404).json({ error: 'Dispositif non trouvé' });
    }
    
    // Vérifier si le dispositif est utilisé dans des groupes
    const isUsedInGroups = groupDeviceAssociations.some(gd => gd.deviceId === id);
    
    if (isUsedInGroups) {
      // Supprimer également les associations dans les groupes
      console.log('Suppression des associations dans les groupes pour le dispositif:', id);
      groupDeviceAssociations = groupDeviceAssociations.filter(gd => gd.deviceId !== id);
    }
    
    // Supprimer le dispositif
    devices.splice(deviceIndex, 1);
    saveDataToFile(DEVICES_FILE, devices);
    
    console.log('Dispositif supprimé:', id);
    
    res.status(204).send();
  } catch (error) {
    console.error('Erreur détaillée lors de la suppression du dispositif:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ error: 'Erreur interne du serveur lors de la suppression du dispositif' });
  }
});

// Endpoint pour obtenir les dispositifs d'un groupe
app.get('/api/groups/:id/devices', (req, res) => {
  const groupId = parseInt(req.params.id);
  
  const group = groups.find(g => g.id === groupId);
  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }
  
  // Get the associated devices
  const associations = groupDeviceAssociations.filter(a => a.groupId === groupId);
  
  // Map to return either the device ID or the full association object
  const devicesList = associations.map(assoc => {
    return assoc.deviceId;
  });
  
  console.log(`Returning ${devicesList.length} devices for group ${groupId}`);
  res.json(devicesList);
});

// Endpoint pour mettre à jour un groupe
app.put('/api/groups/:id', (req, res) => {
  console.log('Requête reçue pour mettre à jour un groupe. Corps de la requête:', req.body);
  
  try {
    const id = parseInt(req.params.id);
    const { name, locationId, connectivityProfile, devices: deviceIds } = req.body;
    
    console.log('Données extraites:', { id, name, locationId, connectivityProfile, deviceIds });
    
    if (!name || !locationId || !connectivityProfile) {
      console.error('Données incomplètes:', { name, locationId, connectivityProfile });
      return res.status(400).json({ error: 'Informations de groupe incomplètes' });
    }
    
    // Vérifier que le groupe existe
    const groupIndex = groups.findIndex(g => g.id === id);
    
    if (groupIndex === -1) {
      console.error('Groupe non trouvé pour l\'ID:', id);
      return res.status(404).json({ error: 'Groupe non trouvé' });
    }
    
    // Vérifier que l'emplacement existe
    const locationIdInt = parseInt(locationId);
    const location = locations.find(loc => loc.id === locationIdInt);
    
    if (!location) {
      console.error('Emplacement non trouvé pour l\'ID:', locationIdInt);
      return res.status(404).json({ error: 'Emplacement non trouvé' });
    }
    
    // Mettre à jour le groupe en conservant createdAt
    const updatedGroup = {
      ...groups[groupIndex],
      name,
      locationId: locationIdInt,
      connectivityProfile,
      updatedAt: new Date().toISOString()
    };
    
    console.log('Groupe mis à jour:', updatedGroup);
    groups[groupIndex] = updatedGroup;
    saveDataToFile(GROUPS_FILE, groups);
    
    // Mettre à jour les associations groupe-dispositif si des dispositifs sont fournis
    if (Array.isArray(deviceIds)) {
      // Supprimer les anciennes associations
      groupDeviceAssociations = groupDeviceAssociations.filter(gd => gd.groupId !== id);
      
      // Ajouter les nouvelles associations
      deviceIds.forEach(deviceId => {
        // Vérifier que le dispositif existe
        const device = devices.find(d => d.id === deviceId);
        if (device) {
          groupDeviceAssociations.push({
            groupId: id,
            deviceId: deviceId,
            addedAt: new Date().toISOString()
          });
        }
      });
      
      console.log('Associations groupe-dispositif mises à jour pour le groupe', id);
    }
    
    saveDataToFile(GROUP_DEVICES_FILE, groupDeviceAssociations);
    
    res.json(updatedGroup);
  } catch (error) {
    console.error('Erreur détaillée lors de la mise à jour du groupe:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ error: 'Erreur interne du serveur lors de la mise à jour du groupe' });
  }
});

// Endpoint pour créer un nouveau groupe
app.post('/api/groups', (req, res) => {
  console.log('Requête reçue pour créer un groupe. Corps de la requête:', req.body);
  console.log('Headers de la requête:', req.headers);
  
  try {
    const { locationId, name, connectivityProfile, devices: devicesList } = req.body;
    
    if (!locationId || !name || !connectivityProfile) {
      console.error('Données incomplètes:', { locationId, name, connectivityProfile });
      return res.status(400).json({ error: 'Location ID, name and connectivity profile are required' });
    }
    
    // Parse location ID
    const parsedLocationId = parseInt(locationId);
    console.log('ID d\'emplacement parsé:', parsedLocationId);
    
    // Check if location exists
    const location = locations.find(l => l.id === parsedLocationId);
    if (!location) {
      console.error('Emplacement non trouvé:', parsedLocationId);
      return res.status(404).json({ error: 'Location not found' });
    }
    console.log('Emplacement trouvé:', location);
    
    // Generate next ID
    const id = getNextId(groups);
    console.log('Nouvel ID de groupe:', id);
    
    // Create new group
    const newGroup = {
      id,
      locationId: parsedLocationId,
      name,
      connectivityProfile,
      createdAt: new Date().toISOString()
    };
    
    console.log('Nouveau groupe à ajouter:', newGroup);
    
    groups.push(newGroup);
    saveDataToFile(GROUPS_FILE, groups);
    console.log('Groupe ajouté avec succès, nombre total de groupes:', groups.length);
    console.log('Liste des groupes mise à jour:', groups);
    
    // Ajouter les associations groupe-dispositif si des dispositifs sont fournis
    if (Array.isArray(devicesList) && devicesList.length > 0) {
      devicesList.forEach(deviceId => {
        // Vérifier que le dispositif existe
        const device = devices.find(d => d.id === deviceId);
        if (device) {
          groupDeviceAssociations.push({
            groupId: id,
            deviceId: deviceId,
            addedAt: new Date().toISOString()
          });
        }
      });
      
      console.log('Associations groupe-dispositif créées pour le nouveau groupe:', groupDeviceAssociations.filter(gd => gd.groupId === id));
    }
    
    saveDataToFile(GROUP_DEVICES_FILE, groupDeviceAssociations);
    
    res.status(201).json(newGroup);
  } catch (error) {
    console.error('Erreur détaillée lors de la création du groupe:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ error: 'Erreur interne du serveur lors de la création du groupe' });
  }
});

// Endpoint pour supprimer un groupe
app.delete('/api/groups/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const groupIndex = groups.findIndex(g => g.id === id);
  
  if (groupIndex === -1) {
    return res.status(404).json({ error: 'Groupe non trouvé' });
  }
  
  groups.splice(groupIndex, 1);
  saveDataToFile(GROUPS_FILE, groups);
  res.status(204).send();
});

// Endpoints QoS
// ===============================================

// Endpoint pour créer une session QoS
app.post('/api/qos/sessions', async (req, res) => {
  try {
    // Use token from Authorization header if present
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else {
      // Fallback: get a new token using OrangeQoDClient
      token = await qodClient.getToken();
    }

    // Forward the payload as-is to Orange API
    const response = await axios.post(
      'https://api.orange.com/camara/quality-on-demand/orange-lab/v0/sessions',
      req.body,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      }
    );

    // Return the Orange API response to the frontend
    res.status(response.status).json(response.data);
  } catch (error) {
    // Log and return error details
    console.error('Erreur lors de la création de la session QoS Orange:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || 'Erreur lors de la création de la session QoS Orange',
      details: error.response?.data || error.message
    });
  }
});

// Endpoint pour récupérer les sessions d'un utilisateur
app.get('/api/qos/sessions/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userSessions.has(userId)) {
      return res.status(404).json({ error: 'Aucune session trouvée pour cet utilisateur' });
    }
    
    // Récupère toutes les sessions de l'utilisateur
    const sessions = userSessions.get(userId);
    
    // Met à jour le statut de chaque session
    const updatedSessions = await Promise.all(
      sessions.map(async (session) => {
        try {
          const status = await qodClient.checkSessionStatus(session.id);
          return {
            sessionId: session.id,
            qosProfile: session.qosProfile,
            status: status.status || 'unknown',
            expiresAt: new Date(session.expiresAt).toISOString()
          };
        } catch (error) {
          // Si la session n'existe plus ou une erreur se produit
          return {
            sessionId: session.id,
            qosProfile: session.qosProfile,
            status: 'expired',
            expiresAt: new Date(session.expiresAt).toISOString()
          };
        }
      })
    );
    
    res.json(updatedSessions);
  } catch (error) {
    console.error('Erreur lors de la récupération des sessions:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des sessions' });
  }
});

// Endpoint pour étendre une session
app.post('/api/qos/sessions/:sessionId/extend', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // Log the entire request body to debug
    console.log('Extend session request body:', req.body);
    
    // Check for both possible parameter names
    const duration = req.body.duration || req.body.requestedAdditionalDuration;
    
    if (!duration) {
      return res.status(400).json({ error: 'Durée manquante / Duration parameter is required' });
    }
    
    // Parse to ensure it's a number
    const durationValue = parseInt(duration);
    if (isNaN(durationValue) || durationValue <= 0) {
      return res.status(400).json({ error: 'Duration must be a positive number' });
    }
    
    // Use token from Authorization header if present
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
      console.log('Using provided token for extension');
    } else {
      // Fallback: get a new token using OrangeQoDClient
      token = await qodClient.getToken();
      console.log('Using new token from OrangeQoDClient for extension');
    }
    
    console.log(`Extending session ${sessionId} with additional duration: ${durationValue} seconds`);
    
    // Use the client's extendSession method which already works correctly
    try {
      const result = await qodClient.extendSession(sessionId, durationValue);
      console.log('Extension successful:', result);
      return res.json(result);
    } catch (clientError) {
      console.error('Error from client extension method:', clientError);
      
      // Attempt direct API call as fallback
      try {
        const response = await axios.post(
          `https://api.orange.com/camara/quality-on-demand/orange-lab/v0/sessions/${sessionId}/extend`,
          { requestedAdditionalDuration: durationValue },
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache'
            }
          }
        );
        
        console.log(`Direct API session extension response:`, response.status, response.data);
        return res.status(response.status).json(response.data);
      } catch (apiError) {
        console.error('API ERROR DETAILS:', apiError.message);
        if (apiError.response) {
          console.error('API Response Status:', apiError.response.status);
          console.error('API Response Data:', apiError.response.data);
        }
        throw apiError;
      }
    }
  } catch (error) {
    console.error(`Erreur lors de l'extension de la session ${req.params.sessionId}:`, error.message);
    if (error.response) {
      console.error('Detailed error response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    }
    
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || 'Erreur lors de l\'extension de la session',
      details: error.response?.data,
      message: error.message
    });
  }
});

// Endpoint pour supprimer une session
app.delete('/api/qos/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { userId } = req.query;
    
    console.log(`Tentative de suppression de la session: ${sessionId}`);
    
    // Get token from authorization header or get a fresh one
    let token = null;
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
      console.log(`Utilisation du token fourni: ${token.substring(0, 15)}...`);
    } else {
      console.log('Aucun token fourni dans l\'en-tête, génération d\'un nouveau token...');
      token = await qodClient.getToken();
      console.log(`Nouveau token généré: ${token.substring(0, 15)}...`);
    }
    
    // Log the exact URL we're going to call - match Postman exactly
    const orangeApiUrl = `https://api.orange.com/camara/quality-on-demand/orange-lab/v0/sessions/${sessionId}`;
    console.log(`URL exacte de l'API Orange: ${orangeApiUrl}`);
    
    // Make direct request to Orange API with exactly the same headers as Postman
    try {
      // Try to match Postman's request exactly
      const response = await axios({
        method: 'DELETE', // Using DELETE in all caps to match Postman
        url: orangeApiUrl,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        },
        // Don't set 'Content-Type' header for DELETE requests unless sending body
        // Don't set any timeout to allow for longer processing time
        // Don't set 'transformResponse' to ensure raw response
        validateStatus: status => true // Accept any status code to handle manually
      });
      
      console.log(`Réponse de l'API Orange pour la suppression: Status=${response.status}`);
      console.log(`Headers de réponse:`, response.headers);
      
      if (response.data) {
        console.log(`Réponse data:`, response.data);
      }
      
      // Handle all success status codes (2xx)
      if (response.status >= 200 && response.status < 300) {
        console.log(`Suppression réussie (${response.status})`);
    
    // Supprime la session de la liste des sessions utilisateur
    if (userId && userSessions.has(userId)) {
      const sessions = userSessions.get(userId);
      const updatedSessions = sessions.filter(session => session.id !== sessionId);
      
      if (updatedSessions.length === 0) {
        userSessions.delete(userId);
      } else {
        userSessions.set(userId, updatedSessions);
      }
    }
        
        // Also remove from qodClient active sessions
        qodClient.activeSessions.delete(sessionId);
    
    res.status(204).send();
      } 
      // Handle 404 as success - session already gone
      else if (response.status === 404) {
        console.log(`Session ${sessionId} non trouvée sur l'API Orange (404), considérée comme déjà supprimée`);
        
        // Clean up local references anyway
        if (userId && userSessions.has(userId)) {
          const sessions = userSessions.get(userId);
          const updatedSessions = sessions.filter(session => session.id !== sessionId);
          userSessions.set(userId, updatedSessions);
        }
        qodClient.activeSessions.delete(sessionId);
        
        return res.status(204).send();
      }
      // Handle other status codes as errors
      else {
        console.error(`Erreur lors de la suppression - statut HTTP non prévu: ${response.status}`);
        return res.status(response.status).json({
          error: 'Erreur lors de la suppression de la session via l\'API Orange',
          details: response.data,
          statusCode: response.status,
          sessionId: sessionId,
          url: orangeApiUrl
        });
      }
    } catch (apiError) {
      console.error('Erreur API Orange lors de la suppression:', apiError);
      
      // Log the entire error object for detailed debugging
      console.error('Détails complets de l\'erreur:');
      
      // Specific error response details 
      if (apiError.response) {
        console.error(`Status: ${apiError.response.status}`);
        console.error(`Status Text: ${apiError.response.statusText}`);
        console.error('Headers:', apiError.response.headers);
        console.error('Data:', apiError.response.data);
      } else {
        console.error('Erreur sans réponse HTTP:', apiError.message);
        console.error('Stack trace:', apiError.stack);
      }
      
      // For other API errors, return the error details
      return res.status(apiError.response?.status || 500).json({
        error: 'Erreur lors de la suppression de la session via l\'API Orange',
        details: apiError.response?.data || apiError.message,
        statusCode: apiError.response?.status,
        sessionId: sessionId,
        url: orangeApiUrl
      });
    }
  } catch (error) {
    console.error(`Erreur générale lors de la suppression de la session ${req.params.sessionId}:`, error);
    res.status(500).json({ 
      error: 'Erreur lors de la suppression de la session',
      message: error.message,
      sessionId: req.params.sessionId
    });
  }
});

// Endpoint pour vérifier le statut d'une session
app.get('/api/qos/sessions/:sessionId/status', async (req, res) => {
  try {
    const { sessionId } = req.params;
    console.log(`Vérification du statut de la session: ${sessionId}`);
    
    // Use token from Authorization header if present
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
      console.log(`Utilisation du token fourni: ${token.substring(0, 15)}...`);
    } else {
      // Fallback: get a new token using OrangeQoDClient
      token = await qodClient.getToken();
      console.log(`Nouveau token généré: ${token.substring(0, 15)}...`);
    }
    
    // Direct call to Orange API to get session status
    const orangeApiUrl = `https://api.orange.com/camara/quality-on-demand/orange-lab/v0/sessions/${sessionId}`;
    console.log(`Appel à l'API Orange: ${orangeApiUrl}`);
    
    try {
      const response = await axios({
        method: 'GET',
        url: orangeApiUrl,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        },
        validateStatus: status => true // Accept any status code to handle manually
      });
      
      console.log(`Réponse de statut - Code: ${response.status}`);
      
      // If the session doesn't exist (404), it's definitely not active
      if (response.status === 404) {
        console.log(`La session ${sessionId} n'existe pas sur l'API Orange`);
        return res.json({
          sessionId: sessionId,
          qosStatus: 'DELETED',
          active: false,
          message: 'Session not found on Orange API'
        });
      }
      
      // For successful responses, interpret the status
      if (response.status >= 200 && response.status < 300) {
        const sessionData = response.data;
        const qosStatus = sessionData.qosStatus || 'UNKNOWN';
        
        // Determine if the session is actually active based on its status
        const isActive = ['ACTIVE', 'AVAILABLE', 'REQUESTED'].includes(qosStatus);
        
        console.log(`Statut récupéré avec succès: ${qosStatus}, Active: ${isActive}`);
        
        return res.json({
          ...sessionData,
          active: isActive
        });
      }
      
      // For other error codes
      console.error(`Erreur lors de la vérification du statut: ${response.status}`);
      res.status(response.status).json({
        error: `Error retrieving session status: ${response.status}`,
        qosStatus: 'ERROR',
        active: false,
        details: response.data
      });
      
    } catch (apiError) {
      console.error(`Erreur lors de la vérification du statut de la session ${sessionId}:`, apiError);
      
      // Handle network errors or other exceptions
      res.status(500).json({
        error: 'Erreur lors de la vérification du statut',
        qosStatus: 'ERROR',
        active: false,
        details: apiError.message
      });
    }
  } catch (error) {
    console.error(`Erreur générale lors de la vérification du statut de la session ${sessionId}:`, error);
    res.status(500).json({
      error: error.response?.data?.error || 'Erreur lors de la vérification du statut',
      qosStatus: 'ERROR',
      active: false,
      details: error.response?.data || error.message
    });
  }
});

// Endpoint pour recevoir les notifications webhook
app.post('/api/qos/webhook', (req, res) => {
  try {
    const notification = req.body;
    
    console.log('Notification reçue:', notification);
    
    // Traite la notification
    qodClient.processWebhookNotification(notification);
    
    // Répond avec succès
    res.status(200).send();
  } catch (error) {
    console.error('Erreur lors du traitement de la notification webhook:', error);
    res.status(500).json({ error: 'Erreur lors du traitement de la notification' });
  }
});

// Dev Tools Endpoints
// ===============================================

// Endpoint pour récupérer un token OAuth
app.get('/api/dev/get-token', async (req, res) => {
  try {
    console.log('Requête reçue pour récupérer un token OAuth');
    
    // Utiliser child_process pour exécuter la commande curl directement
    const curlCommand = `curl -X POST -H "Authorization: Basic ZjF5UWt1ZkxwY2dTQzBZWkhWOXRwTkJ4ZVNBakZOUGQ6VUpYbjV5Rk8zR1hyN01vY1o1elBsZnhaQzJKcElxZzNnMGZJbGdPUGIxZzk=" -H "Content-Type: application/x-www-form-urlencoded" -H "Accept: application/json" -d "grant_type=client_credentials" https://api.orange.com/oauth/v3/token`;
    
    console.log('Exécution de la commande curl:', curlCommand);
    
    exec(curlCommand, (error, stdout, stderr) => {
      if (error) {
        console.error('Erreur lors de l\'exécution de curl:', error);
        return res.status(500).json({
          error: 'Erreur lors de la récupération du token',
          details: error.message,
          stderr: stderr
        });
      }
      
      if (stderr) {
        console.warn('Stderr de curl:', stderr);
      }
      
      console.log('Résultat de curl:', stdout);
      
      try {
        // Essayer de parser la réponse JSON
        const tokenData = JSON.parse(stdout);
        console.log('Token récupéré avec succès');
        res.json(tokenData);
      } catch (parseError) {
        console.error('Erreur lors du parsing de la réponse curl:', parseError);
        res.status(500).json({
          error: 'Erreur lors du parsing de la réponse',
          details: parseError.message,
          rawOutput: stdout
        });
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du token OAuth:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération du token', 
      message: error.message
    });
  }
});

// Endpoint pour récupérer les profils QoS depuis l'API Orange
app.get('/api/qos-profiles', async (req, res) => {
  try {
    console.log('Requête reçue pour récupérer les profils QoS');
    
    // Récupérer le token d'authentification depuis l'en-tête
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Token d\'authentification manquant ou invalide',
        message: 'Veuillez fournir un token Bearer valide dans l\'en-tête Authorization'
      });
    }
    
    const token = authHeader.split(' ')[1];
    console.log('Token utilisé pour l\'appel API QoS profiles:', token.substring(0, 20) + '...');
    
    // Utiliser child_process pour exécuter la commande curl avec plus de détails et de verbosité
    const { exec } = require('child_process');
    
    // URL de l'API Orange QoS profiles
    const apiUrl = 'https://api.orange.com/camara/quality-on-demand/orange-lab/v0/qos-profiles';
    
    // Commande curl avec l'option -v pour plus de verbosité
    const curlCommand = `curl -v -X GET -H "Authorization: Bearer ${token}" -H "Accept: application/json" "${apiUrl}"`;
    
    console.log('Exécution de la commande curl pour les profils QoS:', curlCommand.replace(token, token.substring(0, 10) + '...'));
    
    exec(curlCommand, (error, stdout, stderr) => {
      // Journaliser tous les détails de la réponse pour le débogage
      console.log('Curl stderr (informations de connexion):', stderr);
      console.log('Curl stdout (corps de la réponse):', stdout);
      
      if (error) {
        console.error('Erreur lors de l\'exécution de curl pour les profils QoS:', error);
        return res.status(500).json({
          error: 'Erreur lors de la récupération des profils QoS',
          details: error.message,
          stderr: stderr
        });
      }
      
      try {
        // Tenter de parser la réponse JSON
        let profilesData;
        try {
          profilesData = JSON.parse(stdout);
        } catch (parseError) {
          console.error('Erreur de parsing JSON, vérification si la réponse contient des informations d\'erreur:', parseError);
          
          // Vérifier si la sortie contient des informations d'erreur
          if (stdout.includes('"error"') || stdout.includes('"error_description"')) {
            // Tenter d'extraire l'objet JSON d'erreur
            const errorMatch = stdout.match(/\{[\s\S]*"error"[\s\S]*\}/);
            if (errorMatch) {
              try {
                profilesData = JSON.parse(errorMatch[0]);
              } catch (e) {
                console.error('Impossible de parser l\'objet d\'erreur');
              }
            }
          }
          
          // Si on n'a pas pu extraire l'objet d'erreur
          if (!profilesData) {
            // Vérifier si la sortie contient des indications de problème d'authentification
            if (stderr.includes('401') || stdout.includes('unauthorized') || stderr.includes('invalid_token')) {
              return res.status(401).json({
                error: 'Unauthorized',
                message: 'Token invalide ou expiré',
                rawOutput: stdout,
                rawError: stderr
              });
            }
            
            // Si la réponse contient "404", c'est probablement un endpoint introuvable
            if (stderr.includes('404') || stdout.includes('Not Found')) {
              return res.status(404).json({
                error: 'Not Found',
                message: 'L\'endpoint QoS profiles n\'est pas disponible ou l\'URL est incorrecte',
                rawOutput: stdout,
                rawError: stderr
              });
            }
            
            return res.status(500).json({
              error: 'Erreur lors du parsing de la réponse pour les profils QoS',
              details: parseError.message,
              rawOutput: stdout,
              rawError: stderr
            });
          }
        }
        
        // Vérifier si la réponse contient un message d'erreur de l'API Orange
        if (profilesData.error || profilesData.error_description) {
          console.error('Erreur retournée par l\'API Orange:', profilesData);
          return res.status(400).json({
            error: profilesData.error || 'API Error',
            message: profilesData.error_description || 'Error from Orange API',
            apiResponse: profilesData
          });
        }
        
        console.log('Profils QoS récupérés avec succès:', profilesData.length || 'unknown number of');
        res.json(profilesData);
      } catch (finalError) {
        console.error('Erreur non gérée lors du traitement de la réponse:', finalError);
        res.status(500).json({ 
          error: 'Erreur lors du traitement de la réponse', 
          message: finalError.message,
          rawOutput: stdout,
          rawError: stderr
        });
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des profils QoS:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des profils QoS', 
      message: error.message
    });
  }
});

// GET all mappings
app.get('/api/qos-mappings', (req, res) => {
  qosMappings = loadQosMappings();
  res.json(qosMappings);
});
// POST create/update a mapping { profile, qosProfile }
app.post('/api/qos-mappings', (req, res) => {
  const { profile, qosProfile } = req.body;
  if (!profile || !qosProfile) {
    return res.status(400).json({ error: 'profile and qosProfile are required' });
  }
  qosMappings[profile] = qosProfile;
  saveQosMappings(qosMappings);
  res.json({ success: true, mappings: qosMappings });
});
// DELETE a mapping
app.delete('/api/qos-mappings/:profile', (req, res) => {
  const { profile } = req.params;
  if (qosMappings[profile]) {
    delete qosMappings[profile];
    saveQosMappings(qosMappings);
    return res.json({ success: true, mappings: qosMappings });
  }
  res.status(404).json({ error: 'Mapping not found' });
});

// Endpoint to get all active QoS sessions
app.get('/api/qos/sessions', (req, res) => {
  try {
    // Convert userSessions Map to an array of sessions
    const allSessions = [];
    
    userSessions.forEach((sessions, userId) => {
      sessions.forEach(session => {
        // Add user identifier to session data
        allSessions.push({
          ...session,
          userId
        });
      });
    });
    
    console.log(`Returning ${allSessions.length} active QoS sessions`);
    res.json(allSessions);
  } catch (error) {
    console.error('Error fetching QoS sessions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fonction pour importer des dispositifs à partir d'un CSV
function importDevicesFromCSV(csvContent) {
  const lines = csvContent.split('\n').filter(line => line.trim() !== '');
  
  // Skip header if it exists and detect if we have a header
  let hasHeader = false;
  const firstLine = lines[0].toLowerCase();
  if (firstLine.includes('name') || firstLine.includes('type') || firstLine.includes('ip')) {
    hasHeader = true;
    lines.shift(); // Remove header
  }
  
  // Get the next available ID
  let nextId = getNextId(devices);
  
  // Parse and validate each line
  const importedDevices = [];
  
  for (const line of lines) {
    const fields = line.split(',').map(field => field.trim());
    
    // Require at least name and type and locationId
    if (fields.length < 3) continue;
    
    // Default to first location if locationId is missing or invalid
    let locationId = parseInt(fields[5]);
    if (isNaN(locationId) || !locations.find(loc => loc.id === locationId)) {
      locationId = locations.length > 0 ? locations[0].id : 1;
    }
    
    const device = {
      id: nextId++,
      name: fields[0],
      type: fields[1],
      ipAddress: fields[2] || '',
      msisdn: fields[3] || '',
      status: ['active', 'inactive', 'maintenance'].includes(fields[4]) ? fields[4] : 'inactive',
      locationId: locationId,
      createdAt: new Date().toISOString()
    };
    
    importedDevices.push(device);
  }
  
  return importedDevices;
}

// Démarrage du serveur
app.listen(port, () => {
  console.log(`QNow Platform démarré sur le port ${port}`);
}); 