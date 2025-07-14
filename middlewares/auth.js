const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    let token;

    // Get token from header or cookie
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ message: 'Not authorized, no token' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-jwt-secret-for-testing');
      req.user = await User.findById(decoded.userId);
      
      if (!req.user) {
        return res.status(401).json({ message: 'User not found' });
      }

      // Allow document operations and profile updates for all authenticated users regardless of approval status
      const isDocumentOperation = req.originalUrl.includes('/documents') || 
                                  req.originalUrl.includes('/upload') ||
                                  req.baseUrl.includes('/documents');
      
      const isProfileOperation = req.originalUrl.includes('/auth/profile') || 
                                req.originalUrl.includes('/auth/me');
      
      if (req.user.role !== 'admin' && !req.user.isApproved && !isDocumentOperation && !isProfileOperation) {
        console.log(`Blocking unapproved user for non-document/profile operation: ${req.originalUrl}`);
        return res.status(403).json({ 
          message: 'Account pending approval. Please contact an administrator for account activation.',
          code: 'ACCOUNT_PENDING_APPROVAL'
        });
      }

      if (isDocumentOperation) {
        console.log(`Allowing document operation for user: ${req.user.email}, path: ${req.originalUrl}`);
      }

      next();
    } catch (error) {
      return res.status(401).json({ message: 'Not authorized, invalid token' });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Special middleware for document uploads that allows unapproved users
const protectDocumentUpload = async (req, res, next) => {
  try {
    let token;

    // Get token from header or cookie
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'Not authorized, no token' 
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-jwt-secret-for-testing');
      req.user = await User.findById(decoded.userId);
      
      if (!req.user) {
        return res.status(401).json({ 
          success: false,
          message: 'User not found' 
        });
      }

      // Allow document upload/listing for all authenticated users (approved or not)
      // This enables users to upload and view documents immediately after registration
      console.log(`Document access allowed for user: ${req.user.email}, approved: ${req.user.isApproved}`);
      next();
    } catch (error) {
      console.error('Token verification error:', error.message);
      return res.status(401).json({ 
        success: false,
        message: 'Not authorized, invalid token',
        debug: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        message: 'Not authorized' 
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false,
        message: `Access denied. ${req.user.role} role is not authorized to access this resource`,
        allowedRoles: roles,
        userRole: req.user.role
      });
    }

    next();
  };
};

// Role-specific middleware
const authorizeStudent = authorize('student');
const authorizeMentor = authorize('mentor');
const authorizeAdmin = authorize('admin');
const authorizeMentorOrAdmin = authorize('mentor', 'admin');
const authorizeStudentOrMentor = authorize('student', 'mentor');

const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-jwt-secret-for-testing');
        req.user = await User.findById(decoded.userId);
      } catch (error) {
        // Token invalid, but continue without user
        req.user = null;
      }
    }

    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    next();
  }
};

module.exports = { 
  protect, 
  authorize, 
  optionalAuth, 
  protectDocumentUpload,
  authorizeStudent,
  authorizeMentor,
  authorizeAdmin,
  authorizeMentorOrAdmin,
  authorizeStudentOrMentor
};