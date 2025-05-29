# Orange API Quality on Demand (QoD) - Guide des commandes

Ce document détaille les commandes cURL nécessaires pour interagir avec l'API Quality on Demand d'Orange. Cette API permet de créer et gérer des sessions QoS (Quality of Service) pour optimiser la qualité de connexion pour des applications spécifiques.

## Obtenir un token d'authentification

```bash
curl -X POST \
-H "Authorization: Basic ZjF5UWt1ZkxwY2dTQzBZWkhWOXRwTkJ4ZVNBakZOUGQ6VUpYbjV5Rk8zR1hyN01vY1o1elBsZnhaQzJKcElxZzNnMGZJbGdPUGIxZzk=" \
-H "Content-Type: application/x-www-form-urlencoded" \
-H "Accept: application/json" \
-d "grant_type=client_credentials" \
https://api.orange.com/oauth/v3/token
```

Cette commande utilise l'authentification OAuth 2.0 pour obtenir un jeton d'accès. Le jeton retourné sera utilisé dans les appels API suivants.

## Créer une session QoS

```bash
curl -X POST "https://api.orange.com/camara/quality-on-demand/orange-lab/v0/sessions" \
-H "Authorization: Basic ZjF5UWt1ZkxwY2dTQzBZWkhWOXRwTkJ4ZVNBakZOUGQ6VUpYbjV5Rk8zR1hyN01vY1o1elBsZnhaQzJKcElxZzNnMGZJbGdPUGIxZzk=" \
-H "Cache-Control: no-cache" \
-H "accept: application/json" \
-H "Content-Type: application/json" \
-d '{
  "duration": 60,
  "device": {
    "ipv4Address": {
      "publicAddress": "172.20.120.107",
      "privateAddress": "172.20.120.107"
    }
  },
  "applicationServer": {
    "ipv4Address": "0.0.0.0"
  },
  "devicePorts": {
    "ports": [
      50984
    ]
  },
  "applicationServerPorts": {
    "ports": [
      10000
    ]
  },
  "qosProfile": "low",
  "webhook": {
    "notificationUrl": "https://webhook.site/669c8490-2f35-4561-8a3f-6c89618332ed"
  }
}'
```

Cette commande crée une session QoS avec les paramètres suivants:
- Durée: 60 secondes
- Adresse IP du dispositif: 172.20.120.107
- Ports utilisés par le dispositif: 50984
- Ports du serveur d'application: 10000
- Profil de QoS: "low"
- URL de notification webhook pour recevoir les mises à jour de statut

## Vérifier le statut d'une session

```bash
curl -X GET "https://api.orange.com/camara/quality-on-demand/orange-lab/v0/sessions/fdd6f490-3fb4-4559-90d7-a9df43ff5617" \
-H "Authorization: Bearer {your access token}" \
-H "accept: application/json"
```

Remplacez `{your access token}` par le jeton obtenu lors de la première étape. Cette commande permet de vérifier l'état d'une session QoS spécifique identifiée par son ID.

## Prolonger une session

```bash
curl -X POST "https://api.orange.com/camara/quality-on-demand/orange-lab/v0/sessions/2efd59b0-d9d8-4eff-84ce-6826b50d193a/extend" \
-H "Authorization: Bearer {your access token}" \
-H "Cache-Control: no-cache" \
-H "accept: application/json" \
-H "Content-Type: application/json" \
-d '{
    "requestedAdditionalDuration": 120
}'
```

Cette commande permet de prolonger une session QoS existante de 120 secondes supplémentaires.

## Supprimer une session

```bash
curl -X DELETE "https://api.orange.com/camara/quality-on-demand/orange-lab/v0/sessions/2efd59b0-d9d8-4eff-84ce-6826b50d193a" \
-H "Authorization: Bearer {your access token}" \
-H "accept: application/json"
```

Cette commande supprime une session QoS avant sa fin normale.

## Format de notification webhook

```bash
curl -X POST "https://{notificationUrl}/notifications" \
-H "Authorization: Bearer {notificationAuthToken}" \
-H "Cache-Control: no-cache" \
-H "accept: application/json" \
-H "Content-Type: application/json" \
-d '{
  "eventType": "QosStatusChangedEvent",
  "eventDetail": {
    "sessionId": "fdd6f490-3fb4-4559-90d7-a9df43ff561",
    "qosStatus": "AVAILABLE"
  }
}'
```

Ce format montre comment les notifications de changement de statut sont envoyées à l'URL webhook spécifiée lors de la création de la session. Les statuts possibles incluent "AVAILABLE" pour indiquer que la QoS demandée est active.

## Notes d'implémentation pour l'Adaptive QoS Assistant

Pour intégrer ces commandes dans l'Adaptive QoS Assistant:

1. Gérer les jetons d'accès avec mise en cache et actualisation automatique
2. Surveiller la durée des sessions et les prolonger automatiquement si nécessaire
3. Paramétrer dynamiquement les profils QoS en fonction des besoins des applications
4. Implémenter un gestionnaire de webhooks pour traiter les notifications de statut
5. Conserver un journal des sessions pour analyser les performances 