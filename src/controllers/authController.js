/**
 * CONTRÔLEUR D'AUTHENTIFICATION & PARAMÈTRES UTILISATEUR (authController.js)
 * 
 * Traite les inscriptions, connexions, rafraîchissements, la vérification 2FA,
 * ainsi que la mise à jour du profil et le changement de mot de passe.
 */

const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/token');
const { generateTwoFactorOTP, verifyTwoFactorOTP } = require('../utils/crypto');
const { emitNotification } = require('./notificationController');
const { AppError } = require('../middlewares/errorHandler');

/**
 * Enregistre un nouvel utilisateur.
 * @route POST /api/auth/register
 */
const register = async (req, res, next) => {
  try {
    const { nom, email, telephone, password, confirmPassword } = req.body;

    if (!nom || !email || !telephone || !password || !confirmPassword) {
      return next(new AppError('Tous les champs sont obligatoires.', 400));
    }
    if (password !== confirmPassword) {
      return next(new AppError('Les deux mots de passe ne correspondent pas.', 400));
    }

    const existingEmail = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingEmail) return next(new AppError('Un compte existe déjà avec cette adresse email.', 409));

    const existingPhone = await User.findOne({ telephone: telephone.trim() });
    if (existingPhone) return next(new AppError('Un compte existe déjà avec ce numéro de téléphone.', 409));

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
      idEntiteCible: user._id
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
 * Connecte un utilisateur (avec support 2FA).
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

    if (!user.estActif) return next(new AppError('Ce compte a été désactivé.', 403));

    if (user.deuxFacteursActif) {
      const { code, expiresAt } = generateTwoFactorOTP();
      user.deuxFacteursOtp = code;
      user.deuxFacteursOtpExpire = expiresAt;
      await user.save({ validateBeforeSave: false });

      return res.status(200).json({
        success: true,
        require2FA: true,
        userId: user._id,
        message: 'Code OTP 2FA envoyé.',
        demoOtpCode: code
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
      message: 'Connexion réussie.',
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
    if (!userId || !code) return next(new AppError('Identifiant et code 2FA obligatoires.', 400));

    const user = await User.findById(userId).select('+deuxFacteursOtp +deuxFacteursOtpExpire');
    if (!user) return next(new AppError('Utilisateur introuvable.', 404));

    const isValid = verifyTwoFactorOTP(code, user.deuxFacteursOtp, user.deuxFacteursOtpExpire);
    if (!isValid) return next(new AppError('Code 2FA invalide ou expiré.', 401));

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
 * Met à jour les informations du profil utilisateur connecté.
 * @route PATCH /api/auth/me
 */
const updateProfile = async (req, res, next) => {
  try {
    const { nom, email, telephone } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return next(new AppError('Utilisateur introuvable.', 404));

    if (email && email.toLowerCase().trim() !== user.email) {
      const existingEmail = await User.findOne({ email: email.toLowerCase().trim(), _id: { $ne: user._id } });
      if (existingEmail) return next(new AppError('Cette adresse email est déjà utilisée par un autre compte.', 409));
      user.email = email.toLowerCase().trim();
    }

    if (telephone && telephone.trim() !== user.telephone) {
      const existingPhone = await User.findOne({ telephone: telephone.trim(), _id: { $ne: user._id } });
      if (existingPhone) return next(new AppError('Ce numéro de téléphone est déjà utilisé par un autre compte.', 409));
      user.telephone = telephone.trim();
    }

    if (nom) user.nom = nom.trim();
    await user.save();

    await AuditLog.logAction({
      action: 'MODIFICATION_PROFIL',
      auteur: user._id,
      entiteCible: 'User',
      idEntiteCible: user._id,
      details: { nom: user.nom, email: user.email, telephone: user.telephone }
    });

    await emitNotification({
      destinataire: user._id,
      type: 'securite',
      titre: 'Profil mis à jour',
      message: 'Les informations de votre profil ont été modifiées avec succès.'
    });

    res.status(200).json({
      success: true,
      message: 'Profil mis à jour avec succès.',
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Modifie le mot de passe du compte utilisateur.
 * @route PATCH /api/auth/me/mot-de-passe
 */
const updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return next(new AppError('Veuillez renseigner le mot de passe actuel et le nouveau mot de passe.', 400));
    }
    if (newPassword !== confirmNewPassword) {
      return next(new AppError('Le nouveau mot de passe et sa confirmation ne correspondent pas.', 400));
    }
    if (newPassword.length < 6) {
      return next(new AppError('Le nouveau mot de passe doit comporter au moins 6 caractères.', 400));
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user || !(await user.comparePassword(currentPassword))) {
      return next(new AppError('Le mot de passe actuel saisi est incorrect.', 401));
    }

    user.password = newPassword;
    await user.save(); // Déclenche le hachage bcrypt automatique

    await AuditLog.logAction({
      action: 'MODIFICATION_MOT_DE_PASSE',
      auteur: user._id,
      entiteCible: 'User',
      idEntiteCible: user._id
    });

    await emitNotification({
      destinataire: user._id,
      type: 'securite',
      titre: 'Mot de passe modifié',
      message: 'Le mot de passe de votre compte a été changé avec succès.'
    });

    res.status(200).json({
      success: true,
      message: 'Votre mot de passe a été modifié avec succès.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Active/Désactive le 2FA.
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
      message: `2FA ${actif ? 'activé' : 'désactivé'}.`,
      data: { deuxFacteursActif: user.deuxFacteursActif }
    });
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: { user: req.user } });
  } catch (error) {
    next(error);
  }
};

const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: clientRefreshToken } = req.body;
    if (!clientRefreshToken) return next(new AppError('Jeton manquant.', 400));

    const decoded = verifyRefreshToken(clientRefreshToken);
    const user = await User.findById(decoded.id);
    if (!user || !user.estActif) return next(new AppError('Session invalide.', 401));

    const newAccessToken = generateAccessToken(user._id);
    res.status(200).json({ success: true, data: { accessToken: newAccessToken } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  verifyTwoFactorLogin,
  updateProfile,
  updatePassword,
  toggleTwoFactor,
  getMe,
  refreshToken
};
