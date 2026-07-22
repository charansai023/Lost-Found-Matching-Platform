// A custom error class that lets us attach an HTTP status code to an error.
// Controllers can throw `new ApiError(404, "Item not found")` and the
// errorHandler middleware will know exactly what status code to send back.
class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

module.exports = ApiError;
