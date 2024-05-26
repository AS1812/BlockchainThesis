const { Web3 = require('web3');
const { abi } = require('./artifacts/contracts/FileStorage.sol/FileStorage.json');

const ganacheURL = 'http://127.0.0.1:8545';
const web3 = new Web3(new Web3.providers.HttpProvider(ganacheURL));

// Replace with your deployed contract address
const contractAddress = '0x95d3f5411e42C2216Bd3fa77991A2c349Cbe2085';
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
    const signedMessage = web3.eth.accounts.sign(documentHash, validPrivateKey);
    return signedMessage.signature;
  }

  async uploadFile(privateKey, cid, fileName, fileType, signature) {
    const account = web3.eth.accounts.privateKeyToAccount(privateKey);
    web3.eth.accounts.wallet.add(account);

    console.log(`Uploading file to blockchain from account: ${account.address}`);

    const gasEstimate = await fileStorageContract.methods.uploadFile(cid, fileName, fileType, signature).estimateGas({ from: account.address });
    console.log(`Estimated gas: ${gasEstimate}`);

    const result = await fileStorageContract.methods.uploadFile(cid, fileName, fileType, signature).send({
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
      timestamp: file.timestamp.toString() // Convert BigInt to string
    }));
  }
}

module.exports = { Blockchain };
