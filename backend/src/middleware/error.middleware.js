const ApiError = require('../utils/ApiError');

const notFound = (req, _res, next) => {
  next(new ApiError(404, `Route not found: ${req.originalUrl}`));
};

const errorHandler = (err, _req, res, _next) => {
  let status = err.statusCode || 500;
  let message = err.message || 'Internal server error';

  if (err.name === 'MulterError') {
    status = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'Uploaded file exceeds allowed size limit';
    } else {
      message = 'Invalid file upload request';
    }
  }

  if (status >= 500) {
    console.error('[SERVER_ERROR]', err);
  }

  res.status(status).json({
    success: false,
    message,
    details: err.details || null,
  });
};

module.exports = {
  notFound,
  errorHandler,
};
