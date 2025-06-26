const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect, authorizeMentor } = require('../middlewares/auth');

const router = express.Router();

// @route   GET /api/availability
// @desc    Get mentor's availability
// @access  Private (Mentor only)
router.get('/', protect, authorizeMentor, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('availability');
    res.json({
      success: true,
      data: user.availability || {
        monday: { available: false, slots: [] },
        tuesday: { available: false, slots: [] },
        wednesday: { available: false, slots: [] },
        thursday: { available: false, slots: [] },
        friday: { available: false, slots: [] },
        saturday: { available: false, slots: [] },
        sunday: { available: false, slots: [] }
      }
    });
  } catch (error) {
    console.error('Get availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/availability
// @desc    Update mentor's availability
// @access  Private (Mentor only)
router.put('/', [
  protect,
  authorizeMentor,
  body('availability').isObject().withMessage('Availability must be an object')
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

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { availability: req.body.availability },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Availability updated successfully',
      data: user.availability
    });
  } catch (error) {
    console.error('Update availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/availability/slot
// @desc    Add availability slot for specific day
// @access  Private (Mentor only)
router.post('/slot', [
  protect,
  authorizeMentor,
  body('day').isIn(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']).withMessage('Valid day required'),
  body('startTime').matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid start time required (HH:MM)'),
  body('endTime').matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid end time required (HH:MM)')
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

    const { day, startTime, endTime } = req.body;
    const user = await User.findById(req.user._id);

    if (!user.availability) {
      user.availability = {};
    }
    if (!user.availability[day]) {
      user.availability[day] = { available: true, slots: [] };
    }

    // Add new slot
    user.availability[day].slots.push({
      startTime,
      endTime,
      isBooked: false
    });
    user.availability[day].available = true;

    await user.save();

    res.json({
      success: true,
      message: 'Availability slot added successfully',
      data: user.availability[day]
    });
  } catch (error) {
    console.error('Add slot error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/availability/slot
// @desc    Remove availability slot
// @access  Private (Mentor only)
router.delete('/slot', [
  protect,
  authorizeMentor,
  body('day').isIn(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']).withMessage('Valid day required'),
  body('slotIndex').isInt({ min: 0 }).withMessage('Valid slot index required')
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

    const { day, slotIndex } = req.body;
    const user = await User.findById(req.user._id);

    if (!user.availability || !user.availability[day] || !user.availability[day].slots[slotIndex]) {
      return res.status(404).json({
        success: false,
        message: 'Slot not found'
      });
    }

    user.availability[day].slots.splice(slotIndex, 1);
    
    // If no slots left, mark day as unavailable
    if (user.availability[day].slots.length === 0) {
      user.availability[day].available = false;
    }

    await user.save();

    res.json({
      success: true,
      message: 'Availability slot removed successfully',
      data: user.availability[day]
    });
  } catch (error) {
    console.error('Remove slot error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;