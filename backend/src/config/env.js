const dotenv = require('dotenv');

dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

if (isProduction) {
  const required = ['MONGODB_URI', 'JWT_SECRET', 'ADMIN_EMAIL', 'ADMIN_PASSWORD'];

  required.forEach((key) => {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  });
}

const env = {
  port: Number(process.env.PORT || 5000),
  nodeEnv,
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/felicity',
  jwtSecret: process.env.JWT_SECRET || 'dev_jwt_secret_change_me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  iiitEmailDomain: process.env.IIIT_EMAIL_DOMAIN || '@iiit.ac.in',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@felicity.local',
  adminPassword: process.env.ADMIN_PASSWORD || 'Admin@12345',
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || 'Felicity <noreply@felicity.local>',
  },
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  maxUploadSizeBytes: Number(process.env.MAX_UPLOAD_SIZE_MB || 5) * 1024 * 1024,
};

module.exports = env;
