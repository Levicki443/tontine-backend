/**
 * Module utilitaire pour la gestion des jetons JSON Web Token (JWT).
 * Assure la signature et la vérification des jetons d'accès et de rafraîchissement.
 */

const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Génère un jeton d'accès JWT (Access Token).
 * @param {string} userId - Identifiant unique de l'utilisateur
 * @returns {string} Jeton JWT signé
 */
const generateAccessToken = (userId) => {
  return jwt.sign({ id: userId }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN
  });
};

/**
 * Génère un jeton de rafraîchissement JWT (Refresh Token).
 * @param {string} userId - Identifiant unique de l'utilisateur
 * @returns {string} Jeton de rafraîchissement signé
 */
const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN
  });
};

/**
 * Vérifie l'authenticité et la validité temporelle d'un jeton d'accès.
 * @param {string} token - Jeton JWT à vérifier
 * @returns {object} Données décodées du jeton
 */
const verifyAccessToken = (token) => {
  return jwt.verify(token, env.JWT_SECRET);
};

/**
 * Vérifie l'authenticité et la validité temporelle d'un jeton de rafraîchissement.
 * @param {string} token - Jeton JWT de rafraîchissement
 * @returns {object} Données décodées du jeton
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken
};
