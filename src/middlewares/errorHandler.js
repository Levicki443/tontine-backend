/**
 * Middleware centralisé de traitement et normalisation des erreurs.
 * Garantit qu'aucune information sensible ni trace de pile (stack trace)
 * ne soit exposée aux clients en production.
 */

const env = require('../config/env');

/**
 * Classe personnalisée pour les erreurs opérationnelles prévisibles.
 */
class AppError extends Error {
  /**
   * @param {string} message - Message explicatif de l'erreur
   * @param {number} statusCode - Code de statut HTTP associé
   */
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Normalise les erreurs de cast MongoDB (ex: ID invalide).
 */
const handleCastErrorDB = (err) => {
  const message = `Ressource introuvable : valeur invalide "${err.value}" pour le champ "${err.path}".`;
  return new AppError(message, 400);
};

/**
 * Normalise les erreurs de duplication de clé unique MongoDB (ex: email déjà pris).
 */
const handleDuplicateFieldsDB = (err) => {
  const field = Object.keys(err.keyValue || {})[0] || 'champ';
  const value = err.keyValue ? err.keyValue[field] : '';
  const message = `La valeur "${value}" pour le champ "${field}" est déjà utilisée. Veuillez en choisir une autre.`;
  return new AppError(message, 409);
};

/**
 * Normalise les erreurs de validation Mongoose.
 */
const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `Données invalides fournies : ${errors.join('. ')}`;
  return new AppError(message, 422);
};

/**
 * Normalise les erreurs de jeton JWT invalide.
 */
const handleJWTError = () => {
  return new AppError('Jeton d\'authentification invalide. Veuillez vous reconnecter.', 401);
};

/**
 * Normalise les erreurs de jeton JWT expiré.
 */
const handleJWTExpiredError = () => {
  return new AppError('Votre session a expiré. Veuillez vous reconnecter.', 401);
};

/**
 * Middleware Express de gestion globale des erreurs.
 */
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (env.NODE_ENV === 'development') {
    return res.status(err.statusCode).json({
      success: false,
      status: err.status,
      message: err.message,
      error: err,
      stack: err.stack
    });
  }

  // Mode Production : Traitement et masquage des erreurs internes
  let error = { ...err };
  error.message = err.message;
  error.name = err.name;

  if (error.name === 'CastError') error = handleCastErrorDB(error);
  if (error.code === 11000) error = handleDuplicateFieldsDB(error);
  if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
  if (error.name === 'JsonWebTokenError') error = handleJWTError();
  if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

  // Erreur opérationnelle attendue : message contrôlé transmis au client
  if (error.isOperational) {
    return res.status(error.statusCode).json({
      success: false,
      status: error.status,
      message: error.message
    });
  }

  // Erreur de programmation ou tierce imprévue : log interne et message générique sécurisé
  console.error('💥 ERREUR NON CONTRÔLÉE :', err);
  return res.status(500).json({
    success: false,
    status: 'error',
    message: 'Une erreur interne est survenue sur nos serveurs. Veuillez réessayer ultérieurement.'
  });
};

module.exports = {
  AppError,
  errorHandler
};
