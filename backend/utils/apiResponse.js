// A small helper to keep every API response in the same shape:
// { success, message, data }
// This makes the frontend code predictable since it always knows
// what shape of object to expect back from the API.

const sendSuccess = (res, statusCode, message, data = {}) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

const sendError = (res, statusCode, message) => {
  return res.status(statusCode).json({
    success: false,
    message,
    data: {},
  });
};

module.exports = { sendSuccess, sendError };
