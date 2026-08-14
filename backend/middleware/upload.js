const multer = require('multer');
const path = require('path');
const ApiError = require('../utils/ApiError');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configure Cloudinary using environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure CloudinaryStorage for multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'lost-and-found',
    allowed_formats: ['jpeg', 'jpg', 'png', 'webp'],
    // Add a unique prefix to filenames (optional but good practice)
    public_id: (req, file) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      return `${file.fieldname}-${uniqueSuffix}`;
    },
  },
});

// Only allow common image formats to be uploaded
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const isAllowedExt = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const isAllowedMime = allowedTypes.test(file.mimetype);

  if (isAllowedExt && isAllowedMime) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'Only image files (jpg, jpeg, png, webp) are allowed'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max file size
});

module.exports = upload;
