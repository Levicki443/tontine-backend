/**
 * MODÈLE NOTIFICATION MONGOOSE (Notification.js)
 * 
 * Stocke et orchestre les notifications transactionnelles, rappels de cotisation,
 * alertes d'échéance, validations de paiement et événements de litige.
 */

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    destinataire: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Le destinataire de la notification est obligatoire.'],
      index: true
    },
    type: {
      type: String,
      required: [true, 'Le type de notification est obligatoire.'],
      enum: {
        values: [
          'rappel_cotisation',
          'validation_paiement',
          'alerte_retard',
          'nouveau_membre',
          'nouveau_tour',
          'litige_signale',
          'litige_resolu',
          'securite'
        ],
        message: 'Type de notification non pris en charge.'
      },
      default: 'rappel_cotisation'
    },
    titre: {
      type: String,
      required: [true, 'Le titre de la notification est obligatoire.'],
      trim: true,
      maxlength: [120, 'Le titre ne peut pas dépasser 120 caractères.']
    },
    message: {
      type: String,
      required: [true, 'Le contenu du message est obligatoire.'],
      trim: true,
      maxlength: [500, 'Le message ne peut pas dépasser 500 caractères.']
    },
    tontine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tontine',
      default: null
    },
    montantConcerne: {
      type: Number,
      default: null
    },
    dateEcheance: {
      type: Date,
      default: null
    },
    estLu: {
      type: Boolean,
      default: false,
      index: true
    },
    dateLecture: {
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

// Index composé pour recherche rapide des notifications non lues d'un utilisateur
notificationSchema.index({ destinataire: 1, estLu: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
