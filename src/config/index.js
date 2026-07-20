require('dotenv').config();

const requiredEnvVars = ['MONGODB_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];

const missing = requiredEnvVars.filter((key) => !process.env[key]);
if (missing.length > 0 && process.env.NODE_ENV !== 'test') {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

const config = {
  env: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV !== 'production',

  server: {
    port: parseInt(process.env.PORT, 10) || 5000,
    apiPrefix: process.env.API_PREFIX || '/api/v1',
    appName: process.env.APP_NAME || 'HRMS',
  },

  database: {
    uri: process.env.MONGODB_URI,
    options: {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    },
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '12h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  upload: {
    maxFileSize: parseInt(process.env.UPLOAD_MAX_FILE_SIZE, 10) || 10 * 1024 * 1024,
    allowedMimeTypes: (process.env.UPLOAD_ALLOWED_TYPES || 'image/jpeg,image/png,application/pdf').split(','),
    photoMimeTypes: (process.env.UPLOAD_PHOTO_TYPES || 'image/jpeg,image/png,image/webp,image/heic,image/heif').split(','),
    spreadsheetMimeTypes: (
      process.env.UPLOAD_SPREADSHEET_TYPES ||
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,application/vnd.ms-excel'
    ).split(','),
    uploadDir: process.env.UPLOAD_DIR || 'uploads',
    importDir: process.env.UPLOAD_IMPORT_DIR || 'uploads/imports',
    photoDir: process.env.UPLOAD_PHOTO_DIR || 'uploads/photos',
    leaveDir: process.env.UPLOAD_LEAVE_DIR || 'uploads/leave',
  },

  mail: {
    host: process.env.MAIL_HOST,
    port: parseInt(process.env.MAIL_PORT, 10) || 587,
    user: process.env.MAIL_USER,
    password: process.env.MAIL_PASSWORD,
    from: process.env.MAIL_FROM || 'noreply@hrms.local',
  },

  security: {
    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12,
    corsOrigin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
      : '*',
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || 'logs',
  },

  seed: {
    ownerEmail: process.env.SEED_OWNER_EMAIL || 'owner@hrms.local',
    ownerPassword: process.env.SEED_OWNER_PASSWORD || 'Owner@12345',
    ownerFirstName: process.env.SEED_OWNER_FIRST_NAME || 'System',
    ownerLastName: process.env.SEED_OWNER_LAST_NAME || 'Owner',
    runOnStart: process.env.SEED_ON_START === 'true',
  },

  auth: {
    maxFailedLoginAttempts: parseInt(process.env.MAX_FAILED_LOGIN_ATTEMPTS, 10) || (
      process.env.NODE_ENV === 'production' ? 5 : 20
    ),
    lockDurationMinutes: parseInt(process.env.LOCK_DURATION_MINUTES, 10) || (
      process.env.NODE_ENV === 'production' ? 30 : 5
    ),
  },

  employeeId: {
    prefixLength: parseInt(process.env.EMPLOYEE_ID_PREFIX_LENGTH, 10) || 3,
    sequencePadding: parseInt(process.env.EMPLOYEE_ID_PADDING, 10) || 4,
  },
};

module.exports = config;
