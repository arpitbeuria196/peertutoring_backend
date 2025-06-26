const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect } = require('../middlewares/auth');

const router = express.Router();

// @route   GET /api/settings/profile
// @desc    Get user profile settings
// @access  Private
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json({
      success: true,
      data: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        username: user.username,
        bio: user.bio,
        phone: user.phone,
        location: user.location,
        timezone: user.timezone,
        profilePicture: user.profilePicture
      }
    });
  } catch (error) {
    console.error('Get profile settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/settings/profile
// @desc    Update profile settings
// @access  Private
router.put('/profile', [
  protect,
  body('firstName').optional().trim().isLength({ min: 1, max: 50 }).withMessage('First name must be 1-50 characters'),
  body('lastName').optional().trim().isLength({ min: 1, max: 50 }).withMessage('Last name must be 1-50 characters'),
  body('bio').optional().trim().isLength({ max: 1000 }).withMessage('Bio must be less than 1000 characters'),
  body('phone').optional().trim().isLength({ max: 20 }).withMessage('Phone must be less than 20 characters'),
  body('location').optional().trim().isLength({ max: 100 }).withMessage('Location must be less than 100 characters'),
  body('timezone').optional().isString().withMessage('Timezone must be a string')
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

    const allowedFields = ['firstName', 'lastName', 'bio', 'phone', 'location', 'timezone'];
    const updates = {};
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: user.getFullProfile()
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/settings/mentor
// @desc    Get mentor-specific settings
// @access  Private (Mentor only)
router.get('/mentor', protect, async (req, res) => {
  try {
    if (req.user.role !== 'mentor') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Mentor role required.'
      });
    }

    const user = await User.findById(req.user._id).select('hourlyRate availability specializations');
    res.json({
      success: true,
      data: {
        hourlyRate: user.hourlyRate,
        availability: user.availability,
        specializations: user.specializations
      }
    });
  } catch (error) {
    console.error('Get mentor settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/settings/mentor
// @desc    Update mentor-specific settings
// @access  Private (Mentor only)
router.put('/mentor', [
  protect,
  body('hourlyRate').optional().isFloat({ min: 0, max: 1000 }).withMessage('Hourly rate must be between 0 and 1000'),
  body('specializations').optional().isArray().withMessage('Specializations must be an array')
], async (req, res) => {
  try {
    if (req.user.role !== 'mentor') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Mentor role required.'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const allowedFields = ['hourlyRate', 'availability', 'specializations'];
    const updates = {};
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Mentor settings updated successfully',
      data: {
        hourlyRate: user.hourlyRate,
        availability: user.availability,
        specializations: user.specializations
      }
    });
  } catch (error) {
    console.error('Update mentor settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/settings/password
// @desc    Change password
// @access  Private
router.put('/password', [
  protect,
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
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

    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/settings/preferences
// @desc    Get user preferences
// @access  Private
router.get('/preferences', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('timezone language currency');
    res.json({
      success: true,
      data: {
        timezone: user.timezone || 'UTC',
        language: user.language || 'en',
        currency: user.currency || 'USD'
      }
    });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/settings/preferences
// @desc    Update user preferences
// @access  Private
router.put('/preferences', [
  protect,
  body('timezone').optional().isString().withMessage('Timezone must be a string'),
  body('language').optional().isIn(['en', 'es', 'fr', 'de', 'zh', 'ja']).withMessage('Invalid language'),
  body('currency').optional().isIn(['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'INR']).withMessage('Invalid currency')
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

    const allowedFields = ['timezone', 'language', 'currency'];
    const updates = {};
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      data: {
        timezone: user.timezone,
        language: user.language,
        currency: user.currency
      }
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;