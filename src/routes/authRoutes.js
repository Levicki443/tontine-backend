/**
 * ROUTES D'AUTHENTIFICATION & SÉCURITÉ (authRoutes.js)
 */

const express = require('express');
const {
  register,
  login,
  verifyTwoFactorLogin,
  toggleTwoFactor,
  getMe,
  refreshToken
} = require('../controllers/authController');
const { protect } = require('../middlewares/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/verify-2fa', verifyTwoFactorLogin);
router.post('/refresh-token', refreshToken);

// Routes protégées
router.use(protect);
router.get('/me', getMe);
router.patch('/toggle-2fa', toggleTwoFactor);

module.exports = router;
