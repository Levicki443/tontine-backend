/**
 * CONTRÔLEUR DE GESTION DES TONTINES & CYCLES (tontineController.js)
 * 
 * Permet la création, adhésion, désignation du trésorier, tirage au sort transparent
 * et calcul du tableau de bord de transparence financière.
 */

const Tontine = require('../models/Tontine');
const Payment = require('../models/Payment');
const AuditLog = require('../models/AuditLog');
const { emitNotification } = require('./notificationController');
const { AppError } = require('../middlewares/errorHandler');

/**
 * Calcule les dates d'échéances d'un calendrier selon la fréquence.
 */
const generateTourSchedule = (dateDebut, frequence, participantsCount, membres, montantCotisation) => {
  const schedule = [];
  const baseDate = new Date(dateDebut || Date.now());
  const intervalDays = frequence === 'hebdomadaire' ? 7 : frequence === 'bimensuelle' ? 14 : 30;

  for (let i = 0; i < participantsCount; i++) {
    const echeanceDate = new Date(baseDate.getTime() + i * intervalDays * 24 * 60 * 60 * 1000);
    const beneficiaire = membres[i] ? membres[i].user : null;
    schedule.push({
      numeroTour: i + 1,
      dateEcheance: echeanceDate,
      beneficiairePrevu: beneficiaire,
      montantCagnotte: montantCotisation * participantsCount,
      estTermine: false
    });
  }
  return schedule;
};

/**
 * Crée un nouveau groupe de tontine.
 * @route POST /api/tontines
 */
const createTontine = async (req, res, next) => {
  try {
    const {
      titre,
      description,
      montantCotisation,
      devise,
      frequence,
      nombreParticipantsMax,
      methodeTirage,
      penaliteRetardActif,
      montantPenaliteParJour,
      delaiGraceJours
    } = req.body;

    if (!titre || !montantCotisation || !nombreParticipantsMax || !frequence) {
      return next(new AppError('Veuillez renseigner tous les champs obligatoires.', 400));
    }

    const parsedMontant = Number(montantCotisation);
    const parsedParticipants = parseInt(nombreParticipantsMax, 10);

    const tontine = await Tontine.create({
      titre: titre.trim(),
      description: description ? description.trim() : '',
      montantCotisation: parsedMontant,
      devise: devise ? devise.trim().toUpperCase() : 'FCFA',
      frequence,
      nombreParticipantsMax: parsedParticipants,
      methodeTirage: methodeTirage || 'aleatoire',
      penaliteRetardActif: Boolean(penaliteRetardActif),
      montantPenaliteParJour: Number(montantPenaliteParJour) || 500,
      delaiGraceJours: Number(delaiGraceJours) || 2,
      createur: req.user._id,
      membres: [
        {
          user: req.user._id,
          roleDansGroupe: 'administrateur',
          dateAdhesion: new Date(),
          ordreTour: 1,
          aEteBeneficiaire: false
        }
      ]
    });

    await AuditLog.logAction({
      action: 'TONTINE_CREEE',
      auteur: req.user._id,
      entiteCible: 'Tontine',
      idEntiteCible: tontine._id,
      details: { titre: tontine.titre, montantCotisation: parsedMontant }
    });

    res.status(201).json({
      success: true,
      message: 'Votre tontine a été créée avec succès.',
      data: { tontine }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Rejoint une tontine et déclenche le cycle si le groupe est complet.
 * @route POST /api/tontines/:id/rejoindre
 */
const joinTontine = async (req, res, next) => {
  try {
    const tontine = await Tontine.findById(req.params.id);
    if (!tontine) return next(new AppError('Tontine introuvable.', 404));
    if (tontine.statut !== 'en_attente') return next(new AppError('Cette tontine n\'accepte plus d\'adhésions.', 400));

    const isMember = tontine.membres.some((m) => m.user.toString() === req.user._id.toString());
    if (isMember) return next(new AppError('Vous êtes déjà membre de cette tontine.', 409));

    const nouvelOrdre = tontine.membres.length + 1;
    tontine.membres.push({
      user: req.user._id,
      roleDansGroupe: 'membre',
      dateAdhesion: new Date(),
      ordreTour: nouvelOrdre,
      aEteBeneficiaire: false
    });

    // Si complet, démarrage du cycle et génération du calendrier
    if (tontine.membres.length === tontine.nombreParticipantsMax) {
      tontine.statut = 'en_cours';
      tontine.dateDebut = new Date();

      if (tontine.methodeTirage === 'aleatoire') {
        // Tirage au sort aléatoire équitable
        const shuffled = [...tontine.membres].sort(() => Math.random() - 0.5);
        shuffled.forEach((m, idx) => {
          m.ordreTour = idx + 1;
        });
        tontine.membres = shuffled;
      }

      tontine.calendrierTours = generateTourSchedule(
        tontine.dateDebut,
        tontine.frequence,
        tontine.nombreParticipantsMax,
        tontine.membres,
        tontine.montantCotisation
      );
    }

    await tontine.save();

    await emitNotification({
      destinataire: tontine.createur,
      type: 'nouveau_membre',
      titre: 'Nouvelle adhésion',
      message: `${req.user.nom} a rejoint la tontine "${tontine.titre}".`,
      tontine: tontine._id
    });

    res.status(200).json({
      success: true,
      message: 'Vous avez rejoint la tontine avec succès.',
      data: { tontine }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Désigne ou change le trésorier d'une tontine.
 * @route PATCH /api/tontines/:id/tresorier
 */
const assignTreasurer = async (req, res, next) => {
  try {
    const { tresorierUserId } = req.body;
    const tontine = await Tontine.findById(req.params.id);

    if (!tontine) return next(new AppError('Tontine introuvable.', 404));
    if (tontine.createur.toString() !== req.user._id.toString() && req.user.role !== 'administrateur') {
      return next(new AppError('Seul l\'administrateur du groupe peut nommer un trésorier.', 403));
    }

    tontine.tresorier = tresorierUserId;
    tontine.membres.forEach((m) => {
      if (m.user.toString() === tresorierUserId.toString()) {
        m.roleDansGroupe = 'tresorier';
      }
    });

    await tontine.save();

    await AuditLog.logAction({
      action: 'NOMINATION_TRESORIER',
      auteur: req.user._id,
      entiteCible: 'Tontine',
      idEntiteCible: tontine._id,
      details: { tresorierUserId }
    });

    res.status(200).json({
      success: true,
      message: 'Trésorier nommé avec succès.',
      data: { tontine }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtient la synthèse de transparence financière et les métriques d'une tontine.
 * @route GET /api/tontines/:id/synthese-financiere
 */
const getFinancialSummary = async (req, res, next) => {
  try {
    const tontine = await Tontine.findById(req.params.id)
      .populate('createur', 'nom email telephone')
      .populate('tresorier', 'nom email telephone')
      .populate('membres.user', 'nom email telephone')
      .populate('calendrierTours.beneficiairePrevu', 'nom email telephone');

    if (!tontine) return next(new AppError('Tontine introuvable.', 404));

    const payments = await Payment.find({ tontine: req.params.id, statut: 'valide' });
    const totalCollecte = payments.reduce((sum, p) => sum + (p.montant || 0), 0);
    const totalPenalites = payments.reduce((sum, p) => sum + (p.montantPenalite || 0), 0);

    const contributionsParMembre = tontine.membres.map((m) => {
      const u = m.user;
      const userPayments = payments.filter((p) => p.payeur.toString() === (u._id || u).toString());
      const montantPaye = userPayments.reduce((acc, p) => acc + (p.montant || 0), 0);
      return {
        user: u,
        roleDansGroupe: m.roleDansGroupe,
        ordreTour: m.ordreTour,
        aEteBeneficiaire: m.aEteBeneficiaire,
        montantPaye,
        nombreVersements: userPayments.length,
        estAJour: montantPaye >= tontine.montantCotisation * (tontine.tourActuel || 1)
      };
    });

    res.status(200).json({
      success: true,
      data: {
        tontine,
        totalCollecte,
        totalPenalites,
        soldeFondsCommun: totalCollecte,
        prochainBeneficiaire: tontine.calendrierTours.find((c) => c.numeroTour === tontine.tourActuel) || null,
        contributionsParMembre
      }
    });
  } catch (error) {
    next(error);
  }
};

const getAllTontines = async (req, res, next) => {
  try {
    const tontines = await Tontine.find({ statut: 'en_attente' })
      .populate('createur', 'nom email telephone')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, resultats: tontines.length, data: { tontines } });
  } catch (error) {
    next(error);
  }
};

const getMyTontines = async (req, res, next) => {
  try {
    const tontines = await Tontine.find({ 'membres.user': req.user._id })
      .populate('createur', 'nom email telephone')
      .populate('tresorier', 'nom email telephone')
      .populate('membres.user', 'nom email telephone')
      .sort({ updatedAt: -1 });
    res.status(200).json({ success: true, resultats: tontines.length, data: { tontines } });
  } catch (error) {
    next(error);
  }
};

const getTontineById = async (req, res, next) => {
  try {
    const tontine = await Tontine.findById(req.params.id)
      .populate('createur', 'nom email telephone')
      .populate('tresorier', 'nom email telephone')
      .populate('membres.user', 'nom email telephone')
      .populate('calendrierTours.beneficiairePrevu', 'nom email telephone');
    if (!tontine) return next(new AppError('Tontine introuvable.', 404));
    res.status(200).json({ success: true, data: { tontine } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTontine,
  joinTontine,
  assignTreasurer,
  getFinancialSummary,
  getAllTontines,
  getMyTontines,
  getTontineById
};
