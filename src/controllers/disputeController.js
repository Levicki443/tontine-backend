/**
 * CONTRÔLEUR DE GESTION DES LITIGES (disputeController.js)
 * 
 * Permet l'ouverture, la consultation et l'arbitrage des litiges par l'admin ou le trésorier.
 */

const Dispute = require('../models/Dispute');
const Tontine = require('../models/Tontine');
const AuditLog = require('../models/AuditLog');
const { emitNotification } = require('./notificationController');
const { AppError } = require('../middlewares/errorHandler');

/**
 * Génère une référence unique pour un litige.
 */
const generateDisputeRef = () => {
  const timestamp = Date.now().toString().slice(-5);
  const randomStr = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `LIT-${timestamp}-${randomStr}`;
};

/**
 * Ouvre un nouveau litige.
 * @route POST /api/disputes
 */
const createDispute = async (req, res, next) => {
  try {
    const {
      tontineId,
      motif,
      titre,
      description,
      membreConcerne,
      paiementConcerne,
      preuveJustificatif
    } = req.body;

    if (!tontineId || !motif || !titre || !description) {
      return next(new AppError('La tontine, le motif, le titre et la description sont obligatoires.', 400));
    }

    const tontine = await Tontine.findById(tontineId);
    if (!tontine) {
      return next(new AppError('Tontine introuvable.', 404));
    }

    const isMember = tontine.membres.some((m) => m.user.toString() === req.user._id.toString());
    if (!isMember) {
      return next(new AppError('Vous devez faire partie de cette tontine pour y signaler un litige.', 403));
    }

    const referenceLitige = generateDisputeRef();

    const dispute = await Dispute.create({
      referenceLitige,
      tontine: tontineId,
      declarant: req.user._id,
      motif,
      titre: titre.trim(),
      description: description.trim(),
      membreConcerne: membreConcerne || null,
      paiementConcerne: paiementConcerne || null,
      preuveJustificatif: preuveJustificatif || ''
    });

    // Journalisation d'audit
    await AuditLog.logAction({
      action: 'LITIGE_OUVERT',
      auteur: req.user._id,
      entiteCible: 'Dispute',
      idEntiteCible: dispute._id,
      details: { referenceLitige, tontineId, motif }
    });

    // Notification à l'administrateur
    await emitNotification({
      destinataire: tontine.createur,
      type: 'litige_signale',
      titre: `Nouveau litige : ${titre}`,
      message: `Un membre a ouvert un litige (${referenceLitige}) pour la tontine "${tontine.titre}".`,
      tontine: tontine._id
    });

    res.status(201).json({
      success: true,
      message: 'Votre litige a été enregistré avec succès et sera examiné.',
      data: { dispute }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Récupère les litiges liés à une tontine.
 * @route GET /api/disputes/tontine/:tontineId
 */
const getTontineDisputes = async (req, res, next) => {
  try {
    const disputes = await Dispute.find({ tontine: req.params.tontineId })
      .populate('declarant', 'nom email telephone')
      .populate('membreConcerne', 'nom email telephone')
      .populate('arbitre', 'nom email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      resultats: disputes.length,
      data: { disputes }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Arbitre et résout un litige (Admin ou Trésorier).
 * @route PATCH /api/disputes/:id/arbitrer
 */
const resolveDispute = async (req, res, next) => {
  try {
    const { decisionResolution, statut } = req.body;

    if (!decisionResolution || !statut) {
      return next(new AppError('La décision de résolution et le nouveau statut sont obligatoires.', 400));
    }

    if (!['resolu', 'rejete', 'en_cours_d_examen'].includes(statut)) {
      return next(new AppError('Statut de litige invalide.', 400));
    }

    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) {
      return next(new AppError('Litige introuvable.', 404));
    }

    const tontine = await Tontine.findById(dispute.tontine);
    if (!tontine) {
      return next(new AppError('Tontine associée introuvable.', 404));
    }

    const isAdminOrTresorier =
      tontine.createur.toString() === req.user._id.toString() ||
      (tontine.tresorier && tontine.tresorier.toString() === req.user._id.toString()) ||
      req.user.role === 'administrateur';

    if (!isAdminOrTresorier) {
      return next(new AppError('Seul l\'administrateur ou le trésorier peut arbitrer ce litige.', 403));
    }

    dispute.statut = statut;
    dispute.decisionResolution = decisionResolution.trim();
    dispute.arbitre = req.user._id;
    if (statut === 'resolu' || statut === 'rejete') {
      dispute.dateResolution = new Date();
    }
    await dispute.save();

    // Audit log
    await AuditLog.logAction({
      action: 'LITIGE_RESOLU',
      auteur: req.user._id,
      entiteCible: 'Dispute',
      idEntiteCible: dispute._id,
      details: { referenceLitige: dispute.referenceLitige, statut, decisionResolution }
    });

    // Notification au déclarant
    await emitNotification({
      destinataire: dispute.declarant,
      type: 'litige_resolu',
      titre: `Mise à jour de votre litige (${dispute.referenceLitige})`,
      message: `Votre litige a été statué comme "${statut}" : ${decisionResolution}`,
      tontine: dispute.tontine
    });

    res.status(200).json({
      success: true,
      message: 'Litige arbitré avec succès.',
      data: { dispute }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createDispute,
  getTontineDisputes,
  resolveDispute
};
