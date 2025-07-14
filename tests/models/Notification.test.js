const mongoose = require('mongoose');
const Notification = require('../../models/Notification');
const User = require('../../models/User');
const Session = require('../../models/Session');

describe('Notification Model', () => {

  let recipient, sender, session;

  beforeEach(async () => {
    const recipientData = testUtils.createValidUser({
      email: 'recipient@test.com',
      username: 'recipient',
      role: 'student'
    });
    recipient = new User(recipientData);
    await recipient.save();

    const senderData = testUtils.createValidUser({
      email: 'sender@test.com',
      username: 'sender',
      role: 'mentor'
    });
    sender = new User(senderData);
    await sender.save();

    const sessionData = testUtils.createValidSession(sender._id, recipient._id);
    session = new Session(sessionData);
    await session.save();
  });

  describe('Schema Validation', () => {
    test('should create a valid notification with required fields', async () => {
      const notificationData = testUtils.createValidNotification(recipient._id);
      const notification = new Notification(notificationData);
      await expect(notification.save()).resolves.toEqual(expect.objectContaining({
        _id: expect.any(mongoose.Types.ObjectId),
        recipient: notificationData.recipient,
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        isRead: false
      }));
    });

    test('should require recipient field', async () => {
      const notificationData = testUtils.createValidNotification(recipient._id, { recipient: undefined });
      const notification = new Notification(notificationData);
      await expect(notification.save()).rejects.toThrow(/recipient.*required/i);
    });

    test('should require type field', async () => {
      const notificationData = testUtils.createValidNotification(recipient._id, { type: undefined });
      const notification = new Notification(notificationData);
      await expect(notification.save()).rejects.toThrow(/type.*required/i);
    });

    test('should require title field', async () => {
      const notificationData = testUtils.createValidNotification(recipient._id, { title: undefined });
      const notification = new Notification(notificationData);
      await expect(notification.save()).rejects.toThrow(/title.*required/i);
    });

    test('should require message field', async () => {
      const notificationData = testUtils.createValidNotification(recipient._id, { message: undefined });
      const notification = new Notification(notificationData);
      await expect(notification.save()).rejects.toThrow(/message.*required/i);
    });

    test('should validate type enum values', async () => {
      const notificationData = testUtils.createValidNotification(recipient._id, { 
        type: 'invalid_type' 
      });
      const notification = new Notification(notificationData);
      await expect(notification.save()).rejects.toThrow(/type.*not a valid enum value/i);
    });

    test('should accept valid type values', async () => {
      const types = [
        'session_request',
        'session_approved', 
        'session_rejected',
        'session_reminder',
        'session_notification',
        'document_approved',
        'document_rejected',
        'review_received',
        'message_received',
        'account_approved',
        'account_rejected'
      ];
      
      for (let i = 0; i < types.length; i++) {
        const notificationData = testUtils.createValidNotification(recipient._id, {
          type: types[i],
          title: `Test ${types[i]}`,
          message: `Test message for ${types[i]}`
        });
        const notification = new Notification(notificationData);
        await expect(notification.save()).resolves.toBeTruthy();
      }
    });

    test('should enforce maximum title length', async () => {
      const longTitle = 'a'.repeat(201);
      const notificationData = testUtils.createValidNotification(recipient._id, { title: longTitle });
      const notification = new Notification(notificationData);
      await expect(notification.save()).rejects.toThrow(/title.*Path.*longer/i);
    });

    test('should enforce maximum message length', async () => {
      const longMessage = 'a'.repeat(501);
      const notificationData = testUtils.createValidNotification(recipient._id, { message: longMessage });
      const notification = new Notification(notificationData);
      await expect(notification.save()).rejects.toThrow(/message.*Path.*longer/i);
    });

    test('should validate relatedModel enum values when provided', async () => {
      const notificationData = testUtils.createValidNotification(recipient._id, {
        relatedId: session._id,
        relatedModel: 'InvalidModel'
      });
      const notification = new Notification(notificationData);
      await expect(notification.save()).rejects.toThrow(/relatedModel.*not a valid enum value/i);
    });

    test('should accept valid relatedModel values', async () => {
      const models = ['Session', 'SessionRequest', 'Document', 'Review', 'Message', 'User'];
      
      for (let i = 0; i < models.length; i++) {
        const notificationData = testUtils.createValidNotification(recipient._id, {
          title: `Test ${models[i]}`,
          message: `Test message for ${models[i]}`,
          relatedId: session._id,
          relatedModel: models[i]
        });
        const notification = new Notification(notificationData);
        await expect(notification.save()).resolves.toBeTruthy();
      }
    });
  });

  describe('Default Values', () => {
    test('should set default values correctly', async () => {
      const notificationData = testUtils.createValidNotification(recipient._id);
      const notification = new Notification(notificationData);
      await notification.save();

      expect(notification.isRead).toBe(false);
      expect(notification.metadata).toEqual({});
      expect(notification.sender).toBeUndefined();
      expect(notification.relatedId).toBeUndefined();
      expect(notification.relatedModel).toBeUndefined();
    });

    test('should allow optional sender field', async () => {
      const notificationData = testUtils.createValidNotification(recipient._id, {
        sender: sender._id
      });
      const notification = new Notification(notificationData);
      await notification.save();

      expect(notification.sender).toEqual(sender._id);
    });

    test('should handle metadata as mixed type', async () => {
      const metadata = {
        sessionDate: '2023-12-25',
        meetingLink: 'https://meet.google.com/test',
        duration: 60,
        tags: ['urgent', 'reminder']
      };

      const notificationData = testUtils.createValidNotification(recipient._id, {
        metadata
      });
      const notification = new Notification(notificationData);
      await notification.save();

      expect(notification.metadata).toEqual(metadata);
    });
  });

  describe('References', () => {
    test('should populate recipient reference', async () => {
      const notificationData = testUtils.createValidNotification(recipient._id);
      const notification = new Notification(notificationData);
      await notification.save();

      const populatedNotification = await Notification.findById(notification._id).populate('recipient');
      expect(populatedNotification.recipient.email).toBe(recipient.email);
      expect(populatedNotification.recipient.role).toBe('student');
    });

    test('should populate sender reference when provided', async () => {
      const notificationData = testUtils.createValidNotification(recipient._id, {
        sender: sender._id
      });
      const notification = new Notification(notificationData);
      await notification.save();

      const populatedNotification = await Notification.findById(notification._id).populate('sender');
      expect(populatedNotification.sender.email).toBe(sender.email);
      expect(populatedNotification.sender.role).toBe('mentor');
    });

    test('should handle invalid ObjectId references', async () => {
      const invalidId = new mongoose.Types.ObjectId();
      const notificationData = testUtils.createValidNotification(invalidId);
      const notification = new Notification(notificationData);
      await notification.save();

      // Should save but not populate invalid reference
      const populatedNotification = await Notification.findById(notification._id).populate('recipient');
      expect(populatedNotification.recipient).toBeNull();
    });
  });

  describe('Virtual Properties', () => {
    test('should provide formatted date virtual', async () => {
      const notificationData = testUtils.createValidNotification(recipient._id);
      const notification = new Notification(notificationData);
      await notification.save();

      expect(notification.formattedDate).toBeTruthy();
      expect(typeof notification.formattedDate).toBe('string');
      expect(notification.formattedDate).toMatch(/\w+ \d{1,2}, \d{4}/); // Should match format like "Dec 25, 2023"
    });
  });

  describe('Static Methods', () => {
    test('createNotification should create and save notification', async () => {
      const notificationData = testUtils.createValidNotification(recipient._id, {
        sender: sender._id,
        type: 'session_approved',
        title: 'Session Approved',
        message: 'Your session request has been approved'
      });

      const notification = await Notification.createNotification(notificationData);

      expect(notification).toBeTruthy();
      expect(notification._id).toBeInstanceOf(mongoose.Types.ObjectId);
      expect(notification.recipient).toEqual(recipient._id);
      expect(notification.sender).toEqual(sender._id);
      expect(notification.type).toBe('session_approved');

      // Verify it was saved to database
      const foundNotification = await Notification.findById(notification._id);
      expect(foundNotification).toBeTruthy();
    });

    test('createNotification should handle errors', async () => {
      const invalidData = { recipient: 'invalid_id' }; // Missing required fields
      
      await expect(Notification.createNotification(invalidData))
        .rejects.toThrow();
    });

    test('markAsRead should mark notification as read', async () => {
      const notificationData = testUtils.createValidNotification(recipient._id);
      const notification = new Notification(notificationData);
      await notification.save();

      expect(notification.isRead).toBe(false);

      const updatedNotification = await Notification.markAsRead(notification._id, recipient._id);

      expect(updatedNotification).toBeTruthy();
      expect(updatedNotification.isRead).toBe(true);
    });

    test('markAsRead should only mark if user is recipient', async () => {
      const notificationData = testUtils.createValidNotification(recipient._id);
      const notification = new Notification(notificationData);
      await notification.save();

      // Try to mark as read with different user ID
      const result = await Notification.markAsRead(notification._id, sender._id);
      expect(result).toBeNull();

      // Original notification should remain unread
      const originalNotification = await Notification.findById(notification._id);
      expect(originalNotification.isRead).toBe(false);
    });

    test('getUnreadCount should return correct count', async () => {
      // Create multiple notifications, some read, some unread
      const notifications = [];
      for (let i = 0; i < 5; i++) {
        const notificationData = testUtils.createValidNotification(recipient._id, {
          title: `Notification ${i}`,
          message: `Message ${i}`,
          isRead: i < 2 // First two are read
        });
        const notification = new Notification(notificationData);
        await notification.save();
        notifications.push(notification);
      }

      const unreadCount = await Notification.getUnreadCount(recipient._id);
      expect(unreadCount).toBe(3); // Last 3 notifications are unread

      // Test with different user
      const otherUserCount = await Notification.getUnreadCount(sender._id);
      expect(otherUserCount).toBe(0);
    });

    test('getUnreadCount should handle errors gracefully', async () => {
      const validObjectId = new mongoose.Types.ObjectId();
      const count = await Notification.getUnreadCount(validObjectId);
      expect(count).toBe(0);
    });
  });

  describe('Indexes', () => {
    test('should have proper indexes for performance', async () => {
      // Ensure indexes are created in test environment
      await Notification.createIndexes();
      const indexes = await Notification.collection.getIndexes();
      
      // Check for recipient index (might be part of compound index)
      const hasRecipientIndex = Object.keys(indexes).some(key => 
        key.includes('recipient') || 
        (Array.isArray(indexes[key]) && indexes[key].some(field => 
          Array.isArray(field) && field[0] === 'recipient'
        ))
      );
      expect(hasRecipientIndex).toBeTruthy();

      // Check for isRead index (might be part of compound index)
      const hasIsReadIndex = Object.keys(indexes).some(key => 
        key.includes('isRead') || 
        (Array.isArray(indexes[key]) && indexes[key].some(field => 
          Array.isArray(field) && field[0] === 'isRead'
        ))
      );
      expect(hasIsReadIndex).toBeTruthy();

      // Verify we have some indexes beyond the default _id index
      expect(Object.keys(indexes).length).toBeGreaterThan(1);
    });
  });

  describe('Query Performance', () => {
    test('should efficiently query notifications by recipient and read status', async () => {
      // Create multiple notifications with different read statuses
      for (let i = 0; i < 10; i++) {
        const notificationData = testUtils.createValidNotification(recipient._id, {
          title: `Notification ${i}`,
          message: `Message ${i}`,
          isRead: i % 3 === 0 // Every third notification is read
        });
        const notification = new Notification(notificationData);
        await notification.save();
      }

      const unreadNotifications = await Notification.find({
        recipient: recipient._id,
        isRead: false
      }).sort({ createdAt: -1 });

      expect(unreadNotifications.length).toBeGreaterThan(0);
      unreadNotifications.forEach(notification => {
        expect(notification.isRead).toBe(false);
        expect(notification.recipient).toEqual(recipient._id);
      });
    });

    test('should efficiently query notifications by type', async () => {
      const types = ['session_request', 'session_approved', 'document_approved'];
      
      // Create notifications of different types
      for (let i = 0; i < types.length; i++) {
        for (let j = 0; j < 3; j++) {
          const notificationData = testUtils.createValidNotification(recipient._id, {
            type: types[i],
            title: `${types[i]} ${j}`,
            message: `Message for ${types[i]} ${j}`
          });
          const notification = new Notification(notificationData);
          await notification.save();
        }
      }

      const sessionRequestNotifications = await Notification.find({
        recipient: recipient._id,
        type: 'session_request'
      });

      expect(sessionRequestNotifications).toHaveLength(3);
      sessionRequestNotifications.forEach(notification => {
        expect(notification.type).toBe('session_request');
      });
    });

    test('should efficiently query recent notifications', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Create old notification
      const oldNotification = new Notification(testUtils.createValidNotification(recipient._id, {
        title: 'Old notification',
        message: 'This is old'
      }));
      oldNotification.createdAt = yesterday;
      await oldNotification.save();

      // Create recent notifications
      for (let i = 0; i < 3; i++) {
        const notificationData = testUtils.createValidNotification(recipient._id, {
          title: `Recent notification ${i}`,
          message: `Recent message ${i}`
        });
        const notification = new Notification(notificationData);
        await notification.save();
      }

      const recentNotifications = await Notification.find({
        recipient: recipient._id,
        createdAt: { $gte: new Date(now.getTime() - 60 * 60 * 1000) } // Last hour
      }).sort({ createdAt: -1 });

      expect(recentNotifications.length).toBeGreaterThanOrEqual(3);
      recentNotifications.forEach(notification => {
        expect(notification.createdAt.getTime()).toBeGreaterThan(now.getTime() - 60 * 60 * 1000);
      });
    });
  });

  describe('Timestamps', () => {
    test('should have createdAt and updatedAt timestamps', async () => {
      const notificationData = testUtils.createValidNotification(recipient._id);
      const notification = new Notification(notificationData);
      await notification.save();

      expect(notification.createdAt).toBeInstanceOf(Date);
      expect(notification.updatedAt).toBeInstanceOf(Date);
      expect(notification.createdAt.getTime()).toBeLessThanOrEqual(Date.now());
      expect(notification.updatedAt.getTime()).toBeLessThanOrEqual(Date.now());
    });

    test('should update updatedAt on modification', async () => {
      const notificationData = testUtils.createValidNotification(recipient._id);
      const notification = new Notification(notificationData);
      await notification.save();

      const originalUpdatedAt = notification.updatedAt;
      
      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      notification.isRead = true;
      await notification.save();

      expect(notification.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });
});