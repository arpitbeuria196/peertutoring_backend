// Role-based permission system for frontend
const ROLE_PERMISSIONS = {
  student: {
    canBookSessions: true,
    canViewMentors: true,
    canViewOwnSessions: true,
    canReviewMentors: true,
    canUploadDocuments: true,
    canViewOwnDocuments: true,
    canSendMessages: true,
    canViewProfile: true,
    dashboardType: 'student',
    navigationItems: ['dashboard', 'mentors', 'sessions', 'messages', 'documents', 'profile']
  },
  mentor: {
    canAcceptSessions: true,
    canViewStudents: true,
    canViewOwnSessions: true,
    canReceiveReviews: true,
    canUploadDocuments: true,
    canViewOwnDocuments: true,
    canSendMessages: true,
    canViewProfile: true,
    canViewStats: true,
    dashboardType: 'mentor',
    navigationItems: ['dashboard', 'sessions', 'students', 'messages', 'documents', 'profile', 'analytics']
  },
  admin: {
    canViewAllUsers: true,
    canApproveUsers: true,
    canViewAllSessions: true,
    canViewAllDocuments: true,
    canModerateContent: true,
    canViewAnalytics: true,
    canManageSystem: true,
    dashboardType: 'admin',
    navigationItems: ['dashboard', 'users', 'sessions', 'documents', 'analytics', 'settings']
  }
};

// Get current user's role and permissions
async function getCurrentUserPermissions() {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('No authentication token');
    }

    const response = await fetch(`${getApiBaseUrl()}/api/dashboard/permissions`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      return data.data;
    } else {
      throw new Error('Failed to fetch permissions');
    }
  } catch (error) {
    console.error('Permission check error:', error);
    return null;
  }
}

// Check if current user has specific permission
function hasPermission(userRole, permission) {
  return ROLE_PERMISSIONS[userRole] && ROLE_PERMISSIONS[userRole][permission];
}

// Hide/show elements based on user role
function applyRoleBasedVisibility(userRole) {
  const permissions = ROLE_PERMISSIONS[userRole];
  if (!permissions) return;

  // Hide features not available to this role
  const featureElements = {
    'mentor-features': ['mentor'],
    'student-features': ['student'],
    'admin-features': ['admin'],
    'booking-features': ['student'],
    'session-management': ['mentor', 'admin'],
    'user-management': ['admin'],
    'analytics-features': ['mentor', 'admin'],
    'document-approval': ['admin']
  };

  Object.entries(featureElements).forEach(([elementClass, allowedRoles]) => {
    const elements = document.querySelectorAll(`.${elementClass}`);
    elements.forEach(element => {
      if (allowedRoles.includes(userRole)) {
        element.style.display = '';
        element.classList.remove('hidden');
      } else {
        element.style.display = 'none';
        element.classList.add('hidden');
      }
    });
  });

  // Filter navigation items
  const navItems = document.querySelectorAll('[data-nav-item]');
  navItems.forEach(item => {
    const navItem = item.getAttribute('data-nav-item');
    if (permissions.navigationItems.includes(navItem)) {
      item.style.display = '';
      item.classList.remove('hidden');
    } else {
      item.style.display = 'none';
      item.classList.add('hidden');
    }
  });
}

// Redirect if user doesn't have access to current page
function enforceRoleBasedAccess(requiredRole = null, requiredPermission = null) {
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  const userRole = currentUser.role;

  if (requiredRole && userRole !== requiredRole) {
    redirectToAppropriateDashboard(userRole);
    return false;
  }

  if (requiredPermission && !hasPermission(userRole, requiredPermission)) {
    redirectToAppropriateDatabase(userRole);
    return false;
  }

  return true;
}

// Redirect to role-appropriate dashboard
function redirectToAppropriateDatabase(userRole) {
  const dashboardPaths = {
    admin: '/frontend/admin-dashboard.html',
    mentor: '/frontend/mentor-dashboard.html',
    student: '/frontend/student-dashboard.html'
  };

  const redirectPath = dashboardPaths[userRole] || '/frontend/login.html';
  window.location.href = redirectPath;
}

// Initialize role-based UI on page load
async function initializeRoleBasedUI() {
  try {
    const permissions = await getCurrentUserPermissions();
    if (permissions) {
      applyRoleBasedVisibility(permissions.role);
      
      // Store permissions for quick access
      localStorage.setItem('userPermissions', JSON.stringify(permissions));
      
      return permissions;
    }
  } catch (error) {
    console.error('Failed to initialize role-based UI:', error);
  }
  
  return null;
}

// Utility function to get API base URL
function getApiBaseUrl() {
  return window.location.origin + '/api';
}

// Export for use in other files
if (typeof window !== 'undefined') {
  window.RolePermissions = {
    ROLE_PERMISSIONS,
    getCurrentUserPermissions,
    hasPermission,
    applyRoleBasedVisibility,
    enforceRoleBasedAccess,
    redirectToAppropriateDatabase,
    initializeRoleBasedUI
  };
}