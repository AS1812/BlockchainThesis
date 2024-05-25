const { Web3 } = require('web3');
const crypto = require('crypto');
const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/blockchain', { useNewUrlParser: true, useUnifiedTopology: true });

// Define Wallet schema and model
const walletSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  publicAddress: { type: String, required: true, unique: true },
  privateKey: { type: String, required: true }
});

const WalletModel = mongoose.model('Wallet', walletSchema);

class Blockchain {
  constructor() {
    // Replace the Infura URL with your Alchemy URL
    this.web3 = new Web3('https://eth-mainnet.g.alchemy.com/v2/UmfP_4PlAUB7ljPjEmeVRfB2qrFMPosg');
  }

  async addWallet(userId, password) {
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    const account = this.web3.eth.accounts.create();
    const wallet = new WalletModel({ 
      userId, 
      password: hashedPassword, 
      publicAddress: account.address,
      privateKey: account.privateKey 
    });
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

  async signDocument(userId, documentHash) {
    const wallet = await this.getWallet(userId);
    if (!wallet) throw new Error('Wallet not found');

    const signedMessage = this.web3.eth.accounts.sign(documentHash, wallet.privateKey);
    return signedMessage.signature;
  }
}

module.exports = { Blockchain, WalletModel };
