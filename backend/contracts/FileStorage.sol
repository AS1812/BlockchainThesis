// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract FileStorage {
    struct File {
        string cid;
        string fileName;
        string fileType;
        string signature;
        uint256 timestamp;
        string hash;
        bool hidden;
    }

    mapping(address => File[]) private files;

    event FileUploaded(address indexed user, string cid, string fileName, string 
    fileType, string signature, uint256 timestamp, string hash);
    event FileHidden(address indexed user, string cid);

    function uploadFile(string memory cid, string memory fileName, string memory fileType, 
    string memory signature, string memory hash, uint256 timestamp) public {
        files[msg.sender].push(File(cid, fileName, fileType, signature, timestamp, hash, false));
        emit FileUploaded(msg.sender, cid, fileName, fileType, signature, timestamp, hash);
    }

    function getFiles(address user) public view returns (File[] memory) {
        return files[user];
    }

    function hideFile(string memory cid) public {
        File[] storage userFiles = files[msg.sender];
        for (uint i = 0; i < userFiles.length; i++) {
            if (keccak256(abi.encodePacked(userFiles[i].cid)) == keccak256(abi.encodePacked(cid))) {
                userFiles[i].hidden = true;
                emit FileHidden(msg.sender, cid);
                break;
            }
        }
    }
}
