/**
 * Routes de l'API pour les cotisations et transactions de paiement.
 * Point d'accès : /api/payments
 */

const express = require('express');
const {
  initiatePayment,
  validatePayment,
  getMyPayments,
  getTontinePayments
} = require('../controllers/paymentController');
const { protect } = require('../middlewares/auth');

const router = express.Router();

// Toutes les routes de paiement exigent une session utilisateur authentifiée
router.use(protect);

router.route('/')
  .post(initiatePayment);

router.get('/mes-paiements', getMyPayments);
router.get('/tontine/:tontineId', getTontinePayments);
router.post('/:id/valider', validatePayment);

module.exports = router;
