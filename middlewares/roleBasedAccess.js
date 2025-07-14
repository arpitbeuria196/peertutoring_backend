const mongoose = require('mongoose');

// Role-based feature access control
const ROLE_PERMISSIONS = {
  student: {
    canBookSessions: true,
    canViewMentors: true,
    canViewOwnSessions: true,
    canReviewMentors: true,
    canUploadDocuments: true,
    canViewOwnDocuments: true,
    canSendMessages: true,
    canViewProfile: true,
    dashboardType: 'student'
  },
  mentor: {
    canAcceptSessions: true,
    canViewStudents: true,
    canViewOwnSessions: true,
    canReceiveReviews: true,
    canUploadDocuments: true,
    canViewOwnDocuments: true,
    canSendMessages: true,
    canViewProfile: true,
    canViewStats: true,
    dashboardType: 'mentor'
  },
  admin: {
    canViewAllUsers: true,
    canApproveUsers: true,
    canViewAllSessions: true,
    canViewAllDocuments: true,
    canModerateContent: true,
    canViewAnalytics: true,
    canManageSystem: true,
    dashboardType: 'admin'
  }
};

// Check if user has specific permission
const hasPermission = (userRole, permission) => {
  return ROLE_PERMISSIONS[userRole] && ROLE_PERMISSIONS[userRole][permission];
};

// Middleware to check specific permissions
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Your role (${req.user.role}) does not have permission: ${permission}`,
        requiredPermission: permission,
        userRole: req.user.role
      });
    }

    next();
  };
};

// Validate ObjectId parameters
const validateObjectId = (paramName) => {
  return (req, res, next) => {
    const id = req.params[paramName];
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: `Invalid ${paramName}. Must be a valid ObjectId.`,
        providedValue: id
      });
    }
    
    next();
  };
};

// Check resource ownership
const checkResourceOwnership = (resourceModel, resourceIdParam = 'id', ownerField = 'userId') => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[resourceIdParam];
      const resource = await resourceModel.findById(resourceId);

      if (!resource) {
        return res.status(404).json({
          success: false,
          message: 'Resource not found'
        });
      }

      // Admin can access everything
      if (req.user.role === 'admin') {
        req.resource = resource;
        return next();
      }

      // Check ownership
      const ownerId = resource[ownerField];
      if (ownerId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only access your own resources.'
        });
      }

      req.resource = resource;
      next();
    } catch (error) {
      console.error('Resource ownership check error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during access control check'
      });
    }
  };
};

// Session participant check (for students and mentors)
const checkSessionParticipant = async (req, res, next) => {
  try {
    const sessionId = req.params.id || req.params.sessionId;
    const Session = require('../models/Session');
    
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Admin can access all sessions
    if (req.user.role === 'admin') {
      req.session = session;
      return next();
    }

    // Check if user is participant
    const isParticipant = 
      session.mentorId.toString() === req.user._id.toString() ||
      session.studentId.toString() === req.user._id.toString();

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not a participant in this session.'
      });
    }

    req.session = session;
    next();
  } catch (error) {
    console.error('Session participant check error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during session access check'
    });
  }
};

module.exports = {
  ROLE_PERMISSIONS,
  hasPermission,
  requirePermission,
  validateObjectId,
  checkResourceOwnership,
  checkSessionParticipant
};