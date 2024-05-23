import React, { useState, useCallback } from 'react';
import axios from 'axios';
import './App.css';
import ParticlesComponent from './components/ParticlesBackground';
import Modal from './components/Modal';

function App() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const [hash, setHash] = useState('');
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [documents, setDocuments] = useState([]);
  const [showWalletPopup, setShowWalletPopup] = useState(false);
  const [walletAction, setWalletAction] = useState('');
  const [showDocumentsPopup, setShowDocumentsPopup] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState('');
  const [publicAddress, setPublicAddress] = useState('');
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [showChangePasswordPopup, setShowChangePasswordPopup] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showTransferPopup, setShowTransferPopup] = useState(false);
  const [receiverPublicAddress, setReceiverPublicAddress] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [showUserDetailsPopup, setShowUserDetailsPopup] = useState(false); // New state for user details popup

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prevMode) => !prevMode);
  }, []);

  const handleFileChange = useCallback((e) => {
    setFile(e.target.files[0]);
  }, []);

  const loadWallet = useCallback(async (userId, password) => {
    try {
      const response = await axios.get(`http://localhost:3000/wallet/${userId}?password=${password}`);
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
            userId: loggedInUser,
            password,
            fileContent: content,
            fileName,
            fileType
          });
          setMessage(response.data.message);
          setHash(response.data.hash);
          loadWallet(loggedInUser, password);
        } catch (error) {
          setMessage('Error uploading file');
          console.error(error);
        }
      };
      reader.readAsDataURL(file);
    } else {
      setMessage('Please select a file first');
    }
  }, [file, loggedInUser, password, loadWallet]);

  const openWalletPopup = useCallback((action) => {
    setMessage('');
    setUserId('');
    setPassword('');
    setWalletAction(action);
    setShowWalletPopup(true);
  }, []);

  const handleCreateWallet = useCallback(async () => {
    try {
      const response = await axios.post('http://localhost:3000/create-wallet', { userId, password });
      setMessage(response.data.message);
      setLoggedInUser(userId);
      setPublicAddress(response.data.publicAddress);
      setShowWalletPopup(false);
    } catch (error) {
      if (error.response && error.response.data.message) {
        setMessage(error.response.data.message);
      } else {
        setMessage('Error creating wallet');
      }
      console.error(error);
    }
  }, [userId, password]);

  const handleConnectWallet = useCallback(async () => {
    try {
      const response = await axios.post('http://localhost:3000/connect-wallet', { userId, password });
      setMessage(response.data.message);
      setLoggedInUser(userId);
      setPublicAddress(response.data.publicAddress);
      loadWallet(userId, password);
      setShowWalletPopup(false);
    } catch (error) {
      if (error.response && error.response.data.message) {
        setMessage(error.response.data.message);
      } else {
        setMessage('Error connecting to wallet');
      }
      console.error(error);
    }
  }, [userId, password, loadWallet]);

  const deleteDocument = useCallback(async (hash) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      try {
        await axios.post(`http://localhost:3000/wallet/${loggedInUser}/delete`, { password, hash });
        setMessage('Document deleted successfully');
        loadWallet(loggedInUser, password);
        setSelectedDocument(null);
      } catch (error) {
        setMessage('Error deleting document');
        console.error(error);
      }
    }
  }, [loggedInUser, password, loadWallet]);

  const disconnectWallet = useCallback(() => {
    setLoggedInUser('');
    setDocuments([]);
    setMessage('Wallet disconnected');
  }, []);

  const connectAnotherWallet = useCallback(() => {
    disconnectWallet();
    setShowWalletPopup(true);
  }, [disconnectWallet]);

  const handleChangePassword = useCallback(async () => {
    try {
      const response = await axios.post('http://localhost:3000/change-password', {
        userId: loggedInUser,
        oldPassword,
        newPassword
      });
      setMessage(response.data.message);
      setShowChangePasswordPopup(false);
    } catch (error) {
      if (error.response && error.response.data.message) {
        setMessage(error.response.data.message);
      } else {
        setMessage('Error changing password');
      }
      console.error(error);
    }
  }, [loggedInUser, oldPassword, newPassword]);

  const handleTransfer = useCallback(async () => {
    try {
      const response = await axios.post('http://localhost:3000/transfer-document', {
        senderId: loggedInUser,
        senderPassword: password,
        documentHash: selectedDocument.hash,
        receiverPublicAddress
      });
  
      // After successful transfer, refresh wallet documents
      await loadWallet(loggedInUser, password);
  
      // Close any open document or popup views
      setSelectedDocument(null);
      setShowDocumentsPopup(true); // Assuming this controls visibility of the main wallet page
      setShowTransferPopup(false);
  
      // Set and clear the transfer success message
      setMessage(response.data.message);
      setTimeout(() => {
        setMessage('');
      }, 4000); // Clear message after 4 seconds
    } catch (error) {
      setMessage('Error transferring document');
      console.error(error);
    }
  }, [loggedInUser, password, loadWallet, selectedDocument, receiverPublicAddress]);
  

  const handleDecodeFile = useCallback(async (hash) => {
    try {
      const response = await axios.post('http://localhost:3000/decode-file', {
        userId: loggedInUser,
        password,
        hash
      });
  
      if (response.data.fileContent && response.data.fileName && response.data.fileType) {
        const base64Data = response.data.fileContent;
        const fileName = response.data.fileName;
        const fileType = response.data.fileType;
  
        // Convert Base64 to binary data
        const byteCharacters = atob(base64Data.replace(/^data:.+;base64,/, ''));
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: fileType });
  
        // Create a link element and trigger a download with the correct file name and type
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
  
        setMessage(response.data.message);
      } else {
        setMessage('Failed to retrieve file details for download.');
      }
    } catch (error) {
      setMessage('Error decoding file');
      console.error(error);
    }
  }, [loggedInUser, password]);
  
  const showUserDetails = useCallback(() => {
    setShowUserDetailsPopup(true);
  }, []);

  return (
    <div className={`App ${darkMode ? 'dark-mode' : ''}`}>
      <ParticlesComponent id="particles" darkMode={darkMode} />

      <header className="App-header">
        <h1 className={darkMode ? 'dark-mode' : ''}>Document Signing</h1>
        {loggedInUser && (
          <>
            <div className="upload-container">
              <input type="file" onChange={handleFileChange} className="file-input" />
              <button className="btn" onClick={handleUpload}>Upload and Sign</button>
            </div>
            <button className="btn" onClick={() => setShowDocumentsPopup(true)}>Show Wallet</button>
            <p>{message}</p>
            {hash && <p>Hash: {hash}</p>}
          </>
        )}
      </header>

      <div className="wallet-btn-container">
        {loggedInUser ? (
          <>
            <button className="wallet-btn" onClick={disconnectWallet}>Disconnect Wallet</button>
            <button className="wallet-btn" onClick={connectAnotherWallet}>Connect Another Wallet</button>
            <button className="wallet-btn" onClick={() => setShowChangePasswordPopup(true)}>Change Password</button>
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
            <input
              type="text"
              placeholder="Enter User ID"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="input"
            />
            <input
              type="password"
              placeholder="Enter Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
            />
            {walletAction === 'create' ? (
              <button className="btn" onClick={handleCreateWallet}>Create Wallet</button>
            ) : (
              <button className="btn" onClick={handleConnectWallet}>Connect Wallet</button>
            )}
            <button className="btn" onClick={() => setShowWalletPopup(false)}>Close</button>
            <p>{message}</p>
          </div>
        </div>
      )}

      {showChangePasswordPopup && (
        <div className={`wallet-popup ${darkMode ? 'dark-mode' : ''}`}>
          <div className="wallet-popup-content">
            <h2>Change Password</h2>
            <input
              type="password"
              placeholder="Enter Old Password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="input"
            />
            <input
              type="password"
              placeholder="Enter New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input"
            />
            <button className="btn" onClick={handleChangePassword}>Change Password</button>
            <button className="btn" onClick={() => setShowChangePasswordPopup(false)}>Close</button>
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
                <p>Timestamp: {new Date(selectedDocument.timestamp).toLocaleString()}</p>
                <p>Owner ID: {loggedInUser}</p>
                <div className="btn-group">
                  <button className="btn btn-delete" onClick={() => deleteDocument(selectedDocument.hash)}>Delete</button>
                  <button className="btn" onClick={() => setShowTransferPopup(true)}>Send</button>
                  <button className="btn" onClick={() => handleDecodeFile(selectedDocument.hash)}>Download</button>
                  <button className="btn" onClick={() => setSelectedDocument(null)}>Back to List</button>
                </div>
              </div>
            ) : (
              <>
                <button className="btn" onClick={showUserDetails}>Show wallet details</button>
                <ul>
                  {documents.map((doc, index) => (
                    <li key={index} onClick={() => setSelectedDocument(doc)} className={darkMode ? 'dark-mode' : ''}>
                      <p>{doc.fileName}</p>
                      <p>Owner ID: {loggedInUser}</p>
                      <p>Timestamp: {new Date(doc.timestamp).toLocaleString()}</p>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <button className="btn" onClick={() => setShowDocumentsPopup(false)}>Close</button>
          </div>
        </div>
      )}

      {showTransferPopup && (
        <div className={`wallet-popup ${darkMode ? 'dark-mode' : ''}`}>
          <div className="wallet-popup-content">
            <h2>Transfer Document</h2>
            <input
              type="text"
              placeholder="Enter Receiver Public Address"
              value={receiverPublicAddress}
              onChange={(e) => setReceiverPublicAddress(e.target.value)}
              className="input"
            />
            <button className="btn" onClick={handleTransfer}>Confirm and Send</button>
            <button className="btn" onClick={() => setShowTransferPopup(false)}>Close</button>
            <p>{message}</p>
          </div>
        </div>
      )}

      {showUserDetailsPopup && (
        <div className={`wallet-popup ${darkMode ? 'dark-mode' : ''}`}>
          <div className="wallet-popup-content">
            <h2>Wallet Details</h2>
            <p>User ID: {loggedInUser}</p>
            <p>Public Address: {publicAddress}</p>
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
