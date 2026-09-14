/**
 * Contrôleur de gestion des Tontines.
 * Permet la création, l'exploration, l'adhésion et le suivi des cercles d'épargne.
 */

const Tontine = require('../models/Tontine');
const { AppError } = require('../middlewares/errorHandler');

/**
 * Crée un nouveau groupe de tontine collaborative.
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
      nombreParticipantsMax
    } = req.body;

    // 1. Validation de base des champs requis
    if (!titre || !montantCotisation || !nombreParticipantsMax || !frequence) {
      return next(
        new AppError('Veuillez renseigner le titre, le montant, la fréquence et le nombre de participants.', 400)
      );
    }

    const parsedMontant = Number(montantCotisation);
    const parsedParticipants = parseInt(nombreParticipantsMax, 10);

    if (isNaN(parsedMontant) || parsedMontant < 500) {
      return next(new AppError('Le montant de cotisation doit être un nombre supérieur ou égal à 500 FCFA.', 400));
    }

    if (isNaN(parsedParticipants) || parsedParticipants < 2 || parsedParticipants > 100) {
      return next(new AppError('Le nombre de participants doit être compris entre 2 et 100.', 400));
    }

    // 2. Création de la tontine avec le créateur comme premier membre (Ordre 1)
    const tontine = await Tontine.create({
      titre: titre.trim(),
      description: description ? description.trim() : '',
      montantCotisation: parsedMontant,
      devise: devise ? devise.trim().toUpperCase() : 'FCFA',
      frequence,
      nombreParticipantsMax: parsedParticipants,
      createur: req.user._id,
      membres: [
        {
          user: req.user._id,
          dateAdhesion: new Date(),
          ordreTour: 1,
          aEteBeneficiaire: false
        }
      ]
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
 * Récupère les tontines ouvertes aux adhésions.
 * @route GET /api/tontines
 */
const getAllTontines = async (req, res, next) => {
  try {
    const tontines = await Tontine.find({ statut: 'en_attente' })
      .populate('createur', 'nom email telephone')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      resultats: tontines.length,
      data: { tontines }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Récupère les tontines dans lesquelles l'utilisateur connecté participe.
 * @route GET /api/tontines/mes-tontines
 */
const getMyTontines = async (req, res, next) => {
  try {
    const tontines = await Tontine.find({
      'membres.user': req.user._id
    })
      .populate('createur', 'nom email telephone')
      .populate('membres.user', 'nom email telephone')
      .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      resultats: tontines.length,
      data: { tontines }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtient les détails complets d'une tontine spécifique.
 * @route GET /api/tontines/:id
 */
const getTontineById = async (req, res, next) => {
  try {
    const tontine = await Tontine.findById(req.params.id)
      .populate('createur', 'nom email telephone')
      .populate('membres.user', 'nom email telephone');

    if (!tontine) {
      return next(new AppError('Tontine introuvable avec cet identifiant.', 404));
    }

    res.status(200).json({
      success: true,
      data: { tontine }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Permet à un utilisateur de rejoindre une tontine ouverte.
 * @route POST /api/tontines/:id/rejoindre
 */
const joinTontine = async (req, res, next) => {
  try {
    const tontine = await Tontine.findById(req.params.id);

    if (!tontine) {
      return next(new AppError('Tontine introuvable.', 404));
    }

    if (tontine.statut !== 'en_attente') {
      return next(new AppError('Cette tontine n\'accepte plus de nouveaux membres.', 400));
    }

    // Vérifier si l'utilisateur est déjà membre
    const isMember = tontine.membres.some(
      (m) => m.user.toString() === req.user._id.toString()
    );

    if (isMember) {
      return next(new AppError('Vous êtes déjà membre de cette tontine.', 409));
    }

    // Vérifier si le nombre de places maximum est atteint
    if (tontine.membres.length >= tontine.nombreParticipantsMax) {
      return next(new AppError('Cette tontine a déjà atteint son nombre maximal de participants.', 400));
    }

    // Ajout du membre avec le numéro d'ordre suivant
    const nouvelOrdre = tontine.membres.length + 1;
    tontine.membres.push({
      user: req.user._id,
      dateAdhesion: new Date(),
      ordreTour: nouvelOrdre,
      aEteBeneficiaire: false
    });

    // Si le groupe est désormais complet, démarrer le cycle
    if (tontine.membres.length === tontine.nombreParticipantsMax) {
      tontine.statut = 'en_cours';
      tontine.dateDebut = new Date();
    }

    await tontine.save();

    res.status(200).json({
      success: true,
      message: 'Vous avez rejoint la tontine avec succès.',
      data: { tontine }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTontine,
  getAllTontines,
  getMyTontines,
  getTontineById,
  joinTontine
};
