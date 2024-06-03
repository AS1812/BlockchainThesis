const { Web3 } = require('web3');
const { abi } = require('./artifacts/contracts/FileStorage.sol/FileStorage.json');

const ganacheURL = 'http://127.0.0.1:8545';
const web3 = new Web3(new Web3.providers.HttpProvider(ganacheURL));

const contractAddress = '0xB2078FdE2C5dFbAE98Ad1d3D9874f05536279EF2';
const fileStorageContract = new web3.eth.Contract(abi, contractAddress);

class Blockchain {
  constructor() {}

  async createAccount() {
    const account = web3.eth.accounts.create();
    return account;
  }

  validatePrivateKey(privateKey) {
    if (privateKey.startsWith('0x')) {
      privateKey = privateKey.slice(2);
    }
    if (privateKey.length !== 64) {
      throw new Error('Invalid private key length. Expected 64 characters.');
    }
    return '0x' + privateKey;
  }

  async verifyAccount(privateKey) {
    try {
      const validPrivateKey = this.validatePrivateKey(privateKey);
      const account = web3.eth.accounts.privateKeyToAccount(validPrivateKey);
      const balance = await web3.eth.getBalance(account.address);

      return {
        address: account.address,
        balance: web3.utils.fromWei(balance, 'ether'),
        valid: true
      };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  async signDocument(privateKey, documentHash) {
    const validPrivateKey = this.validatePrivateKey(privateKey);
    const account = web3.eth.accounts.privateKeyToAccount(validPrivateKey);
  
    // Ethereum prefix
    const prefixedMessage = web3.eth.accounts.hashMessage(documentHash);
    const signedMessage = await account.sign(prefixedMessage);
    const timestamp = Math.floor(Date.now() / 1000); // Timestamp in seconds
  
    return { signature: signedMessage.signature, timestamp };
  }

  async uploadFile(privateKey, cid, fileName, fileType, signature, hash, timestamp) {
    const validPrivateKey = this.validatePrivateKey(privateKey);
    const account = web3.eth.accounts.privateKeyToAccount(validPrivateKey);
    web3.eth.accounts.wallet.add(account);

    console.log(`Uploading file to blockchain from account: ${account.address}`);

    const gasEstimate = await fileStorageContract.methods.uploadFile(cid, fileName, fileType,
     signature, hash, timestamp).estimateGas({ from: account.address });
    console.log(`Estimated gas: ${gasEstimate}`);

    const result = await fileStorageContract.methods.uploadFile(cid, fileName, fileType, signature, hash, timestamp).send({
      from: account.address,
      gas: gasEstimate
    });

    console.log('Transaction result:', result);
    return result;
  }

  async getFiles(userAddress) {
    const files = await fileStorageContract.methods.getFiles(userAddress).call();
    return files.map(file => ({
      cid: file.cid,
      fileName: file.fileName,
      fileType: file.fileType,
      signature: file.signature,
      timestamp: parseInt(file.timestamp), // Convert string to integer
      hash: file.hash,
      hidden: file.hidden
    }));
  }
  
  async hideFile(privateKey, cid) {
    const validPrivateKey = this.validatePrivateKey(privateKey);
    const account = web3.eth.accounts.privateKeyToAccount(validPrivateKey);
    web3.eth.accounts.wallet.add(account);

    console.log(`Hiding file from account: ${account.address}`);

    const gasEstimate = await fileStorageContract.methods.hideFile(cid).estimateGas({ from: account.address });
    console.log(`Estimated gas: ${gasEstimate}`);

    const result = await fileStorageContract.methods.hideFile(cid).send({
      from: account.address,
      gas: gasEstimate
    });

    console.log('Transaction result:', result);
    return result;
  }
}

module.exports = { Blockchain };
