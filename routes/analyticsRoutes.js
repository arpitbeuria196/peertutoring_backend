const express = require('express');
const mongoose = require('mongoose');
const { query, validationResult } = require('express-validator');
const User = require('../models/User');
const Session = require('../models/Session');
const SessionRequest = require('../models/SessionRequest');
const Review = require('../models/Review');
const Message = require('../models/Message');
const { protect, authorizeAdmin, authorizeMentorOrAdmin } = require('../middlewares/auth');

const router = express.Router();

/**
 * @swagger
 * /analytics/platform:
 *   get:
 *     summary: Get platform-wide analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [week, month, quarter, year]
 *           default: month
 *         description: Time period for analytics
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Custom start date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Custom end date
 *     responses:
 *       200:
 *         description: Platform analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     userGrowth:
 *                       type: object
 *                     sessionMetrics:
 *                       type: object
 *                     revenueMetrics:
 *                       type: object
 *                     engagementMetrics:
 *                       type: object
 */
router.get('/platform', protect, authorizeAdmin, [
  query('period').optional().isIn(['week', 'month', 'quarter', 'year']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
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

    const { period = 'month', startDate, endDate } = req.query;
    
    // Calculate date range
    let dateRange = {};
    if (startDate && endDate) {
      dateRange = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else {
      const now = new Date();
      let daysBack;
      switch (period) {
        case 'week': daysBack = 7; break;
        case 'month': daysBack = 30; break;
        case 'quarter': daysBack = 90; break;
        case 'year': daysBack = 365; break;
        default: daysBack = 30;
      }
      const startPeriod = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000));
      dateRange = { $gte: startPeriod, $lte: now };
    }

    // User Growth Analytics
    const userGrowth = await User.aggregate([
      {
        $match: { createdAt: dateRange }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
            role: '$role'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Session Metrics
    const sessionMetrics = await Session.aggregate([
      {
        $match: { createdAt: dateRange }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalDuration: { $sum: '$duration' },
          avgDuration: { $avg: '$duration' }
        }
      }
    ]);

    // Revenue Metrics (for completed sessions)
    const revenueMetrics = await Session.aggregate([
      {
        $match: { 
          status: 'completed',
          completedAt: dateRange
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'mentorId',
          foreignField: '_id',
          as: 'mentor'
        }
      },
      {
        $unwind: '$mentor'
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $multiply: ['$duration', { $divide: ['$mentor.hourlyRate', 60] }] } },
          totalSessions: { $sum: 1 },
          avgSessionValue: { $avg: { $multiply: ['$duration', { $divide: ['$mentor.hourlyRate', 60] }] } }
        }
      }
    ]);

    // Engagement Metrics
    const engagementMetrics = {
      activeUsers: await User.countDocuments({
        lastActive: dateRange,
        isActive: true
      }),
      totalMessages: await Message.countDocuments({
        createdAt: dateRange
      }),
      totalReviews: await Review.countDocuments({
        createdAt: dateRange
      }),
      sessionRequestRate: await SessionRequest.countDocuments({
        createdAt: dateRange,
        status: 'accepted'
      })
    };

    // Top Mentors by Sessions
    const topMentors = await Session.aggregate([
      {
        $match: { 
          status: 'completed',
          completedAt: dateRange
        }
      },
      {
        $group: {
          _id: '$mentorId',
          sessionsCount: { $sum: 1 },
          totalEarnings: { $sum: { $multiply: ['$duration', 0.5] } } // Approximate
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'mentor'
        }
      },
      {
        $unwind: '$mentor'
      },
      {
        $project: {
          mentorName: { $concat: ['$mentor.firstName', ' ', '$mentor.lastName'] },
          sessionsCount: 1,
          totalEarnings: 1,
          rating: '$mentor.rating'
        }
      },
      { $sort: { sessionsCount: -1 } },
      { $limit: 10 }
    ]);

    const analytics = {
      userGrowth,
      sessionMetrics,
      revenueMetrics: revenueMetrics[0] || { totalRevenue: 0, totalSessions: 0, avgSessionValue: 0 },
      engagementMetrics,
      topMentors,
      period,
      dateRange: {
        start: dateRange.$gte,
        end: dateRange.$lte
      }
    };

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Platform analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @swagger
 * /analytics/mentor/{mentorId}:
 *   get:
 *     summary: Get detailed mentor analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: mentorId
 *         required: true
 *         schema:
 *           type: string
 *         description: Mentor ID
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [week, month, quarter, year]
 *           default: month
 *     responses:
 *       200:
 *         description: Mentor analytics data
 */
router.get('/mentor/:mentorId', protect, authorizeMentorOrAdmin, async (req, res) => {
  try {
    const { mentorId } = req.params;
    const { period = 'month' } = req.query;

    // Verify mentor exists and user has permission
    if (req.user.role !== 'admin' && req.user._id.toString() !== mentorId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Can only view your own analytics.'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(mentorId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid mentor ID'
      });
    }

    const mentor = await User.findOne({ _id: mentorId, role: 'mentor' });
    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: 'Mentor not found'
      });
    }

    // Calculate date range
    const now = new Date();
    const daysBack = period === 'week' ? 7 : period === 'month' ? 30 : period === 'quarter' ? 90 : 365;
    const startDate = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000));

    // Session Analytics
    const sessionAnalytics = await Session.aggregate([
      {
        $match: {
          mentorId: new mongoose.Types.ObjectId(mentorId),
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalDuration: { $sum: '$duration' }
        }
      }
    ]);

    // Earnings Analytics
    const earningsAnalytics = await Session.aggregate([
      {
        $match: {
          mentorId: new mongoose.Types.ObjectId(mentorId),
          status: 'completed',
          completedAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$completedAt' },
            month: { $month: '$completedAt' },
            day: { $dayOfMonth: '$completedAt' }
          },
          dailyEarnings: { $sum: { $multiply: ['$duration', { $divide: [mentor.hourlyRate || 0, 60] }] } },
          sessionsCount: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Student Analytics
    const studentAnalytics = await Session.aggregate([
      {
        $match: {
          mentorId: new mongoose.Types.ObjectId(mentorId),
          status: { $in: ['completed', 'confirmed'] }
        }
      },
      {
        $group: {
          _id: '$studentId',
          sessionsCount: { $sum: 1 },
          totalDuration: { $sum: '$duration' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'student'
        }
      },
      {
        $unwind: '$student'
      },
      {
        $project: {
          studentName: { $concat: ['$student.firstName', ' ', '$student.lastName'] },
          sessionsCount: 1,
          totalDuration: 1
        }
      },
      { $sort: { sessionsCount: -1 } },
      { $limit: 10 }
    ]);

    // Review Analytics
    const reviewAnalytics = await Review.aggregate([
      {
        $match: {
          revieweeId: new mongoose.Types.ObjectId(mentorId),
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const analytics = {
      mentor: {
        id: mentor._id,
        name: `${mentor.firstName} ${mentor.lastName}`,
        rating: mentor.rating,
        totalSessions: mentor.totalSessions,
        hourlyRate: mentor.hourlyRate
      },
      sessionAnalytics,
      earningsAnalytics,
      studentAnalytics,
      reviewAnalytics,
      period,
      dateRange: {
        start: startDate,
        end: now
      }
    };

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Mentor analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @swagger
 * /analytics/revenue:
 *   get:
 *     summary: Get revenue analytics and reports
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [week, month, quarter, year]
 *           default: month
 *       - in: query
 *         name: breakdown
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly]
 *           default: daily
 *     responses:
 *       200:
 *         description: Revenue analytics data
 */
router.get('/revenue', protect, authorizeAdmin, async (req, res) => {
  try {
    const { period = 'month', breakdown = 'daily' } = req.query;

    // Calculate date range
    const now = new Date();
    const daysBack = period === 'week' ? 7 : period === 'month' ? 30 : period === 'quarter' ? 90 : 365;
    const startDate = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000));

    // Revenue by time period
    let groupBy = {};
    if (breakdown === 'daily') {
      groupBy = {
        year: { $year: '$completedAt' },
        month: { $month: '$completedAt' },
        day: { $dayOfMonth: '$completedAt' }
      };
    } else if (breakdown === 'weekly') {
      groupBy = {
        year: { $year: '$completedAt' },
        week: { $week: '$completedAt' }
      };
    } else {
      groupBy = {
        year: { $year: '$completedAt' },
        month: { $month: '$completedAt' }
      };
    }

    const revenueData = await Session.aggregate([
      {
        $match: {
          status: 'completed',
          completedAt: { $gte: startDate, $lte: now }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'mentorId',
          foreignField: '_id',
          as: 'mentor'
        }
      },
      {
        $unwind: '$mentor'
      },
      {
        $group: {
          _id: groupBy,
          revenue: { $sum: { $multiply: ['$duration', { $divide: ['$mentor.hourlyRate', 60] }] } },
          sessionsCount: { $sum: 1 },
          uniqueMentors: { $addToSet: '$mentorId' },
          uniqueStudents: { $addToSet: '$studentId' }
        }
      },
      {
        $addFields: {
          uniqueMentorsCount: { $size: '$uniqueMentors' },
          uniqueStudentsCount: { $size: '$uniqueStudents' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 } }
    ]);

    // Top earning mentors
    const topEarningMentors = await Session.aggregate([
      {
        $match: {
          status: 'completed',
          completedAt: { $gte: startDate, $lte: now }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'mentorId',
          foreignField: '_id',
          as: 'mentor'
        }
      },
      {
        $unwind: '$mentor'
      },
      {
        $group: {
          _id: '$mentorId',
          totalEarnings: { $sum: { $multiply: ['$duration', { $divide: ['$mentor.hourlyRate', 60] }] } },
          sessionsCount: { $sum: 1 },
          mentorName: { $first: { $concat: ['$mentor.firstName', ' ', '$mentor.lastName'] } },
          hourlyRate: { $first: '$mentor.hourlyRate' }
        }
      },
      { $sort: { totalEarnings: -1 } },
      { $limit: 10 }
    ]);

    // Revenue summary
    const revenueSummary = await Session.aggregate([
      {
        $match: {
          status: 'completed',
          completedAt: { $gte: startDate, $lte: now }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'mentorId',
          foreignField: '_id',
          as: 'mentor'
        }
      },
      {
        $unwind: '$mentor'
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $multiply: ['$duration', { $divide: ['$mentor.hourlyRate', 60] }] } },
          totalSessions: { $sum: 1 },
          avgSessionValue: { $avg: { $multiply: ['$duration', { $divide: ['$mentor.hourlyRate', 60] }] } },
          totalDuration: { $sum: '$duration' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        summary: revenueSummary[0] || { totalRevenue: 0, totalSessions: 0, avgSessionValue: 0, totalDuration: 0 },
        revenueData,
        topEarningMentors,
        period,
        breakdown,
        dateRange: {
          start: startDate,
          end: now
        }
      }
    });
  } catch (error) {
    console.error('Revenue analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;