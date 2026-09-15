/**
 * UTILITAIRE DE CHIFFREMENT & SÉCURITÉ DES DONNÉES (crypto.js)
 * 
 * Assure le chiffrement AES-256-GCM des données sensibles,
 * le masquage des informations personnelles (PII) et la génération/validation 2FA.
 */

const crypto = require('crypto');
const env = require('../config/env');

// Clé maîtresse dérivée pour le chiffrement AES-256-GCM
const ENCRYPTION_KEY = crypto
  .createHash('sha256')
  .update(env.JWT_SECRET || 'tontine_secret_key_default_32bytes_min!')
  .digest();

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Chiffre une chaîne de caractères avec l'algorithme AES-256-GCM.
 * @param {string} text - Texte en clair à chiffrer
 * @returns {string} Chaîne hexadécimale sécurisée (IV:Tag:DonnéesChiffrées)
 */
const encryptData = (text) => {
  if (!text) return text;
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(String(text), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (err) {
    console.error('[Crypto] Erreur lors du chiffrement des données :', err);
    return text;
  }
};

/**
 * Déchiffre une chaîne hexadécimale produite par encryptData.
 * @param {string} cipherText - Texte chiffré au format (IV:Tag:DonnéesChiffrées)
 * @returns {string} Texte en clair déchiffré
 */
const decryptData = (cipherText) => {
  if (!cipherText || typeof cipherText !== 'string' || !cipherText.includes(':')) {
    return cipherText;
  }
  try {
    const parts = cipherText.split(':');
    if (parts.length !== 3) return cipherText;

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('[Crypto] Erreur lors du déchiffrement des données :', err);
    return cipherText;
  }
};

/**
 * Masque un numéro de téléphone pour l'affichage public ou partagé.
 * Exemple : "+22997123456" -> "+229 97 •••• 56"
 * @param {string} phone - Numéro de téléphone complet
 * @returns {string} Numéro partiellement masqué
 */
const maskPhoneNumber = (phone) => {
  if (!phone) return '';
  const clean = String(phone).trim();
  if (clean.length < 6) return '••••';
  const start = clean.slice(0, 4);
  const end = clean.slice(-2);
  return `${start} •••• ${end}`;
};

/**
 * Masque une adresse email pour protéger la vie privée des membres.
 * Exemple : "koffi.mensah@gmail.com" -> "k••••h@gmail.com"
 * @param {string} email - Adresse email complète
 * @returns {string} Email partiellement masqué
 */
const maskEmail = (email) => {
  if (!email || !email.includes('@')) return '••••';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `•@${domain}`;
  const first = local.charAt(0);
  const last = local.charAt(local.length - 1);
  return `${first}••••${last}@${domain}`;
};

/**
 * Génère un code OTP numérique sécurisé à 6 chiffres pour l'authentification 2FA.
 * @returns {{ code: string, secret: string, expiresAt: Date }}
 */
const generateTwoFactorOTP = () => {
  const code = crypto.randomInt(100000, 999999).toString();
  const secret = crypto.randomBytes(20).toString('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // Valide 10 minutes
  return { code, secret, expiresAt };
};

/**
 * Vérifie la correspondance d'un code OTP de sécurité.
 * @param {string} candidateCode - Code saisi par l'utilisateur
 * @param {string} storedCode - Code attendu en base
 * @param {Date} expiresAt - Date d'expiration
 * @returns {boolean}
 */
const verifyTwoFactorOTP = (candidateCode, storedCode, expiresAt) => {
  if (!candidateCode || !storedCode) return false;
  if (expiresAt && new Date() > new Date(expiresAt)) return false;
  return String(candidateCode).trim() === String(storedCode).trim();
};

module.exports = {
  encryptData,
  decryptData,
  maskPhoneNumber,
  maskEmail,
  generateTwoFactorOTP,
  verifyTwoFactorOTP
};
