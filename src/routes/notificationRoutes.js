/**
 * ROUTES NOTIFICATIONS (notificationRoutes.js)
 */

const express = require('express');
const { protect } = require('../middlewares/auth');
const {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification
} = require('../controllers/notificationController');

const router = express.Router();

// Toutes les routes de notifications nécessitent une authentification
router.use(protect);

router.get('/', getMyNotifications);
router.patch('/tout-lire', markAllAsRead);
router.patch('/:id/lire', markAsRead);
router.delete('/:id', deleteNotification);

module.exports = router;
