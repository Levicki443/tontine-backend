/**
 * Modèle Tontine Mongoose.
 * Gère les cercles d'épargne collective, les règles de cotisation,
 * les membres participants et l'ordre des bénéficiaires.
 */

const mongoose = require('mongoose');

const membreSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'L\'identifiant de l\'utilisateur membre est requis.']
    },
    dateAdhesion: {
      type: Date,
      default: Date.now
    },
    ordreTour: {
      type: Number,
      required: [true, 'L\'ordre de passage dans la tontine est obligatoire.']
    },
    aEteBeneficiaire: {
      type: Boolean,
      default: false
    }
  },
  { _id: false }
);

const tontineSchema = new mongoose.Schema(
  {
    titre: {
      type: String,
      required: [true, 'Le titre de la tontine est obligatoire.'],
      trim: true,
      minlength: [3, 'Le titre doit comporter au moins 3 caractères.'],
      maxlength: [100, 'Le titre ne peut pas dépasser 100 caractères.']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'La description ne peut pas dépasser 500 caractères.'],
      default: ''
    },
    montantCotisation: {
      type: Number,
      required: [true, 'Le montant de la cotisation est obligatoire.'],
      min: [500, 'Le montant minimum de cotisation est de 500 FCFA.']
    },
    devise: {
      type: String,
      default: 'FCFA',
      uppercase: true,
      trim: true
    },
    frequence: {
      type: String,
      required: [true, 'La fréquence des cotisations est obligatoire.'],
      enum: {
        values: ['hebdomadaire', 'bimensuelle', 'mensuelle'],
        message: 'La fréquence doit être hebdomadaire, bimensuelle ou mensuelle.'
      },
      default: 'mensuelle'
    },
    nombreParticipantsMax: {
      type: Number,
      required: [true, 'Le nombre maximum de participants est obligatoire.'],
      min: [2, 'Une tontine doit comporter au minimum 2 participants.'],
      max: [100, 'Une tontine ne peut pas excéder 100 participants.']
    },
    createur: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Le créateur de la tontine est obligatoire.']
    },
    membres: [membreSchema],
    statut: {
      type: String,
      enum: {
        values: ['en_attente', 'en_cours', 'terminee', 'annulee'],
        message: 'Statut invalide.'
      },
      default: 'en_attente'
    },
    dateDebut: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Calcul virtuel de la cagnotte totale estimée par tour
tontineSchema.virtual('cagnotteEstimee').get(function () {
  return this.montantCotisation * this.nombreParticipantsMax;
});

// Indexation pour les filtres et listes de tontines
tontineSchema.index({ statut: 1, createdAt: -1 });
tontineSchema.index({ createur: 1 });
tontineSchema.index({ 'membres.user': 1 });

const Tontine = mongoose.model('Tontine', tontineSchema);

module.exports = Tontine;
