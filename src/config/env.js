/**
 * Module de configuration centralisée des variables d'environnement.
 * Valide et exporte les paramètres essentiels au bon fonctionnement de l'API.
 */

const dotenv = require('dotenv');
const path = require('path');

// Chargement du fichier .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const env = {
  // Environnement d'exécution
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),

  // Base de données MongoDB
  MONGO_URI: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/tontine_collaborative',

  // Sécurité et Authentification JWT
  JWT_SECRET: process.env.JWT_SECRET || 'dev_jwt_secret_cle_tres_securisee_tontine_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev_jwt_refresh_secret_cle_tres_securisee_2026',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '30d',

  // Limitation du débit (Rate Limiting)
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '150', 10),

  // Configuration CORS multi-origines
  ALLOW_ORIGINS: (process.env.ALLOW_ORIGINS || process.env.ALLOWED_ORIGINS || process.env.CLIENT_ORIGIN || '*')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || process.env.ALLOW_ORIGINS || '*'
};

// Vérification préventive en production
if (env.NODE_ENV === 'production') {
  if (env.JWT_SECRET.includes('dev_jwt_secret') || env.JWT_REFRESH_SECRET.includes('dev_jwt_refresh')) {
    console.warn('⚠️ AVERTISSEMENT SÉCURITÉ : Vous utilisez des clés secrètes JWT par défaut en production !');
  }
}

module.exports = env;
