/**
 * Définition des routes de l'API d'authentification.
 * Point d'accès : /api/auth
 */

const express = require('express');
const {
  register,
  login,
  getMe,
  refreshToken
} = require('../controllers/authController');
const { protect } = require('../middlewares/auth');

const router = express.Router();

// Routes publiques
router.post('/register', register);
router.post('/login', login);
router.post('/refresh-token', refreshToken);

// Routes protégées par authentification JWT
router.get('/me', protect, getMe);

module.exports = router;
