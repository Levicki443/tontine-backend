/**
 * Module de gestion de la connexion à la base de données MongoDB via Mongoose.
 * Intègre la résilience réseau, la gestion des événements et la fermeture propre.
 */

const mongoose = require('mongoose');
const env = require('./env');

/**
 * Initialise la connexion à MongoDB avec les options recommandées.
 * @returns {Promise<typeof mongoose>}
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.MONGO_URI, {
      autoIndex: env.NODE_ENV !== 'production', // Désactiver la création automatique d'index en prod pour la performance
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });

    console.log(`✅ Base de données MongoDB connectée avec succès : ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`❌ Erreur critique lors de la connexion à MongoDB : ${error.message}`);
    // Arrêt du processus en cas d'impossibilité de se connecter au démarrage
    process.exit(1);
  }
};

// Gestion des événements de connexion Mongoose
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ Connexion MongoDB perdue. Tentative de reconnexion en cours...');
});

mongoose.connection.on('reconnected', () => {
  console.log('🔄 Reconnexion à MongoDB établie avec succès.');
});

mongoose.connection.on('error', (err) => {
  console.error(`❌ Erreur sur la connexion MongoDB active : ${err.message}`);
});

/**
 * Ferme proprement la connexion MongoDB lors de l'arrêt du serveur.
 * @param {string} signal - Signal d'interruption (SIGINT, SIGTERM, etc.)
 */
const disconnectDB = async (signal = 'SIGINT') => {
  try {
    await mongoose.connection.close();
    console.log(`🔌 Connexion MongoDB fermée suite au signal ${signal}.`);
  } catch (err) {
    console.error(`❌ Erreur lors de la fermeture de MongoDB : ${err.message}`);
  }
};

module.exports = {
  connectDB,
  disconnectDB
};
