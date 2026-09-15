/**
 * MODÈLE TONTINE MONGOOSE (Tontine.js)
 * 
 * Gère les cercles d'épargne collective, les règles de tirage, les rôles internes
 * (Admin, Trésorier, Membre), le calendrier des tours et le fonds commun.
 */

const mongoose = require('mongoose');

const membreSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'L\'identifiant du membre est requis.']
    },
    roleDansGroupe: {
      type: String,
      enum: ['administrateur', 'tresorier', 'membre'],
      default: 'membre'
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
    },
    dateGain: {
      type: Date,
      default: null
    }
  },
  { _id: false }
);

const echeanceSchema = new mongoose.Schema(
  {
    numeroTour: {
      type: Number,
      required: true
    },
    dateEcheance: {
      type: Date,
      required: true
    },
    beneficiairePrevu: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    montantCagnotte: {
      type: Number,
      required: true
    },
    estTermine: {
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
    methodeTirage: {
      type: String,
      enum: {
        values: ['aleatoire', 'anciennete', 'besoin'],
        message: 'Méthode de tirage invalide (choix : aleatoire, anciennete, besoin).'
      },
      default: 'aleatoire'
    },
    penaliteRetardActif: {
      type: Boolean,
      default: false
    },
    montantPenaliteParJour: {
      type: Number,
      default: 500
    },
    delaiGraceJours: {
      type: Number,
      default: 2
    },
    createur: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Le créateur de la tontine est obligatoire.']
    },
    tresorier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    membres: [membreSchema],
    calendrierTours: [echeanceSchema],
    tourActuel: {
      type: Number,
      default: 1
    },
    fondsCommunSolde: {
      type: Number,
      default: 0
    },
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

// Cagnotte brute estimée par tour
tontineSchema.virtual('cagnotteEstimee').get(function () {
  return this.montantCotisation * this.nombreParticipantsMax;
});

// Indexation
tontineSchema.index({ statut: 1, createdAt: -1 });
tontineSchema.index({ createur: 1 });
tontineSchema.index({ tresorier: 1 });
tontineSchema.index({ 'membres.user': 1 });

const Tontine = mongoose.model('Tontine', tontineSchema);

module.exports = Tontine;
