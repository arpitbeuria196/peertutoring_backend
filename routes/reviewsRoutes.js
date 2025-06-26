const express = require('express');
const mongoose = require('mongoose');
const { body, query, validationResult } = require('express-validator');
const Review = require('../models/Review');
const Session = require('../models/Session');
const User = require('../models/User');
const { protect, authorizeStudentOrMentor } = require('../middlewares/auth');
const { validateObjectId } = require('../middlewares/roleBasedAccess');

const router = express.Router();

// @route   POST /api/reviews
// @desc    Create a review
// @access  Private (Student or Mentor)
router.post('/', [
  protect,
  authorizeStudentOrMentor,
  body('sessionId').isMongoId().withMessage('Valid session ID required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().trim().isLength({ max: 1000 }).withMessage('Comment must be less than 1000 characters')
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

    const { sessionId, rating, comment } = req.body;

    // Verify session exists and user is participant
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    const isParticipant = 
      session.studentId.toString() === req.user._id.toString() ||
      session.mentorId.toString() === req.user._id.toString();

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'You can only review sessions you participated in'
      });
    }

    // Check if review already exists
    const existingReview = await Review.findOne({
      sessionId,
      reviewerId: req.user._id
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this session'
      });
    }

    // Determine who is being reviewed
    const revieweeId = session.studentId.toString() === req.user._id.toString() 
      ? session.mentorId 
      : session.studentId;

    const review = new Review({
      sessionId,
      reviewerId: req.user._id,
      revieweeId,
      rating,
      comment
    });

    await review.save();

    // Update reviewee's rating
    await updateUserRating(revieweeId);

    // Populate for response
    await review.populate([
      { path: 'reviewerId', select: 'firstName lastName username' },
      { path: 'revieweeId', select: 'firstName lastName username' },
      { path: 'sessionId', select: 'subject scheduledDate' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Review created successfully',
      data: review
    });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/reviews/user/:userId
// @desc    Get reviews for a specific user
// @access  Public
router.get('/user/:userId', validateObjectId('userId'), [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
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

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const reviews = await Review.find({ revieweeId: req.params.userId })
      .populate('reviewerId', 'firstName lastName username profilePicture')
      .populate('sessionId', 'subject scheduledDate')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Review.countDocuments({ revieweeId: req.params.userId });

    // Calculate average rating
    const avgRating = await Review.aggregate([
      { $match: { revieweeId: new mongoose.Types.ObjectId(req.params.userId) } },
      { $group: { _id: null, avgRating: { $avg: '$rating' } } }
    ]);

    res.json({
      success: true,
      data: {
        reviews,
        averageRating: avgRating.length > 0 ? avgRating[0].avgRating : 0,
        totalReviews: total,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get user reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/reviews/my-reviews
// @desc    Get reviews written by current user
// @access  Private
router.get('/my-reviews', protect, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
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

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const reviews = await Review.find({ reviewerId: req.user._id })
      .populate('revieweeId', 'firstName lastName username profilePicture')
      .populate('sessionId', 'subject scheduledDate')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Review.countDocuments({ reviewerId: req.user._id });

    res.json({
      success: true,
      data: {
        reviews,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get my reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/reviews/:id
// @desc    Update a review
// @access  Private (Review author only)
router.put('/:id', [
  protect,
  validateObjectId('id'),
  body('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().trim().isLength({ max: 1000 }).withMessage('Comment must be less than 1000 characters')
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

    const review = await Review.findOne({
      _id: req.params.id,
      reviewerId: req.user._id
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found or you are not authorized to edit it'
      });
    }

    // Update fields
    if (req.body.rating !== undefined) review.rating = req.body.rating;
    if (req.body.comment !== undefined) review.comment = req.body.comment;

    await review.save();

    // Update reviewee's rating if rating changed
    if (req.body.rating !== undefined) {
      await updateUserRating(review.revieweeId);
    }

    await review.populate([
      { path: 'reviewerId', select: 'firstName lastName username' },
      { path: 'revieweeId', select: 'firstName lastName username' },
      { path: 'sessionId', select: 'subject scheduledDate' }
    ]);

    res.json({
      success: true,
      message: 'Review updated successfully',
      data: review
    });
  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/reviews/:id
// @desc    Delete a review
// @access  Private (Review author only)
router.delete('/:id', protect, validateObjectId('id'), async (req, res) => {
  try {
    const review = await Review.findOne({
      _id: req.params.id,
      reviewerId: req.user._id
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found or you are not authorized to delete it'
      });
    }

    const revieweeId = review.revieweeId;
    await review.deleteOne();

    // Update reviewee's rating
    await updateUserRating(revieweeId);

    res.json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/reviews/session/:sessionId
// @desc    Get reviews for a specific session
// @access  Private (Session participants only)
router.get('/session/:sessionId', protect, validateObjectId('sessionId'), async (req, res) => {
  try {
    // Verify session exists and user is participant
    const session = await Session.findById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    const isParticipant = 
      session.studentId.toString() === req.user._id.toString() ||
      session.mentorId.toString() === req.user._id.toString();

    if (!isParticipant && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const reviews = await Review.find({ sessionId: req.params.sessionId })
      .populate('reviewerId', 'firstName lastName username profilePicture')
      .populate('revieweeId', 'firstName lastName username profilePicture')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: reviews
    });
  } catch (error) {
    console.error('Get session reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Helper function to update user rating
async function updateUserRating(userId) {
  try {
    const reviews = await Review.find({ revieweeId: userId });
    if (reviews.length > 0) {
      const avgRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
      await User.findByIdAndUpdate(userId, {
        rating: avgRating,
        totalReviews: reviews.length
      });
    }
  } catch (error) {
    console.error('Update user rating error:', error);
  }
}

module.exports = router;