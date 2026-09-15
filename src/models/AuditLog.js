/**
 * MODÈLE JOURNAL D'AUDIT SÉCURISÉ (AuditLog.js)
 * 
 * Journalise de manière immuable toutes les actions sensibles, transactions,
 * arbitrages de litiges et modifications de rôles pour conformité et audit bancaire.
 */

const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: [true, 'L\'action effectuée est obligatoire.'],
      trim: true,
      index: true
    },
    auteur: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    entiteCible: {
      type: String,
      enum: ['User', 'Tontine', 'Payment', 'Dispute', 'System'],
      required: true
    },
    idEntiteCible: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    adresseIp: {
      type: String,
      default: '127.0.0.1',
      trim: true
    },
    agentUtilisateur: {
      type: String,
      default: '',
      trim: true
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    statutOperation: {
      type: String,
      enum: ['SUCCES', 'ECHEC', 'AVERTISSEMENT'],
      default: 'SUCCES'
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Immuable : pas d'updateAt
    toJSON: {
      transform(doc, ret) {
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Indexation pour les recherches temporelles et par acteur
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

/**
 * Fonction utilitaire statique pour consigner une action dans le journal d'audit.
 */
auditLogSchema.statics.logAction = async function ({
  action,
  auteur = null,
  entiteCible = 'System',
  idEntiteCible = null,
  adresseIp = '127.0.0.1',
  agentUtilisateur = '',
  details = {},
  statutOperation = 'SUCCES'
}) {
  try {
    return await this.create({
      action,
      auteur,
      entiteCible,
      idEntiteCible,
      adresseIp,
      agentUtilisateur,
      details,
      statutOperation
    });
  } catch (err) {
    console.error('[AuditLog] Erreur lors de l\'enregistrement de l\'audit :', err);
    return null;
  }
};

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
