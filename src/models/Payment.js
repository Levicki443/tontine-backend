/**
 * MODÈLE PAIEMENT / COTISATION MONGOOSE (Payment.js)
 * 
 * Enregistre les versements, les preuves de paiement uploadées (reçus/captures),
 * les pénalités de retard et la validation par le trésorier ou l'administrateur.
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
      required: [true, 'La tontine associée est obligatoire.'],
      index: true
    },
    payeur: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'L\'identifiant du membre payeur est obligatoire.'],
      index: true
    },
    numeroTour: {
      type: Number,
      default: 1,
      required: true
    },
    montant: {
      type: Number,
      required: [true, 'Le montant de la transaction est obligatoire.'],
      min: [100, 'Le montant minimum est de 100 FCFA.']
    },
    montantPenalite: {
      type: Number,
      default: 0
    },
    joursRetard: {
      type: Number,
      default: 0
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
        values: ['mobile_money', 'carte_bancaire', 'virement', 'especes'],
        message: 'Moyen de paiement non pris en charge.'
      },
      default: 'mobile_money'
    },
    operateurMobile: {
      type: String,
      enum: [
        'MTN Mobile Money',
        'Moov Money',
        'Orange Money',
        'Wave',
        'Carte Bancaire',
        'Virement Bancaire',
        'Autre'
      ],
      default: 'MTN Mobile Money'
    },
    numeroTelephonePaiement: {
      type: String,
      trim: true
    },
    recuPreuvePaiement: {
      type: String,
      default: '',
      trim: true
    },
    typePreuve: {
      type: String,
      enum: ['capture_mobile_money', 'recu_pdf', 'sms_confirmation', 'aucun'],
      default: 'capture_mobile_money'
    },
    statut: {
      type: String,
      enum: {
        values: ['en_attente', 'valide', 'rejete'],
        message: 'Statut de transaction invalide.'
      },
      default: 'valide',
      index: true
    },
    validePar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    dateValidation: {
      type: Date,
      default: Date.now
    },
    note: {
      type: String,
      trim: true,
      maxlength: [300, 'La note ne peut pas dépasser 300 caractères.'],
      default: ''
    }
  },
  {
    timestamps: true
  }
);

// Indexation pour la traçabilité et les requêtes financières
paymentSchema.index({ payeur: 1, createdAt: -1 });
paymentSchema.index({ tontine: 1, numeroTour: 1 });
paymentSchema.index({ tontine: 1, statut: 1 });

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
