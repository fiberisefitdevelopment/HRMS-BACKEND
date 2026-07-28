const crypto = require('crypto');
const AuditLog = require('../modules/audit/auditLog.model');
const { auditLogger } = require('../config/logger');

const createAuditLog = async ({
  companyId,
  userId,
  subjectUserId,
  action,
  entityType,
  entityId,
  changes,
  req,
  metadata,
}) => {
  const payload = {
    companyId,
    userId,
    ...(subjectUserId ? { subjectUserId } : {}),
    action,
    entityType,
    entityId,
    changes,
    ipAddress: req?.ip || req?.headers?.['x-forwarded-for'],
    userAgent: req?.get?.('user-agent'),
    requestId: req?.requestId,
    metadata,
  };

  auditLogger.info('Audit event', payload);

  try {
    await AuditLog.create(payload);
  } catch (error) {
    auditLogger.error('Failed to persist audit log', { error: error.message, action });
  }
};

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

module.exports = {
  createAuditLog,
  hashToken,
};
