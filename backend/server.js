const { Web3 } = require('web3');
const ganacheURL = 'http://127.0.0.1:8545';
const web3 = new Web3(new Web3.providers.HttpProvider(ganacheURL));

const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const { Blockchain } = require('./blockchain');
const cors = require('cors');
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
    const { signature, timestamp } = await blockchain.signDocument(privateKey, documentHash);

    const formData = new FormData();
    formData.append('file', buffer, { filename: fileName });

    const pinataMetadata = JSON.stringify({
      name: fileName,
      keyvalues: {
        fileType: fileType,
        signature: signature,
        hash: documentHash,
        timestamp: timestamp.toString()
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

    await blockchain.uploadFile(privateKey, cid, fileName, fileType, signature, documentHash, timestamp);

    res.send({ message: 'File uploaded and signed', hash: documentHash, signature, cid, timestamp });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).send({ message: 'Error uploading file' });
  }
});

app.get('/wallet/:publicAddress/documents', async (req, res) => {
  const { publicAddress } = req.params;
  try {
    const files = await blockchain.getFiles(publicAddress);

    // Filter out files that are no longer available on IPFS
    const availableFiles = await Promise.all(
      files.map(async (file) => {
        try {
          const response = await axios.head(`https://gateway.pinata.cloud/ipfs/${file.cid}`, {
            headers: {
              'Authorization': `Bearer ${pinataJWT}`
            }
          });
          return response.status === 200 ? file : null;
        } catch (error) {
          return null;
        }
      })
    );

    const visibleFiles = availableFiles.filter(file => file && !file.hidden); // Filter out hidden files and unavailable files
    res.json(visibleFiles);
  } catch (error) {
    console.error('Error loading wallet:', error);
    res.status(500).send({ message: 'Error loading wallet' });
  }
});



app.post('/wallet/:publicAddress/hide', async (req, res) => {
  const { privateKey, cid } = req.body;
  try {
    // Remove the file from Pinata
    await axios.delete(`https://api.pinata.cloud/pinning/unpin/${cid}`, {
      headers: {
        'Authorization': `Bearer ${pinataJWT}`
      }
    });

    await blockchain.hideFile(privateKey, cid);
    res.send({ message: 'Document hidden and removed from IPFS successfully' });
  } catch (error) {
    console.error('Error hiding document:', error);
    res.status(500).send({ message: 'Error hiding document' });
  }
});
// Download file from IPFS
app.get('/download/:cid', async (req, res) => {
  const { cid } = req.params;

  try {
    const response = await axios.get(`https://gateway.pinata.cloud/ipfs/${cid}`, {
      responseType: 'arraybuffer',
      headers: {
        'Authorization': `Bearer ${pinataJWT}`
      }
    });

    if (response.status === 200) {
      res.setHeader('Content-Disposition', `attachment; filename=${cid}`);
      res.send(Buffer.from(response.data, 'binary'));
    } else {
      res.status(response.status).send({ message: 'Failed to retrieve document from IPFS.', error: response.data });
    }
  } catch (error) {
    console.error('Error downloading document:', error);
    res.status(500).send({ message: 'Internal server error' });
  }
});


app.post('/send-document', async (req, res) => {
  const { senderId, documentCid, email } = req.body;

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
      // Retrieve the document metadata from the blockchain
      const documentMetadata = await blockchain.getFiles(senderId);
      const document = documentMetadata.find(doc => doc.cid === documentCid);
      if (!document) {
        return res.status(404).send({ message: 'Document not found in blockchain metadata' });
      }

      const { fileName, hash, signature, timestamp } = document;
      const attachmentBuffer = Buffer.from(response.data, 'binary');

      // Create form data for the email
      const emailContent = new FormData();
      emailContent.append('from', 'no-reply@' + DOMAIN);
      emailContent.append('to', email);
      emailContent.append('subject', 'Document Details');
      emailContent.append('html', `<h1>Hello!</h1>
        <p>You have received a signed document!</p>
        <p><strong>Document hash:</strong> ${hash}</p>
        <p><strong>Public message used for verification:</strong> ${web3.eth.accounts.hashMessage(hash)}</p>
        <p>The document is digitally signed, having the following attributes:</p>
        <ul>
          <li><strong>Public Address:</strong> ${senderId}</li>
          <li><strong>Signature:</strong> ${signature}</li>
          <li><strong>Timestamp:</strong> ${new Date(timestamp * 1000).toUTCString()}</li>
        </ul>
        <p>You can verify the integrity of the file anytime by accessing the following verification link:</p>
        <p><a href="https://etherscan.io/verifiedSignatures#">https://etherscan.io/verifiedSignatures#</a></p>
        <p>Or by regenerating the document HASH, which can be done at the following link:</p>
        <p><a href="https://md5file.com/calculator">https://md5file.com/calculator</a></p>
        <p>Have a nice day!</p>`);
      emailContent.append('attachment', attachmentBuffer, { filename: fileName, contentType: 'application/pdf' });

      // Convert form data to headers and body for request
      const emailOptions = {
        method: 'POST',
        url: `https://api.mailgun.net/v3/${DOMAIN}/messages`,
        headers: {
          ...emailContent.getHeaders(),
          'Authorization': 'Basic ' + Buffer.from('api:' + mg.apiKey).toString('base64')
        },
        data: emailContent
      };

      const emailResponse = await axios(emailOptions);

      if (emailResponse.status === 200) {
        console.log('Email sent:', emailResponse.data);
        res.send({ message: 'Email sent successfully' });
      } else {
        console.error('Error sending email:', emailResponse.data);
        res.status(500).send({ message: 'Error sending email' });
      }
    } else {
      res.status(response.status).send({ message: 'Failed to retrieve document from IPFS.', error: response.data });
    }
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).send({ message: 'Internal server error' });
  }
});


app.post('/verify-signature', (req, res) => {
  const { documentHash, signature, publicAddress } = req.body;

  // Ethereum prefix
  const prefixedMessage = web3.eth.accounts.hashMessage(documentHash);
  const signer = web3.eth.accounts.recover(prefixedMessage, signature);

  if (signer.toLowerCase() === publicAddress.toLowerCase()) {
    res.send({ message: 'Signature is valid', valid: true, documentHash, signature, publicAddress, prefixedMessage });
  } else {
    res.send({ message: 'Signature is invalid', valid: false });
  }
});


const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
