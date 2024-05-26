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


app.post('/create-wallet', async (req, res) => {
  try {
    const account = await blockchain.createAccount();
    res.send({ message: 'Wallet created successfully', publicAddress: account.address, privateKey: account.privateKey });
  } catch (error) {
    console.error('Error creating wallet:', error);
    res.status(500).send({ message: 'Error creating wallet' });
  }
});

app.post('/connect-wallet', async (req, res) => {
  const { privateKey } = req.body;
  try {
    const verification = await blockchain.verifyAccount(privateKey);
    if (!verification.valid) {
      return res.status(400).send({ message: 'Invalid private key or insufficient balance', error: verification.error });
    }

    res.send({ message: 'Wallet connected successfully', publicAddress: verification.address, balance: verification.balance });
  } catch (error) {
    console.error('Error connecting to wallet:', error);
    res.status(500).send({ message: 'Error connecting to wallet' });
  }
});

app.post('/upload', async (req, res) => {
  const { privateKey, fileContent, fileName, fileType } = req.body;
  try {
    const buffer = Buffer.from(fileContent, 'base64');
    const documentHash = crypto.createHash('sha256').update(buffer).digest('hex');

    const signature = await blockchain.signDocument(privateKey, documentHash);

    const formData = new FormData();
    formData.append('file', buffer, { filename: fileName });

    const pinataMetadata = JSON.stringify({
      name: fileName,
      keyvalues: {
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

    console.log('Uploading file to blockchain with CID:', cid);

    await blockchain.uploadFile(privateKey, cid, fileName, fileType, signature);

    res.send({ message: 'File uploaded and signed', hash: documentHash, signature, cid });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).send({ message: 'Error uploading file' });
  }
});

app.get('/wallet/:publicAddress/documents', async (req, res) => {
  const { publicAddress } = req.params;
  try {
    const files = await blockchain.getFiles(publicAddress);
    res.json(files); // Use res.json to handle JSON serialization
  } catch (error) {
    console.error('Error loading wallet:', error);
    res.status(500).send({ message: 'Error loading wallet' });
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