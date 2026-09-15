/**
 * CONTRÔLEUR DES NOTIFICATIONS (notificationController.js)
 * 
 * Permet la récupération, le marquage et la gestion du centre de notifications.
 */

const Notification = require('../models/Notification');
const { AppError } = require('../middlewares/errorHandler');

/**
 * Récupère les notifications de l'utilisateur connecté.
 * @route GET /api/notifications
 */
const getMyNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ destinataire: req.user._id })
      .populate('tontine', 'titre montantCotisation frequence')
      .sort({ createdAt: -1 })
      .limit(50);

    const nonLuesCount = await Notification.countDocuments({
      destinataire: req.user._id,
      estLu: false
    });

    res.status(200).json({
      success: true,
      resultats: notifications.length,
      nonLues: nonLuesCount,
      data: { notifications }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Marque une notification spécifique comme lue.
 * @route PATCH /api/notifications/:id/lire
 */
const markAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, destinataire: req.user._id },
      { estLu: true, dateLecture: new Date() },
      { new: true }
    );

    if (!notification) {
      return next(new AppError('Notification introuvable ou non autorisée.', 404));
    }

    res.status(200).json({
      success: true,
      message: 'Notification marquée comme lue.',
      data: { notification }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Marque toutes les notifications non lues de l'utilisateur comme lues.
 * @route PATCH /api/notifications/tout-lire
 */
const markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { destinataire: req.user._id, estLu: false },
      { estLu: true, dateLecture: new Date() }
    );

    res.status(200).json({
      success: true,
      message: 'Toutes vos notifications ont été marquées comme lues.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Supprime une notification.
 * @route DELETE /api/notifications/:id
 */
const deleteNotification = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      destinataire: req.user._id
    });

    if (!notification) {
      return next(new AppError('Notification introuvable.', 404));
    }

    res.status(200).json({
      success: true,
      message: 'Notification supprimée avec succès.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Émet une notification système interne.
 */
const emitNotification = async ({
  destinataire,
  type,
  titre,
  message,
  tontine = null,
  montantConcerne = null,
  dateEcheance = null
}) => {
  try {
    return await Notification.create({
      destinataire,
      type,
      titre,
      message,
      tontine,
      montantConcerne,
      dateEcheance
    });
  } catch (err) {
    console.error('[Notification] Échec de création de la notification :', err);
    return null;
  }
};

module.exports = {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  emitNotification
};
