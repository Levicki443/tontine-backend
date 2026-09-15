/**
 * CONTRÔLEUR D'AUTHENTIFICATION & 2FA (authController.js)
 * 
 * Traite les inscriptions, connexions, rafraîchissements de sessions,
 * la vérification 2FA (Double Authentification) et la journalisation d'audit.
 */

const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/token');
const { generateTwoFactorOTP, verifyTwoFactorOTP } = require('../utils/crypto');
const { AppError } = require('../middlewares/errorHandler');

/**
 * Enregistre un nouvel utilisateur sur la plateforme.
 * @route POST /api/auth/register
 */
const register = async (req, res, next) => {
  try {
    const { nom, email, telephone, password, confirmPassword } = req.body;

    if (!nom || !email || !telephone || !password || !confirmPassword) {
      return next(new AppError('Tous les champs sont obligatoires.', 400));
    }

    if (password !== confirmPassword) {
      return next(new AppError('Les deux mots de passe saisis ne correspondent pas.', 400));
    }

    const existingEmail = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingEmail) {
      return next(new AppError('Un compte existe déjà avec cette adresse email.', 409));
    }

    const existingPhone = await User.findOne({ telephone: telephone.trim() });
    if (existingPhone) {
      return next(new AppError('Un compte existe déjà avec ce numéro de téléphone.', 409));
    }

    const user = await User.create({
      nom: nom.trim(),
      email: email.toLowerCase().trim(),
      telephone: telephone.trim(),
      password
    });

    await AuditLog.logAction({
      action: 'INSCRIPTION',
      auteur: user._id,
      entiteCible: 'User',
      idEntiteCible: user._id,
      adresseIp: req.ip || '127.0.0.1'
    });

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Votre compte a été créé avec succès.',
      data: { user, accessToken, refreshToken }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Connecte un utilisateur via Email/Téléphone avec support 2FA.
 * @route POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { identifiant, password } = req.body;

    if (!identifiant || !password) {
      return next(new AppError('Veuillez fournir vos identifiants.', 400));
    }

    const cleanIdentifiant = identifiant.trim();
    const user = await User.findOne({
      $or: [{ email: cleanIdentifiant.toLowerCase() }, { telephone: cleanIdentifiant }]
    }).select('+password +deuxFacteursOtp +deuxFacteursOtpExpire');

    if (!user || !(await user.comparePassword(password))) {
      await AuditLog.logAction({
        action: 'ECHEC_CONNEXION',
        entiteCible: 'User',
        details: { identifiant: cleanIdentifiant },
        statutOperation: 'ECHEC'
      });
      return next(new AppError('Identifiants incorrects.', 401));
    }

    if (!user.estActif) {
      return next(new AppError('Ce compte a été désactivé.', 403));
    }

    // Gestion de l'authentification à deux facteurs si activée
    if (user.deuxFacteursActif) {
      const { code, expiresAt } = generateTwoFactorOTP();
      user.deuxFacteursOtp = code;
      user.deuxFacteursOtpExpire = expiresAt;
      await user.save({ validateBeforeSave: false });

      return res.status(200).json({
        success: true,
        require2FA: true,
        userId: user._id,
        message: 'Un code de confirmation 2FA vous a été envoyé.',
        demoOtpCode: code // Fourni pour faciliter la validation et les démonstrations
      });
    }

    user.derniereConnexion = new Date();
    await user.save({ validateBeforeSave: false });

    await AuditLog.logAction({
      action: 'CONNEXION_REUSSIE',
      auteur: user._id,
      entiteCible: 'User',
      idEntiteCible: user._id
    });

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Connexion réussie avec succès.',
      data: { user, accessToken, refreshToken }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Valide le code 2FA pour finaliser la connexion.
 * @route POST /api/auth/verify-2fa
 */
const verifyTwoFactorLogin = async (req, res, next) => {
  try {
    const { userId, code } = req.body;

    if (!userId || !code) {
      return next(new AppError('Identifiant et code 2FA obligatoires.', 400));
    }

    const user = await User.findById(userId).select('+deuxFacteursOtp +deuxFacteursOtpExpire');
    if (!user) {
      return next(new AppError('Utilisateur introuvable.', 404));
    }

    const isValid = verifyTwoFactorOTP(code, user.deuxFacteursOtp, user.deuxFacteursOtpExpire);
    if (!isValid) {
      return next(new AppError('Code 2FA invalide ou expiré.', 401));
    }

    user.deuxFacteursOtp = null;
    user.deuxFacteursOtpExpire = null;
    user.derniereConnexion = new Date();
    await user.save({ validateBeforeSave: false });

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Authentification 2FA validée.',
      data: { user, accessToken, refreshToken }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Active ou désactive le 2FA sur le compte de l'utilisateur connecté.
 * @route PATCH /api/auth/toggle-2fa
 */
const toggleTwoFactor = async (req, res, next) => {
  try {
    const { actif } = req.body;
    const user = await User.findById(req.user._id);

    user.deuxFacteursActif = Boolean(actif);
    await user.save({ validateBeforeSave: false });

    await AuditLog.logAction({
      action: actif ? '2FA_ACTIVE' : '2FA_DESACTIVE',
      auteur: user._id,
      entiteCible: 'User',
      idEntiteCible: user._id
    });

    res.status(200).json({
      success: true,
      message: `Authentification à deux facteurs ${actif ? 'activée' : 'désactivée'}.`,
      data: { deuxFacteursActif: user.deuxFacteursActif }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retourne le profil utilisateur connecté.
 * @route GET /api/auth/me
 */
const getMe = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: { user: req.user }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Renouvelle le token JWT.
 * @route POST /api/auth/refresh-token
 */
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: clientRefreshToken } = req.body;
    if (!clientRefreshToken) {
      return next(new AppError('Jeton de rafraîchissement manquant.', 400));
    }

    const decoded = verifyRefreshToken(clientRefreshToken);
    const user = await User.findById(decoded.id);
    if (!user || !user.estActif) {
      return next(new AppError('Session invalide ou compte inactif.', 401));
    }

    const newAccessToken = generateAccessToken(user._id);
    res.status(200).json({
      success: true,
      data: { accessToken: newAccessToken }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  verifyTwoFactorLogin,
  toggleTwoFactor,
  getMe,
  refreshToken
};
