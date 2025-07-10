const fs = require('fs');
const path = require('path');
const config = require('../../config/config');

class DataService {
  constructor() {
    this.ensureDataDirectory();
    this.initializeDataFiles();
  }

  ensureDataDirectory() {
    const dataDir = path.dirname(config.dataFiles.users);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  initializeDataFiles() {
    // Initialize users.json
    if (!fs.existsSync(config.dataFiles.users)) {
      this.saveUsers({});
    }

    // Initialize blocked_users.json
    if (!fs.existsSync(config.dataFiles.blockedUsers)) {
      this.saveBlockedUsers([]);
    }

    // Initialize reports.json
    if (!fs.existsSync(config.dataFiles.reports)) {
      this.saveReports([]);
    }
  }

  // Users data management
  loadUsers() {
    try {
      const data = fs.readFileSync(config.dataFiles.users, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading users:', error);
      return {};
    }
  }

  saveUsers(users) {
    try {
      fs.writeFileSync(config.dataFiles.users, JSON.stringify(users, null, 2));
    } catch (error) {
      console.error('Error saving users:', error);
    }
  }

  addUser(userId, userInfo) {
    const users = this.loadUsers();
    users[userId] = {
      ...userInfo,
      joinDate: new Date().toISOString(),
      reportCount: users[userId]?.reportCount || 0
    };
    this.saveUsers(users);
  }

  getUser(userId) {
    const users = this.loadUsers();
    return users[userId] || null;
  }

  updateUser(userId, updateData) {
    const users = this.loadUsers();
    if (users[userId]) {
      users[userId] = { ...users[userId], ...updateData };
      this.saveUsers(users);
    }
  }

  // Blocked users management
  loadBlockedUsers() {
    try {
      const data = fs.readFileSync(config.dataFiles.blockedUsers, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading blocked users:', error);
      return [];
    }
  }

  saveBlockedUsers(blockedUsers) {
    try {
      fs.writeFileSync(config.dataFiles.blockedUsers, JSON.stringify(blockedUsers, null, 2));
    } catch (error) {
      console.error('Error saving blocked users:', error);
    }
  }

  isUserBlocked(userId) {
    const blockedUsers = this.loadBlockedUsers();
    return blockedUsers.includes(userId);
  }

  blockUser(userId) {
    const blockedUsers = this.loadBlockedUsers();
    if (!blockedUsers.includes(userId)) {
      blockedUsers.push(userId);
      this.saveBlockedUsers(blockedUsers);
    }
  }

  unblockUser(userId) {
    const blockedUsers = this.loadBlockedUsers();
    const index = blockedUsers.indexOf(userId);
    if (index > -1) {
      blockedUsers.splice(index, 1);
      this.saveBlockedUsers(blockedUsers);
    }
  }

  // Reports management
  loadReports() {
    try {
      const data = fs.readFileSync(config.dataFiles.reports, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading reports:', error);
      return [];
    }
  }

  saveReports(reports) {
    try {
      fs.writeFileSync(config.dataFiles.reports, JSON.stringify(reports, null, 2));
    } catch (error) {
      console.error('Error saving reports:', error);
    }
  }

  addReport(reporterInfo, reportedInfo, reason = '') {
    const reports = this.loadReports();
    const report = {
      id: Date.now(),
      reporter: reporterInfo,
      reported: reportedInfo,
      reason: reason,
      timestamp: new Date().toISOString(),
      status: 'pending'
    };
    
    reports.push(report);
    this.saveReports(reports);

    // Update report count for reported user
    const users = this.loadUsers();
    if (users[reportedInfo.id]) {
      users[reportedInfo.id].reportCount = (users[reportedInfo.id].reportCount || 0) + 1;
      this.saveUsers(users);
    }

    return report;
  }

  getStats() {
    const users = this.loadUsers();
    const blockedUsers = this.loadBlockedUsers();
    const reports = this.loadReports();

    return {
      totalUsers: Object.keys(users).length,
      blockedUsers: blockedUsers.length,
      totalReports: reports.length,
      pendingReports: reports.filter(r => r.status === 'pending').length
    };
  }
}

module.exports = new DataService();
