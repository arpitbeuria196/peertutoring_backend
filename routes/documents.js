const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect, authorizeAdmin, protectDocumentUpload } = require('../middlewares/auth');

const router = express.Router();

// Document storage configuration with separate folders
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create base directory first
    const baseDir = `uploads/${req.user._id}`;
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    cb(null, baseDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const timestamp = Date.now();
    const filename = `${timestamp}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, images, and Word documents allowed.'));
    }
  }
});

// @route   POST /api/documents/upload
// @desc    Upload a document
// @access  Private
router.post('/upload', protectDocumentUpload, upload.single('document'), [
  body('documentType').isIn(['resume', 'offer']).withMessage('Document type must be resume or offer')
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

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const { documentType } = req.body;
    const user = await User.findById(req.user._id);

    // Update user's document info (simplified structure)
    if (!user.documents) {
      user.documents = {};
    }

    // Move file to proper subfolder after upload
    const subDir = `${documentType}s`; // resumes/ or offers/
    const targetDir = path.join(`uploads/${req.user._id}`, subDir);
    
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    const newFilename = `${documentType}_${Date.now()}${path.extname(req.file.originalname)}`;
    const newPath = path.join(targetDir, newFilename);
    
    // Move file to correct subdirectory
    fs.renameSync(req.file.path, newPath);
    
    // Generate unique document ID
    const documentId = `${documentType}_${req.user._id}_${Date.now()}`;
    
    user.documents[`${documentType}Document`] = {
      id: documentId,
      filename: newFilename,
      originalName: req.file.originalname,
      path: newPath,
      uploadedAt: new Date(),
      verified: false
    };

    // Check if both documents are uploaded
    const hasResume = user.documents.resumeDocument && user.documents.resumeDocument.filename;
    const hasOffer = user.documents.offerDocument && user.documents.offerDocument.filename;
    user.documentsUploaded = !!(hasResume && hasOffer);

    await user.save();

    res.json({
      success: true,
      message: 'Document uploaded successfully',
      data: {
        documentType,
        filename: req.file.filename,
        originalName: req.file.originalname,
        documentsUploaded: user.documentsUploaded
      }
    });
  } catch (error) {
    console.error('Document upload error:', error);
    
    // Clean up uploaded file if there was an error
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Error cleaning up file:', unlinkError);
      }
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error during upload',
      error: error.message
    });
  }
});

// @route   GET /api/documents-simple
// @desc    Get user's documents
// @access  Private
router.get('/', protectDocumentUpload, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('documents documentsUploaded documentsVerified');
    
    const documents = [];
    if (user.documents) {
      Object.entries(user.documents).forEach(([key, doc]) => {
        // Only show documents that actually have a filename (were uploaded)
        if (doc && doc.filename && doc.filename.trim() !== '') {
          documents.push({
            id: doc.id || key,
            type: key.replace('Document', ''),
            filename: doc.filename,
            originalName: doc.originalName,
            uploadedAt: doc.uploadedAt,
            verified: doc.verified || false,
            path: doc.path
          });
        }
      });
    }

    res.json({
      success: true,
      data: {
        documents,
        documentsUploaded: user.documentsUploaded || false,
        documentsVerified: user.documentsVerified || false
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

// @route   PUT /api/documents/verify/:userId
// @desc    Verify or reject user documents
// @access  Private (Admin only)
router.put('/verify/:userId', protect, authorizeAdmin, [
  body('action').isIn(['approve', 'reject']).withMessage('Action must be approve or reject'),
  body('reason').optional().trim().isLength({ max: 500 }).withMessage('Reason must be less than 500 characters')
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

    const { action, reason } = req.body;
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (action === 'approve') {
      // Mark all documents as verified
      if (user.documents) {
        Object.keys(user.documents).forEach(key => {
          if (user.documents[key] && user.documents[key].filename) {
            user.documents[key].verified = true;
            user.documents[key].verifiedAt = new Date();
            user.documents[key].verifiedBy = req.user._id;
          }
        });
      }
      user.documentsVerified = true;
      user.isApproved = true;
      user.approvedBy = req.user._id;
      user.approvedAt = new Date();
    } else {
      // Reject documents
      user.documentsVerified = false;
      user.isApproved = false;
      user.rejectionReason = reason;
    }

    await user.save();

    res.json({
      success: true,
      message: `Documents ${action}d successfully`,
      data: {
        userId: user._id,
        action,
        documentsVerified: user.documentsVerified,
        isApproved: user.isApproved
      }
    });
  } catch (error) {
    console.error('Document verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/documents/download/:userId/:documentType
// @desc    Download document
// @access  Private (Admin only)
router.get('/download/:userId/:documentType', protect, authorizeAdmin, async (req, res) => {
  try {
    const { userId, documentType } = req.params;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const docKey = documentType === 'resume' ? 'resumeDocument' : 
                   documentType === 'offer' ? 'offerDocument' : null;

    if (!docKey || !user.documents || !user.documents[docKey] || !user.documents[docKey].filename) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    const doc = user.documents[docKey];
    const filePath = path.join(__dirname, '..', doc.path);
    
    if (fs.existsSync(filePath)) {
      res.download(filePath, doc.originalName);
    } else {
      res.status(404).json({
        success: false,
        message: 'File not found on server'
      });
    }
  } catch (error) {
    console.error('Document download error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during download'
    });
  }
});

// @route   DELETE /api/documents/:documentType
// @desc    Delete a document
// @access  Private
router.delete('/:documentType', protect, async (req, res) => {
  try {
    const { documentType } = req.params;
    const validTypes = ['legal', 'resume', 'legalDocument', 'resumeDocument'];
    
    if (!validTypes.includes(documentType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document type'
      });
    }

    const user = await User.findById(req.user._id);
    
    // Handle both formats: 'legal' -> 'legalDocument' and 'legalDocument' -> 'legalDocument'
    let docKey;
    if (documentType === 'offer') {
      docKey = 'offerDocument';
    } else if (documentType === 'resume') {
      docKey = 'resumeDocument';
    } else if (documentType === 'legalDocument' || documentType === 'resumeDocument') {
      docKey = documentType;
    }
    
    console.log(`DELETE request: documentType=${documentType}, docKey=${docKey}, user=${req.user.email}`);
    
    if (!user.documents || !user.documents[docKey] || !user.documents[docKey].filename) {
      console.log(`Document not found: ${docKey} for user ${req.user.email}`);
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    const filename = user.documents[docKey].filename;
    console.log(`Found document to delete: filename=${filename}`);
    
    // Delete file from filesystem
    const filePath = path.join('uploads', req.user._id.toString(), filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`File deleted from filesystem: ${filePath}`);
    }

    // Remove from database
    user.documents[docKey] = undefined;
    
    // Update upload status
    const hasLegal = user.documents.legalDocument && user.documents.legalDocument.filename;
    const hasResume = user.documents.resumeDocument && user.documents.resumeDocument.filename;
    user.documentsUploaded = hasLegal && hasResume;
    
    // Reset verification if documents removed
    if (!user.documentsUploaded) {
      user.documentsVerified = false;
      user.isApproved = false;
    }

    await user.save();

    res.json({
      success: true,
      message: 'Document deleted successfully',
      data: {
        documentsUploaded: user.documentsUploaded,
        documentsVerified: user.documentsVerified
      }
    });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/documents/:documentId
// @desc    Delete user document
// @access  Private
router.delete('/:documentId', protect, async (req, res) => {
  try {
    const documentId = req.params.documentId;
    console.log(`DELETION HANDLER REACHED: User=${req.user.email}, DocID=${documentId}, Approved=${req.user.isApproved}`);
    
    const user = await User.findById(req.user._id);
    if (!user) {
      console.log(`User not found for ID: ${req.user._id}`);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log(`User documents structure:`, JSON.stringify(user.documents, null, 2));
    
    // Check if the document exists and delete it
    let documentDeleted = false;
    let filePath = null;
    
    if (user.documents && user.documents[documentId]) {
      const filename = user.documents[documentId].filename;
      console.log(`Found document: ${documentId}, filename: ${filename}`);
      
      // Delete file from filesystem
      filePath = path.join('uploads', req.user._id.toString(), filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`File deleted: ${filePath}`);
      }
      
      // Remove from database
      user.documents[documentId] = undefined;
      documentDeleted = true;
    }

    if (!documentDeleted) {
      console.log(`Document not found: ${documentId} for user ${req.user.email}`);
      console.log(`Available document keys:`, Object.keys(user.documents || {}));
      return res.status(404).json({
        success: false,
        message: `Document ${documentId} not found`
      });
    }

    // Update status
    const hasResume = user.documents.resumeDocument && user.documents.resumeDocument.filename;
    const hasOffer = user.documents.offerDocument && user.documents.offerDocument.filename;
    user.documentsUploaded = !!(hasResume && hasOffer);

    await user.save();
    console.log(`Document ${documentId} deleted successfully for user ${req.user.email}`);

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('Document delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during deletion'
    });
  }
});

// @route   GET /api/documents/download/:documentId
// @desc    Download document by ID
// @access  Private
router.get('/download/:documentId', protectDocumentUpload, async (req, res) => {
  try {
    const { documentId } = req.params;
    const user = await User.findById(req.user._id);
    
    if (!user || !user.documents) {
      return res.status(404).json({
        success: false,
        message: 'No documents found'
      });
    }

    // Find document by ID across all document types
    let documentFound = null;
    let documentKey = null;
    
    // Parse documentId to match the format: docType_userId_timestamp
    if (documentId.includes('_')) {
      const parts = documentId.split('_');
      const docType = parts[0]; // resume or offer
      const userId = parts[1];
      const timestamp = parts[2];
      
      if (userId === req.user._id.toString()) {
        const docKey = docType === 'resume' ? 'resumeDocument' : 'offerDocument';
        if (user.documents && user.documents[docKey] && user.documents[docKey].filename) {
          documentFound = user.documents[docKey];
          documentKey = docKey;
        }
      }
    } else {
      // Fallback: search by actual document ID in filename
      if (user.documents) {
        Object.entries(user.documents).forEach(([key, doc]) => {
          if (doc && doc.filename && doc.filename.includes(documentId)) {
            documentFound = doc;
            documentKey = key;
          }
        });
      }
    }

    if (!documentFound || !documentFound.filename) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Construct file path based on the stored path or filename
    let filePath;
    if (documentFound.path) {
      filePath = path.join(__dirname, '..', documentFound.path);
    } else {
      // Fallback: construct path from user directory and filename
      filePath = path.join(__dirname, '..', 'uploads', req.user._id.toString(), documentFound.filename);
    }
    
    if (fs.existsSync(filePath)) {
      res.download(filePath, documentFound.originalName);
    } else {
      res.status(404).json({
        success: false,
        message: 'File not found on server'
      });
    }
  } catch (error) {
    console.error('Document download error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during download'
    });
  }
});

// @route   GET /api/documents/:type/download
// @desc    Download document by type (legacy support)
// @access  Private
router.get('/:type/download', protectDocumentUpload, async (req, res) => {
  try {
    const { type } = req.params;
    const user = await User.findById(req.user._id);
    
    if (!user || !user.documents) {
      return res.status(404).json({
        success: false,
        message: 'No documents found'
      });
    }

    const docKey = type === 'resume' ? 'resumeDocument' : 
                   type === 'legal' ? 'legalDocument' : 
                   type === 'offer' ? 'offerDocument' : null;

    if (!docKey || !user.documents[docKey] || !user.documents[docKey].filename) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    const doc = user.documents[docKey];
    const filePath = path.join(__dirname, '..', doc.path);
    
    if (fs.existsSync(filePath)) {
      res.download(filePath, doc.originalName);
    } else {
      res.status(404).json({
        success: false,
        message: 'File not found on server'
      });
    }
  } catch (error) {
    console.error('Document download error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during download'
    });
  }
});

// @route   GET /api/documents/view/:userId/:documentType
// @desc    View document
// @access  Private
router.get('/view/:userId/:documentType', protect, async (req, res) => {
  try {
    const { userId, documentType } = req.params;
    
    // Check if user is admin or viewing their own documents
    if (req.user.role !== 'admin' && req.user._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const docKey = documentType === 'resume' ? 'resumeDocument' : 
                   documentType === 'offer' ? 'offerDocument' : null;

    if (!docKey || !user.documents || !user.documents[docKey] || !user.documents[docKey].filename) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    const doc = user.documents[docKey];
    const filePath = path.join(__dirname, '..', doc.path);
    
    if (fs.existsSync(filePath)) {
      // Set appropriate content type based on file extension
      const ext = path.extname(doc.filename).toLowerCase();
      let contentType = 'application/octet-stream';
      
      if (ext === '.pdf') contentType = 'application/pdf';
      else if (['.jpg', '.jpeg'].includes(ext)) contentType = 'image/jpeg';
      else if (ext === '.png') contentType = 'image/png';
      else if (ext === '.doc') contentType = 'application/msword';
      else if (ext === '.docx') contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      
      res.set({
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${doc.originalName}"`
      });
      
      res.sendFile(path.resolve(filePath));
    } else {
      res.status(404).json({
        success: false,
        message: 'File not found on server'
      });
    }
  } catch (error) {
    console.error('Document view error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during document view'
    });
  }
});

// @route   GET /api/documents/user/:userId
// @desc    Get user documents
// @access  Private (Admin only)
router.get('/user/:userId', protect, authorizeAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select('documents documentsUploaded documentsVerified firstName lastName email');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const documents = [];
    if (user.documents) {
      Object.entries(user.documents).forEach(([key, doc]) => {
        if (doc && doc.filename && doc.filename.trim() !== '') {
          documents.push({
            id: doc.id || `${userId}_${key}`,
            type: key.replace('Document', ''),
            filename: doc.filename,
            originalName: doc.originalName,
            uploadedAt: doc.uploadedAt,
            verified: doc.verified || false,
            path: doc.path
          });
        }
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email
        },
        documents,
        documentsUploaded: user.documentsUploaded || false,
        documentsVerified: user.documentsVerified || false
      }
    });
  } catch (error) {
    console.error('Get user documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;