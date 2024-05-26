import React, { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import ParticlesComponent from './components/ParticlesBackground';
import Modal from './components/Modal';

function App() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const [cid, setCid] = useState('');
  const [publicAddress, setPublicAddress] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [balance, setBalance] = useState('');
  const [documents, setDocuments] = useState([]);
  const [showWalletPopup, setShowWalletPopup] = useState(false);
  const [walletAction, setWalletAction] = useState('');
  const [showDocumentsPopup, setShowDocumentsPopup] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState('');
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [showSendPopup, setShowSendPopup] = useState(false);
  const [email, setEmail] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [showUserDetailsPopup, setShowUserDetailsPopup] = useState(false);
  const [sendMessage, setSendMessage] = useState('');

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
          const response = await axios.post('http://localhost:3000/upload', {
            privateKey,
            fileContent: content,
            fileName,
            fileType
          });
          setMessage(response.data.message);
          setCid(response.data.cid);
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

  const openWalletPopup = useCallback((action) => {
    setMessage('');
    setShowWalletPopup(true);
  }, []);

  const handleCreateWallet = useCallback(async () => {
    try {
      const response = await axios.post('http://localhost:3000/create-wallet');
      setMessage(response.data.message);
      setLoggedInUser(response.data.publicAddress);
      setPublicAddress(response.data.publicAddress);
      setPrivateKey(response.data.privateKey);
      setShowWalletPopup(false);
    } catch (error) {
      if (error.response && error.response.data.message) {
        setMessage(error.response.data.message);
      } else {
        setMessage('Error creating wallet');
      }
      console.error(error);
    }
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

  const deleteDocument = useCallback(async (cid) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      try {
        await axios.post(`http://localhost:3000/wallet/${loggedInUser}/delete`, { cid });
        setMessage('Document deleted successfully');
        loadWallet(publicAddress);
        setSelectedDocument(null);
      } catch (error) {
        setMessage('Error deleting document');
        console.error(error);
      }
    }
  }, [loggedInUser, publicAddress, loadWallet]);

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
      const response = await axios.post('http://localhost:3000/send-document', {
        senderId: loggedInUser,
        documentCid: selectedDocument.cid,
        email
      });

      // Close any open document or popup views
      setSelectedDocument(null);
      setShowSendPopup(false);

      // Set send success message
      setSendMessage(`Document sent successfully to ${email}`);
    } catch (error) {
      setMessage('Error sending document');
      console.error(error);
    }
  }, [loggedInUser, selectedDocument, email]);

  const handleDownloadFile = useCallback(async (cid) => {
    try {
      const response = await axios.get(`http://localhost:3000/download-file?cid=${cid}`, {
        responseType: 'blob', // Important for file download
      });

      const contentDisposition = response.headers['content-disposition'];
      console.log('Content-Disposition:', contentDisposition); // Debugging line

      let fileName = 'downloaded_file';

      if (contentDisposition) {
        // Try to match both standard and RFC 6266 formats
        const fileNameMatch = contentDisposition.match(/filename\*?=(?:UTF-8'')?['"]?([^;'"]+)['"]?/i);
        if (fileNameMatch && fileNameMatch[1]) {
          fileName = decodeURIComponent(fileNameMatch[1].replace(/['"]/g, ''));
        }
      }

      const blob = new Blob([response.data], { type: response.headers['content-type'] });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setMessage('File downloaded successfully');
    } catch (error) {
      setMessage('Error downloading file');
      console.error(error);
    }
  }, []);

  const showUserDetails = useCallback(() => {
    setShowUserDetailsPopup(true);
  }, []);

  const verifyDocumentIntegrity = useCallback(async (documentHash) => {
    try {
      const response = await axios.post('http://localhost:3000/verify-document', {
        documentHash
      });
      if (response.data.isValid) {
        alert('Document integrity verified.');
      } else {
        alert('Document integrity verification failed.');
      }
    } catch (error) {
      console.error('Error verifying document integrity:', error);
      alert('Error verifying document integrity.');
    }
  }, []);

  return (
    <div className={`App ${darkMode ? 'dark-mode' : ''}`}>
      <ParticlesComponent id="particles" darkMode={darkMode} />

      <header className="App-header">
        <h1 className={darkMode ? 'dark-mode' : ''}>DocOps</h1>
        {loggedInUser && (
          <>
            <div className="upload-container">
              <input type="file" onChange={handleFileChange} className="file-input" />
              <button className="btn" onClick={handleUpload}>Upload and Sign</button>
            </div>
            <button className="btn" onClick={() => setShowDocumentsPopup(true)}>Show Wallet</button>
            <p>{message}</p>
            {cid &&  <p>CID: {cid}</p>}
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
          <>
            <button className="wallet-btn" onClick={() => openWalletPopup('create')}>Create Wallet</button>
            <button className="wallet-btn" onClick={() => openWalletPopup('connect')}>Connect Wallet</button>
          </>
        )}
      </div>

      {showWalletPopup && (
        <div className={`wallet-popup ${darkMode ? 'dark-mode' : ''}`}>
          <div className="wallet-popup-content">
            <h2>{walletAction === 'create' ? 'Create Wallet' : 'Connect Existing Wallet'}</h2>
            {walletAction === 'create' ? (
              <button className="btn" onClick={handleCreateWallet}>Create Wallet</button>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Enter Private Key"
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                  className="input"
                />
                <button className="btn" onClick={handleConnectWallet}>Connect Wallet</button>
              </>
            )}
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
                <p>CID: {selectedDocument.cid}</p>
                <p>Timestamp: {new Date(selectedDocument.timestamp).toLocaleString()}</p>
                <p>Owner ID: {loggedInUser}</p>
                <div className="btn-group">
                  <button className="btn btn-delete" onClick={() => deleteDocument(selectedDocument.cid)}>Delete</button>
                  <button className="btn" onClick={() => setShowSendPopup(true)}>Send</button>
                  <button className="btn" onClick={() => handleDownloadFile(selectedDocument.cid)}>Download</button>
                  <button className="btn" onClick={() => setSelectedDocument(null)}>Back to List</button>
                  <button className="btn" onClick={() => verifyDocumentIntegrity(selectedDocument.hash)}>Verify Integrity</button>
                </div>
                {sendMessage && <p>{sendMessage}</p>}
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
                        <p>Timestamp: {new Date(doc.timestamp).toLocaleString()}</p>
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

      <label className="switch">
        <input type="checkbox" checked={darkMode} onChange={toggleDarkMode} />
        <span className="slider round"></span>
      </label>
    </div>
  );
}

export default App;
