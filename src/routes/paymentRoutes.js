/**
 * ROUTES PAIEMENTS (paymentRoutes.js)
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

router.use(protect);

router.post('/', initiatePayment);
router.patch('/:id/valider', validatePayment);
router.get('/mes-paiements', getMyPayments);
router.get('/tontine/:tontineId', getTontinePayments);

module.exports = router;
