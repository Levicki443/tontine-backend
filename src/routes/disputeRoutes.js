/**
 * ROUTES LITIGES (disputeRoutes.js)
 */

const express = require('express');
const { protect } = require('../middlewares/auth');
const {
  createDispute,
  getTontineDisputes,
  resolveDispute
} = require('../controllers/disputeController');

const router = express.Router();

router.use(protect);

router.post('/', createDispute);
router.get('/tontine/:tontineId', getTontineDisputes);
router.patch('/:id/arbitrer', resolveDispute);

module.exports = router;
