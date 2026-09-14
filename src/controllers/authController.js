/**
 * Contrôleur d'authentification et de gestion des comptes utilisateurs.
 * Traite les inscriptions, connexions, rafraîchissements de sessions et consultations de profil.
 */

const User = require('../models/User');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/token');
const { AppError } = require('../middlewares/errorHandler');

/**
 * Enregistre un nouvel utilisateur sur la plateforme.
 * @route POST /api/auth/register
 */
const register = async (req, res, next) => {
  try {
    const { nom, email, telephone, password, confirmPassword } = req.body;

    // 1. Validation de la présence des champs
    if (!nom || !email || !telephone || !password || !confirmPassword) {
      return next(
        new AppError('Tous les champs sont obligatoires (Nom, Email, Téléphone, Mot de passe, Confirmation).', 400)
      );
    }

    // 2. Vérification de la correspondance des mots de passe
    if (password !== confirmPassword) {
      return next(
        new AppError('Les deux mots de passe saisis ne correspondent pas.', 400)
      );
    }

    // 3. Vérification de l'unicité de l'email
    const existingEmail = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingEmail) {
      return next(
        new AppError('Un compte existe déjà avec cette adresse email.', 409)
      );
    }

    // 4. Vérification de l'unicité du téléphone
    const existingPhone = await User.findOne({ telephone: telephone.trim() });
    if (existingPhone) {
      return next(
        new AppError('Un compte existe déjà avec ce numéro de téléphone.', 409)
      );
    }

    // 5. Création de l'utilisateur
    const user = await User.create({
      nom: nom.trim(),
      email: email.toLowerCase().trim(),
      telephone: telephone.trim(),
      password
    });

    // 6. Génération des jetons JWT
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // 7. Réponse formatée
    res.status(201).json({
      success: true,
      message: 'Votre compte a été créé avec succès.',
      data: {
        user,
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Connecte un utilisateur via son Email ou son Téléphone.
 * @route POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { identifiant, password } = req.body;

    // 1. Vérification des données d'entrée
    if (!identifiant || !password) {
      return next(
        new AppError('Veuillez fournir votre email ou numéro de téléphone ainsi que votre mot de passe.', 400)
      );
    }

    const cleanIdentifiant = identifiant.trim();

    // 2. Recherche par email ou par téléphone
    const user = await User.findOne({
      $or: [
        { email: cleanIdentifiant.toLowerCase() },
        { telephone: cleanIdentifiant }
      ]
    }).select('+password');

    if (!user) {
      return next(
        new AppError('Identifiants incorrects. Veuillez vérifier vos accès.', 401)
      );
    }

    // 3. Vérification du mot de passe
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return next(
        new AppError('Identifiants incorrects. Veuillez vérifier vos accès.', 401)
      );
    }

    // 4. Vérification de l'état actif du compte
    if (!user.estActif) {
      return next(
        new AppError('Ce compte a été désactivé. Veuillez contacter le support.', 403)
      );
    }

    // 5. Mise à jour de la dernière connexion
    user.derniereConnexion = new Date();
    await user.save({ validateBeforeSave: false });

    // 6. Génération des jetons
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Connexion réussie avec succès.',
      data: {
        user,
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retourne les données de profil de l'utilisateur actuellement authentifié.
 * @route GET /api/auth/me
 */
const getMe = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        user: req.user
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Renouvelle un jeton d'accès via le jeton de rafraîchissement.
 * @route POST /api/auth/refresh-token
 */
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: clientRefreshToken } = req.body;

    if (!clientRefreshToken) {
      return next(
        new AppError('Jeton de rafraîchissement manquant.', 400)
      );
    }

    // Vérification du jeton de rafraîchissement
    const decoded = verifyRefreshToken(clientRefreshToken);

    const user = await User.findById(decoded.id);
    if (!user || !user.estActif) {
      return next(
        new AppError('Session invalide ou compte inactif.', 401)
      );
    }

    // Génération d'un nouveau jeton d'accès
    const newAccessToken = generateAccessToken(user._id);

    res.status(200).json({
      success: true,
      data: {
        accessToken: newAccessToken
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getMe,
  refreshToken
};
