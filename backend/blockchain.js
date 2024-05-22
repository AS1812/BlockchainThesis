
const crypto = require('crypto');
const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/blockchain', { useNewUrlParser: true, useUnifiedTopology: true });

// Define Wallet schema and model
const walletSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  documents: [{ hash: String, fileContent: String, timestamp: Number }]
});

const WalletModel = mongoose.model('Wallet', walletSchema);

// Define Block schema and model
const blockSchema = new mongoose.Schema({
  index: Number,
  timestamp: String,
  data: Object,
  previousHash: String,
  hash: String
});

const BlockModel = mongoose.model('Block', blockSchema);

class Block {
  constructor(index, timestamp, data, previousHash = '') {
    this.index = index;
    this.timestamp = timestamp;
    this.data = data;
    this.previousHash = previousHash;
    this.hash = this.calculateHash();
  }

  calculateHash() {
    return crypto.createHash('sha256').update(this.index + this.timestamp + JSON.stringify(this.data) + this.previousHash).digest('hex');
  }
}

class Blockchain {
  constructor() {
    this.chain = [];
    this.initializeChain();
  }

  async initializeChain() {
    const genesisBlock = await BlockModel.findOne({ index: 0 });
    if (!genesisBlock) {
      const newGenesisBlock = new Block(0, Date.now().toString(), 'Genesis Block', '0');
      const block = new BlockModel(newGenesisBlock);
      await block.save();
      this.chain.push(newGenesisBlock);
    } else {
      this.chain = await BlockModel.find().sort({ index: 1 });
    }
  }

  async addBlock(newBlock) {
    newBlock.previousHash = this.chain[this.chain.length - 1].hash;
    newBlock.hash = newBlock.calculateHash();
    const block = new BlockModel(newBlock);
    await block.save();
    this.chain.push(newBlock);
  }

  async isChainValid() {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      if (currentBlock.hash !== currentBlock.calculateHash()) {
        return false;
      }

      if (currentBlock.previousHash !== previousBlock.hash) {
        return false;
      }
    }
    return true;
  }

  async addWallet(userId, password) {
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    const wallet = new WalletModel({ userId, password: hashedPassword });
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

class Wallet {
  constructor(userId, password) {
    this.userId = userId;
    this.password = password;
    this.documents = [];
  }

  addDocument(document) {
    this.documents.push(document);
  }

  getDocuments() {
    return this.documents;
  }

  findDocument(hash) {
    return this.documents.find(doc => doc.hash === hash);
  }
}

module.exports = { Block, Blockchain, Wallet, WalletModel };