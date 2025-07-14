const mongoose = require('mongoose');
const Message = require('../../models/Message');
const User = require('../../models/User');
const Session = require('../../models/Session');

describe('Message Model', () => {

  let sender, receiver, session;

  beforeEach(async () => {
    const senderData = testUtils.createValidUser({
      email: 'sender@test.com',
      username: 'sender',
      role: 'mentor'
    });
    sender = new User(senderData);
    await sender.save();

    const receiverData = testUtils.createValidUser({
      email: 'receiver@test.com',
      username: 'receiver',
      role: 'student'
    });
    receiver = new User(receiverData);
    await receiver.save();

    const sessionData = testUtils.createValidSession(sender._id, receiver._id);
    session = new Session(sessionData);
    await session.save();
  });

  describe('Schema Validation', () => {
    test('should create a valid message with required fields', async () => {
      const messageData = testUtils.createValidMessage(sender._id, receiver._id);
      const message = new Message(messageData);
      await expect(message.save()).resolves.toEqual(expect.objectContaining({
        _id: expect.any(mongoose.Types.ObjectId),
        senderId: messageData.senderId,
        receiverId: messageData.receiverId,
        conversationId: messageData.conversationId,
        content: messageData.content,
        messageType: 'text',
        isRead: false,
        isEdited: false
      }));
    });

    test('should require senderId field', async () => {
      const messageData = testUtils.createValidMessage(sender._id, receiver._id, { senderId: undefined });
      const message = new Message(messageData);
      await expect(message.save()).rejects.toThrow(/senderId.*required/i);
    });

    test('should require receiverId field', async () => {
      const messageData = testUtils.createValidMessage(sender._id, receiver._id, { receiverId: undefined });
      const message = new Message(messageData);
      await expect(message.save()).rejects.toThrow(/receiverId.*required/i);
    });

    test('should require conversationId field', async () => {
      const messageData = testUtils.createValidMessage(sender._id, receiver._id, { conversationId: undefined });
      const message = new Message(messageData);
      await expect(message.save()).rejects.toThrow(/conversationId.*required/i);
    });

    test('should require content field', async () => {
      const messageData = testUtils.createValidMessage(sender._id, receiver._id, { content: undefined });
      const message = new Message(messageData);
      await expect(message.save()).rejects.toThrow(/content.*required/i);
    });

    test('should enforce maximum content length', async () => {
      const longContent = 'a'.repeat(2001);
      const messageData = testUtils.createValidMessage(sender._id, receiver._id, { content: longContent });
      const message = new Message(messageData);
      await expect(message.save()).rejects.toThrow(/content.*Path.*longer/i);
    });

    test('should validate messageType enum values', async () => {
      const messageData = testUtils.createValidMessage(sender._id, receiver._id, { 
        messageType: 'invalid_type' 
      });
      const message = new Message(messageData);
      await expect(message.save()).rejects.toThrow(/messageType.*not a valid enum value/i);
    });

    test('should accept valid messageType values', async () => {
      const types = ['text', 'file', 'system'];
      for (let i = 0; i < types.length; i++) {
        const messageData = testUtils.createValidMessage(sender._id, receiver._id, {
          messageType: types[i],
          content: `Test message ${i}`,
          conversationId: `${sender._id}_${receiver._id}_${i}`
        });
        const message = new Message(messageData);
        await expect(message.save()).resolves.toBeTruthy();
      }
    });
  });

  describe('Default Values', () => {
    test('should set default values correctly', async () => {
      const messageData = testUtils.createValidMessage(sender._id, receiver._id);
      const message = new Message(messageData);
      await message.save();

      expect(message.messageType).toBe('text');
      expect(message.isRead).toBe(false);
      expect(message.isEdited).toBe(false);
      expect(message.readAt).toBeUndefined();
      expect(message.editedAt).toBeUndefined();
      expect(message.fileUrl).toBeUndefined();
      expect(message.fileName).toBeUndefined();
      expect(message.fileSize).toBeUndefined();
    });
  });

  describe('References', () => {
    test('should populate sender reference', async () => {
      const messageData = testUtils.createValidMessage(sender._id, receiver._id);
      const message = new Message(messageData);
      await message.save();

      const populatedMessage = await Message.findById(message._id).populate('senderId');
      expect(populatedMessage.senderId.email).toBe(sender.email);
      expect(populatedMessage.senderId.role).toBe('mentor');
    });

    test('should populate receiver reference', async () => {
      const messageData = testUtils.createValidMessage(sender._id, receiver._id);
      const message = new Message(messageData);
      await message.save();

      const populatedMessage = await Message.findById(message._id).populate('receiverId');
      expect(populatedMessage.receiverId.email).toBe(receiver.email);
      expect(populatedMessage.receiverId.role).toBe('student');
    });

    test('should populate session reference when provided', async () => {
      const messageData = testUtils.createValidMessage(sender._id, receiver._id, {
        sessionId: session._id
      });
      const message = new Message(messageData);
      await message.save();

      const populatedMessage = await Message.findById(message._id).populate('sessionId');
      expect(populatedMessage.sessionId.title).toBe(session.title);
      expect(populatedMessage.sessionId.mentorId).toEqual(sender._id);
    });

    test('should populate replyTo reference when provided', async () => {
      // Create original message
      const originalMessageData = testUtils.createValidMessage(sender._id, receiver._id);
      const originalMessage = new Message(originalMessageData);
      await originalMessage.save();

      // Create reply message
      const replyMessageData = testUtils.createValidMessage(receiver._id, sender._id, {
        content: 'This is a reply',
        conversationId: `${receiver._id}_${sender._id}`,
        replyTo: originalMessage._id
      });
      const replyMessage = new Message(replyMessageData);
      await replyMessage.save();

      const populatedReply = await Message.findById(replyMessage._id).populate('replyTo');
      expect(populatedReply.replyTo.content).toBe(originalMessage.content);
      expect(populatedReply.replyTo.senderId).toEqual(sender._id);
    });
  });

  describe('File Message Support', () => {
    test('should handle file messages correctly', async () => {
      const messageData = testUtils.createValidMessage(sender._id, receiver._id, {
        messageType: 'file',
        content: 'Shared a file: document.pdf',
        fileUrl: 'https://example.com/files/document.pdf',
        fileName: 'document.pdf',
        fileSize: 2048
      });
      const message = new Message(messageData);
      await message.save();

      expect(message.messageType).toBe('file');
      expect(message.fileUrl).toBe('https://example.com/files/document.pdf');
      expect(message.fileName).toBe('document.pdf');
      expect(message.fileSize).toBe(2048);
    });

    test('should handle system messages correctly', async () => {
      const messageData = testUtils.createValidMessage(sender._id, receiver._id, {
        messageType: 'system',
        content: 'Session has been scheduled for tomorrow at 10:00 AM'
      });
      const message = new Message(messageData);
      await message.save();

      expect(message.messageType).toBe('system');
      expect(message.content).toBe('Session has been scheduled for tomorrow at 10:00 AM');
    });
  });

  describe('Conversation ID Generation', () => {
    test('should generate consistent conversation ID for two users', async () => {
      const conversationId1 = Message.generateConversationId(sender._id, receiver._id);
      const conversationId2 = Message.generateConversationId(receiver._id, sender._id);
      
      expect(conversationId1).toBe(conversationId2);
      expect(conversationId1).toMatch(/^[a-f0-9]{24}_[a-f0-9]{24}$/);
    });

    test('should sort user IDs consistently', async () => {
      const userId1 = new mongoose.Types.ObjectId();
      const userId2 = new mongoose.Types.ObjectId();
      
      const conversationId1 = Message.generateConversationId(userId1, userId2);
      const conversationId2 = Message.generateConversationId(userId2, userId1);
      
      expect(conversationId1).toBe(conversationId2);
      
      // Should be in sorted order
      const [firstId, secondId] = conversationId1.split('_');
      expect(firstId <= secondId).toBe(true);
    });
  });

  describe('Message Read Functionality', () => {
    test('should mark message as read', async () => {
      const messageData = testUtils.createValidMessage(sender._id, receiver._id);
      const message = new Message(messageData);
      await message.save();

      expect(message.isRead).toBe(false);
      expect(message.readAt).toBeUndefined();

      await message.markAsRead();

      expect(message.isRead).toBe(true);
      expect(message.readAt).toBeInstanceOf(Date);
      expect(message.readAt.getTime()).toBeLessThanOrEqual(Date.now());
    });

    test('should not update readAt if already read', async () => {
      const messageData = testUtils.createValidMessage(sender._id, receiver._id);
      const message = new Message(messageData);
      await message.save();

      // Mark as read first time
      await message.markAsRead();
      const firstReadAt = message.readAt;

      // Wait and mark as read again
      await new Promise(resolve => setTimeout(resolve, 10));
      await message.markAsRead();

      expect(message.readAt).toEqual(firstReadAt);
    });
  });

  describe('Message Editing', () => {
    test('should handle message editing correctly', async () => {
      const messageData = testUtils.createValidMessage(sender._id, receiver._id);
      const message = new Message(messageData);
      await message.save();

      expect(message.isEdited).toBe(false);
      expect(message.editedAt).toBeUndefined();

      message.content = 'Edited message content';
      message.isEdited = true;
      message.editedAt = new Date();
      await message.save();

      expect(message.isEdited).toBe(true);
      expect(message.editedAt).toBeInstanceOf(Date);
      expect(message.content).toBe('Edited message content');
    });
  });

  describe('Indexes', () => {
    test('should have proper indexes for performance', async () => {
      const indexes = await Message.collection.getIndexes();
      
      // Check for compound index on conversationId and createdAt
      const conversationIndex = Object.keys(indexes).find(key => 
        indexes[key].some(field => field[0] === 'conversationId' && field[1] === 1) &&
        indexes[key].some(field => field[0] === 'createdAt' && field[1] === -1)
      );
      expect(conversationIndex).toBeTruthy();

      // Check for compound index on senderId and createdAt
      const senderIndex = Object.keys(indexes).find(key => 
        indexes[key].some(field => field[0] === 'senderId' && field[1] === 1) &&
        indexes[key].some(field => field[0] === 'createdAt' && field[1] === -1)
      );
      expect(senderIndex).toBeTruthy();

      // Check for compound index on receiverId and isRead
      const receiverReadIndex = Object.keys(indexes).find(key => 
        indexes[key].some(field => field[0] === 'receiverId' && field[1] === 1) &&
        indexes[key].some(field => field[0] === 'isRead' && field[1] === 1)
      );
      expect(receiverReadIndex).toBeTruthy();
    });

    test('should have conversationId index for efficient queries', async () => {
      const indexes = await Message.collection.getIndexes();
      const conversationIdIndex = indexes['conversationId_1'];
      expect(conversationIdIndex).toBeTruthy();
    });
  });

  describe('Query Performance', () => {
    test('should efficiently query messages by conversation', async () => {
      const conversationId = Message.generateConversationId(sender._id, receiver._id);
      
      // Create multiple messages in the conversation
      for (let i = 0; i < 5; i++) {
        const messageData = testUtils.createValidMessage(
          i % 2 === 0 ? sender._id : receiver._id,
          i % 2 === 0 ? receiver._id : sender._id,
          {
            content: `Message ${i}`,
            conversationId
          }
        );
        const message = new Message(messageData);
        await message.save();
      }

      const messages = await Message.find({ conversationId })
        .sort({ createdAt: 1 })
        .populate('senderId receiverId');

      expect(messages).toHaveLength(5);
      expect(messages[0].content).toBe('Message 0');
      expect(messages[4].content).toBe('Message 4');
      expect(messages[0].senderId.email).toBe(sender.email);
      expect(messages[1].senderId.email).toBe(receiver.email);
    });

    test('should efficiently query unread messages', async () => {
      // Create read and unread messages
      for (let i = 0; i < 3; i++) {
        const messageData = testUtils.createValidMessage(sender._id, receiver._id, {
          content: `Message ${i}`,
          conversationId: `conv_${i}`,
          isRead: i < 2 // First two are read
        });
        const message = new Message(messageData);
        await message.save();
      }

      const unreadMessages = await Message.find({
        receiverId: receiver._id,
        isRead: false
      });

      expect(unreadMessages).toHaveLength(1);
      expect(unreadMessages[0].content).toBe('Message 2');
    });

    test('should efficiently query messages by date range', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // Create messages with different timestamps
      const oldMessage = new Message(testUtils.createValidMessage(sender._id, receiver._id, {
        content: 'Old message',
        conversationId: 'conv_old'
      }));
      oldMessage.createdAt = yesterday;
      await oldMessage.save();

      const recentMessage = new Message(testUtils.createValidMessage(sender._id, receiver._id, {
        content: 'Recent message',
        conversationId: 'conv_recent'
      }));
      await recentMessage.save();

      const messages = await Message.find({
        createdAt: { $gte: yesterday, $lte: tomorrow }
      }).sort({ createdAt: -1 });

      expect(messages.length).toBeGreaterThanOrEqual(2);
      expect(messages[0].content).toBe('Recent message');
    });
  });

  describe('Timestamps', () => {
    test('should have createdAt and updatedAt timestamps', async () => {
      const messageData = testUtils.createValidMessage(sender._id, receiver._id);
      const message = new Message(messageData);
      await message.save();

      expect(message.createdAt).toBeInstanceOf(Date);
      expect(message.updatedAt).toBeInstanceOf(Date);
      expect(message.createdAt.getTime()).toBeLessThanOrEqual(Date.now());
      expect(message.updatedAt.getTime()).toBeLessThanOrEqual(Date.now());
    });

    test('should update updatedAt on modification', async () => {
      const messageData = testUtils.createValidMessage(sender._id, receiver._id);
      const message = new Message(messageData);
      await message.save();

      const originalUpdatedAt = message.updatedAt;
      
      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await message.markAsRead();

      expect(message.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });
});