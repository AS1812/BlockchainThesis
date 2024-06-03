import React, { useState, useCallback } from 'react';
import axios from 'axios';
import './App.css';
import logo from './DocChainLogo.png';
import ParticlesComponent from './components/ParticlesBackground';
import LoadingSpinner from './components/LoadingSpinner';

function App() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const [publicAddress, setPublicAddress] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [balance, setBalance] = useState('');
  const [documents, setDocuments] = useState([]);
  const [showWalletPopup, setShowWalletPopup] = useState(false);
  const [showDocumentsPopup, setShowDocumentsPopup] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState('');
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [showSendPopup, setShowSendPopup] = useState(false);
  const [email, setEmail] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [showUserDetailsPopup, setShowUserDetailsPopup] = useState(false);
  const [sendMessage, setSendMessage] = useState('');
  const [verificationMessage, setVerificationMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifiedData, setVerifiedData] = useState(null);
  const [showVerificationPopup, setShowVerificationPopup] = useState(false);

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prevMode) => !prevMode);
  }, []);

  const handleFileChange = useCallback((e) => {
    setFile(e.target.files[0]);
  }, []);

  const loadWallet = useCallback(async (publicAddress) => {
    try {
      const response = await axios.get(`http://localhost:3000/wallet/${publicAddress}/documents`);
      setDocuments(response.data);
    } catch (error) {
      setMessage('Error loading wallet');
      console.error(error);
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (!loggedInUser) {
      setMessage('Please log in to a wallet first');
      return;
    }

    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target.result.split(',')[1];
        const fileName = file.name;
        const fileType = file.type;
        try {
          await axios.post('http://localhost:3000/upload', {
            privateKey,
            fileContent: content,
            fileName,
            fileType
          });
          setMessage('File uploaded successfully');
          loadWallet(publicAddress);
        } catch (error) {
          setMessage('Error uploading file');
          console.error(error);
        }
      };
      reader.readAsDataURL(file);
    } else {
      setMessage('Please select a file first');
    }
  }, [file, loggedInUser, privateKey, publicAddress, loadWallet]);

  const openWalletPopup = useCallback(() => {
    setMessage('');
    setShowWalletPopup(true);
  }, []);

  const handleConnectWallet = useCallback(async () => {
    try {
      const response = await axios.post('http://localhost:3000/connect-wallet', { privateKey });
      setMessage(response.data.message);
      setLoggedInUser(response.data.publicAddress);
      setPublicAddress(response.data.publicAddress);
      setBalance(response.data.balance);
      loadWallet(response.data.publicAddress);
      setShowWalletPopup(false);
    } catch (error) {
      if (error.response && error.response.data.message) {
        setMessage(error.response.data.message);
      } else {
        setMessage('Error connecting to wallet');
      }
      console.error(error);
    }
  }, [privateKey, loadWallet]);

  const hideDocument = useCallback(async (cid) => {
    try {
      await axios.post(`http://localhost:3000/wallet/${loggedInUser}/hide`, { privateKey, cid });
      setMessage('Document hidden successfully');
      loadWallet(publicAddress);
      setSelectedDocument(null); // Close the document details popup
      setShowDocumentsPopup(true); // Show the documents list popup
    } catch (error) {
      setMessage('Error hiding document');
      console.error(error);
    }
  }, [loggedInUser, publicAddress, loadWallet, privateKey]);

  const disconnectWallet = useCallback(() => {
    setLoggedInUser('');
    setDocuments([]);
    setMessage('Wallet disconnected');
  }, []);

  const connectAnotherWallet = useCallback(() => {
    disconnectWallet();
    setShowWalletPopup(true);
  }, [disconnectWallet]);

  const handleSend = useCallback(async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage('Invalid email address');
      return;
    }

    try {
      await axios.post('http://localhost:3000/send-document', {
        senderId: loggedInUser,
        documentCid: selectedDocument.cid,
        email
      });

      setSelectedDocument(null);
      setShowSendPopup(false);
      setSendMessage(`Document sent successfully to ${email}`);
    } catch (error) {
      setMessage('Error sending document');
      console.error(error);
    }
  }, [loggedInUser, selectedDocument, email]);

  const handleDownloadFile = useCallback(async (cid, fileName) => {
    try {
      const response = await axios.get(`http://localhost:3000/download/${cid}`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (error) {
      setMessage('Error downloading file');
      console.error(error);
    }
  }, []);

  const verifySignature = useCallback(async (documentHash, signature, publicAddress) => {
    setLoading(true);
    setShowVerificationPopup(true);
    try {
      const response = await axios.post('http://localhost:3000/verify-signature', {
        documentHash,
        signature,
        publicAddress
      });
      setVerificationMessage(response.data.message);
      setVerifiedData(response.data);
      setLoading(false);
    } catch (error) {
      setVerificationMessage('Error verifying signature');
      setLoading(false);
      console.error(error);
    }
  }, []);

  const showUserDetails = useCallback(() => {
    setShowUserDetailsPopup(true);
  }, []);

  return (
    <div className={`App ${darkMode ? 'dark-mode' : ''}`}>
      <ParticlesComponent id="particles" darkMode={darkMode} />

      <header className={`App-header ${darkMode ? 'dark-mode' : ''}`}>
        <img src={logo} alt="DocChain Logo" style={{ width: '200px' }} />
        <h1 className={darkMode ? 'dark-mode' : ''}>e-DocChain</h1>
        {loggedInUser && (
          <>
            <div className="upload-container">
              <input type="file" onChange={handleFileChange} className="file-input" />
              <button className="btn" onClick={handleUpload}>Upload and Sign</button>
            </div>
            <button className="btn" onClick={() => setShowDocumentsPopup(true)}>Show Wallet</button>
            <p>{message}</p>
          </>
        )}
      </header>

      <div className="wallet-btn-container">
        {loggedInUser ? (
          <>
            <button className="wallet-btn" onClick={disconnectWallet}>Disconnect Wallet</button>
            <button className="wallet-btn" onClick={connectAnotherWallet}>Connect Another Wallet</button>
          </>
        ) : (
          <button className="wallet-btn" onClick={openWalletPopup}>Connect Wallet</button>
        )}
      </div>

      {showWalletPopup && (
        <div className={`wallet-popup ${darkMode ? 'dark-mode' : ''}`}>
          <div className="wallet-popup-content">
            <h2>Connect Existing Wallet</h2>
            <input
              type="text"
              placeholder="Enter Private Key"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              className="input"
            />
            <button className="btn" onClick={handleConnectWallet}>Connect Wallet</button>
            <button className="btn" onClick={() => setShowWalletPopup(false)}>Close</button>
            <p>{message}</p>
          </div>
        </div>
      )}

      {showDocumentsPopup && (
        <div className={`wallet-popup ${darkMode ? 'dark-mode' : ''}`}>
          <div className="wallet-popup-content">
            {selectedDocument ? (
              <div className="wallet-document-details">
                <h2>{selectedDocument.fileName}</h2>
                <p>Hash: {selectedDocument.hash}</p>
                <p>Timestamp: {new Date(selectedDocument.timestamp * 1000).toLocaleString()}</p>
                <p>Owner ID: {loggedInUser}</p>
                <div className="btn-group">
                  <button className="btn btn-hide" onClick={() => hideDocument(selectedDocument.cid)}>Hide</button>
                  <button className="btn" onClick={() => setShowSendPopup(true)}>Send</button>
                  <button className="btn" onClick={() => handleDownloadFile(selectedDocument.cid, selectedDocument.fileName)}>Download</button>
                  <button className="btn" onClick={() => setSelectedDocument(null)}>Back to List</button>
                  <button className="btn" onClick={() => verifySignature(selectedDocument.hash, selectedDocument.signature, publicAddress)}>Verify Signature</button>
                </div>
                {sendMessage && <p>{sendMessage}</p>}
                {verificationMessage && <p>{verificationMessage}</p>}
              </div>
            ) : (
              <>
                <button className="btn" onClick={showUserDetails}>Show wallet details</button>
                {documents.length === 0 ? (
                  <p>Your wallet has no documents.</p>
                ) : (
                  <ul>
                    {documents.map((doc, index) => (
                      <li key={index} onClick={() => setSelectedDocument(doc)} className={darkMode ? 'dark-mode' : ''}>
                        <p>{doc.fileName}</p>
                        <p>Owner ID: {loggedInUser}</p>
                        <p>Timestamp: {new Date(doc.timestamp * 1000).toLocaleString()}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
            <button className="btn" onClick={() => setShowDocumentsPopup(false)}>Close Wallet</button>
          </div>
        </div>
      )}

      {showSendPopup && (
        <div className={`wallet-popup ${darkMode ? 'dark-mode' : ''}`}>
          <div className="wallet-popup-content">
            <h2>Send Document</h2>
            <input
              type="email"
              placeholder="Enter Receiver's Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
            />
            <button className="btn" onClick={handleSend}>Send Document</button>
            <button className="btn" onClick={() => setShowSendPopup(false)}>Close</button>
            <p>{message}</p>
          </div>
        </div>
      )}

      {showUserDetailsPopup && (
        <div className={`wallet-popup ${darkMode ? 'dark-mode' : ''}`}>
          <div className="wallet-popup-content">
            <h2>Wallet Details</h2>
            <p>Owner ID: {loggedInUser}</p>
            <p>Public Address: {publicAddress}</p>
            <p>Balance: {balance} ETH</p>
            <button className="btn" onClick={() => setShowUserDetailsPopup(false)}>Close</button>
          </div>
        </div>
      )}

      {showVerificationPopup && (
        <div className={`wallet-popup verification-popup ${darkMode ? 'dark-mode' : ''}`}>
          <div className="verification-popup-content">
            {loading ? (
              <LoadingSpinner />
            ) : (
              <>
                <h2>Verification Details</h2>
                {verifiedData && (
                  <div className="verification-details">
                    <p><span className="verified">✔</span> Document Hash: {verifiedData.documentHash}</p>
                    <p><span className="verified">✔</span> Signature: {verifiedData.signature}</p>
                    <p><span className="verified">✔</span> Public Address: {verifiedData.publicAddress}</p>
                    <p><span className="verified">✔</span> Message: {verifiedData.prefixedMessage}</p>
                  </div>
                )}
                <button className="btn" onClick={() => setShowVerificationPopup(false)}>Close</button>
              </>
            )}
            <p>{verificationMessage}</p>
          </div>
        </div>
      )}

      <label className="switch">
        <input type="checkbox" checked={darkMode} onChange={toggleDarkMode} />
        <span className="slider round"></span>
      </label>
    </div>
  );
}

export default App;
