/**
 * CONTRÔLEUR DU JOURNAL D'AUDIT (auditController.js)
 * 
 * Permet la consultation sécurisée des pistes d'audit pour les administrateurs
 * et membres autorisés pour garantir la transparence financière absolue.
 */

const AuditLog = require('../models/AuditLog');
const { AppError } = require('../middlewares/errorHandler');

/**
 * Récupère les entrées du journal d'audit.
 * @route GET /api/audit
 */
const getAuditLogs = async (req, res, next) => {
  try {
    const filter = {};

    // Si ce n'est pas un admin global, on limite aux actions de l'utilisateur ou liées
    if (req.user.role !== 'administrateur') {
      filter.$or = [
        { auteur: req.user._id },
        { idEntiteCible: req.user._id }
      ];
    }

    const logs = await AuditLog.find(filter)
      .populate('auteur', 'nom email role')
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json({
      success: true,
      resultats: logs.length,
      data: { logs }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtient un résumé statistique de l'intégrité et des opérations.
 * @route GET /api/audit/statistiques
 */
const getAuditStats = async (req, res, next) => {
  try {
    const totalOperations = await AuditLog.countDocuments();
    const succesCount = await AuditLog.countDocuments({ statutOperation: 'SUCCES' });
    const echecsCount = await AuditLog.countDocuments({ statutOperation: 'ECHEC' });

    res.status(200).json({
      success: true,
      data: {
        totalOperations,
        succesCount,
        echecsCount,
        tauxSucces: totalOperations > 0 ? ((succesCount / totalOperations) * 100).toFixed(1) : '100'
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAuditLogs,
  getAuditStats
};
