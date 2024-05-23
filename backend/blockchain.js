const crypto = require('crypto');
const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/blockchain', { useNewUrlParser: true, useUnifiedTopology: true });

// Define Wallet schema and model
const walletSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  publicAddress: { type: String, required: true, unique: true },
  documents: [{
    hash: String,
    fileContent: Buffer,
    timestamp: Number,
    fileName: String,
    fileType: String,
    signatureId: { type: String, unique: true } // New field for signature ID
  }]
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
    const publicAddress = crypto.createHash('sha256').update(userId + Date.now().toString()).digest('hex');
    const wallet = new WalletModel({ userId, password: hashedPassword, publicAddress });
    await wallet.save();
    return wallet;
  }

  async getWallet(userId) {
    return await WalletModel.findOne({ userId });
  }

  async getWalletByPublicAddress(publicAddress) {
    return await WalletModel.findOne({ publicAddress });
  }

  async validatePassword(userId, password) {
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    const wallet = await WalletModel.findOne({ userId, password: hashedPassword });
    return wallet !== null;
  }

  async transferDocument(senderId, senderPassword, documentHash, receiverPublicAddress) {
    const senderWallet = await this.getWallet(senderId);
    if (!senderWallet) {
      throw new Error('Sender wallet not found');
    }
  
    const validPassword = await this.validatePassword(senderId, senderPassword);
    if (!validPassword) {
      throw new Error('Invalid password');
    }
  
    const document = senderWallet.documents.find(doc => doc.hash === documentHash);
    if (!document) {
      throw new Error('Document not found');
    }
  
    const receiverWallet = await this.getWalletByPublicAddress(receiverPublicAddress);
    if (!receiverWallet) {
      throw new Error('Receiver wallet not found');
    }
  
    // Remove the document from sender's wallet
    senderWallet.documents = senderWallet.documents.filter(doc => doc.hash !== documentHash);
    await senderWallet.save();
  
    // Add the document to receiver's wallet
    receiverWallet.documents.push(document);
    await receiverWallet.save();
  
    return document;
  }
  async verifyDocument(documentHash) {
    try {
      // Iterate over the blocks in the chain
      for (let block of this.chain) {
        // Check if the block's data contains the document hash
        if (block.data.hash === documentHash) {
          return true; // Document hash found in the blockchain
        }
      }
      return false; // Document hash not found in the blockchain
    } catch (error) {
      console.error('Error verifying document:', error);
      throw new Error('Error verifying document');
    }
  }

  
}

module.exports = { Block, Blockchain, WalletModel };
