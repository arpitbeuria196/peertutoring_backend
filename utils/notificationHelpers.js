const Notification = require('../models/Notification');
const User = require('../models/User');

/**
 * Create and send notification to specific user
 */
async function sendNotificationToUser(recipientId, notificationData) {
  try {
    const notification = await Notification.createNotification({
      recipient: recipientId,
      ...notificationData
    });
    return notification;
  } catch (error) {
    console.error('Error sending notification to user:', error);
    return null;
  }
}

/**
 * Send notification to all students when mentor creates a session
 */
async function notifyAllStudentsOfNewSession(mentorId, sessionData) {
  try {
    // Get all approved students
    const students = await User.find({
      role: 'student',
      isApproved: true,
      _id: { $ne: mentorId } // Exclude the mentor
    }).select('_id');

    // Get mentor info
    const mentor = await User.findById(mentorId).select('firstName lastName');
    
    if (!mentor) {
      throw new Error('Mentor not found');
    }

    const notifications = [];
    
    for (const student of students) {
      const notification = await sendNotificationToUser(student._id, {
        sender: mentorId,
        type: 'session_notification',
        title: 'New Session Available',
        message: `${mentor.firstName} ${mentor.lastName} has scheduled a new session: "${sessionData.title}" on ${new Date(sessionData.scheduledAt).toLocaleDateString()} at ${new Date(sessionData.scheduledAt).toLocaleTimeString()}. Duration: ${sessionData.duration} minutes.`,
        relatedId: sessionData._id,
        relatedModel: 'Session',
        metadata: {
          sessionTitle: sessionData.title,
          sessionDate: sessionData.scheduledAt,
          duration: sessionData.duration,
          meetingLink: sessionData.meetingLink,
          description: sessionData.description,
          mentorName: `${mentor.firstName} ${mentor.lastName}`
        }
      });
      
      if (notification) {
        notifications.push(notification);
      }
    }
    
    return notifications;
  } catch (error) {
    console.error('Error notifying students of new session:', error);
    return [];
  }
}

/**
 * Send notification when session request is approved/rejected
 */
async function notifySessionRequestUpdate(studentId, mentorId, sessionRequestData, status) {
  try {
    const mentor = await User.findById(mentorId).select('firstName lastName');
    
    if (!mentor) {
      throw new Error('Mentor not found');
    }

    const isApproved = status === 'approved';
    const notification = await sendNotificationToUser(studentId, {
      sender: mentorId,
      type: isApproved ? 'session_approved' : 'session_rejected',
      title: isApproved ? 'Session Request Approved' : 'Session Request Rejected',
      message: `${mentor.firstName} ${mentor.lastName} has ${status} your session request for "${sessionRequestData.subject}".`,
      relatedId: sessionRequestData._id,
      relatedModel: 'SessionRequest',
      metadata: {
        sessionSubject: sessionRequestData.subject,
        mentorName: `${mentor.firstName} ${mentor.lastName}`,
        requestedTime: sessionRequestData.preferredTime,
        status: status
      }
    });
    
    return notification;
  } catch (error) {
    console.error('Error notifying session request update:', error);
    return null;
  }
}

/**
 * Send notification when documents are approved/rejected
 */
async function notifyDocumentStatusUpdate(userId, documentType, status, adminId = null) {
  try {
    const isApproved = status === 'approved';
    const notification = await sendNotificationToUser(userId, {
      sender: adminId,
      type: isApproved ? 'document_approved' : 'document_rejected',
      title: isApproved ? 'Document Approved' : 'Document Rejected',
      message: `Your ${documentType} document has been ${status} by our admin team.`,
      relatedId: userId,
      relatedModel: 'User',
      metadata: {
        documentType: documentType,
        status: status
      }
    });
    
    return notification;
  } catch (error) {
    console.error('Error notifying document status update:', error);
    return null;
  }
}

/**
 * Send notification when account is approved/rejected
 */
async function notifyAccountStatusUpdate(userId, status, adminId = null) {
  try {
    const isApproved = status === 'approved';
    const notification = await sendNotificationToUser(userId, {
      sender: adminId,
      type: isApproved ? 'account_approved' : 'account_rejected',
      title: isApproved ? 'Account Approved' : 'Account Rejected',
      message: isApproved 
        ? 'Congratulations! Your account has been approved. You can now access all platform features.'
        : 'Your account application has been rejected. Please contact support for more information.',
      relatedId: userId,
      relatedModel: 'User',
      metadata: {
        status: status
      }
    });
    
    return notification;
  } catch (error) {
    console.error('Error notifying account status update:', error);
    return null;
  }
}

/**
 * Send notification when a new review is received
 */
async function notifyNewReview(revieweeId, reviewerId, reviewData) {
  try {
    const reviewer = await User.findById(reviewerId).select('firstName lastName');
    
    if (!reviewer) {
      throw new Error('Reviewer not found');
    }

    const notification = await sendNotificationToUser(revieweeId, {
      sender: reviewerId,
      type: 'review_received',
      title: 'New Review Received',
      message: `${reviewer.firstName} ${reviewer.lastName} has left you a ${reviewData.rating}-star review: "${reviewData.comment}"`,
      relatedId: reviewData._id,
      relatedModel: 'Review',
      metadata: {
        rating: reviewData.rating,
        comment: reviewData.comment,
        reviewerName: `${reviewer.firstName} ${reviewer.lastName}`,
        sessionId: reviewData.sessionId
      }
    });
    
    return notification;
  } catch (error) {
    console.error('Error notifying new review:', error);
    return null;
  }
}

/**
 * Send notification for new message (if not using real-time messaging)
 */
async function notifyNewMessage(recipientId, senderId, messageContent) {
  try {
    const sender = await User.findById(senderId).select('firstName lastName');
    
    if (!sender) {
      throw new Error('Sender not found');
    }

    const notification = await sendNotificationToUser(recipientId, {
      sender: senderId,
      type: 'message_received',
      title: 'New Message',
      message: `${sender.firstName} ${sender.lastName} sent you a message: "${messageContent.substring(0, 100)}${messageContent.length > 100 ? '...' : ''}"`,
      relatedId: senderId,
      relatedModel: 'Message',
      metadata: {
        senderName: `${sender.firstName} ${sender.lastName}`,
        messagePreview: messageContent.substring(0, 100)
      }
    });
    
    return notification;
  } catch (error) {
    console.error('Error notifying new message:', error);
    return null;
  }
}

module.exports = {
  sendNotificationToUser,
  notifyAllStudentsOfNewSession,
  notifySessionRequestUpdate,
  notifyDocumentStatusUpdate,
  notifyAccountStatusUpdate,
  notifyNewReview,
  notifyNewMessage
};