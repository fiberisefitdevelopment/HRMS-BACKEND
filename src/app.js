const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const config = require('./config');
const routes = require('./routes');
const requestId = require('./middlewares/requestId.middleware');
const notFound = require('./middlewares/notFound.middleware');
const errorHandler = require('./middlewares/errorHandler.middleware');
const { logger } = require('./config/logger');

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: config.security.corsOrigin,
    credentials: true,
  })
);
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestId);

const morganStream = {
  write: (message) => logger.http(message.trim()),
};

app.use(
  morgan(config.isProduction ? 'combined' : 'dev', {
    stream: morganStream,
    skip: (req) => req.url === '/api/v1/dashboard/health',
  })
);

app.use('/uploads', express.static(path.resolve(process.cwd(), config.upload.uploadDir)));
app.use('/uploads/photos', express.static(path.resolve(process.cwd(), config.upload.photoDir)));
app.use('/uploads/imports', express.static(path.resolve(process.cwd(), config.upload.importDir)));
app.use('/uploads/leave', express.static(path.resolve(process.cwd(), config.upload.leaveDir)));

app.use(config.server.apiPrefix, routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
