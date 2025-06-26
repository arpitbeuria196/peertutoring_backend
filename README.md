# MentorHub - Peer Tutoring Platform

A comprehensive peer tutoring platform that connects students with mentors through a modern web application. Built with Node.js, Express, MongoDB, and vanilla JavaScript, it provides a complete solution for managing tutoring sessions, user verification, messaging, analytics, and administrative oversight.

## 🚀 Features

### For Students
- **Smart Mentor Discovery**: Browse and search mentors by skills, location, rating, pricing, and real-time availability
- **Session Management**: Request, schedule, join, and complete tutoring sessions with integrated video conferencing
- **Document Verification**: Upload and manage verification documents with real-time approval tracking
- **Real-time Communication**: Direct messaging system with conversation management and notifications
- **Progress Analytics**: Track learning progress, session history, and skill development
- **Review System**: Rate mentors and provide feedback for continuous quality improvement
- **Profile Management**: Comprehensive profile with skills, education, experience, and preferences

### for Mentors
- **Professional Profile**: Detailed mentor profiles with skills, experience, rates, and availability calendars
- **Session Operations**: Create, manage, approve session requests with automated student notifications
- **Student Management**: Track student progress, manage relationships, and view session history
- **Earnings Analytics**: Comprehensive revenue tracking, session analytics, and performance metrics
- **Document Portfolio**: Upload credentials, certifications, and professional documentation
- **Communication Hub**: Integrated messaging system with all platform users
- **Availability Management**: Flexible scheduling with time slots and booking preferences

### For Administrators
- **User Management**: Complete user lifecycle management with approval workflows
- **Document Verification**: Advanced document review system with approval/rejection workflows
- **Platform Analytics**: Comprehensive business intelligence with user growth, revenue, and engagement metrics
- **Content Moderation**: Review management, user monitoring, and quality assurance
- **System Configuration**: Platform settings, role management, and feature controls
- **Reporting Dashboard**: Export capabilities for business reporting and compliance

### Advanced Platform Features
- **Role-based Access Control**: Granular permissions system with feature-level security
- **Notification System**: Real-time notifications for sessions, messages, and platform updates
- **Advanced Search**: Multi-criteria search with filtering, sorting, and pagination
- **Analytics Engine**: Comprehensive analytics for users, sessions, revenue, and platform performance
- **Session Broadcasting**: Mentors can create open sessions for multiple students
- **Skills Management**: Detailed skill tracking with proficiency levels and verification

## 🛠 Technology Stack

### Backend Architecture
- **Node.js** with Express.js framework
- **MongoDB** with Mongoose ODM for data persistence
- **JWT** for stateless authentication and authorization
- **bcrypt** for secure password hashing with configurable rounds
- **Multer** for secure file upload handling with type validation
- **Express Validator** for comprehensive input validation and sanitization
- **Helmet** for security headers and protection
- **CORS** for controlled cross-origin resource sharing
- **Rate Limiting** for API protection and abuse prevention

### Frontend Architecture
- **Vanilla JavaScript** with modern ES6+ features and modules
- **Bootstrap 5.3.2** for responsive UI components and layouts
- **Font Awesome 6.4.0** for comprehensive icon library
- **Multi-page application (MPA)** with role-based routing
- **Local storage** for client-side authentication and state management
- **Progressive Web App** capabilities for enhanced user experience

### Development & Operations
- **Swagger/OpenAPI 3.0** for comprehensive API documentation
- **Jest** with Supertest for unit and integration testing
- **Nodemon** for development server with auto-reload
- **MongoDB Memory Server** for isolated testing environments
- **Comprehensive logging** for debugging and monitoring
- **Environment-based configuration** for flexible deployment

## 📋 Prerequisites

- **Node.js** 18.0 or higher
- **MongoDB** 5.0 or higher
- **npm** or **yarn** package manager
- **Git** for version control

## 🚀 Quick Start

### 1. Repository Setup
```bash
git clone https://github.com/arpitbeuria196/peertutoring_backend.git
cd peertutoring_backend
```

### 2. Dependency Installation
```bash
npm install
```

### 3. Environment Configuration
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/peertutoring
MONGODB_TEST_URI=mongodb://localhost:27017/peertutoring_test

# Authentication
JWT_SECRET=your-super-secure-jwt-secret-key
JWT_EXPIRES_IN=7d

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Server Configuration
PORT=5000
NODE_ENV=development
```

### 4. Database Setup
```bash
# Start MongoDB service
sudo systemctl start mongod

# Or using Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### 5. Application Launch
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start

# Testing mode
npm test
```

### 6. Access Points
- **Application**: http://localhost:5000
- **API Documentation**: http://localhost:5000/api/docs
- **Health Check**: http://localhost:5000/api/health
- **Admin Dashboard**: http://localhost:5000/frontend/admin-dashboard.html

## 👥 User Journey

### Student Registration & Onboarding
1. **Account Creation** - Register with email, username, and basic information
2. **Document Upload** - Upload verification documents (resume, legal ID)
3. **Admin Review** - Wait for administrator approval and document verification
4. **Dashboard Access** - Access student dashboard with full platform features
5. **Mentor Discovery** - Browse mentors using advanced search and filtering
6. **Session Booking** - Request sessions with preferred mentors and time slots
7. **Learning Journey** - Attend sessions, communicate, and track progress

### Mentor Registration & Setup
1. **Professional Registration** - Create account with mentor role and credentials
2. **Profile Development** - Complete detailed profile with skills, experience, and rates
3. **Document Verification** - Upload professional credentials and certifications
4. **Platform Approval** - Admin verification and credential review
5. **Dashboard Configuration** - Set availability, preferences, and teaching subjects
6. **Student Engagement** - Accept session requests and manage student relationships
7. **Session Delivery** - Conduct sessions and track earnings

### Administrator Workflow
1. **Platform Access** - Admin dashboard with comprehensive platform overview
2. **User Management** - Review and approve pending user registrations
3. **Document Verification** - Review uploaded documents and credentials
4. **Quality Assurance** - Monitor platform activity and user interactions
5. **Analytics Review** - Track platform performance and business metrics
6. **System Configuration** - Manage platform settings and feature controls

## 📄 Document Management System

### Supported Document Types
- **Legal Documents**: Government-issued ID, passport, driver's license, visa
- **Professional Documents**: Resume, CV, cover letter, portfolio
- **Educational Credentials**: Transcripts, certificates, diplomas, certifications
- **Verification Documents**: Professional licenses, background checks

### Upload Specifications
- **File Formats**: PDF, JPEG, PNG, DOC, DOCX
- **File Size Limit**: 10MB per document
- **Security**: Virus scanning and malware detection
- **Storage**: Encrypted file storage with access controls
- **Validation**: Automatic file type and integrity verification

### Document Workflow
1. **Upload**: Secure document upload with progress tracking
2. **Validation**: Automatic file type and size validation
3. **Storage**: Encrypted storage with unique file naming
4. **Review**: Admin verification with approval/rejection workflow
5. **Notification**: Real-time status updates to users
6. **Access**: Secure document download for approved users

## 🔗 Comprehensive API Documentation

The platform features **95+ API endpoints** organized into functional categories. Full documentation available at `/api/docs`.

### Authentication & User Management
```
POST   /api/auth/register           # User registration
POST   /api/auth/login              # User authentication
GET    /api/auth/me                 # Get current user profile
PUT    /api/auth/profile            # Update user profile  
POST   /api/auth/change-password    # Change user password
POST   /api/auth/logout             # User logout
GET    /api/auth/refresh            # Refresh JWT token
```

### User Operations
```
GET    /api/users                   # Get all users (admin only)
GET    /api/users/search            # Search users with filters
GET    /api/users/:id               # Get specific user profile
PUT    /api/users/:id               # Update user profile
DELETE /api/users/:id               # Delete user account
GET    /api/users/:id/reviews       # Get user reviews
POST   /api/users/:id/follow        # Follow/unfollow user
GET    /api/users/all               # Get all platform users
```

### Session Management
```
POST   /api/sessions                # Create new session
GET    /api/sessions                # Get user sessions
GET    /api/sessions/:id            # Get specific session
PUT    /api/sessions/:id            # Update session details
DELETE /api/sessions/:id            # Delete session
GET    /api/sessions/upcoming       # Get upcoming sessions
GET    /api/sessions/analytics/dashboard # Session analytics
POST   /api/sessions/request        # Create session request
PUT    /api/sessions/requests/:id/respond # Respond to request
```

### Advanced Session Operations
```
PUT    /api/session-management/:id/complete  # Mark session complete
PUT    /api/session-management/:id/cancel    # Cancel session
POST   /api/session-management/:id/join      # Join session
GET    /api/session-management/available     # Get available sessions
```

### Session Requests & Notifications
```
GET    /api/session-requests        # Get session requests
POST   /api/session-requests        # Create session request
PUT    /api/session-requests/:id    # Update request
DELETE /api/session-requests/:id    # Delete request
GET    /api/session-requests/pending # Get pending requests

POST   /api/session-notifications   # Create session notification
GET    /api/session-notifications   # Get notifications
PUT    /api/session-notifications/:id # Update notification
DELETE /api/session-notifications/:id # Delete notification
```

### Mentor Operations
```
GET    /api/mentors                 # Get all mentors
GET    /api/mentors/search          # Search mentors with filters
GET    /api/mentors/:id             # Get mentor profile
GET    /api/mentors/:id/students    # Get mentor's students
GET    /api/mentors/:id/sessions    # Get mentor sessions
GET    /api/mentors/:id/analytics   # Get mentor analytics
GET    /api/mentors/:id/availability # Get mentor availability
PUT    /api/mentors/:id/availability # Update availability
```

### Administrative Operations
```
GET    /api/admin/users             # Get all users for admin
PUT    /api/admin/users/:id/approve # Approve user account
PUT    /api/admin/users/:id/reject  # Reject user account
GET    /api/admin/pending-users     # Get pending approvals
GET    /api/admin/stats             # Get platform statistics
GET    /api/admin/analytics         # Get admin analytics
PUT    /api/admin/users/:id/role    # Change user role
```

### Document Management
```
GET    /api/documents-simple        # Get user documents
POST   /api/documents-simple        # Upload document
GET    /api/documents-simple/:id    # Get specific document
PUT    /api/documents-simple/:id    # Update document
DELETE /api/documents-simple/:id    # Delete document
GET    /api/user-documents          # Get documents (bypass auth)
GET    /api/approval-status         # Check approval status
```

### Skills & Profile Management
```
GET    /api/skills                  # Get user skills
POST   /api/skills                  # Add new skill
PUT    /api/skills/:id              # Update skill
DELETE /api/skills/:id              # Delete skill
POST   /api/skills/bulk             # Bulk add skills
DELETE /api/skills/bulk             # Bulk delete skills
```

### Settings & Preferences
```
GET    /api/settings                # Get user settings
PUT    /api/settings/profile        # Update profile settings
PUT    /api/settings/mentor-rates   # Update mentor rates
PUT    /api/settings/password       # Change password
PUT    /api/settings/preferences    # Update preferences
PUT    /api/settings/notifications  # Update notification settings
```

### Education & Experience
```
GET    /api/education               # Get education history
POST   /api/education               # Add education entry
PUT    /api/education/:id           # Update education
DELETE /api/education/:id           # Delete education

GET    /api/experience              # Get work experience
POST   /api/experience              # Add experience entry
PUT    /api/experience/:id          # Update experience
DELETE /api/experience/:id          # Delete experience
GET    /api/experience/summary      # Get experience summary
```

### Availability & Scheduling
```
GET    /api/availability            # Get availability slots
POST   /api/availability            # Add availability
PUT    /api/availability/:id        # Update availability
DELETE /api/availability/:id        # Delete availability
GET    /api/availability/calendar   # Get calendar view
POST   /api/availability/bulk       # Bulk update availability
```

### Messaging System
```
GET    /api/messages                # Get user messages
POST   /api/messages                # Send new message
GET    /api/messages/conversations  # Get conversations
GET    /api/messages/conversations/:id # Get conversation messages
PUT    /api/messages/:id/read       # Mark message as read
DELETE /api/messages/:id            # Delete message
```

### Reviews & Ratings
```
GET    /api/reviews                 # Get reviews
POST   /api/reviews                 # Create review
PUT    /api/reviews/:id             # Update review
DELETE /api/reviews/:id             # Delete review
GET    /api/reviews/user/:id        # Get user reviews
GET    /api/reviews/session/:id     # Get session reviews
```

### Notifications
```
GET    /api/notifications           # Get user notifications
PUT    /api/notifications/:id/read  # Mark notification as read
DELETE /api/notifications/:id       # Delete notification
GET    /api/notifications/unread-count # Get unread count
```

### Search & Discovery
```
GET    /api/search/mentors          # Search mentors
GET    /api/search/users            # Search users
GET    /api/search/sessions         # Search sessions
GET    /api/search/skills           # Search skills
```

### Analytics & Reporting
```
GET    /api/analytics/platform      # Platform-wide analytics
GET    /api/analytics/mentor/:id    # Mentor-specific analytics
GET    /api/analytics/revenue       # Revenue analytics
GET    /api/dashboard               # Get dashboard data
GET    /api/dashboard/analytics     # Dashboard analytics
```

### File Upload Operations
```
POST   /api/upload/profile-picture  # Upload profile picture
POST   /api/upload/document         # Upload document
POST   /api/upload/session-material # Upload session materials
DELETE /api/upload/:id              # Delete uploaded file
```

## 🔒 Authentication & Security

### JWT Authentication
- **Token-based authentication** with configurable expiration
- **Refresh token mechanism** for seamless user experience
- **Role-based access control** with granular permissions
- **Secure password hashing** using bcrypt with salt rounds

### Security Features
- **Rate limiting** to prevent API abuse
- **Input validation** and sanitization on all endpoints
- **CORS configuration** for controlled cross-origin access
- **Security headers** via Helmet middleware
- **File upload validation** with type and size restrictions

### Role-Based Permissions
- **Student Role**: Session booking, mentor search, profile management
- **Mentor Role**: Session management, student communication, earnings tracking
- **Admin Role**: User management, platform oversight, analytics access

## 📊 Testing & Quality Assurance

### Test Commands
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run integration tests
npm run test:integration
```

### Test Users for Development
```bash
# Create test users with sample data
node setup-test-users.js

# Seed admin account
node seed-admin.js

# Test API endpoints
node test-api-endpoints.js
```

### Available Test Accounts
- **Admin**: admin@mentorhub.com / admin123
- **Mentor**: mentor@mentorhub.com / mentor123  
- **Student**: student@mentorhub.com / student123

## 🚀 Deployment

### Development Environment
```bash
npm run dev
```

### Production Environment
```bash
npm run build
npm start
```

### Environment Variables
Ensure all required environment variables are configured:
- Database connection strings
- JWT secrets and configuration
- File upload paths and limits
- External service API keys
- Security and rate limiting settings

## 🔧 Development Commands

### Database Operations
```bash
# Connect to MongoDB
mongo mongodb://localhost:27017/mentorhub

# View collections
show collections

# Query users
db.users.find().pretty()

# Drop database (caution!)
db.dropDatabase()
```

### Server Management
```bash
# Start development server
npm run dev

# Start production server
npm start

# Check server status
curl http://localhost:5000/api/health

# View API documentation
open http://localhost:5000/api/docs
```

### Debugging & Monitoring
```bash
# View server logs
tail -f logs/server.log

# Monitor MongoDB operations
mongostat --host localhost:27017

# Check process information
ps aux | grep node
```

## 📈 Platform Analytics

### Key Metrics Tracked
- **User Growth**: Registration trends, user acquisition, retention rates
- **Session Analytics**: Booking rates, completion rates, session duration
- **Revenue Metrics**: Earnings per mentor, platform commission, payment trends
- **Engagement Metrics**: Message volume, session frequency, user activity

### Reporting Features
- **Real-time dashboards** for all user roles
- **Exportable reports** in CSV and PDF formats
- **Custom date ranges** for flexible analysis
- **Comparative analytics** for performance tracking

## 🛠 Troubleshooting

### Common Issues

**MongoDB Connection Failed**
```bash
# Check MongoDB status
sudo systemctl status mongod

# Restart MongoDB
sudo systemctl restart mongod

# Check connection string in .env
```

**JWT Token Issues**
```bash
# Verify JWT_SECRET in .env
# Check token expiration settings
# Clear localStorage in browser
```

**File Upload Problems**
```bash
# Check uploads directory permissions
chmod 755 uploads/

# Verify file size limits
# Check supported file types
```

**Port Already in Use**
```bash
# Find process using port 5000
lsof -i :5000

# Kill process
kill -9 <PID>

# Or use different port in .env
```

## 📞 Support & Contact

- **Documentation**: http://localhost:5000/api/docs
- **Health Check**: http://localhost:5000/api/health
- **GitHub Issues**: [Project Repository](https://github.com/arpitbeuria196/peertutoring_backend)
- **Email Support**: support@mentorhub.com

## 📝 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

We welcome contributions! Please read our [CONTRIBUTING.md](CONTRIBUTING.md) guide for details on our code of conduct and the process for submitting pull requests.

---

**PeerTutoring** - Connecting learners with expert mentors for transformative educational experiences.