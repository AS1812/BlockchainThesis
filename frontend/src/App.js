import React, { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import ParticlesComponent from './components/ParticlesBackground';
import Modal from './components/Modal';

function App() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const [cid, setCid] = useState('');
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

  const loadWallet = useCallback(async (userId, password) => {
    try {
      const response = await axios.get(`http://localhost:3000/wallet/${userId}/documents?password=${password}`);
      setDocuments(response.data);
    } catch (error) {
      setMessage('Error loading wallet');
      console.error(error);
    }
  }, []);

  useEffect(() => {
    if (loggedInUser && password) {
      const interval = setInterval(() => {
        loadWallet(loggedInUser, password);
      }, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [loggedInUser, password, loadWallet]);
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
          setCid(response.data.cid);
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

  const deleteDocument = useCallback(async (cid) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      try {
        await axios.post(`http://localhost:3000/wallet/${loggedInUser}/delete`, { password, cid });
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

  const handleSend = useCallback(async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage('Invalid email address');
      return;
    }

    try {
      const response = await axios.post('http://localhost:3000/send-document', {
        senderId: loggedInUser,
        senderPassword: password,
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
  }, [loggedInUser, password, selectedDocument, email]);

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
