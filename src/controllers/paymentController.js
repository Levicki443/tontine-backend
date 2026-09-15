/**
 * CONTRÔLEUR DES PAIEMENTS & PREUVES DE VERSEMENT (paymentController.js)
 * 
 * Assure l'enregistrement des cotisations, l'upload de reçus, le calcul des pénalités
 * et la validation par les administrateurs et trésoriers.
 */

const Payment = require('../models/Payment');
const Tontine = require('../models/Tontine');
const AuditLog = require('../models/AuditLog');
const { emitNotification } = require('./notificationController');
const { AppError } = require('../middlewares/errorHandler');

/**
 * Génère une référence de transaction unique.
 */
const generateTransactionRef = () => {
  const timestamp = Date.now().toString().slice(-6);
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TON-${timestamp}-${randomStr}`;
};

/**
 * Enregistre une cotisation avec preuve de paiement éventuelle.
 * @route POST /api/payments
 */
const initiatePayment = async (req, res, next) => {
  try {
    const {
      tontineId,
      montant,
      numeroTour,
      moyenPaiement,
      operateurMobile,
      numeroTelephonePaiement,
      recuPreuvePaiement,
      typePreuve,
      note
    } = req.body;

    if (!tontineId || !montant) {
      return next(new AppError('L\'identifiant de la tontine et le montant sont obligatoires.', 400));
    }

    const tontine = await Tontine.findById(tontineId);
    if (!tontine) {
      return next(new AppError('Tontine introuvable.', 404));
    }

    const isMember = tontine.membres.some((m) => m.user.toString() === req.user._id.toString());
    if (!isMember) {
      return next(new AppError('Vous devez être membre de cette tontine pour cotiser.', 403));
    }

    // Calcul éventuel de pénalités de retard
    let montantPenalite = 0;
    let joursRetard = 0;

    if (tontine.penaliteRetardActif && tontine.calendrierTours && tontine.calendrierTours.length > 0) {
      const tourIndex = (Number(numeroTour) || tontine.tourActuel || 1) - 1;
      const echeance = tontine.calendrierTours[tourIndex];
      if (echeance && new Date() > new Date(echeance.dateEcheance)) {
        const diffDays = Math.ceil((new Date() - new Date(echeance.dateEcheance)) / (1000 * 60 * 60 * 24));
        if (diffDays > (tontine.delaiGraceJours || 0)) {
          joursRetard = diffDays;
          montantPenalite = diffDays * (tontine.montantPenaliteParJour || 500);
        }
      }
    }

    const referenceTransaction = generateTransactionRef();

    const payment = await Payment.create({
      referenceTransaction,
      tontine: tontineId,
      payeur: req.user._id,
      numeroTour: Number(numeroTour) || tontine.tourActuel || 1,
      montant: Number(montant),
      montantPenalite,
      joursRetard,
      moyenPaiement: moyenPaiement || 'mobile_money',
      operateurMobile: operateurMobile || 'MTN Mobile Money',
      numeroTelephonePaiement: numeroTelephonePaiement || req.user.telephone,
      recuPreuvePaiement: recuPreuvePaiement || '',
      typePreuve: typePreuve || 'capture_mobile_money',
      statut: 'valide',
      dateValidation: new Date(),
      note: note ? note.trim() : ''
    });

    // Journalisation de sécurité
    await AuditLog.logAction({
      action: 'PAIEMENT_COTISATION',
      auteur: req.user._id,
      entiteCible: 'Payment',
      idEntiteCible: payment._id,
      details: {
        referenceTransaction,
        montant: payment.montant,
        operateur: payment.operateurMobile,
        penalite: montantPenalite
      }
    });

    // Notification de confirmation au payeur
    await emitNotification({
      destinataire: req.user._id,
      type: 'validation_paiement',
      titre: 'Cotisation confirmée',
      message: `Votre cotisation de ${payment.montant.toLocaleString('fr-FR')} FCFA (${payment.operateurMobile}) a été enregistrée avec succès.`,
      tontine: tontineId,
      montantConcerne: payment.montant
    });

    res.status(201).json({
      success: true,
      message: 'Votre cotisation a été enregistrée avec succès.',
      data: { payment }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Valide manuellement un paiement / preuve par le Trésorier ou l'Admin.
 * @route PATCH /api/payments/:id/valider
 */
const validatePayment = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return next(new AppError('Paiement introuvable.', 404));

    payment.statut = 'valide';
    payment.validePar = req.user._id;
    payment.dateValidation = new Date();
    await payment.save();

    await AuditLog.logAction({
      action: 'PAIEMENT_VALIDE_MANUEL',
      auteur: req.user._id,
      entiteCible: 'Payment',
      idEntiteCible: payment._id
    });

    await emitNotification({
      destinataire: payment.payeur,
      type: 'validation_paiement',
      titre: 'Preuve de paiement validée',
      message: `Votre reçu pour la transaction ${payment.referenceTransaction} a été validé par le trésorier.`,
      tontine: payment.tontine
    });

    res.status(200).json({
      success: true,
      message: 'Transaction et reçu validés avec succès.',
      data: { payment }
    });
  } catch (error) {
    next(error);
  }
};

const getMyPayments = async (req, res, next) => {
  try {
    const payments = await Payment.find({ payeur: req.user._id })
      .populate('tontine', 'titre montantCotisation frequence')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      resultats: payments.length,
      data: { payments }
    });
  } catch (error) {
    next(error);
  }
};

const getTontinePayments = async (req, res, next) => {
  try {
    const payments = await Payment.find({ tontine: req.params.tontineId })
      .populate('payeur', 'nom email telephone')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      resultats: payments.length,
      data: { payments }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  initiatePayment,
  validatePayment,
  getMyPayments,
  getTontinePayments
};
