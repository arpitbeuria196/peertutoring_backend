// Comprehensive Settings Management Interface
const API_BASE_URL = window.location.origin + '/api';

class SettingsManager {
  constructor() {
    this.currentUser = null;
    this.init();
  }

  async init() {
    await this.checkAuthentication();
    this.setupEventHandlers();
    await this.loadAllSettings();
    this.renderSettingsInterface();
  }

  async checkAuthentication() {
    const token = localStorage.getItem('authToken');
    if (!token) {
      window.location.href = '/frontend/login.html';
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.currentUser = data.user;
      } else {
        localStorage.removeItem('authToken');
        window.location.href = '/frontend/login.html';
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      window.location.href = '/frontend/login.html';
    }
  }

  setupEventHandlers() {
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-save-section]')) {
        const section = e.target.getAttribute('data-save-section');
        this.saveSection(section);
      }
    });
  }

  async loadAllSettings() {
    try {
      // Load profile settings
      const profileResponse = await fetch(`${API_BASE_URL}/settings/profile`, {
        headers: this.getHeaders()
      });
      this.profileSettings = profileResponse.ok ? (await profileResponse.json()).data : {};

      // Load mentor settings if user is a mentor
      if (this.currentUser.role === 'mentor') {
        const mentorResponse = await fetch(`${API_BASE_URL}/settings/mentor`, {
          headers: this.getHeaders()
        });
        this.mentorSettings = mentorResponse.ok ? (await mentorResponse.json()).data : {};
      }

      // Load preferences
      const preferencesResponse = await fetch(`${API_BASE_URL}/settings/preferences`, {
        headers: this.getHeaders()
      });
      this.preferences = preferencesResponse.ok ? (await preferencesResponse.json()).data : {};

    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  renderSettingsInterface() {
    const container = document.getElementById('settingsContainer');
    if (!container) return;

    container.innerHTML = `
      <div class="settings-manager">
        <div class="row">
          <div class="col-md-3">
            <div class="nav flex-column nav-pills" id="settingsNav" role="tablist">
              <button class="nav-link active" id="profile-tab" data-bs-toggle="pill" data-bs-target="#profile" role="tab">
                <i class="fas fa-user me-2"></i>Profile Settings
              </button>
              ${this.currentUser.role === 'mentor' ? `
                <button class="nav-link" id="mentor-tab" data-bs-toggle="pill" data-bs-target="#mentor" role="tab">
                  <i class="fas fa-chalkboard-teacher me-2"></i>Mentor Settings
                </button>
              ` : ''}
              <button class="nav-link" id="security-tab" data-bs-toggle="pill" data-bs-target="#security" role="tab">
                <i class="fas fa-shield-alt me-2"></i>Security
              </button>
              <button class="nav-link" id="preferences-tab" data-bs-toggle="pill" data-bs-target="#preferences" role="tab">
                <i class="fas fa-cog me-2"></i>Preferences
              </button>
            </div>
          </div>
          
          <div class="col-md-9">
            <div class="tab-content" id="settingsTabContent">
              ${this.renderProfileTab()}
              ${this.currentUser.role === 'mentor' ? this.renderMentorTab() : ''}
              ${this.renderSecurityTab()}
              ${this.renderPreferencesTab()}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderProfileTab() {
    return `
      <div class="tab-pane fade show active" id="profile" role="tabpanel">
        <div class="card">
          <div class="card-header">
            <h5 class="mb-0">Profile Information</h5>
          </div>
          <div class="card-body">
            <form id="profileForm">
              <div class="row">
                <div class="col-md-6">
                  <div class="mb-3">
                    <label for="firstName" class="form-label">First Name</label>
                    <input type="text" class="form-control" id="firstName" value="${this.profileSettings.firstName || ''}" required>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="mb-3">
                    <label for="lastName" class="form-label">Last Name</label>
                    <input type="text" class="form-control" id="lastName" value="${this.profileSettings.lastName || ''}" required>
                  </div>
                </div>
              </div>
              
              <div class="mb-3">
                <label for="email" class="form-label">Email Address</label>
                <input type="email" class="form-control" id="email" value="${this.profileSettings.email || ''}" readonly>
                <div class="form-text">Email cannot be changed through settings.</div>
              </div>
              
              <div class="mb-3">
                <label for="phone" class="form-label">Phone Number</label>
                <input type="tel" class="form-control" id="phone" value="${this.profileSettings.phone || ''}">
              </div>
              
              <div class="mb-3">
                <label for="location" class="form-label">Location</label>
                <input type="text" class="form-control" id="location" value="${this.profileSettings.location || ''}" placeholder="City, Country">
              </div>
              
              <div class="mb-3">
                <label for="bio" class="form-label">Bio</label>
                <textarea class="form-control" id="bio" rows="4" maxlength="1000" placeholder="Tell us about yourself...">${this.profileSettings.bio || ''}</textarea>
                <div class="form-text">Maximum 1000 characters</div>
              </div>
              
              <div class="mb-3">
                <label for="timezone" class="form-label">Timezone</label>
                <select class="form-select" id="timezone">
                  <option value="UTC" ${this.profileSettings.timezone === 'UTC' ? 'selected' : ''}>UTC</option>
                  <option value="America/New_York" ${this.profileSettings.timezone === 'America/New_York' ? 'selected' : ''}>Eastern Time</option>
                  <option value="America/Chicago" ${this.profileSettings.timezone === 'America/Chicago' ? 'selected' : ''}>Central Time</option>
                  <option value="America/Denver" ${this.profileSettings.timezone === 'America/Denver' ? 'selected' : ''}>Mountain Time</option>
                  <option value="America/Los_Angeles" ${this.profileSettings.timezone === 'America/Los_Angeles' ? 'selected' : ''}>Pacific Time</option>
                  <option value="Europe/London" ${this.profileSettings.timezone === 'Europe/London' ? 'selected' : ''}>London</option>
                  <option value="Europe/Paris" ${this.profileSettings.timezone === 'Europe/Paris' ? 'selected' : ''}>Paris</option>
                  <option value="Asia/Tokyo" ${this.profileSettings.timezone === 'Asia/Tokyo' ? 'selected' : ''}>Tokyo</option>
                </select>
              </div>
              
              <button type="button" class="btn btn-primary" data-save-section="profile">
                <i class="fas fa-save me-2"></i>Save Profile Settings
              </button>
            </form>
          </div>
        </div>
      </div>
    `;
  }

  renderMentorTab() {
    return `
      <div class="tab-pane fade" id="mentor" role="tabpanel">
        <div class="card">
          <div class="card-header">
            <h5 class="mb-0">Mentor-Specific Settings</h5>
          </div>
          <div class="card-body">
            <form id="mentorForm">
              <div class="mb-3">
                <label for="hourlyRate" class="form-label">Hourly Rate (USD)</label>
                <div class="input-group">
                  <span class="input-group-text">$</span>
                  <input type="number" class="form-control" id="hourlyRate" min="0" max="1000" step="5" value="${this.mentorSettings.hourlyRate || 0}">
                  <span class="input-group-text">per hour</span>
                </div>
                <div class="form-text">Set your teaching rate per hour</div>
              </div>
              
              <div class="mb-3">
                <label class="form-label">Specializations</label>
                <div id="specializationsContainer">
                  ${(this.mentorSettings.specializations || []).map((spec, index) => `
                    <div class="input-group mb-2">
                      <input type="text" class="form-control specialization-input" value="${spec}" placeholder="Enter specialization">
                      <button type="button" class="btn btn-outline-danger" onclick="this.parentElement.remove()">
                        <i class="fas fa-times"></i>
                      </button>
                    </div>
                  `).join('')}
                </div>
                <button type="button" class="btn btn-outline-primary btn-sm" onclick="this.addSpecialization()">
                  <i class="fas fa-plus me-1"></i>Add Specialization
                </button>
              </div>
              
              <button type="button" class="btn btn-primary" data-save-section="mentor">
                <i class="fas fa-save me-2"></i>Save Mentor Settings
              </button>
            </form>
          </div>
        </div>
      </div>
    `;
  }

  renderSecurityTab() {
    return `
      <div class="tab-pane fade" id="security" role="tabpanel">
        <div class="card">
          <div class="card-header">
            <h5 class="mb-0">Security Settings</h5>
          </div>
          <div class="card-body">
            <form id="passwordForm">
              <div class="mb-3">
                <label for="currentPassword" class="form-label">Current Password</label>
                <input type="password" class="form-control" id="currentPassword" required>
              </div>
              
              <div class="mb-3">
                <label for="newPassword" class="form-label">New Password</label>
                <input type="password" class="form-control" id="newPassword" minlength="6" required>
                <div class="form-text">Password must be at least 6 characters long</div>
              </div>
              
              <div class="mb-3">
                <label for="confirmPassword" class="form-label">Confirm New Password</label>
                <input type="password" class="form-control" id="confirmPassword" required>
              </div>
              
              <button type="button" class="btn btn-warning" data-save-section="password">
                <i class="fas fa-key me-2"></i>Change Password
              </button>
            </form>
            
            <hr class="my-4">
            
            <div class="alert alert-info">
              <h6 class="alert-heading">Account Security</h6>
              <p class="mb-0">Your account is protected with industry-standard security measures. Always use a strong, unique password.</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderPreferencesTab() {
    return `
      <div class="tab-pane fade" id="preferences" role="tabpanel">
        <div class="card">
          <div class="card-header">
            <h5 class="mb-0">Application Preferences</h5>
          </div>
          <div class="card-body">
            <form id="preferencesForm">
              <div class="mb-3">
                <label for="language" class="form-label">Language</label>
                <select class="form-select" id="language">
                  <option value="en" ${this.preferences.language === 'en' ? 'selected' : ''}>English</option>
                  <option value="es" ${this.preferences.language === 'es' ? 'selected' : ''}>Spanish</option>
                  <option value="fr" ${this.preferences.language === 'fr' ? 'selected' : ''}>French</option>
                  <option value="de" ${this.preferences.language === 'de' ? 'selected' : ''}>German</option>
                  <option value="zh" ${this.preferences.language === 'zh' ? 'selected' : ''}>Chinese</option>
                  <option value="ja" ${this.preferences.language === 'ja' ? 'selected' : ''}>Japanese</option>
                </select>
              </div>
              
              <div class="mb-3">
                <label for="currency" class="form-label">Currency</label>
                <select class="form-select" id="currency">
                  <option value="USD" ${this.preferences.currency === 'USD' ? 'selected' : ''}>USD - US Dollar</option>
                  <option value="EUR" ${this.preferences.currency === 'EUR' ? 'selected' : ''}>EUR - Euro</option>
                  <option value="GBP" ${this.preferences.currency === 'GBP' ? 'selected' : ''}>GBP - British Pound</option>
                  <option value="JPY" ${this.preferences.currency === 'JPY' ? 'selected' : ''}>JPY - Japanese Yen</option>
                  <option value="CNY" ${this.preferences.currency === 'CNY' ? 'selected' : ''}>CNY - Chinese Yuan</option>
                  <option value="INR" ${this.preferences.currency === 'INR' ? 'selected' : ''}>INR - Indian Rupee</option>
                </select>
              </div>
              
              <button type="button" class="btn btn-primary" data-save-section="preferences">
                <i class="fas fa-save me-2"></i>Save Preferences
              </button>
            </form>
          </div>
        </div>
      </div>
    `;
  }

  async saveSection(section) {
    try {
      switch (section) {
        case 'profile':
          await this.saveProfileSettings();
          break;
        case 'mentor':
          await this.saveMentorSettings();
          break;
        case 'password':
          await this.changePassword();
          break;
        case 'preferences':
          await this.savePreferences();
          break;
      }
    } catch (error) {
      console.error(`Save ${section} error:`, error);
      this.showNotification(`Failed to save ${section} settings`, 'error');
    }
  }

  async saveProfileSettings() {
    const formData = {
      firstName: document.getElementById('firstName').value,
      lastName: document.getElementById('lastName').value,
      phone: document.getElementById('phone').value,
      location: document.getElementById('location').value,
      bio: document.getElementById('bio').value,
      timezone: document.getElementById('timezone').value
    };

    const response = await fetch(`${API_BASE_URL}/settings/profile`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(formData)
    });

    const data = await response.json();
    if (response.ok) {
      this.showNotification('Profile settings saved successfully', 'success');
    } else {
      throw new Error(data.message || 'Failed to save profile settings');
    }
  }

  async saveMentorSettings() {
    const hourlyRate = parseFloat(document.getElementById('hourlyRate').value);
    const specializations = Array.from(document.querySelectorAll('.specialization-input'))
      .map(input => input.value.trim())
      .filter(spec => spec.length > 0);

    const formData = {
      hourlyRate,
      specializations
    };

    const response = await fetch(`${API_BASE_URL}/settings/mentor`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(formData)
    });

    const data = await response.json();
    if (response.ok) {
      this.showNotification('Mentor settings saved successfully', 'success');
    } else {
      throw new Error(data.message || 'Failed to save mentor settings');
    }
  }

  async changePassword() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword !== confirmPassword) {
      this.showNotification('New passwords do not match', 'error');
      return;
    }

    const response = await fetch(`${API_BASE_URL}/settings/password`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ currentPassword, newPassword })
    });

    const data = await response.json();
    if (response.ok) {
      document.getElementById('passwordForm').reset();
      this.showNotification('Password changed successfully', 'success');
    } else {
      throw new Error(data.message || 'Failed to change password');
    }
  }

  async savePreferences() {
    const formData = {
      language: document.getElementById('language').value,
      currency: document.getElementById('currency').value
    };

    const response = await fetch(`${API_BASE_URL}/settings/preferences`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(formData)
    });

    const data = await response.json();
    if (response.ok) {
      this.showNotification('Preferences saved successfully', 'success');
    } else {
      throw new Error(data.message || 'Failed to save preferences');
    }
  }

  addSpecialization() {
    const container = document.getElementById('specializationsContainer');
    const newSpecDiv = document.createElement('div');
    newSpecDiv.className = 'input-group mb-2';
    newSpecDiv.innerHTML = `
      <input type="text" class="form-control specialization-input" placeholder="Enter specialization">
      <button type="button" class="btn btn-outline-danger" onclick="this.parentElement.remove()">
        <i class="fas fa-times"></i>
      </button>
    `;
    container.appendChild(newSpecDiv);
  }

  getHeaders() {
    return {
      'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
      'Content-Type': 'application/json'
    };
  }

  showNotification(message, type) {
    const alertClass = type === 'error' ? 'alert-danger' : 'alert-success';
    const alert = document.createElement('div');
    alert.className = `alert ${alertClass} alert-dismissible fade show position-fixed`;
    alert.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    alert.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alert);
    
    setTimeout(() => {
      alert.remove();
    }, 5000);
  }
}

// Initialize settings manager when DOM is ready
let settingsManager;
document.addEventListener('DOMContentLoaded', () => {
  settingsManager = new SettingsManager();
});

// Logout function
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'landing.html';
}