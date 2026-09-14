/**
 * Modèle Paiement / Cotisation Mongoose.
 * Gère la traçabilité des transactions financières, les moyens de paiement
 * et la validation des cotisations de chaque tour.
 */

const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    referenceTransaction: {
      type: String,
      required: [true, 'La référence de transaction est obligatoire.'],
      unique: true,
      uppercase: true,
      trim: true
    },
    tontine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tontine',
      required: [true, 'La tontine associée est obligatoire.']
    },
    payeur: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'L\'identifiant du membre payeur est obligatoire.']
    },
    montant: {
      type: Number,
      required: [true, 'Le montant de la transaction est obligatoire.'],
      min: [100, 'Le montant minimum est de 100 FCFA.']
    },
    devise: {
      type: String,
      default: 'FCFA',
      uppercase: true,
      trim: true
    },
    moyenPaiement: {
      type: String,
      enum: {
        values: ['mobile_money', 'carte_bancaire', 'virement'],
        message: 'Moyen de paiement non pris en charge.'
      },
      default: 'mobile_money'
    },
    operateurMobile: {
      type: String,
      trim: true,
      default: 'MTN Mobile Money'
    },
    numeroTelephonePaiement: {
      type: String,
      trim: true
    },
    statut: {
      type: String,
      enum: {
        values: ['en_attente', 'valide', 'rejete'],
        message: 'Statut de transaction invalide.'
      },
      default: 'valide' // Validation automatique pour le flux opérationnel standard
    },
    dateValidation: {
      type: Date,
      default: Date.now
    },
    note: {
      type: String,
      trim: true,
      maxlength: [200, 'La note ne peut pas dépasser 200 caractères.'],
      default: ''
    }
  },
  {
    timestamps: true
  }
);

// Indexation pour l'historique rapide et l'intégrité
paymentSchema.index({ referenceTransaction: 1 });
paymentSchema.index({ payeur: 1, createdAt: -1 });
paymentSchema.index({ tontine: 1, createdAt: -1 });

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
