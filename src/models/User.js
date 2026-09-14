/**
 * Modèle Utilisateur Mongoose.
 * Gère les données de profil, la sécurité des mots de passe et le statut du compte.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    nom: {
      type: String,
      required: [true, 'Le nom complet est obligatoire.'],
      trim: true,
      minlength: [2, 'Le nom doit comporter au moins 2 caractères.'],
      maxlength: [80, 'Le nom ne peut pas dépasser 80 caractères.']
    },
    email: {
      type: String,
      required: [true, 'L\'adresse email est obligatoire.'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        'Veuillez fournir une adresse email valide.'
      ]
    },
    telephone: {
      type: String,
      required: [true, 'Le numéro de téléphone est obligatoire.'],
      unique: true,
      trim: true,
      match: [
        /^\+?[0-9\s\-]{8,20}$/,
        'Veuillez fournir un numéro de téléphone valide.'
      ]
    },
    password: {
      type: String,
      required: [true, 'Le mot de passe est obligatoire.'],
      minlength: [6, 'Le mot de passe doit contenir au moins 6 caractères.'],
      select: false // Exclu par défaut des requêtes find
    },
    role: {
      type: String,
      enum: {
        values: ['membre', 'administrateur'],
        message: 'Le rôle doit être soit membre, soit administrateur.'
      },
      default: 'membre'
    },
    estActif: {
      type: Boolean,
      default: true
    },
    derniereConnexion: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      }
    }
  }
);

/**
 * Middleware pré-enregistrement pour le hachage sécurisé du mot de passe.
 */
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

/**
 * Méthode d'instance pour comparer un mot de passe en clair avec le hash stocké.
 * @param {string} candidatePassword - Mot de passe fourni par l'utilisateur
 * @returns {Promise<boolean>}
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
