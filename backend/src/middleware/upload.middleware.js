const fs = require('fs');
const path = require('path');
const multer = require('multer');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

const uploadsRoot = path.resolve(process.cwd(), env.uploadDir);
const proofDir = path.join(uploadsRoot, 'payment-proofs');
const formResponseDir = path.join(uploadsRoot, 'form-responses');

[uploadsRoot, proofDir, formResponseDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const buildStorage = (destinationDir) =>
  multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, destinationDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      cb(null, name);
    },
  });

const paymentProofStorage = buildStorage(proofDir);
const formResponseStorage = buildStorage(formResponseDir);

const paymentProofFileFilter = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!allowed.includes(file.mimetype)) {
    return cb(new ApiError(400, 'Invalid file type. Use jpg/png/webp/pdf only'));
  }
  cb(null, true);
};

const formResponseFileFilter = (_req, file, cb) => {
  const allowed = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'application/zip',
    'application/x-zip-compressed',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ];
  if (!allowed.includes(file.mimetype)) {
    return cb(new ApiError(400, 'Unsupported upload type for custom form file field'));
  }
  cb(null, true);
};

const uploadPaymentProof = multer({
  storage: paymentProofStorage,
  fileFilter: paymentProofFileFilter,
  limits: {
    fileSize: env.maxUploadSizeBytes,
  },
}).single('paymentProof');

const uploadDynamicFormFiles = multer({
  storage: formResponseStorage,
  fileFilter: formResponseFileFilter,
  limits: {
    fileSize: env.maxUploadSizeBytes,
    files: 10,
  },
}).any();

module.exports = {
  uploadPaymentProof,
  uploadDynamicFormFiles,
};
