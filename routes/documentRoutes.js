const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { body, query, validationResult } = require('express-validator');
const Document = require('../models/Document');
const Session = require('../models/Session');
const Message = require('../models/Message');
const { protect, optionalAuth } = require('../middlewares/auth');

const router = express.Router();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads');
fs.mkdir(uploadsDir, { recursive: true }).catch(console.error);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const userDir = path.join(uploadsDir, req.user._id.toString());
    await fs.mkdir(userDir, { recursive: true });
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Define allowed file types
  const allowedTypes = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/gif': ['.gif'],
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/vnd.ms-excel': ['.xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'application/vnd.ms-powerpoint': ['.ppt'],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
    'text/plain': ['.txt'],
    'text/csv': ['.csv'],
    'application/zip': ['.zip'],
    'application/x-rar-compressed': ['.rar']
  };

  if (allowedTypes[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Please upload supported file formats.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
    files: 5 // Maximum 5 files per request
  }
});

// @route   POST /api/documents/upload
// @desc    Upload document(s)
// @access  Private
router.post('/upload', protect, upload.array('files', 5), [
  body('category').optional().isIn(['profile_picture', 'session_material', 'message_attachment', 'verification_document', 'other']),
  body('accessLevel').optional().isIn(['public', 'authenticated', 'participants_only', 'private']),
  body('sessionId').optional().isMongoId(),
  body('messageId').optional().isMongoId(),
  body('description').optional().isLength({ max: 500 }),
  body('tags').optional().isArray(),
  body('expiresIn').optional().isInt({ min: 1, max: 365 }) // Days
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    const {
      category = 'other',
      accessLevel = 'private',
      sessionId,
      messageId,
      description,
      tags,
      expiresIn
    } = req.body;

    // Validate session access if sessionId provided
    if (sessionId) {
      const session = await Session.findById(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      const isParticipant = session.mentorId.toString() === req.user._id.toString() ||
                           session.studentId.toString() === req.user._id.toString();
      
      if (!isParticipant && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to upload to this session'
        });
      }
    }

    // Create document records
    const documents = [];
    for (const file of req.files) {
      const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000) : null;

      const document = new Document({
        uploaderId: req.user._id,
        sessionId,
        messageId,
        originalName: file.originalname,
        fileName: file.filename,
        mimeType: file.mimetype,
        size: file.size,
        path: file.path,
        category,
        accessLevel,
        description,
        tags: tags || [],
        expiresAt
      });

      await document.save();
      documents.push(document);
    }

    const populatedDocs = await Document.find({
      _id: { $in: documents.map(d => d._id) }
    }).populate('uploaderId', 'firstName lastName username');

    res.status(201).json({
      success: true,
      message: `${documents.length} file(s) uploaded successfully`,
      data: populatedDocs
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during file upload'
    });
  }
});

// @route   GET /api/documents
// @desc    Get user's documents
// @access  Private
router.get('/', protect, [
  query('category').optional().isIn(['profile_picture', 'session_material', 'message_attachment', 'verification_document', 'other']),
  query('sessionId').optional().isMongoId(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { category, sessionId, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {
      uploaderId: req.user._id,
      isActive: true
    };

    if (category) query.category = category;
    if (sessionId) query.sessionId = sessionId;

    const documents = await Document.find(query)
      .populate('sessionId', 'title subject')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Document.countDocuments(query);

    res.json({
      success: true,
      data: {
        documents,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/documents/:documentId
// @desc    Get document details
// @access  Private
router.get('/:documentId', optionalAuth, async (req, res) => {
  try {
    const document = await Document.findById(req.params.documentId)
      .populate('uploaderId', 'firstName lastName username')
      .populate('sessionId', 'title subject');

    if (!document || !document.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Check access permissions
    if (!document.canAccess(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: document
    });
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/documents/:documentId/download
// @desc    Download document file
// @access  Private
router.get('/:documentId/download', optionalAuth, async (req, res) => {
  try {
    const document = await Document.findById(req.params.documentId);

    if (!document || !document.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Check access permissions
    if (!document.canAccess(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if file exists
    try {
      await fs.access(document.path);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'File not found on server'
      });
    }

    // Increment download count
    await document.incrementDownload();

    // Set appropriate headers
    res.setHeader('Content-Disposition', `attachment; filename="${document.originalName}"`);
    res.setHeader('Content-Type', document.mimeType);

    // Stream file to response
    res.sendFile(path.resolve(document.path));
  } catch (error) {
    console.error('Download document error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/documents/:documentId
// @desc    Update document metadata
// @access  Private
router.put('/:documentId', protect, [
  body('description').optional().isLength({ max: 500 }),
  body('tags').optional().isArray(),
  body('accessLevel').optional().isIn(['public', 'authenticated', 'participants_only', 'private']),
  body('category').optional().isIn(['profile_picture', 'session_material', 'message_attachment', 'verification_document', 'other'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const document = await Document.findById(req.params.documentId);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Check if user owns the document
    if (document.uploaderId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this document'
      });
    }

    const { description, tags, accessLevel, category } = req.body;

    const updates = {};
    if (description !== undefined) updates.description = description;
    if (tags !== undefined) updates.tags = tags;
    if (accessLevel !== undefined) updates.accessLevel = accessLevel;
    if (category !== undefined) updates.category = category;

    const updatedDocument = await Document.findByIdAndUpdate(
      req.params.documentId,
      updates,
      { new: true }
    ).populate('uploaderId', 'firstName lastName username');

    res.json({
      success: true,
      message: 'Document updated successfully',
      data: updatedDocument
    });
  } catch (error) {
    console.error('Update document error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/documents/:documentId
// @desc    Delete document
// @access  Private
router.delete('/:documentId', protect, async (req, res) => {
  try {
    const document = await Document.findById(req.params.documentId);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Check if user owns the document
    if (document.uploaderId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this document'
      });
    }

    // Delete file from filesystem
    try {
      await fs.unlink(document.path);
    } catch (error) {
      console.warn('Could not delete file from filesystem:', error.message);
    }

    // Delete document record
    await Document.findByIdAndDelete(req.params.documentId);

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/documents/session/:sessionId
// @desc    Get documents for a specific session
// @access  Private
router.get('/session/:sessionId', protect, async (req, res) => {
  try {
    const session = await Session.findById(req.params.sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Check if user is participant
    const isParticipant = session.mentorId.toString() === req.user._id.toString() ||
                         session.studentId.toString() === req.user._id.toString();

    if (!isParticipant && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view session documents'
      });
    }

    const documents = await Document.find({
      sessionId: req.params.sessionId,
      isActive: true
    })
    .populate('uploaderId', 'firstName lastName username')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: documents
    });
  } catch (error) {
    console.error('Get session documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;