/**
 * Adaptive QoS Assistant - Client API Orange QoD
 * Ce module permet d'interagir avec l'API Quality on Demand d'Orange
 * pour créer et gérer des sessions QoS adaptatives.
 */

const axios = require('axios');

class OrangeQoDClient {
  constructor(clientId, clientSecret) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.baseUrl = 'https://api.orange.com/camara/quality-on-demand/orange-lab/v0';
    this.tokenUrl = 'https://api.orange.com/oauth/v3/token';
    this.token = null;
    this.tokenExpiry = null;
    this.activeSessions = new Map(); // Stocke les sessions actives
  }

  /**
   * Obtient un token d'authentification
   * @returns {Promise<string>} Le token d'accès
   */
  async getToken() {
    // Vérifie si le token est toujours valide
    if (this.token && this.tokenExpiry && this.tokenExpiry > Date.now()) {
      return this.token;
    }

    try {
      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      const response = await axios({
        method: 'post',
        url: this.tokenUrl,
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        data: 'grant_type=client_credentials'
      });

      this.token = response.data.access_token;
      // Définit l'expiration du token avec une marge de sécurité de 60 secondes
      this.tokenExpiry = Date.now() + (response.data.expires_in - 60) * 1000;
      return this.token;
    } catch (error) {
      console.error('Erreur lors de l\'obtention du token:', error);
      throw error;
    }
  }

  /**
   * Crée une nouvelle session QoS
   * @param {Object} params Les paramètres de la session
   * @returns {Promise<Object>} Les détails de la session créée
   */
  async createSession(params) {
    const token = await this.getToken();
    
    const defaultParams = {
      duration: 60, // Durée par défaut: 60 secondes
      qosProfile: 'low', // Profil QoS par défaut: bas
      webhook: {
        notificationUrl: params.notificationUrl || 'https://webhook.site/669c8490-2f35-4561-8a3f-6c89618332ed'
      }
    };

    const sessionParams = { ...defaultParams, ...params };

    try {
      const response = await axios({
        method: 'post',
        url: `${this.baseUrl}/sessions`,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache',
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        data: sessionParams
      });

      const session = response.data;
      
      // Stocke la session avec sa durée pour la gestion automatique
      this.activeSessions.set(session.id, {
        ...session,
        createdAt: Date.now(),
        expiresAt: Date.now() + (sessionParams.duration * 1000)
      });
      
      // Configure le renouvellement automatique si spécifié
      if (params.autoRenew) {
        this._scheduleRenewal(session.id, sessionParams.duration);
      }
      
      return session;
    } catch (error) {
      console.error('Erreur lors de la création de la session:', error);
      throw error;
    }
  }

  /**
   * Planifie le renouvellement automatique d'une session
   * @param {string} sessionId ID de la session
   * @param {number} duration Durée actuelle en secondes
   * @private
   */
  _scheduleRenewal(sessionId, duration) {
    // Renouvelle 10 secondes avant l'expiration
    const renewalTime = (duration - 10) * 1000;
    setTimeout(async () => {
      try {
        // Vérifie si la session est toujours active
        if (this.activeSessions.has(sessionId)) {
          const session = this.activeSessions.get(sessionId);
          // Renouvelle seulement si pas encore expirée
          if (session.expiresAt > Date.now()) {
            await this.extendSession(sessionId, duration);
          }
        }
      } catch (error) {
        console.error(`Erreur lors du renouvellement automatique de la session ${sessionId}:`, error);
      }
    }, renewalTime);
  }

  /**
   * Prolonge une session existante
   * @param {string} sessionId ID de la session
   * @param {number} additionalDuration Durée supplémentaire en secondes
   * @returns {Promise<Object>} Résultat de l'extension
   */
  async extendSession(sessionId, additionalDuration = 120) {
    const token = await this.getToken();

    try {
      const response = await axios({
        method: 'post',
        url: `${this.baseUrl}/sessions/${sessionId}/extend`,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache',
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        data: {
          requestedAdditionalDuration: additionalDuration
        }
      });

      // Met à jour les informations de la session
      if (this.activeSessions.has(sessionId)) {
        const session = this.activeSessions.get(sessionId);
        session.expiresAt = Date.now() + (additionalDuration * 1000);
        this.activeSessions.set(sessionId, session);
        
        // Replanifie le renouvellement si nécessaire
        if (session.autoRenew) {
          this._scheduleRenewal(sessionId, additionalDuration);
        }
      }

      return response.data;
    } catch (error) {
      console.error(`Erreur lors de l'extension de la session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Vérifie le statut d'une session
   * @param {string} sessionId ID de la session
   * @returns {Promise<Object>} Statut de la session
   */
  async checkSessionStatus(sessionId) {
    const token = await this.getToken();

    try {
      const response = await axios({
        method: 'get',
        url: `${this.baseUrl}/sessions/${sessionId}`,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      console.error(`Erreur lors de la vérification du statut de la session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Supprime une session
   * @param {string} sessionId ID de la session
   * @returns {Promise<boolean>} Succès de la suppression
   */
  async deleteSession(sessionId) {
    const token = await this.getToken();

    try {
      await axios({
        method: 'delete',
        url: `${this.baseUrl}/sessions/${sessionId}`,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      // Supprime la session de la liste des sessions actives
      this.activeSessions.delete(sessionId);
      return true;
    } catch (error) {
      console.error(`Erreur lors de la suppression de la session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Crée une session adaptée à un type d'application spécifique
   * @param {string} appType Type d'application (streaming, gaming, voip)
   * @param {Object} deviceInfo Informations sur l'appareil
   * @returns {Promise<Object>} Session créée
   */
  async createAdaptiveSession(appType, deviceInfo) {
    // Configure les paramètres optimaux en fonction du type d'application
    let qosProfile, duration;
    
    switch (appType.toLowerCase()) {
      case 'streaming':
        qosProfile = 'medium';
        duration = 300; // 5 minutes pour le streaming
        break;
      case 'gaming':
        qosProfile = 'high';
        duration = 600; // 10 minutes pour le gaming
        break;
      case 'voip':
        qosProfile = 'low';
        duration = 180; // 3 minutes pour la VoIP
        break;
      default:
        qosProfile = 'low';
        duration = 60;
    }

    return this.createSession({
      duration,
      qosProfile,
      device: deviceInfo,
      autoRenew: true, // Active le renouvellement automatique
      // Autres paramètres spécifiques à l'application
    });
  }

  /**
   * Traite les notifications de webhook
   * @param {Object} notification Données de notification
   */
  processWebhookNotification(notification) {
    const { eventType, eventDetail } = notification;
    
    if (eventType === 'QosStatusChangedEvent') {
      const { sessionId, qosStatus } = eventDetail;
      
      console.log(`Session ${sessionId} a changé de statut: ${qosStatus}`);
      
      // Adapte le comportement en fonction du statut
      switch (qosStatus) {
        case 'AVAILABLE':
          // La QoS est disponible, informer l'application
          console.log(`QoS disponible pour la session ${sessionId}`);
          break;
        case 'UNAVAILABLE':
          // La QoS n'est plus disponible
          console.log(`QoS indisponible pour la session ${sessionId}`);
          break;
        case 'EXPIRED':
          // La session a expiré
          console.log(`Session ${sessionId} expirée`);
          this.activeSessions.delete(sessionId);
          break;
      }
    }
  }
}

// Exemple d'utilisation
async function example() {
  const client = new OrangeQoDClient(
    'f1yQkufLpcgSC0YZHV9tpNBxeSAjFNPd',
    'UJXn5yFO3GXr7MocZ5zPlMasIxaC2JpIqg3g0fIlgOPb1g9'
  );

  try {
    // Crée une session adaptée pour une application de streaming
    const session = await client.createAdaptiveSession('streaming', {
      ipv4Address: {
        publicAddress: '172.20.120.107',
        privateAddress: '172.20.120.107'
      }
    });
    
    console.log('Session créée:', session);
    
    // Vérification du statut après 30 secondes
    setTimeout(async () => {
      const status = await client.checkSessionStatus(session.id);
      console.log('Statut de la session:', status);
      
      // Suppression manuelle si nécessaire
      // await client.deleteSession(session.id);
    }, 30000);
  } catch (error) {
    console.error('Erreur dans l\'exemple:', error);
  }
}

module.exports = OrangeQoDClient; 