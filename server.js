const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
// Swagger removed to focus on core functionality
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/authRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const mentorRoutes = require('./routes/mentorRoutes');
const adminRoutes = require('./routes/adminRoutes');
const userRoutes = require('./routes/userRoutes');
const documentsRoutes = require('./routes/documents');
const skillsRoutes = require('./routes/skillsRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const messagesRoutes = require('./routes/messagesRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const sessionRequestRoutes = require('./routes/sessionRequestRoutes');
const sessionNotificationRoutes = require('./routes/sessionNotificationRoutes');
const reviewsRoutes = require('./routes/reviewsRoutes');
const searchRoutes = require('./routes/searchRoutes');

const educationRoutes = require('./routes/educationRoutes');
const experienceRoutes = require('./routes/experienceRoutes');
const availabilityRoutes = require('./routes/availabilityRoutes');
const { router: notificationsRoutes } = require('./routes/notificationsRoutes');
const sessionManagementRoutes = require('./routes/sessionManagementRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const { errorHandler } = require('./middlewares/errorHandler');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5000",
    methods: ["GET", "POST"],
    credentials: true
  }
});
const PORT = process.env.PORT || 5000;

// Trust proxy for rate limiting (required for Replit and other proxy environments)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdn.socket.io"],
      scriptSrcAttr: ["'unsafe-inline'"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"]
    }
  }
}));

// CORS configuration - Allow access from anywhere
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    success: false,
    message: 'Too many requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply rate limiting to API routes
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// Connect to MongoDB
const mongoURI = process.env.NODE_ENV === 'test' 
  ? process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/peertutoring_test'
  : process.env.MONGODB_URI || 'mongodb://localhost:27017/peertutoring';

if (process.env.NODE_ENV !== 'test') {
  mongoose.connect(mongoURI)
  .then(() => {
    console.log('MongoDB connected successfully');
    console.log(`Database: ${mongoose.connection.db.databaseName}`);
  })
  .catch(err => console.error('MongoDB connection error:', err));
}

// API documentation endpoint (simplified)
app.get('/api/docs', (req, res) => {
  res.json({
    success: true,
    message: 'MentorHub API Documentation',
    version: '1.0.0',
    endpoints: {
      auth: 'Authentication endpoints: /api/auth/*',
      users: 'User management: /api/users/*',
      documents: 'Document management: /api/documents/*',
      admin: 'Admin operations: /api/admin/*'
    }
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true,
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: process.uptime()
  });
});

// Direct document listing endpoint (bypasses middleware chain)
app.get('/api/user-documents', async (req, res) => {
  try {
    const jwt = require('jsonwebtoken');
    const User = require('./models/User');
    
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, no token'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-jwt-secret-for-testing');
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log(`Document list access for user: ${user.email}, approved: ${user.isApproved}`);

    const documents = [];
    
    if (user.documents) {
      if (user.documents.legalDocument) {
        documents.push({
          _id: `${user._id}_legalDocument`,
          documentType: 'legalDocument',
          originalName: user.documents.legalDocument.originalName || 'Legal Document',
          filename: user.documents.legalDocument.filename,
          uploadedAt: user.documents.legalDocument.uploadedAt,
          verified: user.documents.legalDocument.verified || false,
          status: user.documents.legalDocument.verified ? 'approved' : 'pending'
        });
      }
      
      if (user.documents.resume) {
        documents.push({
          _id: `${user._id}_resume`,
          documentType: 'resume',
          originalName: user.documents.resume.originalName || 'Resume',
          filename: user.documents.resume.filename,
          uploadedAt: user.documents.resume.uploadedAt,
          verified: user.documents.resume.verified || false,
          status: user.documents.resume.verified ? 'approved' : 'pending'
        });
      }
    }

    res.json({
      success: true,
      data: documents
    });
  } catch (error) {
    console.error('Get user documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Direct approval status check endpoint
app.get('/api/approval-status', async (req, res) => {
  try {
    const jwt = require('jsonwebtoken');
    const User = require('./models/User');
    
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, no token'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-jwt-secret-for-testing');
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log(`Approval status check for user: ${user.email}, approved: ${user.isApproved}`);

    // Check document status
    const hasLegalDoc = user.documents && user.documents.legalDocument && user.documents.legalDocument.filename;
    const hasResume = user.documents && user.documents.resume && user.documents.resume.filename;
    const allDocumentsUploaded = hasLegalDoc && hasResume;

    res.json({
      success: true,
      data: {
        userId: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isApproved: user.isApproved,
        documentsVerified: user.documentsVerified || false,
        allDocumentsUploaded: allDocumentsUploaded,
        documentStatus: {
          legalDocument: hasLegalDoc ? {
            uploaded: true,
            verified: user.documents.legalDocument.verified || false
          } : { uploaded: false, verified: false },
          resume: hasResume ? {
            uploaded: true,
            verified: user.documents.resume.verified || false
          } : { uploaded: false, verified: false }
        }
      }
    });
  } catch (error) {
    console.error('Get approval status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/mentors', mentorRoutes);
app.use('/api/admin', adminRoutes);

app.use('/api/documents', documentsRoutes);
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/session-requests', require('./routes/sessionRequestRoutes'));
app.use('/api/session-notifications', require('./routes/sessionNotificationRoutes'));
app.use('/api/skills', require('./routes/skillsRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));
app.use('/api/availability', require('./routes/availabilityRoutes'));
app.use('/api/reviews', require('./routes/reviewsRoutes'));
app.use('/api/messages', require('./routes/messagesRoutes'));
app.use('/api/education', require('./routes/educationRoutes'));
app.use('/api/experience', require('./routes/experienceRoutes'));
app.use('/api/search', require('./routes/searchRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/notifications', notificationsRoutes);
app.use('/api/session-management', sessionManagementRoutes);
app.use('/api/analytics', analyticsRoutes);

// Serve static frontend
app.use('/frontend', express.static('frontend'));

// Redirect root to frontend
app.get('/', (req, res) => {
  res.redirect('/frontend');
});

// API documentation endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    success: true,
    message: 'Peer Tutoring Platform API',
    version: '1.0.0',
    endpoints: {
      auth: {
        'POST /api/auth/register': 'Register a new user',
        'POST /api/auth/login': 'Login user',
        'GET /api/auth/me': 'Get current user profile',
        'PUT /api/auth/profile': 'Update user profile',
        'POST /api/auth/change-password': 'Change password',
        'POST /api/auth/logout': 'Logout user'
      },
      users: {
        'GET /api/users/search': 'Search users/mentors',
        'GET /api/users/:id': 'Get user profile',
        'GET /api/users/:id/reviews': 'Get user reviews',
        'POST /api/users/:id/follow': 'Follow/unfollow user',
        'GET /api/users': 'Get all users (admin only)'
      },
      sessions: {
        'POST /api/sessions/request': 'Create session request',
        'GET /api/sessions/requests': 'Get session requests',
        'PUT /api/sessions/requests/:id/respond': 'Respond to session request',
        'GET /api/sessions': 'Get user sessions',
        'GET /api/sessions/:id': 'Get session details',
        'PUT /api/sessions/:id/complete': 'Complete session',
        'PUT /api/sessions/:id/cancel': 'Cancel session',
        'POST /api/sessions/:id/review': 'Create session review'
      },
      mentors: {
        'GET /api/mentors': 'Get all mentors',
        'GET /api/mentors/:id': 'Get mentor profile',
        'GET /api/mentors/:id/availability': 'Get mentor availability',
        'PUT /api/mentors/profile': 'Update mentor profile',
        'GET /api/mentors/dashboard/stats': 'Get mentor dashboard stats',
        'POST /api/mentors/verify': 'Request mentor verification'
      },
      messages: {
        'POST /api/messages': 'Send a message',
        'GET /api/messages/conversations': 'Get user conversations',
        'GET /api/messages/:userId': 'Get messages with specific user',
        'PUT /api/messages/:messageId/read': 'Mark message as read',
        'PUT /api/messages/:messageId': 'Edit message',
        'DELETE /api/messages/:messageId': 'Delete message',
        'GET /api/messages/unread/count': 'Get unread message count'
      },
      admin: {
        'GET /api/admin/dashboard': 'Get admin dashboard data',
        'GET /api/admin/users': 'Get all users (admin management)',
        'GET /api/admin/users/pending': 'Get users pending approval',
        'PUT /api/admin/users/:userId/approve': 'Approve/reject user account',
        'PUT /api/admin/users/:userId/status': 'Update user status',
        'DELETE /api/admin/users/:userId': 'Delete user account',
        'GET /api/admin/sessions': 'Get all sessions (admin view)',
        'PUT /api/admin/sessions/:sessionId/status': 'Update session status',
        'GET /api/admin/reports/revenue': 'Generate revenue reports',
        'POST /api/admin/broadcast': 'Send broadcast message'
      },
      documents: {
        'POST /api/documents/upload': 'Upload documents',
        'GET /api/documents': 'Get user documents',
        'GET /api/documents/:documentId': 'Get document details',
        'GET /api/documents/:documentId/download': 'Download document',
        'PUT /api/documents/:documentId': 'Update document metadata',
        'DELETE /api/documents/:documentId': 'Delete document',
        'GET /api/documents/session/:sessionId': 'Get session documents'
      },
      upload: {
        'POST /api/upload/profile-picture': 'Upload profile picture',
        'GET /api/upload/profile-pics/:filename': 'Serve profile picture',
        'DELETE /api/upload/profile-picture': 'Delete profile picture'
      }
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false,
    message: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method,
    availableEndpoints: '/api/docs'
  });
});

// Global error handler
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  mongoose.connection.close().then(() => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  mongoose.connection.close().then(() => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
});

// Socket.IO authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication token required'));
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-jwt-secret-for-testing');
    socket.userId = decoded.userId;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`User ${socket.userId} connected to WebSocket`);

  // Join user to their own room for private notifications
  socket.join(`user_${socket.userId}`);

  // Handle typing indicators
  socket.on('typing', (data) => {
    socket.to(`conversation_${data.conversationId}`).emit('typing', {
      userId: socket.userId,
      isTyping: data.isTyping
    });
  });

  // Handle joining conversation rooms
  socket.on('join_conversation', (conversationId) => {
    socket.join(`conversation_${conversationId}`);
  });

  // Handle leaving conversation rooms
  socket.on('leave_conversation', (conversationId) => {
    socket.leave(`conversation_${conversationId}`);
  });

  // Handle new messages
  socket.on('send_message', async (messageData) => {
    try {
      // Broadcast message to conversation participants
      socket.to(`conversation_${messageData.conversationId}`).emit('new_message', {
        ...messageData,
        senderId: socket.userId,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error handling message:', error);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`User ${socket.userId} disconnected from WebSocket`);
  });
});

// Start server only if not in test environment
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
    console.log(`API documentation: http://localhost:${PORT}/api/docs`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`WebSocket server enabled`);
  });
}

module.exports = app;