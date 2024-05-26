// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract FileStorage {
    struct File {
        string cid;
        string fileName;
        string fileType;
        string signature;
        uint256 timestamp;
    }

    mapping(address => File[]) private files;

    event FileUploaded(address indexed user, string cid, string fileName, string fileType, string signature, uint256 timestamp);

    function uploadFile(string memory cid, string memory fileName, string memory fileType, string memory signature) public {
        files[msg.sender].push(File(cid, fileName, fileType, signature, block.timestamp));
        emit FileUploaded(msg.sender, cid, fileName, fileType, signature, block.timestamp);
    }

    function getFiles(address user) public view returns (File[] memory) {
        return files[user];
    }
}
