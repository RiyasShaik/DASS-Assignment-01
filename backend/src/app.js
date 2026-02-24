const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const cookieParser = require('cookie-parser');
const env = require('./config/env');
const { auth, authorize } = require('./middleware/auth.middleware');
const { notFound, errorHandler } = require('./middleware/error.middleware');

const authRoutes = require('./routes/auth.routes');
const eventRoutes = require('./routes/event.routes');
const participantRoutes = require('./routes/participant.routes');
const organizerRoutes = require('./routes/organizer.routes');
const adminRoutes = require('./routes/admin.routes');

const buildApp = (io) => {
  const app = express();

  app.use(
    cors({
      origin: env.frontendUrl,
      credentials: true,
    })
  );
  app.use(helmet());
  app.use(cookieParser());
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

  app.use('/uploads', express.static(path.resolve(process.cwd(), env.uploadDir)));

  app.use((req, _res, next) => {
    req.io = io;
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ success: true, message: 'Server healthy' });
  });

  app.use('/api/auth', authRoutes);

  // Protected features
  app.use('/api/events', auth, eventRoutes);
  app.use('/api/participants', auth, authorize('participant'), participantRoutes);
  app.use('/api/organizer', auth, authorize('organizer'), organizerRoutes);
  app.use('/api/admin', auth, authorize('admin'), adminRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
};

module.exports = buildApp;
