const TelegramBot = require('node-telegram-bot-api');
const config = require('./config/config');
const UserHandlers = require('./src/handlers/userHandlers');
const AdminHandlers = require('./src/handlers/adminHandlers');
const dataService = require('./src/services/dataService');

// Initialize bot
const bot = new TelegramBot(config.telegram.token, { polling: true });

// Initialize handlers
const userHandlers = new UserHandlers(bot);
const adminHandlers = new AdminHandlers(bot);

// User command handlers
bot.onText(/\/start/, (msg) => userHandlers.handleStart(msg));
bot.onText(/\/stop/, (msg) => userHandlers.handleStop(msg));
bot.onText(/\/report/, (msg) => userHandlers.handleReport(msg));
bot.onText(/\/help/, (msg) => userHandlers.handleHelp(msg));

// Admin command handlers
bot.onText(/\/block (.+)/, (msg, match) => adminHandlers.handleBlock(msg, match));
bot.onText(/\/unblock (.+)/, (msg, match) => adminHandlers.handleUnblock(msg, match));
bot.onText(/\/stats/, (msg) => adminHandlers.handleStats(msg));
bot.onText(/\/reports/, (msg) => adminHandlers.handleReports(msg));
bot.onText(/\/adminhelp/, (msg) => adminHandlers.handleAdminHelp(msg));

// Message handler
bot.on('text', (msg) => {
  // Skip if message is a command
  if (msg.text.startsWith('/')) return;
  
  userHandlers.handleMessage(msg);
});

// Error handling
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Bot sedang shutdown...');
  bot.stopPolling();
  process.exit(0);
});

console.log('🤖 Telegram Random Chat Bot Started!');
console.log('📋 Fitur yang tersedia:');
console.log('   ✅ Random chat matching dengan nama (tidak anonim)');
console.log('   ✅ Sistem laporan ke admin');
console.log('   ✅ Admin dapat memblokir/unblock user');
console.log('   ✅ Auto-block setelah 3 laporan');
console.log('   ✅ Penyimpanan data dalam file JSON');
console.log('   ✅ Statistik bot untuk admin');
console.log('   ✅ Timeout otomatis untuk chat');
console.log('\n📁 Data disimpan di folder ./data/');
console.log('⚙️  Konfigurasi dapat diubah di ./config/config.js');
