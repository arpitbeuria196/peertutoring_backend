const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect, protectDocumentUpload } = require('../middlewares/auth');
const User = require('../models/User');

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
const profilePicsDir = path.join(uploadsDir, 'profile-pics');
const documentsDir = path.join(uploadsDir, 'documents');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(profilePicsDir)) {
  fs.mkdirSync(profilePicsDir, { recursive: true });
}
if (!fs.existsSync(documentsDir)) {
  fs.mkdirSync(documentsDir, { recursive: true });
}

// Configure multer for profile picture uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, profilePicsDir);
  },
  filename: (req, file, cb) => {
    // Create unique filename: userId_timestamp.extension
    const uniqueName = `${req.user._id}_${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const imageFileFilter = (req, file, cb) => {
  // Allow only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const documentFileFilter = (req, file, cb) => {
  // Allow PDF, DOC, DOCX files
  const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, DOC, and DOCX files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: imageFileFilter
});

// Configure multer for document uploads
const documentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, documentsDir);
  },
  filename: (req, file, cb) => {
    // Create unique filename: userId_documentType_timestamp.extension
    const documentType = req.body.documentType || 'unknown';
    const uniqueName = `${req.user._id}_${documentType}_${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const documentUpload = multer({
  storage: documentStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for documents
  },
  fileFilter: documentFileFilter
});

// @route   POST /api/upload/profile-picture
// @desc    Upload profile picture
// @access  Private
router.post('/profile-picture', protect, upload.single('profilePicture'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Delete old profile picture if exists
    if (user.profilePicture) {
      const oldPicturePath = path.join(profilePicsDir, path.basename(user.profilePicture));
      if (fs.existsSync(oldPicturePath)) {
        fs.unlinkSync(oldPicturePath);
      }
    }

    // Update user profile picture URL
    const profilePictureUrl = `/api/upload/profile-pics/${req.file.filename}`;
    user.profilePicture = profilePictureUrl;
    await user.save();

    res.json({
      success: true,
      message: 'Profile picture uploaded successfully',
      data: {
        profilePicture: profilePictureUrl,
        filename: req.file.filename,
        size: req.file.size
      }
    });
  } catch (error) {
    console.error('Profile picture upload error:', error);
    
    // Clean up uploaded file if there was an error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Server error during upload'
    });
  }
});

// @route   GET /api/upload/profile-pics/:filename
// @desc    Serve profile picture files
// @access  Public
router.get('/profile-pics/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(profilePicsDir, filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Set proper headers
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    
    // Send file
    res.sendFile(filePath);
  } catch (error) {
    console.error('Serve profile picture error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/upload/profile-picture
// @desc    Delete profile picture
// @access  Private
router.delete('/profile-picture', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.profilePicture) {
      return res.status(400).json({
        success: false,
        message: 'No profile picture to delete'
      });
    }

    // Delete file from filesystem
    const filename = path.basename(user.profilePicture);
    const filePath = path.join(profilePicsDir, filename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Remove from user record
    user.profilePicture = null;
    await user.save();

    res.json({
      success: true,
      message: 'Profile picture deleted successfully'
    });
  } catch (error) {
    console.error('Delete profile picture error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @swagger
 * /upload/documents:
 *   post:
 *     summary: Upload legal document or resume for verification
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - document
 *               - documentType
 *             properties:
 *               document:
 *                 type: string
 *                 format: binary
 *                 description: PDF, DOC, or DOCX file
 *               documentType:
 *                 type: string
 *                 enum: [legalDocument, resume]
 *                 description: Type of document being uploaded
 *                 example: legalDocument
 *     responses:
 *       200:
 *         description: Document uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         documentType:
 *                           type: string
 *                           example: legalDocument
 *                         filename:
 *                           type: string
 *                           example: user_legalDocument_1703123456789.pdf
 *                         originalName:
 *                           type: string
 *                           example: passport.pdf
 *                         size:
 *                           type: number
 *                           example: 1048576
 *                         uploadedAt:
 *                           type: string
 *                           format: date-time
 *                         allDocumentsUploaded:
 *                           type: boolean
 *                           example: false
 *       400:
 *         description: Invalid file type or missing document
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/documents', protectDocumentUpload, documentUpload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No document uploaded'
      });
    }

    const { documentType } = req.body;
    if (!['legalDocument', 'resume'].includes(documentType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document type. Must be "legalDocument" or "resume"'
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Delete old document if exists
    if (user.documents && user.documents[documentType] && user.documents[documentType].path) {
      const oldDocPath = user.documents[documentType].path;
      if (fs.existsSync(oldDocPath)) {
        fs.unlinkSync(oldDocPath);
      }
    }

    // Initialize documents object if it doesn't exist
    if (!user.documents) {
      user.documents = {};
    }

    // Update user document
    const documentUrl = `/api/upload/documents/${req.file.filename}`;
    user.documents[documentType] = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      uploadedAt: new Date(),
      verified: false
    };

    // Check if both documents are uploaded
    const hasLegalDoc = user.documents.legalDocument && user.documents.legalDocument.filename;
    const hasResume = user.documents.resume && user.documents.resume.filename;
    
    // Mark documents as complete if both are uploaded
    if (hasLegalDoc && hasResume) {
      user.documentsVerified = false; // Admin needs to verify
    }

    await user.save();

    res.json({
      success: true,
      message: `${documentType === 'legalDocument' ? 'Legal document' : 'Resume'} uploaded successfully`,
      data: {
        documentType,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        uploadedAt: user.documents[documentType].uploadedAt,
        allDocumentsUploaded: hasLegalDoc && hasResume
      }
    });
  } catch (error) {
    console.error('Document upload error:', error);
    
    // Clean up uploaded file if there was an error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Server error during upload'
    });
  }
});

// @route   GET /api/upload/documents/:filename
// @desc    Serve document files (admin only)
// @access  Private (Admin only)
router.get('/documents/:filename', protect, async (req, res) => {
  try {
    // Check if user is admin or owns the document
    const filename = req.params.filename;
    const userId = filename.split('_')[0]; // Extract user ID from filename
    
    if (req.user.role !== 'admin' && req.user._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const filePath = path.join(documentsDir, filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Set proper headers based on file type
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';
    
    if (ext === '.pdf') {
      contentType = 'application/pdf';
    } else if (ext === '.doc') {
      contentType = 'application/msword';
    } else if (ext === '.docx') {
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    
    // Send file
    res.sendFile(filePath);
  } catch (error) {
    console.error('Serve document error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;