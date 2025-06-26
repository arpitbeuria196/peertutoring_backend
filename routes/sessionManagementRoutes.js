const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const Session = require('../models/Session');
const User = require('../models/User');
const { protect, authorizeStudentOrMentor } = require('../middlewares/auth');

const router = express.Router();

/**
 * @swagger
 * /session-management/{sessionId}/complete:
 *   put:
 *     summary: Mark session as completed
 *     tags: [Session Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Session completion notes
 *               actualDuration:
 *                 type: integer
 *                 minimum: 1
 *                 description: Actual session duration in minutes
 *     responses:
 *       200:
 *         description: Session marked as completed
 *       403:
 *         description: Not authorized to complete this session
 *       404:
 *         description: Session not found
 */
router.put('/:sessionId/complete', protect, authorizeStudentOrMentor, [
  body('notes').optional().trim().isLength({ max: 1000 }).withMessage('Notes must be less than 1000 characters'),
  body('actualDuration').optional().isInt({ min: 1 }).withMessage('Actual duration must be at least 1 minute')
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

    if (!mongoose.Types.ObjectId.isValid(req.params.sessionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session ID'
      });
    }

    const session = await Session.findById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Check if user is participant
    const isParticipant = 
      session.studentId.toString() === req.user._id.toString() ||
      session.mentorId.toString() === req.user._id.toString();

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to complete this session'
      });
    }

    const { notes, actualDuration } = req.body;

    session.status = 'completed';
    session.completedAt = new Date();
    session.completedBy = req.user._id;
    
    if (notes) session.completionNotes = notes;
    if (actualDuration) session.actualDuration = actualDuration;

    await session.save();

    res.json({
      success: true,
      message: 'Session marked as completed successfully',
      data: session
    });
  } catch (error) {
    console.error('Complete session error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @swagger
 * /session-management/{sessionId}/cancel:
 *   put:
 *     summary: Cancel a session
 *     tags: [Session Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *                 description: Reason for cancellation
 *     responses:
 *       200:
 *         description: Session cancelled successfully
 *       403:
 *         description: Not authorized to cancel this session
 *       404:
 *         description: Session not found
 */
router.put('/:sessionId/cancel', protect, authorizeStudentOrMentor, [
  body('reason').trim().isLength({ min: 1, max: 500 }).withMessage('Cancellation reason is required and must be less than 500 characters')
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

    if (!mongoose.Types.ObjectId.isValid(req.params.sessionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session ID'
      });
    }

    const session = await Session.findById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Check if user is participant
    const isParticipant = 
      session.studentId.toString() === req.user._id.toString() ||
      session.mentorId.toString() === req.user._id.toString();

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this session'
      });
    }

    if (session.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a completed session'
      });
    }

    const { reason } = req.body;

    session.status = 'cancelled';
    session.cancelledAt = new Date();
    session.cancelledBy = req.user._id;
    session.cancellationReason = reason;

    await session.save();

    // Create notification for other participant
    const Message = require('../models/Message');
    const otherParticipantId = session.studentId.toString() === req.user._id.toString() 
      ? session.mentorId 
      : session.studentId;

    const notification = new Message({
      sender: req.user._id,
      receiver: otherParticipantId,
      content: `Session "${session.title || 'Untitled'}" has been cancelled. Reason: ${reason}`,
      messageType: 'session_cancelled',
      sessionId: session._id,
      isRead: false
    });
    await notification.save();

    res.json({
      success: true,
      message: 'Session cancelled successfully',
      data: session
    });
  } catch (error) {
    console.error('Cancel session error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @swagger
 * /session-management/{sessionId}/join:
 *   post:
 *     summary: Join a session
 *     tags: [Session Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session ID
 *     responses:
 *       200:
 *         description: Successfully joined session
 *       400:
 *         description: Cannot join session (already started, full, etc.)
 *       404:
 *         description: Session not found
 */
router.post('/:sessionId/join', protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.sessionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session ID'
      });
    }

    const session = await Session.findById(req.params.sessionId)
      .populate('mentorId', 'firstName lastName username')
      .populate('studentId', 'firstName lastName username');

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    if (session.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Session has already been completed'
      });
    }

    if (session.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Session has been cancelled'
      });
    }

    // Check if session is in the past
    if (session.scheduledAt && session.scheduledAt < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Session time has passed'
      });
    }

    // Check if user is already in the session
    const isParticipant = 
      session.studentId._id.toString() === req.user._id.toString() ||
      session.mentorId._id.toString() === req.user._id.toString();

    if (isParticipant) {
      return res.json({
        success: true,
        message: 'Session joined successfully',
        data: {
          session,
          meetingLink: session.meetingLink,
          isParticipant: true
        }
      });
    }

    // For group sessions or open sessions, allow joining
    if (session.studentId._id.toString() === session.mentorId._id.toString()) {
      // This is a group session created by mentor, student can join
      session.studentId = req.user._id;
      session.status = 'confirmed';
      await session.save();

      res.json({
        success: true,
        message: 'Successfully joined the session',
        data: {
          session,
          meetingLink: session.meetingLink,
          isParticipant: true
        }
      });
    } else {
      return res.status(403).json({
        success: false,
        message: 'This session is not available for joining'
      });
    }
  } catch (error) {
    console.error('Join session error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @swagger
 * /session-management/available:
 *   get:
 *     summary: Get available sessions for students to join
 *     tags: [Session Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: subject
 *         schema:
 *           type: string
 *         description: Filter by subject
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *     responses:
 *       200:
 *         description: List of available sessions
 */
router.get('/available', protect, async (req, res) => {
  try {
    const { subject, date, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {
      status: 'pending',
      scheduledAt: { $gte: new Date() },
      // Group sessions where studentId equals mentorId (available for joining)
      $expr: { $eq: ['$studentId', '$mentorId'] }
    };

    if (subject) {
      query.subject = { $regex: subject, $options: 'i' };
    }

    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      query.scheduledAt = { $gte: startDate, $lt: endDate };
    }

    const sessions = await Session.find(query)
      .populate('mentorId', 'firstName lastName username profilePicture rating')
      .sort({ scheduledAt: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Session.countDocuments(query);

    res.json({
      success: true,
      data: {
        sessions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get available sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;