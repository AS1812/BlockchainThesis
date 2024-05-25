const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const { Blockchain } = require('./blockchain');
const cors = require('cors');
const mongoose = require('mongoose');
const axios = require('axios');
const FormData = require('form-data');
const mailgun = require('mailgun-js');

// Pinata API JWT
const pinataJWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiIyNjI4NjhkYi1lYmVhLTQxZjYtODM1ZS00YWY5YTk2NWRkMzIiLCJlbWFpbCI6ImFuZHJlaS5uaWN1bGFAeWFob28uY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siaWQiOiJGUkExIiwiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjF9LHsiaWQiOiJOWUMxIiwiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjF9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6IjUyMzJjMTgxZTRjMjBkNmY4YWY5Iiwic2NvcGVkS2V5U2VjcmV0IjoiYjA4MDU5ZDQ1OTQ1OTAzYzIyYjc1N2JlZjUxZDk5NTdhYTY3NjI0Yzk0ZTM2M2RmOWY2OGI0MGFjZjllYjc0OSIsImlhdCI6MTcxNjYzMDk0M30.tJryPC7DwJK9ZceeuwkRkTjhwPiqTkUp1uM0LqM41R4';
const DOMAIN = 'sandbox4a6dbe30728e4d07acf8493ce1240d13.mailgun.org';
const mg = mailgun({ apiKey: '6b39e24da26dd0b49807501a479f44c9-a2dd40a3-42e3fa78', domain: DOMAIN });

const app = express();
const blockchain = new Blockchain();

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

mongoose.connect('mongodb://localhost:27017/blockchain', { useNewUrlParser: true, useUnifiedTopology: true });

// Create a new wallet
app.post('/create-wallet', async (req, res) => {
  const { userId, password } = req.body;
  try {
    const existingWallet = await blockchain.getWallet(userId);
    if (existingWallet) {
      res.status(400).send({ message: 'This user ID already has a wallet' });
    } else {
      const wallet = await blockchain.addWallet(userId, password);
      res.send({ message: 'Wallet created successfully', userId, publicAddress: wallet.publicAddress });
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
      const wallet = await blockchain.getWallet(userId);
      res.send({ message: 'Wallet connected', userId, publicAddress: wallet.publicAddress });
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

// Upload document to Pinata with blockchain signing
app.post('/upload', async (req, res) => {
  const { userId, password, fileContent, fileName, fileType } = req.body;
  try {
    const validPassword = await blockchain.validatePassword(userId, password);
    if (!validPassword) {
      return res.status(404).send({ message: 'Invalid user ID or password' });
    }

    const buffer = Buffer.from(fileContent, 'base64');
    const documentHash = crypto.createHash('sha256').update(buffer).digest('hex');

    // Sign the document hash with the user's wallet
    const signature = await blockchain.signDocument(userId, documentHash);

    const formData = new FormData();
    formData.append('file', buffer, { filename: fileName });

    const pinataMetadata = JSON.stringify({
      name: fileName,
      keyvalues: {
        userId: userId,
        fileType: fileType,
        signature: signature,
        timestamp: Date.now().toString()
      },
    });
    formData.append('pinataMetadata', pinataMetadata);

    const pinataOptions = JSON.stringify({
      cidVersion: 0,
    });
    formData.append('pinataOptions', pinataOptions);

    const response = await axios.post("https://api.pinata.cloud/pinning/pinFileToIPFS", formData, {
      maxBodyLength: "Infinity",
      headers: {
        'Content-Type': `multipart/form-data; boundary=${formData._boundary}`,
        'Authorization': `Bearer ${pinataJWT}`
      }
    });
    const cid = response.data.IpfsHash;

    res.send({ message: 'File uploaded and signed', hash: documentHash, signature, cid });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).send({ message: 'Error uploading file' });
  }
});

// Retrieve wallet documents
app.get('/wallet/:userId/documents', async (req, res) => {
  const { userId } = req.params;
  const { password } = req.query;
  try {
    const validPassword = await blockchain.validatePassword(userId, password);
    if (!validPassword) {
      return res.status(404).send({ message: 'Invalid user ID or password' });
    }

    const response = await axios.get("https://api.pinata.cloud/data/pinList", {
      headers: {
        'Authorization': `Bearer ${pinataJWT}`
      },
      params: {
        status: 'pinned',
        'metadata[keyvalues][userId][value]': userId,
        'metadata[keyvalues][userId][op]': 'eq'
      }
    });

    res.json(response.data.rows.map(doc => ({
      cid: doc.ipfs_pin_hash,
      fileName: doc.metadata.name,
      fileType: doc.metadata.keyvalues.fileType,
      signature: doc.metadata.keyvalues.signature,
      timestamp: parseInt(doc.metadata.keyvalues.timestamp, 10),
    })));
  } catch (error) {
    console.error('Error retrieving documents:', error);
    res.status(500).send({ message: 'Error retrieving documents' });
  }
});

// Delete a document from Pinata
app.post('/wallet/:userId/delete', async (req, res) => {
  const { userId } = req.params;
  const { password, cid } = req.body;

  try {
    const validPassword = await blockchain.validatePassword(userId, password);
    if (!validPassword) {
      return res.status(404).send({ message: 'Invalid user ID or password' });
    }

    if (!cid) {
      return res.status(400).send({ message: 'CID is required' });
    }

    const response = await axios.delete(`https://api.pinata.cloud/pinning/unpin/${cid}`, {
      headers: {
        'Authorization': `Bearer ${pinataJWT}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 200) {
      res.send({ message: 'Document deleted successfully' });
    } else {
      res.status(response.status).send({ message: 'Error deleting document from Pinata', error: response.data });
    }
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).send({ message: 'Error deleting document' });
  }
});

// Download file from IPFS
app.get('/download-file', async (req, res) => {
  const { cid } = req.query;

  try {
    const response = await axios.get(`https://gateway.pinata.cloud/ipfs/${cid}`, {
      responseType: 'arraybuffer',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Authorization': `Bearer ${pinataJWT}`
      }
    });

    if (response.status === 200) {
      const fileType = response.headers['content-type'];
      const fileName = `${cid}.${fileType.split('/')[1]}`;

      res.set({
        'Content-Type': fileType,
        'Content-Disposition': `attachment; filename=${fileName}`
      });

      res.send(response.data);
    } else {
      res.status(response.status).send({ message: 'Failed to retrieve file details for download.', error: response.data });
    }
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).send({ message: 'Error downloading file' });
  }
});

app.post('/send-document', async (req, res) => {
  const { senderId, senderPassword, documentCid, email } = req.body;

  if (!documentCid) {
    return res.status(400).send({ message: 'Document CID is required' });
  }

  // Validate email address
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).send({ message: 'Invalid email address' });
  }

  try {
    const validPassword = await blockchain.validatePassword(senderId, senderPassword);
    if (!validPassword) {
      return res.status(401).send({ message: 'Invalid password' });
    }

    const response = await axios.get(`https://gateway.pinata.cloud/ipfs/${documentCid}`, {
      responseType: 'arraybuffer',
      headers: {
        'Authorization': `Bearer ${pinataJWT}`
      }
    });

    if (response.status === 200) {
      const fileName = `${documentCid}.pdf`;

      const emailData = {
        from: `no-reply@${DOMAIN}`,
        to: email,
        subject: 'Document Details',
        html: `<h1>Document Details</h1>
          <p><strong>Owner ID:</strong> ${senderId}</p>
          <p><strong>Document CID:</strong> ${documentCid}</p>
          <p><strong>File Name:</strong> ${fileName}</p>`,
        attachment: {
          data: response.data,
          filename: fileName,
        }
      };

      mg.messages().send(emailData, (error, body) => {
        if (error) {
          console.error('Error sending email:', error);
          res.status(500).send({ message: 'Error sending email' });
        } else {
          console.log('Email sent:', body);
          res.send({ message: 'Email sent successfully' });
        }
      });
    } else {
      res.status(response.status).send({ message: 'Failed to retrieve document from IPFS.', error: response.data });
    }
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).send({ message: 'Internal server error' });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
