const dataService = require('./dataService');
const config = require('../../config/config');

class ReportService {
  reportUser(reporterInfo, reportedInfo, reason = '') {
    const report = dataService.addReport(reporterInfo, reportedInfo, reason);
    
    // Check if auto-block threshold is reached
    const reportedUser = dataService.getUser(reportedInfo.id);
    if (reportedUser && reportedUser.reportCount >= config.settings.autoBlockThreshold) {
      dataService.blockUser(reportedInfo.id);
      return { report, autoBlocked: true };
    }

    return { report, autoBlocked: false };
  }

  getRecentReports(limit = 10) {
    const reports = dataService.loadReports();
    return reports
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  getUserReports(userId) {
    const reports = dataService.loadReports();
    return reports.filter(report => 
      report.reported.id === userId || report.reporter.id === userId
    );
  }
}

module.exports = new ReportService();
