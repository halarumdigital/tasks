require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

module.exports = {
  token: process.env.TELEGRAM_BOT_TOKEN,
  webhookUrl: process.env.TELEGRAM_WEBHOOK_URL
};
