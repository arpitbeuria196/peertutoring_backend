const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
}, 30000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
}, 30000);

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});

// Test utilities
global.testUtils = {
  createValidUser: (overrides = {}) => ({
    email: 'test@example.com',
    username: 'testuser',
    password: 'password123',
    firstName: 'Test',
    lastName: 'User',
    role: 'student',
    ...overrides
  }),

  createValidSession: (mentorId, studentId = null, overrides = {}) => ({
    title: 'Test Session',
    description: 'A test tutoring session',
    mentorId,
    studentId,
    scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    duration: 60,
    meetLink: 'https://meet.google.com/test-link',
    ...overrides
  }),

  createValidMessage: (senderId, receiverId, overrides = {}) => ({
    senderId,
    receiverId,
    conversationId: `${senderId}_${receiverId}`,
    content: 'Test message content',
    ...overrides
  }),

  createValidNotification: (recipientId, overrides = {}) => ({
    recipient: recipientId,
    type: 'session_request',
    title: 'Test Notification',
    message: 'This is a test notification',
    ...overrides
  }),

  createValidReview: (sessionId, reviewerId, revieweeId, overrides = {}) => ({
    sessionId,
    reviewerId,
    revieweeId,
    rating: 5,
    comment: 'Great session!',
    ...overrides
  }),

  createValidSessionRequest: (studentId, mentorId, overrides = {}) => ({
    studentId,
    mentorId,
    subject: 'Mathematics Help',
    description: 'Need help with calculus',
    duration: 60,
    preferredTimes: [{
      date: new Date(Date.now() + 24 * 60 * 60 * 1000),
      timeSlots: [{ start: '10:00', end: '11:00' }]
    }],
    ...overrides
  }),

  createValidDocument: (uploaderId, overrides = {}) => ({
    uploaderId,
    originalName: 'test-document.pdf',
    fileName: 'test-document-123.pdf',
    mimeType: 'application/pdf',
    size: 1024,
    path: '/uploads/test-document-123.pdf',
    ...overrides
  }),

  createValidSession: (mentorId, studentId, overrides = {}) => ({
    title: 'Test Session',
    description: 'A test tutoring session',
    mentorId,
    studentId,
    scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    duration: 60,
    meetLink: 'https://meet.google.com/test-link',
    ...overrides
  })
};