const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Peer Tutoring Platform API',
      version: '1.0.0',
      description: 'A comprehensive API for a peer tutoring platform that connects mentors with students',
      contact: {
        name: 'API Support',
        email: 'support@peertutoring.com'
      }
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' 
          ? 'https://your-domain.com/api' 
          : `http://localhost:${process.env.PORT || 5000}/api`,
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token for authentication'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '507f1f77bcf86cd799439011' },
            email: { type: 'string', format: 'email', example: 'user@example.com' },
            username: { type: 'string', example: 'johndoe' },
            firstName: { type: 'string', example: 'John' },
            lastName: { type: 'string', example: 'Doe' },
            role: { type: 'string', enum: ['student', 'mentor', 'admin'], example: 'student' },
            isVerified: { type: 'boolean', example: false },
            isApproved: { type: 'boolean', example: false },
            documentsVerified: { type: 'boolean', example: false },
            bio: { type: 'string', example: 'Passionate about learning and teaching' },
            skills: { type: 'array', items: { type: 'string' }, example: ['JavaScript', 'React'] },
            location: { type: 'string', example: 'New York, NY' },
            rating: { type: 'number', minimum: 0, maximum: 5, example: 4.5 },
            totalSessions: { type: 'number', example: 15 },
            profilePicture: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Session: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '507f1f77bcf86cd799439012' },
            title: { type: 'string', example: 'JavaScript Fundamentals Help' },
            subject: { type: 'string', example: 'JavaScript' },
            description: { type: 'string', example: 'Need help with array methods and async/await' },
            mentorId: { type: 'string', example: '507f1f77bcf86cd799439011' },
            studentId: { type: 'string', example: '507f1f77bcf86cd799439013' },
            status: { type: 'string', enum: ['pending', 'confirmed', 'completed', 'cancelled'], example: 'confirmed' },
            scheduledAt: { type: 'string', format: 'date-time' },
            duration: { type: 'number', example: 60 },
            meetingLink: { type: 'string', nullable: true },
            price: { type: 'number', example: 50 },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        SessionRequest: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '507f1f77bcf86cd799439014' },
            title: { type: 'string', example: 'React Hooks Tutorial' },
            subject: { type: 'string', example: 'React' },
            description: { type: 'string', example: 'Need help understanding useEffect and useState' },
            mentorId: { type: 'string', example: '507f1f77bcf86cd799439011' },
            studentId: { type: 'string', example: '507f1f77bcf86cd799439013' },
            status: { type: 'string', enum: ['pending', 'approved', 'rejected'], example: 'pending' },
            duration: { type: 'number', example: 90 },
            preferredTimes: { 
              type: 'array', 
              items: { type: 'string', format: 'date-time' }
            },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Document: {
          type: 'object',
          properties: {
            filename: { type: 'string', example: 'user_legalDocument_1703123456789.pdf' },
            originalName: { type: 'string', example: 'passport.pdf' },
            path: { type: 'string', example: '/uploads/documents/user_legalDocument_1703123456789.pdf' },
            uploadedAt: { type: 'string', format: 'date-time' },
            verified: { type: 'boolean', example: false },
            verifiedBy: { type: 'string', nullable: true },
            verifiedAt: { type: 'string', format: 'date-time', nullable: true }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Error description' },
            errors: { 
              type: 'array', 
              items: { 
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' }
                }
              }
            }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Operation completed successfully' },
            data: { type: 'object' }
          }
        }
      }
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization endpoints'
      },
      {
        name: 'Users',
        description: 'User management and profile operations'
      },
      {
        name: 'Sessions',
        description: 'Tutoring session management'
      },
      {
        name: 'Mentors',
        description: 'Mentor-specific operations and search'
      },
      {
        name: 'Admin',
        description: 'Administrative operations (admin only)'
      },
      {
        name: 'Upload',
        description: 'File upload operations'
      },
      {
        name: 'Messages',
        description: 'Messaging system between users'
      },
      {
        name: 'Documents',
        description: 'Document management for verification'
      }
    ]
  },
  apis: ['./routes/*.js', './models/*.js'] // paths to files containing OpenAPI definitions
};

const specs = swaggerJsdoc(options);
module.exports = specs;