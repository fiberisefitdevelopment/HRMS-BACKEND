const mongoose = require('mongoose');
const config = require('../config');
const { dbLogger } = require('../config/logger');

const connectDatabase = async () => {
  try {
    mongoose.set('strictQuery', true);

    const conn = await mongoose.connect(config.database.uri, config.database.options);

    dbLogger.info(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);

    mongoose.connection.on('error', (err) => {
      dbLogger.error('MongoDB connection error', { error: err.message });
    });

    mongoose.connection.on('disconnected', () => {
      dbLogger.warn('MongoDB disconnected');
    });

    return conn;
  } catch (error) {
    dbLogger.error('MongoDB connection failed', { error: error.message });
    process.exit(1);
  }
};

const disconnectDatabase = async () => {
  await mongoose.disconnect();
  dbLogger.info('MongoDB disconnected gracefully');
};

module.exports = { connectDatabase, disconnectDatabase };
