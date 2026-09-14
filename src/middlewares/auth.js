/**
 * Middleware d'authentification et de protection des routes privées.
 * Extrait le jeton Bearer, le vérifie et attache l'utilisateur actif à la requête.
 */

const { verifyAccessToken } = require('../utils/token');
const User = require('../models/User');
const { AppError } = require('./errorHandler');

/**
 * Middleware principal de vérification de session active.
 */
const protect = async (req, res, next) => {
  try {
    let token = null;

    // 1. Extraction du jeton depuis l'en-tête Authorization
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(
        new AppError('Accès refusé. Vous devez être connecté pour accéder à cette ressource.', 401)
      );
    }

    // 2. Vérification cryptographique du jeton
    const decoded = verifyAccessToken(token);

    // 3. Vérification de l'existence continue de l'utilisateur
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return next(
        new AppError('L\'utilisateur associé à cette session n\'existe plus.', 401)
      );
    }

    // 4. Vérification de l'état actif du compte
    if (!currentUser.estActif) {
      return next(
        new AppError('Votre compte a été désactivé. Veuillez contacter le support.', 403)
      );
    }

    // 5. Attachement de l'utilisateur à l'objet requête
    req.user = currentUser;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware de restriction d'accès selon les rôles.
 * @param  {...string} roles - Rôles autorisés (ex: 'administrateur')
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new AppError('Vous n\'avez pas les permissions requises pour effectuer cette action.', 403)
      );
    }
    next();
  };
};

module.exports = {
  protect,
  restrictTo
};
