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
bot.onText(/\/cari/, (msg) => userHandlers.handleCari(msg));  // TAMBAHAN BARU
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
    console.error('Maintenance error:', error);
    bot.sendMessage(chatId, `❌ Error during maintenance: ${error.message}`);
  }
});

// Callback query handler
bot.on('callback_query', (callbackQuery) => {
  const data = callbackQuery.data;
  
  try {
    // Handle admin callback queries first
    if (data.startsWith('admin_')) {
      // Check if adminHandlers has handleAdminCallback method
      if (adminHandlers.handleAdminCallback && typeof adminHandlers.handleAdminCallback === 'function') {
        adminHandlers.handleAdminCallback(callbackQuery);
      } else {
        // Fallback to userHandlers if admin doesn't have the method
        userHandlers.handleCallbackQuery(callbackQuery);
      }
      return;
    }
    
    // Handle all user callback queries through userHandlers
    userHandlers.handleCallbackQuery(callbackQuery);
  } catch (error) {
    console.error('Callback query error:', error);
    bot.answerCallbackQuery(callbackQuery.id, {
      text: '❌ Terjadi kesalahan',
      show_alert: true
    });
  }
});

// Message handler
bot.on('text', (msg) => {
  try {
    // Skip if message is a command
    if (msg.text && msg.text.startsWith('/')) return;
    
    userHandlers.handleMessage(msg);
  } catch (error) {
    console.error('Text message error:', error);
    bot.sendMessage(msg.chat.id, '❌ Terjadi kesalahan saat memproses pesan.');
  }
});

// Photo message handler
bot.on('photo', (msg) => {
  try {
    userHandlers.handleMediaMessage(msg, 'photo');
  } catch (error) {
    console.error('Photo message error:', error);
    bot.sendMessage(msg.chat.id, '❌ Gagal mengirim foto.');
  }
});

// Document message handler
bot.on('document', (msg) => {
  try {
    userHandlers.handleMediaMessage(msg, 'document');
  } catch (error) {
    console.error('Document message error:', error);
    bot.sendMessage(msg.chat.id, '❌ Gagal mengirim dokumen.');
  }
});

// Sticker message handler
bot.on('sticker', (msg) => {
  try {
    userHandlers.handleMediaMessage(msg, 'sticker');
  } catch (error) {
    console.error('Sticker message error:', error);
    bot.sendMessage(msg.chat.id, '❌ Gagal mengirim sticker.');
  }
});

// Voice message handler
bot.on('voice', (msg) => {
  try {
    userHandlers.handleMediaMessage(msg, 'voice');
  } catch (error) {
    console.error('Voice message error:', error);
    bot.sendMessage(msg.chat.id, '❌ Gagal mengirim pesan suara.');
  }
});

// Video message handler
bot.on('video', (msg) => {
  try {
    userHandlers.handleMediaMessage(msg, 'video');
  } catch (error) {
    console.error('Video message error:', error);
    bot.sendMessage(msg.chat.id, '❌ Gagal mengirim video.');
  }
});

// Audio message handler
bot.on('audio', (msg) => {
  try {
    userHandlers.handleMediaMessage(msg, 'audio');
  } catch (error) {
    console.error('Audio message error:', error);
    bot.sendMessage(msg.chat.id, '❌ Gagal mengirim audio.');
  }
});

// Video note message handler
bot.on('video_note', (msg) => {
  try {
    userHandlers.handleMediaMessage(msg, 'video_note');
  } catch (error) {
    console.error('Video note message error:', error);
    bot.sendMessage(msg.chat.id, '❌ Gagal mengirim video note.');
  }
});

// Location message handler
bot.on('location', (msg) => {
  try {
    userHandlers.handleMediaMessage(msg, 'location');
  } catch (error) {
    console.error('Location message error:', error);
    bot.sendMessage(msg.chat.id, '❌ Gagal mengirim lokasi.');
  }
});

// Contact message handler
bot.on('contact', (msg) => {
  try {
    userHandlers.handleMediaMessage(msg, 'contact');
  } catch (error) {
    console.error('Contact message error:', error);
    bot.sendMessage(msg.chat.id, '❌ Gagal mengirim kontak.');
  }
});

// Animation/GIF message handler
bot.on('animation', (msg) => {
  try {
    userHandlers.handleMediaMessage(msg, 'animation');
  } catch (error) {
    console.error('Animation message error:', error);
    bot.sendMessage(msg.chat.id, '❌ Gagal mengirim animasi.');
  }
});

// Error handling
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

bot.on('webhook_error', (error) => {
  console.error('Webhook error:', error);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Periodic maintenance (every 24 hours)
const maintenanceInterval = setInterval(() => {
  console.log('Running automatic maintenance...');
  try {
    dataService.performMaintenance();
    console.log('✅ Automatic maintenance completed');
  } catch (error) {
    console.error('❌ Automatic maintenance failed:', error);
  }
}, 24 * 60 * 60 * 1000);

// Periodic queue cleanup (every 5 minutes)
const queueCleanupInterval = setInterval(() => {
  try {
    const matchingService = require('./src/services/matchingService');
    if (matchingService.cleanupInactiveChats) {
      matchingService.cleanupInactiveChats();
    }
  } catch (error) {
    console.error('Queue cleanup error:', error);
  }
}, 5 * 60 * 1000);

// Graceful shutdown
function gracefulShutdown() {
  console.log('\n🛑 Bot sedang shutdown...');
  
  // Clear intervals
  if (maintenanceInterval) clearInterval(maintenanceInterval);
  if (queueCleanupInterval) clearInterval(queueCleanupInterval);
  
  // Stop bot polling
  bot.stopPolling()
    .then(() => {
      console.log('✅ Bot polling stopped');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error stopping bot:', error);
      process.exit(1);
    });
}

// Handle shutdown signals
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Bot startup message
bot.getMe()
  .then((botInfo) => {
    console.log('🤖 Telegram Random Chat Bot Started!');
    console.log(`📋 Bot Info: @${botInfo.username} (${botInfo.first_name})`);
    console.log('📋 Fitur yang tersedia:');
    console.log('   ✅ Random chat matching dengan foto profil dan info lengkap');
    console.log('   ✅ Inline keyboard untuk quick actions');
    console.log('   ✅ Pilihan lanjut setelah obrolan berakhir');
    console.log('   ✅ Forward semua jenis media (foto, video, audio, sticker, dll)');
    console.log('   ✅ Interactive admin panel untuk laporan');
    console.log('   ✅ One-click block/ignore untuk admin');
    console.log('   ✅ User history dan warning system');
    console.log('   ✅ Auto-block setelah 3 laporan');
    console.log('   ✅ Penyimpanan data dalam file JSON dengan auto-cleanup');
    console.log('   ✅ Statistik bot untuk admin');
    console.log('   ✅ Automatic data maintenance');
    console.log('   ✅ Queue cleanup untuk chat tidak aktif');
    console.log('\n📁 Data disimpan di folder ./data/');
    console.log('⚙️  Konfigurasi dapat diubah di ./config/config.js');
    console.log(`👨‍💼 Admin ID: ${config.telegram.adminId}`);
    console.log('🚀 Bot siap digunakan!\n');
  })
  .catch((error) => {
    console.error('❌ Error getting bot info:', error);
    console.log('🤖 Telegram Random Chat Bot Started! (dengan warning)');
    console.log('📋 Fitur yang tersedia:');
    console.log('   ✅ Random chat matching dengan foto profil dan info lengkap');
    console.log('   ✅ Inline keyboard untuk quick actions');
    console.log('   ✅ Pilihan lanjut setelah obrolan berakhir');
    console.log('   ✅ Forward semua jenis media (foto, video, audio, sticker, dll)');
    console.log('   ✅ Interactive admin panel untuk laporan');
    console.log('   ✅ One-click block/ignore untuk admin');
    console.log('   ✅ User history dan warning system');
    console.log('   ✅ Auto-block setelah 3 laporan');
    console.log('   ✅ Penyimpanan data dalam file JSON dengan auto-cleanup');
    console.log('   ✅ Statistik bot untuk admin');
    console.log('   ✅ Automatic data maintenance');
    console.log('   ✅ Queue cleanup untuk chat tidak aktif');
    console.log('\n📁 Data disimpan di folder ./data/');
    console.log('⚙️  Konfigurasi dapat diubah di ./config/config.js');
    console.log('🚀 Bot siap digunakan!\n');
  });

// Export bot for testing purposes
module.exports = bot;
