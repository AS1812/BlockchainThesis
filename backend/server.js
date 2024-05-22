const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const { Block, Blockchain, Wallet, WalletModel } = require('./blockchain');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const blockchain = new Blockchain();

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/blockchain', { useNewUrlParser: true, useUnifiedTopology: true });

// Create a new wallet
app.post('/create-wallet', async (req, res) => {
  const { userId, password } = req.body;
  try {
    const existingWallet = await blockchain.getWallet(userId);
    if (existingWallet) {
      res.status(400).send({ message: 'This user ID already has a wallet' });
    } else {
      await blockchain.addWallet(userId, password);
      res.send({ message: 'Wallet created successfully', userId });
    }
  } catch (error) {
    console.error('Error creating wallet:', error);
    res.status(500).send({ message: 'Error creating wallet' });
  }
});

// Connect to the wallet
app.post('/connect-wallet', async (req, res) => {
  const { userId, password } = req.body;
  try {
    const validPassword = await blockchain.validatePassword(userId, password);
    if (validPassword) {
      res.send({ message: 'Wallet connected', userId });
    } else {
      res.status(404).send({ message: 'Invalid user ID or password' });
    }
  } catch (error) {
    console.error('Error connecting to wallet:', error);
    res.status(500).send({ message: 'Error connecting to wallet' });
  }
});

// Change password
app.post('/change-password', async (req, res) => {
  const { userId, oldPassword, newPassword } = req.body;
  try {
    const validPassword = await blockchain.validatePassword(userId, oldPassword);
    if (!validPassword) {
      return res.status(404).send({ message: 'Invalid user ID or password' });
    }

    const hashedNewPassword = crypto.createHash('sha256').update(newPassword).digest('hex');
    await WalletModel.updateOne({ userId }, { password: hashedNewPassword });
    res.send({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).send({ message: 'Error changing password' });
  }
});

// Upload and sign a document
app.post('/upload', async (req, res) => {
  const { userId, password, fileContent } = req.body;
  try {
    const validPassword = await blockchain.validatePassword(userId, password);
    if (!validPassword) {
      return res.status(404).send({ message: 'Invalid user ID or password' });
    }

    const hash = crypto.createHash('sha256').update(fileContent).digest('hex');
    const wallet = await blockchain.getWallet(userId);

    const existingDocument = wallet.documents.find(doc => doc.hash === hash);
    if (existingDocument) {
      res.send({ message: 'Document already signed', hash });
    } else {
      const newBlock = new Block(blockchain.chain.length, Date.now().toString(), { hash });
      await blockchain.addBlock(newBlock);
      wallet.documents.push({ hash, fileContent, timestamp: Date.now() });
      await wallet.save();
      res.send({ message: 'File uploaded and signed', hash });
    }
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).send({ message: 'Error uploading file' });
  }
});

// Retrieve wallet documents
app.get('/wallet/:userId', async (req, res) => {
  const { userId } = req.params;
  const { password } = req.query;  // Note: Use query parameters for GET requests
  try {
    const validPassword = await blockchain.validatePassword(userId, password);
    if (!validPassword) {
      return res.status(404).send({ message: 'Invalid user ID or password' });
    }

    const wallet = await blockchain.getWallet(userId);
    res.json(wallet.documents);
  } catch (error) {
    console.error('Error retrieving wallet:', error);
    res.status(500).send({ message: 'Error retrieving wallet' });
  }
});

// Delete a document from the wallet
app.post('/wallet/:userId/delete', async (req, res) => {
  const { userId } = req.params;
  const { password, hash } = req.body;
  try {
    const validPassword = await blockchain.validatePassword(userId, password);
    if (!validPassword) {
      return res.status(404).send({ message: 'Invalid user ID or password' });
    }

    const wallet = await blockchain.getWallet(userId);
    wallet.documents = wallet.documents.filter(doc => doc.hash !== hash);
    await wallet.save();
    res.send({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).send({ message: 'Error deleting document' });
  }
});

// Retrieve the blockchain
app.get('/blocks', async (req, res) => {
  try {
    const chain = await BlockModel.find().sort({ index: 1 });
    res.json(chain);
  } catch (error) {
    console.error('Error retrieving blocks:', error);
    res.status(500).send({ message: 'Error retrieving blocks' });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
