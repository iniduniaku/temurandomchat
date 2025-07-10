const config = require('../../config/config');

class Helpers {
  isAdmin(userId) {
    return userId.toString() === config.telegram.adminId.toString();
  }

  formatUserInfo(user) {
    return {
      id: user.id,
      name: user.first_name || 'Unknown',
      username: user.username || 'No username',
      language: user.language_code || 'unknown'
    };
  }

  formatTimeAgo(timestamp) {
    const now = new Date();
    const past = new Date(timestamp);
    const diffMs = now - past;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Baru saja';
    if (diffMins < 60) return `${diffMins} menit lalu`;
    if (diffHours < 24) return `${diffHours} jam lalu`;
    return `${diffDays} hari lalu`;
  }

  escapeMarkdown(text) {
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
  }
}

module.exports = new Helpers();
