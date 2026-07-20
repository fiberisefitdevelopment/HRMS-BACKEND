const path = require('path');
const fs = require('fs');
const multer = require('multer');
const config = require('./index');
const ApiError = require('../utils/ApiError');

const uploadDir = path.resolve(process.cwd(), config.upload.uploadDir);
const importDir = path.resolve(process.cwd(), config.upload.importDir);
const photoDir = path.resolve(process.cwd(), config.upload.photoDir);
const leaveDir = path.resolve(process.cwd(), config.upload.leaveDir);

[uploadDir, importDir, photoDir, leaveDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const EXT_TO_MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.pdf': 'application/pdf',
};

const GENERIC_MIMES = new Set(['application/octet-stream', 'binary/octet-stream', '']);

const resolveFileMime = (file) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const fromExt = EXT_TO_MIME[ext];
  if (file.mimetype && !GENERIC_MIMES.has(file.mimetype)) {
    return file.mimetype;
  }
  return fromExt || file.mimetype;
};

const createStorage = (destination) =>
  multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, destination),
    filename: (_req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = path.extname(file.originalname) || extFromMime(resolveFileMime(file));
      cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    },
  });

const extFromMime = (mime) => {
  const map = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/heic': '.heic',
    'application/pdf': '.pdf',
  };
  return map[mime] || '';
};

const createUpload = (destination, allowedTypes, options = {}) => {
  const { extensionAllowList = [], allowGenericBlob = false } = options;

  return multer({
    storage: createStorage(destination),
    fileFilter: (_req, file, cb) => {
      const resolvedMime = resolveFileMime(file);
      const ext = path.extname(file.originalname || '').toLowerCase();

      if (resolvedMime && resolvedMime !== file.mimetype) {
        file.mimetype = resolvedMime;
      }

      const allowedByMime = allowedTypes.includes(resolvedMime);
      const allowedByExt =
        extensionAllowList.length > 0 &&
        extensionAllowList.includes(ext) &&
        (GENERIC_MIMES.has(file.mimetype) || !file.mimetype);

      const allowedMobileBlob =
        allowGenericBlob &&
        GENERIC_MIMES.has(file.mimetype) &&
        (!ext || extensionAllowList.includes(ext));

      if (allowedByMime || allowedByExt || allowedMobileBlob) {
        if (allowedMobileBlob && GENERIC_MIMES.has(file.mimetype)) {
          file.mimetype = resolvedMime && !GENERIC_MIMES.has(resolvedMime) ? resolvedMime : 'image/jpeg';
        }
        cb(null, true);
        return;
      }

      cb(ApiError.badRequest(`File type ${file.mimetype || resolvedMime} is not allowed`), false);
    },
    limits: { fileSize: config.upload.maxFileSize },
  });
};

const PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.heif'];
const LEAVE_EXTENSIONS = [...PHOTO_EXTENSIONS, '.pdf'];

const upload = createUpload(uploadDir, config.upload.allowedMimeTypes, {
  extensionAllowList: LEAVE_EXTENSIONS,
});
const uploadPhoto = createUpload(photoDir, config.upload.photoMimeTypes, {
  extensionAllowList: PHOTO_EXTENSIONS,
  allowGenericBlob: true,
});
const uploadSpreadsheet = createUpload(importDir, config.upload.spreadsheetMimeTypes);
const uploadLeaveAttachment = createUpload(leaveDir, config.upload.allowedMimeTypes, {
  extensionAllowList: LEAVE_EXTENSIONS,
});

module.exports = {
  upload,
  uploadPhoto,
  uploadSpreadsheet,
  uploadLeaveAttachment,
  uploadDir,
  importDir,
  photoDir,
  leaveDir,
};
