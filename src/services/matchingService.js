const dataService = require('./dataService');

class MatchingService {
  constructor() {
    this.queue = [];
    this.activeChats = new Map();
    this.chatTimeouts = new Map();
  }

  addToQueue(userId) {
    if (!this.queue.includes(userId) && !this.activeChats.has(userId)) {
      this.queue.push(userId);
      return true;
    }
    return false;
  }

  removeFromQueue(userId) {
    const index = this.queue.indexOf(userId);
    if (index > -1) {
      this.queue.splice(index, 1);
      return true;
    }
    return false;
  }

  matchUsers() {
    if (this.queue.length >= 2) {
      const user1Id = this.queue.shift();
      const user2Id = this.queue.shift();

      this.activeChats.set(user1Id, user2Id);
      this.activeChats.set(user2Id, user1Id);

      // Set timeout untuk chat
      const timeout = setTimeout(() => {
        this.endChat(user1Id, 'timeout');
      }, 30 * 60 * 1000); // 30 menit

      this.chatTimeouts.set(user1Id, timeout);
      this.chatTimeouts.set(user2Id, timeout);

      return { user1Id, user2Id };
    }
    return null;
  }

  endChat(userId, reason = 'manual') {
    if (this.activeChats.has(userId)) {
      const partnerId = this.activeChats.get(userId);
      
      // Clear timeouts
      if (this.chatTimeouts.has(userId)) {
        clearTimeout(this.chatTimeouts.get(userId));
        this.chatTimeouts.delete(userId);
        this.chatTimeouts.delete(partnerId);
      }

      // Remove from active chats
      this.activeChats.delete(userId);
      this.activeChats.delete(partnerId);

      return { partnerId, reason };
    }
    return null;
  }

  isInChat(userId) {
    return this.activeChats.has(userId);
  }

  getPartner(userId) {
    return this.activeChats.get(userId);
  }

  getQueuePosition(userId) {
    return this.queue.indexOf(userId) + 1;
  }

  getStats() {
    return {
      queueLength: this.queue.length,
      activeChats: this.activeChats.size / 2
    };
  }
}

module.exports = new MatchingService();
