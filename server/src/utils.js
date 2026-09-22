const crypto = require('crypto');
const path = require('path');
const { AppError } = require('./errors');

function required(value, label) {
  if (value === undefined || value === null || String(value).trim() === '') throw new AppError(`${label} is required.`);
  return String(value).trim();
}

function number(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new AppError(`${label} must be a positive number.`);
  return parsed;
}

function documentMetadata(file) {
  if (!file) return null;
  return {
    fileName: path.basename(file.originalname || file.filename),
    mimeType: file.mimetype || 'application/octet-stream',
    size: file.size,
    sha256: crypto.createHash('sha256').update(file.buffer || '').digest('hex'),
    storageKey: file.filename
  };
}

module.exports = { required, number, documentMetadata };
