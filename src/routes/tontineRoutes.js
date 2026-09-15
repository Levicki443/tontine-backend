/**
 * ROUTES TONTINES (tontineRoutes.js)
 */

const express = require('express');
const {
  createTontine,
  getAllTontines,
  getMyTontines,
  getTontineById,
  joinTontine,
  assignTreasurer,
  getFinancialSummary
} = require('../controllers/tontineController');
const { protect } = require('../middlewares/auth');

const router = express.Router();

router.use(protect);

router.post('/', createTontine);
router.get('/', getAllTontines);
router.get('/mes-tontines', getMyTontines);
router.get('/:id', getTontineById);
router.get('/:id/synthese-financiere', getFinancialSummary);
router.post('/:id/rejoindre', joinTontine);
router.patch('/:id/tresorier', assignTreasurer);

module.exports = router;
