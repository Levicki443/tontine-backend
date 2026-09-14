/**
 * Contrôleur de gestion des Cotisations et Paiements.
 * Assure la création, validation et consultation de l'historique financier.
 */

const Payment = require('../models/Payment');
const Tontine = require('../models/Tontine');
const { AppError } = require('../middlewares/errorHandler');

/**
 * Génère une référence de transaction unique et sécurisée.
 */
const generateTransactionRef = () => {
  const timestamp = Date.now().toString().slice(-6);
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TON-${timestamp}-${randomStr}`;
};

/**
 * Enregistre un versement de cotisation pour une tontine.
 * @route POST /api/payments
 */
const initiatePayment = async (req, res, next) => {
  try {
    const {
      tontineId,
      montant,
      moyenPaiement,
      operateurMobile,
      numeroTelephonePaiement,
      note
    } = req.body;

    // 1. Validation de l'existence de la tontine
    if (!tontineId || !montant) {
      return next(new AppError('L\'identifiant de la tontine et le montant sont obligatoires.', 400));
    }

    const tontine = await Tontine.findById(tontineId);
    if (!tontine) {
      return next(new AppError('Tontine introuvable.', 404));
    }

    // 2. Vérification de l'appartenance à la tontine
    const isMember = tontine.membres.some(
      (m) => m.user.toString() === req.user._id.toString()
    );

    if (!isMember) {
      return next(new AppError('Vous devez être membre de cette tontine pour y cotiser.', 403));
    }

    // 3. Création de la transaction
    const referenceTransaction = generateTransactionRef();

    const payment = await Payment.create({
      referenceTransaction,
      tontine: tontineId,
      payeur: req.user._id,
      montant: Number(montant),
      moyenPaiement: moyenPaiement || 'mobile_money',
      operateurMobile: operateurMobile || 'MTN Mobile Money',
      numeroTelephonePaiement: numeroTelephonePaiement || req.user.telephone,
      statut: 'valide',
      dateValidation: new Date(),
      note: note ? note.trim() : ''
    });

    res.status(201).json({
      success: true,
      message: 'Votre cotisation a été enregistrée et validée avec succès.',
      data: { payment }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Valide ou confirme manuellement une transaction.
 * @route POST /api/payments/:id/valider
 */
const validatePayment = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return next(new AppError('Paiement introuvable.', 404));
    }

    payment.statut = 'valide';
    payment.dateValidation = new Date();
    await payment.save();

    res.status(200).json({
      success: true,
      message: 'Transaction validée avec succès.',
      data: { payment }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Récupère l'historique complet des paiements de l'utilisateur connecté.
 * @route GET /api/payments/mes-paiements
 */
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

/**
 * Récupère tous les paiements et le statut des cotisations d'une tontine donnée.
 * @route GET /api/payments/tontine/:tontineId
 */
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
