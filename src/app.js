/**
 * POINT D'ENTRÉE PRINCIPAL API BACKEND (app.js)
 * 
 * Configure la chaîne de middlewares de sécurité bancaire,
 * les routes modulaires et la gestion globale des erreurs.
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
    if (!origin || env.ALLOW_ORIGINS.includes('*')) {
      return callback(null, true);
    }

    const isAllowed = env.ALLOW_ORIGINS.some((allowed) => {
      if (allowed === origin) return true;
      if (allowed.startsWith('*.') || allowed.startsWith('https://*.')) {
        const cleanPattern = allowed.replace(/^https?:\/\/\*\./, '').replace(/^\*\./, '');
        try {
          const originHost = new URL(origin).hostname;
          return originHost === cleanPattern || originHost.endsWith(`.${cleanPattern}`);
        } catch {
          return false;
        }
      }
      return false;
    });

    if (isAllowed) return callback(null, true);
    return callback(new AppError(`Origine non autorisée par la politique CORS : ${origin}`, 403));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// 3. Journalisation en développement
if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// 4. Limitation du débit global (Rate Limiting)
const limiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  message: {
    success: false,
    status: 'fail',
    message: 'Trop de requêtes effectuées depuis cette adresse IP. Veuillez patienter.'
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', limiter);

// 5. Analyse du corps des requêtes avec limite de taille
app.use(express.json({ limit: '10mb' })); // Supporte les reçus et captures en base64
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 6. Assainissement NoSQL
app.use(mongoSanitize());

// 7. Health Check
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
const notificationRoutes = require('./routes/notificationRoutes');
const disputeRoutes = require('./routes/disputeRoutes');
const auditRoutes = require('./routes/auditRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/tontines', tontineRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/disputes', disputeRoutes);
app.use('/api/audit', auditRoutes);

// 9. Capture 404
app.all('*', (req, res, next) => {
  next(new AppError(`La ressource demandée (${req.originalUrl}) est introuvable sur ce serveur.`, 404));
});

// 10. Gestionnaire d'erreurs global
app.use(errorHandler);

/**
 * Démarrage du serveur et arrêt gracieux
 */
const startServer = async () => {
  await connectDB();

  const server = app.listen(env.PORT, () => {
    console.log(`🚀 Serveur API Tontine Collaborative actif sur le port ${env.PORT} [Mode : ${env.NODE_ENV}]`);
  });

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

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
