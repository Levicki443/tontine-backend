/**
 * MODÈLE LITIGE / DISPUTE MONGOOSE (Dispute.js)
 * 
 * Permet aux membres de signaler un désaccord, une anomalie de versement ou un litige,
 * et permet à l'administrateur ou trésorier d'arbitrer et documenter la résolution.
 */

const mongoose = require('mongoose');

const disputeSchema = new mongoose.Schema(
  {
    referenceLitige: {
      type: String,
      required: [true, 'La référence du litige est obligatoire.'],
      unique: true,
      uppercase: true,
      trim: true
    },
    tontine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tontine',
      required: [true, 'La tontine associée au litige est obligatoire.'],
      index: true
    },
    declarant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'L\'utilisateur ayant ouvert le litige est obligatoire.'],
      index: true
    },
    membreConcerne: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    paiementConcerne: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null
    },
    motif: {
      type: String,
      required: [true, 'Le motif du litige est obligatoire.'],
      enum: {
        values: [
          'paiement_non_recu',
          'retard_excessif',
          'non_respect_ordre_tour',
          'fraude_suspectee',
          'autre'
        ],
        message: 'Motif de litige non reconnu.'
      }
    },
    titre: {
      type: String,
      required: [true, 'Le titre du litige est obligatoire.'],
      trim: true,
      minlength: [4, 'Le titre doit comporter au moins 4 caractères.'],
      maxlength: [120, 'Le titre ne peut pas excéder 120 caractères.']
    },
    description: {
      type: String,
      required: [true, 'La description détaillée du litige est obligatoire.'],
      trim: true,
      maxlength: [1000, 'La description ne peut pas dépasser 1000 caractères.']
    },
    preuveJustificatif: {
      type: String,
      default: '',
      trim: true
    },
    statut: {
      type: String,
      enum: {
        values: ['ouvert', 'en_cours_d_examen', 'resolu', 'rejete'],
        message: 'Statut de litige invalide.'
      },
      default: 'ouvert',
      index: true
    },
    arbitre: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    decisionResolution: {
      type: String,
      trim: true,
      default: ''
    },
    dateResolution: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Index composé pour requêtes rapides par tontine et statut
disputeSchema.index({ tontine: 1, statut: 1, createdAt: -1 });

const Dispute = mongoose.model('Dispute', disputeSchema);

module.exports = Dispute;
