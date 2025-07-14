// Skills Management Interface
const API_BASE_URL = window.location.origin + '/api';

class SkillsManager {
  constructor() {
    this.skills = [];
    this.init();
  }

  async init() {
    await this.checkAuthentication();
    this.setupEventHandlers();
    await this.loadSkills();
    this.renderSkillsInterface();
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

      if (!response.ok) {
        localStorage.removeItem('authToken');
        window.location.href = '/frontend/login.html';
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      window.location.href = '/frontend/login.html';
    }
  }

  setupEventHandlers() {
    document.getElementById('addSkillBtn')?.addEventListener('click', () => this.showAddSkillModal());
    document.getElementById('bulkAddSkillsBtn')?.addEventListener('click', () => this.showBulkAddModal());
    document.getElementById('saveSkillBtn')?.addEventListener('click', () => this.saveSkill());
    document.getElementById('saveBulkSkillsBtn')?.addEventListener('click', () => this.saveBulkSkills());
  }

  async loadSkills() {
    try {
      const response = await fetch(`${API_BASE_URL}/skills`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.skills = data.data;
        this.renderSkillsList();
      } else {
        this.showNotification('Failed to load skills', 'error');
      }
    } catch (error) {
      console.error('Load skills error:', error);
      this.showNotification('Error loading skills', 'error');
    }
  }

  renderSkillsInterface() {
    const container = document.getElementById('skillsContainer');
    if (!container) return;

    container.innerHTML = `
      <div class="skills-manager">
        <div class="d-flex justify-content-between align-items-center mb-4">
          <h3>Skills Management</h3>
          <div>
            <button class="btn btn-outline-primary me-2" id="bulkAddSkillsBtn">
              <i class="fas fa-plus-circle"></i> Bulk Add Skills
            </button>
            <button class="btn btn-primary" id="addSkillBtn">
              <i class="fas fa-plus"></i> Add Skill
            </button>
          </div>
        </div>
        
        <div class="skills-list" id="skillsList">
          <div class="text-center py-4">
            <div class="spinner-border" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Add Skill Modal -->
      <div class="modal fade" id="addSkillModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Add New Skill</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="skillForm">
                <div class="mb-3">
                  <label for="skillName" class="form-label">Skill Name</label>
                  <input type="text" class="form-control" id="skillName" required>
                </div>
                <div class="mb-3">
                  <label for="skillLevel" class="form-label">Proficiency Level</label>
                  <select class="form-select" id="skillLevel">
                    <option value="beginner">Beginner</option>
                    <option value="intermediate" selected>Intermediate</option>
                    <option value="advanced">Advanced</option>
                    <option value="expert">Expert</option>
                  </select>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-primary" id="saveSkillBtn">Save Skill</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Bulk Add Skills Modal -->
      <div class="modal fade" id="bulkAddModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Add Multiple Skills</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="mb-3">
                <label for="bulkSkills" class="form-label">Skills (comma-separated)</label>
                <textarea class="form-control" id="bulkSkills" rows="4" 
                  placeholder="JavaScript, Python, React, Node.js, MongoDB"></textarea>
                <div class="form-text">Enter skills separated by commas. They will be added with intermediate level.</div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-primary" id="saveBulkSkillsBtn">Add Skills</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderSkillsList() {
    const skillsList = document.getElementById('skillsList');
    if (!skillsList) return;

    if (this.skills.length === 0) {
      skillsList.innerHTML = `
        <div class="text-center py-5">
          <i class="fas fa-lightbulb fa-3x text-muted mb-3"></i>
          <h5 class="text-muted">No skills added yet</h5>
          <p class="text-muted">Start building your skill profile by adding your expertise areas.</p>
        </div>
      `;
      return;
    }

    const skillsHTML = this.skills.map(skill => `
      <div class="skill-item card mb-2" data-skill-id="${skill._id}">
        <div class="card-body py-3">
          <div class="d-flex justify-content-between align-items-center">
            <div class="d-flex align-items-center">
              <div class="skill-icon me-3">
                <i class="fas fa-code text-primary"></i>
              </div>
              <div>
                <h6 class="mb-1">${skill.name}</h6>
                <span class="badge bg-${this.getLevelColor(skill.level)}">${skill.level}</span>
                ${skill.verified ? '<span class="badge bg-success ms-2">Verified</span>' : ''}
              </div>
            </div>
            <div class="skill-actions">
              <button class="btn btn-sm btn-outline-primary me-2" onclick="skillsManager.editSkill('${skill._id}')">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger" onclick="skillsManager.deleteSkill('${skill._id}')">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `).join('');

    skillsList.innerHTML = skillsHTML;
  }

  getLevelColor(level) {
    const colors = {
      beginner: 'secondary',
      intermediate: 'info',
      advanced: 'warning',
      expert: 'success'
    };
    return colors[level] || 'secondary';
  }

  showAddSkillModal() {
    const modal = new bootstrap.Modal(document.getElementById('addSkillModal'));
    document.getElementById('skillForm').reset();
    modal.show();
  }

  showBulkAddModal() {
    const modal = new bootstrap.Modal(document.getElementById('bulkAddModal'));
    document.getElementById('bulkSkills').value = '';
    modal.show();
  }

  async saveSkill() {
    const name = document.getElementById('skillName').value.trim();
    const level = document.getElementById('skillLevel').value;

    if (!name) {
      this.showNotification('Please enter a skill name', 'error');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/skills`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, level })
      });

      const data = await response.json();

      if (response.ok) {
        this.skills = data.data;
        this.renderSkillsList();
        bootstrap.Modal.getInstance(document.getElementById('addSkillModal')).hide();
        this.showNotification('Skill added successfully', 'success');
      } else {
        this.showNotification(data.message || 'Failed to add skill', 'error');
      }
    } catch (error) {
      console.error('Add skill error:', error);
      this.showNotification('Error adding skill', 'error');
    }
  }

  async saveBulkSkills() {
    const skillsText = document.getElementById('bulkSkills').value.trim();

    if (!skillsText) {
      this.showNotification('Please enter skills to add', 'error');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/skills/bulk`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ skills: skillsText })
      });

      const data = await response.json();

      if (response.ok) {
        this.skills = data.data;
        this.renderSkillsList();
        bootstrap.Modal.getInstance(document.getElementById('bulkAddModal')).hide();
        this.showNotification(data.message, 'success');
      } else {
        this.showNotification(data.message || 'Failed to add skills', 'error');
      }
    } catch (error) {
      console.error('Bulk add skills error:', error);
      this.showNotification('Error adding skills', 'error');
    }
  }

  async editSkill(skillId) {
    const skill = this.skills.find(s => s._id === skillId);
    if (!skill) return;

    document.getElementById('skillName').value = skill.name;
    document.getElementById('skillLevel').value = skill.level;
    
    const modal = new bootstrap.Modal(document.getElementById('addSkillModal'));
    modal.show();

    // Replace save button functionality for editing
    document.getElementById('saveSkillBtn').onclick = async () => {
      await this.updateSkill(skillId);
    };
  }

  async updateSkill(skillId) {
    const name = document.getElementById('skillName').value.trim();
    const level = document.getElementById('skillLevel').value;

    try {
      const response = await fetch(`${API_BASE_URL}/skills/${skillId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, level })
      });

      const data = await response.json();

      if (response.ok) {
        this.skills = data.data;
        this.renderSkillsList();
        bootstrap.Modal.getInstance(document.getElementById('addSkillModal')).hide();
        this.showNotification('Skill updated successfully', 'success');
        
        // Restore original save functionality
        document.getElementById('saveSkillBtn').onclick = () => this.saveSkill();
      } else {
        this.showNotification(data.message || 'Failed to update skill', 'error');
      }
    } catch (error) {
      console.error('Update skill error:', error);
      this.showNotification('Error updating skill', 'error');
    }
  }

  async deleteSkill(skillId) {
    if (!confirm('Are you sure you want to delete this skill?')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/skills/${skillId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        this.skills = data.data;
        this.renderSkillsList();
        this.showNotification('Skill deleted successfully', 'success');
      } else {
        this.showNotification(data.message || 'Failed to delete skill', 'error');
      }
    } catch (error) {
      console.error('Delete skill error:', error);
      this.showNotification('Error deleting skill', 'error');
    }
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

// Initialize skills manager when DOM is ready
let skillsManager;
document.addEventListener('DOMContentLoaded', () => {
  skillsManager = new SkillsManager();
});

// Logout function
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'landing.html';
}