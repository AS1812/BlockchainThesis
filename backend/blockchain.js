const crypto = require('crypto');
const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/blockchain', { useNewUrlParser: true, useUnifiedTopology: true });

// Define Wallet schema and model
const walletSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  publicAddress: { type: String, required: true, unique: true }
});

const WalletModel = mongoose.model('Wallet', walletSchema);

class Blockchain {
  async addWallet(userId, password) {
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    const publicAddress = crypto.createHash('sha256').update(userId + Date.now().toString()).digest('hex');
    const wallet = new WalletModel({ userId, password: hashedPassword, publicAddress });
    await wallet.save();
    return wallet;
  }

  async getWallet(userId) {
    return await WalletModel.findOne({ userId });
  }

  async validatePassword(userId, password) {
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    const wallet = await WalletModel.findOne({ userId, password: hashedPassword });
    return wallet !== null;

    
  }
}

module.exports = { Blockchain, WalletModel };
