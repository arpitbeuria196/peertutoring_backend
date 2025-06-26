const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const User = require('../models/User');
const Session = require('../models/Session');
const Message = require('../models/Message');
const { notifyAllStudentsOfNewSession } = require('../utils/notificationHelpers');

// @route   POST /api/session-notifications/create-session
// @desc    Create a new session and notify all students
// @access  Private (Mentors only)
router.post('/create-session', protect, async (req, res) => {
  try {
    // Verify user is a mentor
    if (req.user.role !== 'mentor') {
      return res.status(403).json({
        success: false,
        message: 'Only mentors can create sessions'
      });
    }

    const {
      title,
      description,
      date,
      time,
      duration,
      googleMeetLink,
      isGroupSession,
      maxParticipants,
      sessionType,
      subject
    } = req.body;

    // Validate required fields
    if (!title || !date || !time || !duration || !googleMeetLink) {
      return res.status(400).json({
        success: false,
        message: 'Title, date, time, duration, and Google Meet link are required'
      });
    }

    // Create the session
    const sessionDateTime = new Date(`${date}T${time}`);
    
    const newSession = new Session({
      title,
      description,
      mentorId: req.user._id,
      studentId: null, // Open session - students can join
      scheduledAt: sessionDateTime,
      duration: parseInt(duration),
      status: 'scheduled',
      meetLink: googleMeetLink,
      notes: `Group session: ${isGroupSession ? 'Yes' : 'No'}. Max participants: ${maxParticipants || 1}. Session type: ${sessionType || 'individual'}.`
    });

    const savedSession = await newSession.save();
    console.log('Session saved successfully:', savedSession._id);

    // Find all students who have had sessions with this mentor OR all students in the platform
    const mentorSessions = await Session.find({ 
      mentorId: req.user._id,
      status: { $in: ['completed', 'confirmed', 'pending'] }
    }).select('studentId');

    // Get unique student IDs from mentor's sessions
    const studentIds = new Set();
    mentorSessions.forEach(session => {
      if (session.studentId && session.studentId.toString() !== req.user._id.toString()) {
        studentIds.add(session.studentId.toString());
      }
    });

    // If no students found from sessions, get all students from platform
    if (studentIds.size === 0) {
      const allStudents = await User.find({ 
        role: 'student',
        isApproved: true,
        documentsVerified: true
      }).select('_id');
      
      allStudents.forEach(student => {
        studentIds.add(student._id.toString());
      });
    }

    // Convert Set to Array
    const uniqueStudentIds = Array.from(studentIds);
    console.log(`Found ${uniqueStudentIds.length} students to notify:`, uniqueStudentIds);

    // Create notifications for all students using the new Notification model
    const Notification = require('../models/Notification');
    const notifications = [];
    
    for (const studentId of uniqueStudentIds) {
      const notification = await Notification.createNotification({
        recipient: studentId,
        sender: req.user._id,
        type: 'session_notification',
        title: 'New Session Available',
        message: `${req.user.firstName} ${req.user.lastName} has scheduled a new session: "${title}" on ${new Date(sessionDateTime).toLocaleDateString()} at ${new Date(sessionDateTime).toLocaleTimeString()}. Duration: ${duration} minutes.`,
        relatedId: savedSession._id,
        relatedModel: 'Session',
        metadata: {
          sessionTitle: title,
          sessionDate: sessionDateTime,
          duration: duration,
          meetLink: googleMeetLink,
          description: description
        }
      });
      
      if (notification) {
        notifications.push(notification);
      }
      
      // Also create a legacy message for backward compatibility
      const notificationMessage = new Message({
        sender: req.user._id,
        receiver: studentId,
        content: `New Session Available!\n\n${req.user.firstName} ${req.user.lastName} has scheduled a new session:\n\n${title}\nDate: ${new Date(sessionDateTime).toLocaleDateString()}\nTime: ${new Date(sessionDateTime).toLocaleTimeString()}\nDuration: ${duration} minutes\n\n${description ? `Description: ${description}\n\n` : ''}Meet Link: ${googleMeetLink}\n\nClick here to join this session!`,
        messageType: 'session_notification',
        sessionId: savedSession._id,
        isRead: false,
        sentAt: new Date()
      });

      await notificationMessage.save();
      notifications.push(notificationMessage);
    }

    // Format response data
    const responseData = {
      session: {
        id: newSession._id,
        title: newSession.title,
        description: newSession.description,
        date: sessionDateTime,
        duration: newSession.duration,
        googleMeetLink: newSession.meetingLink,
        subject: newSession.subject,
        status: newSession.status
      },
      notificationsSent: notifications.length,
      studentsNotified: uniqueStudentIds.length
    };

    console.log(`Session created by ${req.user.email}: ${title} on ${date} at ${time}`);
    console.log(`Notifications sent to ${notifications.length} students`);

    res.status(201).json({
      success: true,
      message: 'Session created and notifications sent successfully',
      data: responseData
    });

  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating session'
    });
  }
});

// @route   GET /api/session-notifications/my-sessions
// @desc    Get mentor's created sessions
// @access  Private (Mentors only)
router.get('/my-sessions', protect, async (req, res) => {
  try {
    if (req.user.role !== 'mentor') {
      return res.status(403).json({
        success: false,
        message: 'Only mentors can view their sessions'
      });
    }

    const sessions = await Session.find({ mentor: req.user._id })
      .populate('students', 'firstName lastName email')
      .sort({ date: 1 });

    res.json({
      success: true,
      data: sessions
    });

  } catch (error) {
    console.error('Get mentor sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching sessions'
    });
  }
});

// @route   POST /api/session-notifications/join-session/:sessionId
// @desc    Allow student to join a session
// @access  Private (Students only)
router.post('/join-session/:sessionId', protect, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Only students can join sessions'
      });
    }

    const session = await Session.findById(req.params.sessionId)
      .populate('mentor', 'firstName lastName email');

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Check if session is full (for group sessions)
    if (session.isGroupSession && session.students.length >= session.maxParticipants) {
      return res.status(400).json({
        success: false,
        message: 'Session is full'
      });
    }

    // Check if student is already joined
    if (session.students.includes(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'You are already registered for this session'
      });
    }

    // Add student to session
    session.students.push(req.user._id);
    await session.save();

    // Send confirmation message to student
    const confirmationMessage = new Message({
      sender: session.mentor._id,
      receiver: req.user._id,
      content: `✅ Session Registration Confirmed!\n\nYou have successfully registered for:\n\n📚 ${session.title}\n📅 ${session.date.toLocaleDateString()}\n⏰ ${session.date.toLocaleTimeString()}\n⏱️ Duration: ${session.duration} minutes\n\n🔗 Google Meet: ${session.googleMeetLink}\n\nSee you there!`,
      messageType: 'session_confirmation',
      sessionId: session._id,
      isRead: false,
      sentAt: new Date()
    });

    await confirmationMessage.save();

    // Send notification to mentor about new student joining
    const mentorNotification = new Message({
      sender: req.user._id,
      receiver: session.mentor._id,
      content: `👋 New Student Joined!\n\n${req.user.firstName} ${req.user.lastName} has joined your session:\n\n📚 ${session.title}\n📅 ${session.date.toLocaleDateString()}\n⏰ ${session.date.toLocaleTimeString()}\n\nTotal participants: ${session.students.length}${session.isGroupSession ? `/${session.maxParticipants}` : ''}`,
      messageType: 'mentor_notification',
      sessionId: session._id,
      isRead: false,
      sentAt: new Date()
    });

    await mentorNotification.save();

    console.log(`Student ${req.user.email} joined session: ${session.title}`);

    res.json({
      success: true,
      message: 'Successfully joined session',
      data: {
        session: {
          id: session._id,
          title: session.title,
          date: session.date,
          duration: session.duration,
          googleMeetLink: session.googleMeetLink,
          mentor: {
            name: `${session.mentor.firstName} ${session.mentor.lastName}`,
            email: session.mentor.email
          }
        }
      }
    });

  } catch (error) {
    console.error('Join session error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error joining session'
    });
  }
});

// @route   GET /api/session-notifications/available-sessions
// @desc    Get available sessions for students
// @access  Private (Students only)
router.get('/available-sessions', protect, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Only students can view available sessions'
      });
    }

    // Find sessions that are scheduled and in the future
    const sessions = await Session.find({
      status: 'scheduled',
      scheduledAt: { $gte: new Date() } // Only future sessions
    })
    .populate('mentorId', 'firstName lastName profilePicture rating')
    .sort({ scheduledAt: 1 });

    // Filter out sessions the student has already joined
    const availableSessions = sessions.filter(session => {
      // For group sessions, check if not full and student not already joined
      if (session.isGroupSession) {
        const studentsCount = session.students ? session.students.length : 0;
        const maxParticipants = session.maxParticipants || 1;
        return studentsCount < maxParticipants && 
               (!session.students || !session.students.includes(req.user._id));
      }
      // For individual sessions, check if no student assigned or not this student
      return !session.studentId || session.studentId.toString() !== req.user._id.toString();
    });

    res.json({
      success: true,
      data: availableSessions
    });

  } catch (error) {
    console.error('Get available sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching available sessions'
    });
  }
});

// @route   DELETE /api/session-notifications/cancel-session/:sessionId
// @desc    Cancel a session and notify students
// @access  Private (Mentors only)
router.delete('/cancel-session/:sessionId', protect, async (req, res) => {
  try {
    if (req.user.role !== 'mentor') {
      return res.status(403).json({
        success: false,
        message: 'Only mentors can cancel sessions'
      });
    }

    const session = await Session.findById(req.params.sessionId)
      .populate('students', 'firstName lastName email');

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    if (session.mentor.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only cancel your own sessions'
      });
    }

    const { reason } = req.body;

    // Update session status
    session.status = 'cancelled';
    session.cancellationReason = reason || 'Cancelled by mentor';
    session.cancelledAt = new Date();
    await session.save();

    // Notify all students about cancellation
    const cancellationNotifications = [];
    for (const student of session.students) {
      const notification = new Message({
        sender: req.user._id,
        receiver: student._id,
        content: `❌ Session Cancelled\n\nUnfortunately, the following session has been cancelled:\n\n📚 ${session.title}\n📅 ${session.date.toLocaleDateString()}\n⏰ ${session.date.toLocaleTimeString()}\n\n${reason ? `Reason: ${reason}\n\n` : ''}We apologize for any inconvenience. Please check for alternative sessions or contact your mentor for rescheduling.`,
        messageType: 'session_cancellation',
        sessionId: session._id,
        isRead: false,
        sentAt: new Date()
      });

      await notification.save();
      cancellationNotifications.push(notification);
    }

    console.log(`Session cancelled by ${req.user.email}: ${session.title}`);
    console.log(`Cancellation notifications sent to ${cancellationNotifications.length} students`);

    res.json({
      success: true,
      message: 'Session cancelled and students notified',
      data: {
        sessionId: session._id,
        notificationsSent: cancellationNotifications.length
      }
    });

  } catch (error) {
    console.error('Cancel session error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error cancelling session'
    });
  }
});

module.exports = router;