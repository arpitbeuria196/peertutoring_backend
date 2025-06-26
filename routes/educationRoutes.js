const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect } = require('../middlewares/auth');
const { validateObjectId } = require('../middlewares/roleBasedAccess');

const router = express.Router();

// @route   GET /api/education
// @desc    Get current user's education
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('education');
    res.json({
      success: true,
      data: user.education || []
    });
  } catch (error) {
    console.error('Get education error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/education
// @desc    Add education entry
// @access  Private
router.post('/', [
  protect,
  body('institution').trim().isLength({ min: 1, max: 200 }).withMessage('Institution name is required and must be less than 200 characters'),
  body('degree').optional().trim().isLength({ max: 100 }).withMessage('Degree must be less than 100 characters'),
  body('field').optional().trim().isLength({ max: 100 }).withMessage('Field must be less than 100 characters'),
  body('startDate').optional().isISO8601().withMessage('Valid start date required'),
  body('endDate').optional().isISO8601().withMessage('Valid end date required'),
  body('current').optional().isBoolean().withMessage('Current must be boolean'),
  body('gpa').optional().isFloat({ min: 0, max: 10 }).withMessage('GPA must be between 0 and 10'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description must be less than 500 characters')
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

    const user = await User.findById(req.user._id);
    
    if (!user.education) {
      user.education = [];
    }

    const educationEntry = {
      institution: req.body.institution,
      degree: req.body.degree,
      field: req.body.field,
      startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
      endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
      current: req.body.current || false,
      gpa: req.body.gpa,
      description: req.body.description
    };

    user.education.push(educationEntry);
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Education entry added successfully',
      data: user.education
    });
  } catch (error) {
    console.error('Add education error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/education/:educationId
// @desc    Update education entry
// @access  Private
router.put('/:educationId', [
  protect,
  body('institution').optional().trim().isLength({ min: 1, max: 200 }).withMessage('Institution name must be less than 200 characters'),
  body('degree').optional().trim().isLength({ max: 100 }).withMessage('Degree must be less than 100 characters'),
  body('field').optional().trim().isLength({ max: 100 }).withMessage('Field must be less than 100 characters'),
  body('startDate').optional().isISO8601().withMessage('Valid start date required'),
  body('endDate').optional().isISO8601().withMessage('Valid end date required'),
  body('current').optional().isBoolean().withMessage('Current must be boolean'),
  body('gpa').optional().isFloat({ min: 0, max: 10 }).withMessage('GPA must be between 0 and 10'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description must be less than 500 characters')
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

    const user = await User.findById(req.user._id);
    const education = user.education.id(req.params.educationId);

    if (!education) {
      return res.status(404).json({
        success: false,
        message: 'Education entry not found'
      });
    }

    // Update fields
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined) {
        if (key === 'startDate' || key === 'endDate') {
          education[key] = req.body[key] ? new Date(req.body[key]) : undefined;
        } else {
          education[key] = req.body[key];
        }
      }
    });

    await user.save();

    res.json({
      success: true,
      message: 'Education entry updated successfully',
      data: user.education
    });
  } catch (error) {
    console.error('Update education error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/education/:educationId
// @desc    Delete education entry
// @access  Private
router.delete('/:educationId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const education = user.education.id(req.params.educationId);

    if (!education) {
      return res.status(404).json({
        success: false,
        message: 'Education entry not found'
      });
    }

    education.remove();
    await user.save();

    res.json({
      success: true,
      message: 'Education entry deleted successfully',
      data: user.education
    });
  } catch (error) {
    console.error('Delete education error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/education/:educationId
// @desc    Get specific education entry
// @access  Private
router.get('/:educationId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const education = user.education.id(req.params.educationId);

    if (!education) {
      return res.status(404).json({
        success: false,
        message: 'Education entry not found'
      });
    }

    res.json({
      success: true,
      data: education
    });
  } catch (error) {
    console.error('Get education entry error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;