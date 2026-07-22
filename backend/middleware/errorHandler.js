// Central error handling middleware.
// Any error passed via next(error) or thrown inside an asyncHandler
// will end up here, so we only need to format error responses in one place.
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Something went wrong on the server';

  // Handle invalid MongoDB ObjectId errors (e.g. GET /api/lost/123)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for field: ${err.path}`;
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((val) => val.message)
      .join(', ');
  }

  // Handle duplicate key errors (e.g. registering with an email that already exists)
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue).join(', ');
    message = `An account with this ${field} already exists`;
  }

  console.error(err.stack);

  res.status(statusCode).json({
    success: false,
    message,
    data: {},
  });
};

// Handles requests to routes that do not exist
const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  res.status(404);
  next(error);
};

module.exports = { errorHandler, notFound };
