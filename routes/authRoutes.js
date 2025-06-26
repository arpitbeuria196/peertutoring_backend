const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect, protectDocumentUpload } = require('../middlewares/auth');

const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'test-jwt-secret-for-testing', {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user with document upload
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - username
 *               - firstName
 *               - lastName
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 30
 *                 example: johndoe
 *               firstName:
 *                 type: string
 *                 maxLength: 50
 *                 example: John
 *               lastName:
 *                 type: string
 *                 maxLength: 50
 *                 example: Doe
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: password123
 *               role:
 *                 type: string
 *                 enum: [student, mentor]
 *                 default: student
 *                 example: student
 *     responses:
 *       201:
 *         description: User registered successfully, pending approval
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     requiresApproval:
 *                       type: boolean
 *                       example: true
 *       400:
 *         description: Validation error or user already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Username availability check endpoint
router.post('/check-username', [
  body('username').trim().isLength({ min: 3, max: 30 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid username',
        available: false
      });
    }

    const { username } = req.body;
    const existingUser = await User.findOne({ username });

    res.json({
      success: true,
      available: !existingUser,
      message: existingUser ? 'Username is already taken' : 'Username is available'
    });
  } catch (error) {
    console.error('Username check error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error checking username',
      available: false
    });
  }
});

router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('username').trim().isLength({ min: 3, max: 30 }),
  body('firstName').trim().isLength({ min: 1, max: 50 }),
  body('lastName').trim().isLength({ min: 1, max: 50 }),
  body('password').isLength({ min: 6 })
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

    const { email, username, firstName, lastName, password, role = 'student' } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email ? 'Email already registered' : 'Username already taken'
      });
    }

    // Create new user
    const user = new User({
      email,
      username,
      firstName,
      lastName,
      password,
      role: ['student', 'mentor'].includes(role) ? role : 'student'
    });

    await user.save();

    // Generate token for immediate document upload
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Account created successfully. Your account is pending admin approval. You will receive access once approved by an administrator.',
      user: user.getFullProfile(),
      token: token, // Include token for immediate document upload
      requiresApproval: true
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - login
 *               - password
 *             properties:
 *               login:
 *                 type: string
 *                 description: Email or username
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Account pending approval
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Error'
 *                 - type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: ACCOUNT_PENDING_APPROVAL
 *                     user:
 *                       type: object
 *                       properties:
 *                         email:
 *                           type: string
 *                         firstName:
 *                           type: string
 *                         lastName:
 *                           type: string
 *                         role:
 *                           type: string
 *                         isApproved:
 *                           type: boolean
 */
router.post('/login', [
  body('login').trim().notEmpty(),
  body('password').notEmpty()
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

    const { login, password } = req.body;

    // Find user by email or username and include password field
    const user = await User.findOne({
      $or: [
        { email: login.toLowerCase() },
        { username: login }
      ]
    }).select('+password');

    console.log('Login attempt for:', login);
    console.log('User found:', user ? user.email : 'Not found');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    console.log('Password field exists:', !!user.password);

    // Password validation with detailed logging
    let isPasswordValid = false;
    try {
      console.log('Attempting password validation...');
      console.log('User ID:', user._id);
      console.log('Hash length:', user.password?.length);
      
      isPasswordValid = await bcrypt.compare(password, user.password);
      console.log('bcrypt.compare result:', isPasswordValid);
      
      // If still failing, try the user's comparePassword method
      if (!isPasswordValid && user.comparePassword) {
        console.log('Trying user.comparePassword method...');
        isPasswordValid = await user.comparePassword(password);
        console.log('user.comparePassword result:', isPasswordValid);
      }
    } catch (error) {
      console.error('Password validation error:', error);
      isPasswordValid = false;
    }

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if account is approved (except for admins)
    if (user.role !== 'admin' && !user.isApproved) {
      // Generate token for document upload even for pending users
      const token = generateToken(user._id);
      
      return res.status(403).json({
        success: false,
        message: 'Your account is pending admin approval. Please contact an administrator for account activation.',
        code: 'ACCOUNT_PENDING_APPROVAL',
        token: token, // Provide token for document uploads
        user: {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isApproved: user.isApproved
        }
      });
    }

    // Update last active
    user.lastActive = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: user.getFullProfile()
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    res.json({
      success: true,
      user: req.user.getFullProfile()
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/auth/profile
// @desc    Get current user profile (alias for /me)
// @access  Private
router.get('/profile', protect, async (req, res) => {
  try {
    res.json({
      success: true,
      data: req.user.getFullProfile()
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/auth/profile-pending
// @desc    Get current user profile (allows pending approval users)
// @access  Private (Document Upload)
router.get('/profile-pending', protectDocumentUpload, async (req, res) => {
  try {
    res.json({
      success: true,
      data: req.user.getFullProfile()
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Send password reset email
// @access  Public
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address',
        errors: errors.array()
      });
    }

    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      // Don't reveal if email exists for security
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Set reset token and expiration (1 hour)
    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000;

    await user.save({ validateBeforeSave: false });

    // Create reset URL
    const resetUrl = `${req.protocol}://${req.get('host')}/frontend/reset-password.html?token=${resetToken}`;

    const message = `
      You are receiving this email because you (or someone else) has requested a password reset for your account.
      
      Please click on the following link to reset your password:
      ${resetUrl}
      
      This link will expire in 10 minutes.
      
      If you did not request this, please ignore this email and your password will remain unchanged.
    `;

    try {
      // In a real application, you would send an email here
      // For demo purposes, we'll return the reset URL directly
      res.json({
        success: true,
        message: 'Password reset email sent. Check your email for reset instructions.',
        resetUrl: resetUrl, // Remove this in production
        resetToken: resetToken // DEV ONLY
      });
    } catch (error) {
      console.error('Email send error:', error);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });

      return res.status(500).json({
        success: false,
        message: 'Email could not be sent'
      });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/auth/reset-password/:resettoken
// @desc    Reset password
// @access  Public
router.put('/reset-password/:resettoken', [
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
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

    const crypto = require('crypto');
    
    // Get hashed token
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.resettoken)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    }).select('+resetPasswordToken +resetPasswordExpire');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired password reset token'
      });
    }

    // Set new password
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    // Generate new JWT token
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Password reset successful',
      token,
      user: user.getFullProfile()
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', protect, [
  body('firstName').optional().trim().isLength({ min: 1, max: 50 }),
  body('lastName').optional().trim().isLength({ min: 1, max: 50 }),
  body('bio').optional().isLength({ max: 1000 }),
  body('skills').optional().custom((value) => {
    // Allow string, array, or object formats for skills
    return typeof value === 'string' || Array.isArray(value) || typeof value === 'object';
  }),
  body('location').optional().trim().isLength({ max: 100 }),
  body('hourlyRate').optional().isNumeric().isFloat({ min: 0 })
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

    const allowedUpdates = [
      'firstName', 'lastName', 'bio', 'skills', 'experience', 
      'education', 'location', 'timezone', 'hourlyRate', 'availability'
    ];

    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        // Handle skills field - convert to simple string array
        if (key === 'skills') {
          if (typeof req.body[key] === 'string') {
            // Handle comma-separated string
            updates[key] = req.body[key].split(',').map(skill => skill.trim());
          } else if (Array.isArray(req.body[key])) {
            // Handle array of strings or objects - extract names only
            updates[key] = req.body[key].map(skill => {
              if (typeof skill === 'string') {
                return skill.trim();
              } else if (skill && typeof skill === 'object' && skill.name) {
                return skill.name.toString();
              }
              return skill.toString();
            });
          } else {
            // Handle single skill
            updates[key] = [req.body[key].toString()];
          }
        } else {
          updates[key] = req.body[key];
        }
      }
    });

    console.log('Profile update - Processing updates:', JSON.stringify(updates, null, 2));
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    );

    console.log('Profile update successful for user:', req.user.email);
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: user.getFullProfile()
    });
  } catch (error) {
    console.error('Profile update error for user:', req.user.email);
    console.error('Error details:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during profile update'
    });
  }
});

// @route   POST /api/auth/change-password
// @desc    Change user password
// @access  Private
router.post('/change-password', protect, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 })
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

    // Get user with password
    const user = await User.findById(req.user._id).select('+password');

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
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during password change'
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user (client-side token removal)
// @access  Private
router.post('/logout', protect, (req, res) => {
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    success: true,
    message: 'Auth routes working',
    timestamp: new Date().toISOString()
  });
});

// @route   GET /api/auth/profile
// @desc    Get current user profile
// @access  Private
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json({
      success: true,
      user: user.getFullProfile()
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/auth/profile/:userId
// @desc    Get user profile by ID
// @access  Private
router.get('/profile/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId)
      .select('-password')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Only show approved users to non-admin users
    if (req.user.role !== 'admin' && !user.isApproved) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Forgot Password
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      // Don't reveal if email exists for security
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Set reset token and expiration (1 hour)
    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();

    // In a real app, you would send this via email
    // For now, we'll log it and return in response (DEV ONLY)
    const resetUrl = `${req.protocol}://${req.get('host')}/frontend/reset-password.html?token=${resetToken}`;
    
    console.log('Password reset URL:', resetUrl);
    console.log('Reset token:', resetToken);

    res.json({
      success: true,
      message: 'Password reset instructions have been sent to your email.',
      // DEV ONLY - remove in production
      resetUrl: resetUrl,
      resetToken: resetToken
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.'
    });
  }
});

// Reset Password
router.post('/reset-password', [
  body('token').notEmpty(),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid token or password too short'
      });
    }

    const { token, password } = req.body;
    
    // Hash token to compare with stored hash
    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: resetTokenHash,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Update password and clear reset token
    user.password = password; // Will be hashed by pre-save middleware
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.json({
      success: true,
      message: 'Password has been reset successfully. You can now login with your new password.'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.'
    });
  }
});

module.exports = router;