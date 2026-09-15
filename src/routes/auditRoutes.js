/**
 * ROUTES JOURNAL D'AUDIT (auditRoutes.js)
 */

const express = require('express');
const { protect } = require('../middlewares/auth');
const { getAuditLogs, getAuditStats } = require('../controllers/auditController');

const router = express.Router();

router.use(protect);

router.get('/', getAuditLogs);
router.get('/statistiques', getAuditStats);

module.exports = router;
