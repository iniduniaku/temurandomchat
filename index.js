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

// Admin maintenance command
bot.onText(/\/maintenance/, (msg) => {
  const adminId = msg.from.id;
  const chatId = msg.chat.id;

  if (adminId.toString() !== config.telegram.adminId.toString()) {
    bot.sendMessage(chatId, '❌ Anda tidak memiliki akses admin.');
    return;
  }

  bot.sendMessage(chatId, '🔧 Memulai maintenance data...');
  
  try {
    dataService.performMaintenance();
    bot.sendMessage(chatId, '✅ Maintenance selesai!');
  } catch (error) {
    bot.sendMessage(chatId, `❌ Error during maintenance: ${error.message}`);
  }
});

// Enhanced callback query handler
bot.on('callback_query', (callbackQuery) => {
  const data = callbackQuery.data;
  
  // Handle user callback queries
  if (['find_new_partner', 'stop_chatting', 'end_current_chat', 'report_current_partner'].includes(data)) {
    userHandlers.handleCallbackQuery(callbackQuery);
    return;
  }
  
  // Handle admin callback queries
  if (data.startsWith('admin_')) {
    adminHandlers.handleAdminCallback(callbackQuery);
    return;
  }
  
  // Handle additional user callbacks
  if (['end_current_chat', 'report_current_partner'].includes(data)) {
    userHandlers.handleAdditionalCallbacks(callbackQuery);
    return;
  }
});

// Message handler
bot.on('text', (msg) => {
  // Skip if message is a command
  if (msg.text.startsWith('/')) return;
  
  userHandlers.handleMessage(msg);
});

// Photo message handler (forward photos in chat)
bot.on('photo', (msg) => {
  const userId = msg.from.id;
  
  if (dataService.isUserBlocked(userId)) {
    bot.sendMessage(msg.chat.id, '❌ Anda telah diblokir dari menggunakan bot ini.');
    return;
  }

  const matchingService = require('./src/services/matchingService');
  
  if (matchingService.isInChat(userId)) {
    const partnerId = matchingService.getPartner(userId);
    const userInfo = dataService.getUser(userId);
    
    // Forward photo to partner
    bot.sendPhoto(partnerId, msg.photo[msg.photo.length - 1].file_id, {
      caption: msg.caption ? `${userInfo.name}: ${msg.caption}` : `📷 Foto dari ${userInfo.name}`
    });
  } else {
    bot.sendMessage(msg.chat.id, '❌ Anda tidak sedang dalam obrolan.');
  }
});

// Document/sticker/voice message handlers
bot.on('document', (msg) => forwardMediaMessage(msg, 'document'));
bot.on('sticker', (msg) => forwardMediaMessage(msg, 'sticker'));
bot.on('voice', (msg) => forwardMediaMessage(msg, 'voice'));
bot.on('video', (msg) => forwardMediaMessage(msg, 'video'));
bot.on('audio', (msg) => forwardMediaMessage(msg, 'audio'));

function forwardMediaMessage(msg, mediaType) {
  const userId = msg.from.id;
  
  if (dataService.isUserBlocked(userId)) {
    bot.sendMessage(msg.chat.id, '❌ Anda telah diblokir dari menggunakan bot ini.');
    return;
  }

  const matchingService = require('./src/services/matchingService');
  
  if (matchingService.isInChat(userId)) {
    const partnerId = matchingService.getPartner(userId);
    const userInfo = dataService.getUser(userId);
    
    let mediaOptions = {};
    let mediaId;
    
    switch (mediaType) {
      case 'document':
        mediaId = msg.document.file_id;
        mediaOptions.caption = `📎 Dokumen dari ${userInfo.name}`;
        bot.sendDocument(partnerId, mediaId, mediaOptions);
        break;
      case 'sticker':
        mediaId = msg.sticker.file_id;
        bot.sendSticker(partnerId, mediaId);
        break;
      case 'voice':
        mediaId = msg.voice.file_id;
        mediaOptions.caption = `🎤 Pesan suara dari ${userInfo.name}`;
        bot.sendVoice(partnerId, mediaId, mediaOptions);
        break;
      case 'video':
        mediaId = msg.video.file_id;
        mediaOptions.caption = msg.caption ? `${userInfo.name}: ${msg.caption}` : `🎥 Video dari ${userInfo.name}`;
        bot.sendVideo(partnerId, mediaId, mediaOptions);
        break;
      case 'audio':
        mediaId = msg.audio.file_id;
        mediaOptions.caption = `🎵 Audio dari ${userInfo.name}`;
        bot.sendAudio(partnerId, mediaId, mediaOptions);
        break;
    }
  } else {
    bot.sendMessage(msg.chat.id, '❌ Anda tidak sedang dalam obrolan.');
  }
}

// Error handling
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

// Periodic maintenance (every 24 hours)
setInterval(() => {
  console.log('Running automatic maintenance...');
  dataService.performMaintenance();
}, 24 * 60 * 60 * 1000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Bot sedang shutdown...');
  bot.stopPolling();
  process.exit(0);
});

console.log('🤖 Telegram Random Chat Bot Started!');
console.log('📋 Fitur yang tersedia:');
console.log('   ✅ Random chat matching dengan foto profil dan info lengkap');
console.log('   ✅ Pilihan lanjut setelah obrolan berakhir');
console.log('   ✅ Forward semua jenis media (foto, video, audio, sticker, dll)');
console.log('   ✅ Interactive admin panel untuk laporan');
console.log('   ✅ One-click block/ignore untuk admin');
console.log('   ✅ User history dan warning system');
console.log('   ✅ Auto-block setelah 3 laporan');
console.log('   ✅ Penyimpanan data dalam file JSON dengan auto-cleanup');
console.log('   ✅ Statistik bot untuk admin');
console.log('   ✅ Automatic data maintenance');
console.log('\n📁 Data disimpan di folder ./data/');
console.log('⚙️  Konfigurasi dapat diubah di ./config/config.js');
