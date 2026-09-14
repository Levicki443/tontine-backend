/**
 * Routes de l'API pour la gestion des Tontines.
 * Point d'accès : /api/tontines
 */

const express = require('express');
const {
  createTontine,
  getAllTontines,
  getMyTontines,
  getTontineById,
  joinTontine
} = require('../controllers/tontineController');
const { protect } = require('../middlewares/auth');

const router = express.Router();

// Toutes les routes tontines sont protégées par authentification JWT
router.use(protect);

router.route('/')
  .post(createTontine)
  .get(getAllTontines);

router.get('/mes-tontines', getMyTontines);

router.route('/:id')
  .get(getTontineById);

router.post('/:id/rejoindre', joinTontine);

module.exports = router;
