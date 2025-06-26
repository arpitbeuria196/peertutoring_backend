const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const SessionRequest = require('../models/SessionRequest');
const User = require('../models/User');
const Session = require('../models/Session');
const { protect, authorizeStudent, authorizeMentor, authorizeStudentOrMentor } = require('../middlewares/auth');
const { validateObjectId, requirePermission } = require('../middlewares/roleBasedAccess');

const router = express.Router();

// @route   POST /api/session-requests
// @desc    Create a new session request (Students only)
// @access  Private (Student only)
router.post('/', [
  protect,
  authorizeStudent,
  requirePermission('canBookSessions'),
  body('mentorId').isMongoId().withMessage('Valid mentor ID is required'),
  body('subject').trim().isLength({ min: 1, max: 200 }).withMessage('Subject must be 1-200 characters'),
  body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),
  body('preferredDates').isArray({ min: 1, max: 5 }).withMessage('1-5 preferred dates required'),
  body('duration').isInt({ min: 30, max: 180 }).withMessage('Duration must be 30-180 minutes'),
  body('sessionType').isIn(['online', 'in-person']).withMessage('Session type must be online or in-person')
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

    const { mentorId, subject, description, preferredDates, duration, sessionType } = req.body;

    // Verify mentor exists and is active
    const mentor = await User.findOne({
      _id: mentorId,
      role: 'mentor',
      isActive: true,
      documentsVerified: true
    });

    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: 'Mentor not found or not available'
      });
    }

    // Check if student already has a pending request with this mentor
    const existingRequest = await SessionRequest.findOne({
      studentId: req.user._id,
      mentorId,
      status: 'pending'
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending request with this mentor'
      });
    }

    // Create session request
    const sessionRequest = new SessionRequest({
      studentId: req.user._id,
      mentorId,
      subject,
      description,
      preferredDates: preferredDates.map(date => new Date(date)),
      duration,
      sessionType,
      status: 'pending'
    });

    await sessionRequest.save();

    // Populate for response
    await sessionRequest.populate([
      { path: 'studentId', select: 'firstName lastName username email' },
      { path: 'mentorId', select: 'firstName lastName username email' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Session request created successfully',
      data: sessionRequest
    });
  } catch (error) {
    console.error('Create session request error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating session request'
    });
  }
});

// @route   GET /api/session-requests/student
// @desc    Get session requests for current student
// @access  Private (Student only)
router.get('/student', protect, authorizeStudent, requirePermission('canViewOwnSessions'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const requests = await SessionRequest.find({ studentId: req.user._id })
      .populate('mentorId', 'firstName lastName username profilePicture rating')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await SessionRequest.countDocuments({ studentId: req.user._id });

    res.json({
      success: true,
      data: {
        requests,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get student session requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/session-requests/mentor
// @desc    Get session requests for current mentor
// @access  Private (Mentor only)
router.get('/mentor', protect, authorizeMentor, requirePermission('canAcceptSessions'), async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = { mentorId: req.user._id };
    if (status !== 'all') {
      query.status = status;
    }

    const requests = await SessionRequest.find(query)
      .populate('studentId', 'firstName lastName username profilePicture email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await SessionRequest.countDocuments(query);

    res.json({
      success: true,
      data: {
        requests,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get mentor session requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/session-requests/:id/accept
// @desc    Accept a session request (Mentors only)
// @access  Private (Mentor only)
router.put('/:id/accept', [
  protect,
  authorizeMentor,
  requirePermission('canAcceptSessions'),
  validateObjectId('id'),
  body('scheduledDate').isISO8601().withMessage('Valid scheduled date is required'),
  body('meetingLink').optional().isURL().withMessage('Meeting link must be a valid URL')
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

    const { scheduledDate, meetingLink } = req.body;

    // Find the session request
    const sessionRequest = await SessionRequest.findOne({
      _id: req.params.id,
      mentorId: req.user._id,
      status: 'pending'
    }).populate('studentId', 'firstName lastName email');

    if (!sessionRequest) {
      return res.status(404).json({
        success: false,
        message: 'Session request not found or already processed'
      });
    }

    // Create the session
    const session = new Session({
      studentId: sessionRequest.studentId._id,
      mentorId: req.user._id,
      subject: sessionRequest.subject,
      description: sessionRequest.description,
      scheduledDate: new Date(scheduledDate),
      duration: sessionRequest.duration,
      sessionType: sessionRequest.sessionType,
      meetingLink,
      status: 'scheduled'
    });

    await session.save();

    // Update session request status
    sessionRequest.status = 'accepted';
    sessionRequest.acceptedDate = new Date();
    await sessionRequest.save();

    res.json({
      success: true,
      message: 'Session request accepted successfully',
      data: {
        sessionRequest,
        session
      }
    });
  } catch (error) {
    console.error('Accept session request error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error accepting session request'
    });
  }
});

// @route   PUT /api/session-requests/:id/reject
// @desc    Reject a session request (Mentors only)
// @access  Private (Mentor only)
router.put('/:id/reject', [
  protect,
  authorizeMentor,
  requirePermission('canAcceptSessions'),
  validateObjectId('id'),
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

    const { reason } = req.body;

    // Find and update the session request
    const sessionRequest = await SessionRequest.findOneAndUpdate(
      {
        _id: req.params.id,
        mentorId: req.user._id,
        status: 'pending'
      },
      {
        status: 'rejected',
        rejectedDate: new Date(),
        rejectionReason: reason
      },
      { new: true }
    ).populate('studentId', 'firstName lastName email');

    if (!sessionRequest) {
      return res.status(404).json({
        success: false,
        message: 'Session request not found or already processed'
      });
    }

    res.json({
      success: true,
      message: 'Session request rejected successfully',
      data: sessionRequest
    });
  } catch (error) {
    console.error('Reject session request error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error rejecting session request'
    });
  }
});

// @route   GET /api/session-requests/:id
// @desc    Get session request details
// @access  Private (Student or Mentor involved)
router.get('/:id', protect, authorizeStudentOrMentor, validateObjectId('id'), async (req, res) => {
  try {
    const sessionRequest = await SessionRequest.findById(req.params.id)
      .populate('studentId', 'firstName lastName username email profilePicture')
      .populate('mentorId', 'firstName lastName username email profilePicture rating');

    if (!sessionRequest) {
      return res.status(404).json({
        success: false,
        message: 'Session request not found'
      });
    }

    // Check if user is participant
    const isParticipant = 
      sessionRequest.studentId._id.toString() === req.user._id.toString() ||
      sessionRequest.mentorId._id.toString() === req.user._id.toString();

    if (!isParticipant && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not involved in this session request.'
      });
    }

    res.json({
      success: true,
      data: sessionRequest
    });
  } catch (error) {
    console.error('Get session request error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;