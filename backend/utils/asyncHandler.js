// Wraps an async controller function so that any error is passed to
// Express's error handling middleware instead of crashing the server.
// This keeps our controllers clean and free of repetitive try/catch blocks.
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = asyncHandler;
