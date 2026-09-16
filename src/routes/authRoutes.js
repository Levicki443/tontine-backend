/**
 * ROUTES D'AUTHENTIFICATION & PARAMÈTRES (authRoutes.js)
 */

const express = require('express');
const {
  register,
  login,
  verifyTwoFactorLogin,
  updateProfile,
  updatePassword,
  toggleTwoFactor,
  getMe,
  refreshToken
} = require('../controllers/authController');
const { protect } = require('../middlewares/auth');

const router = express.Router();

// Routes publiques
router.post('/register', register);
router.post('/login', login);
router.post('/verify-2fa', verifyTwoFactorLogin);
router.post('/refresh-token', refreshToken);

// Routes protégées
router.use(protect);
router.get('/me', getMe);
router.patch('/me', updateProfile);
router.patch('/me/mot-de-passe', updatePassword);
router.patch('/toggle-2fa', toggleTwoFactor);

module.exports = router;
