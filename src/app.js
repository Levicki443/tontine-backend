/**
 * Point d'entrée principal de l'application Backend Express.
 * Configure la chaîne de middlewares de sécurité, les routes de base et la gestion des erreurs.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');

const env = require('./config/env');
const { connectDB, disconnectDB } = require('./config/database');
const { AppError, errorHandler } = require('./middlewares/errorHandler');

const app = express();

// 1. Sécurisation des en-têtes HTTP
app.use(helmet());

// 2. Gestion dynamique et sécurisée des accès multi-origines (CORS)
const corsOptions = {
  origin: (origin, callback) => {
    // Autoriser les requêtes sans origine (ex: Postman, curl, requêtes serveur)
    if (!origin) {
      return callback(null, true);
    }

    // Autoriser si wildcard (*) ou si l'origine est présente dans la liste blanche
    if (env.ALLOW_ORIGINS.includes('*') || env.ALLOW_ORIGINS.includes(origin)) {
      return callback(null, true);
    }

    return callback(new AppError(`Origine non autorisée par la politique CORS : ${origin}`, 403));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// 3. Journalisation des requêtes HTTP en développement
if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// 4. Limitation du débit global pour contrer le déni de service (DDoS)
const limiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  message: {
    success: false,
    status: 'fail',
    message: 'Trop de requêtes effectuées depuis cette adresse IP. Veuillez patienter 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', limiter);

// 5. Analyse du corps des requêtes avec restriction de taille (Anti-Payload Flooding)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// 6. Assainissement des données contre les injections NoSQL
app.use(mongoSanitize());

// 7. Route de vérification de l'état de santé de l'API (Health Check)
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API Tontine Collaborative opérationnelle.',
    environnement: env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// 8. Montage des modules de routes
const authRoutes = require('./routes/authRoutes');
const tontineRoutes = require('./routes/tontineRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/tontines', tontineRoutes);
app.use('/api/payments', paymentRoutes);

// 9. Capture des routes non trouvées (404)
app.all('*', (req, res, next) => {
  next(new AppError(`La ressource demandée (${req.originalUrl}) est introuvable sur ce serveur.`, 404));
});

// 9. Middleware global de capture et traitement des erreurs
app.use(errorHandler);

/**
 * Démarre le serveur HTTP et initialise la connexion aux services externes.
 */
const startServer = async () => {
  await connectDB();

  const server = app.listen(env.PORT, () => {
    console.log(`🚀 Serveur API Tontine Collaborative actif sur le port ${env.PORT} [Mode : ${env.NODE_ENV}]`);
  });

  // Gestion des signaux de terminaison propre (Graceful Shutdown)
  const gracefulShutdown = async (signal) => {
    console.log(`\n🛑 Signal ${signal} reçu : fermeture progressive du serveur...`);
    server.close(async () => {
      await disconnectDB(signal);
      console.log('✅ Arrêt complet du processus effectué sans perte de données.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
};

// Démarrage automatique si exécuté directement
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
