async function main() {
    const [deployer] = await ethers.getSigners();
  
    console.log("Deploying contracts with the account:", deployer.address);
  
    const FileStorage = await ethers.getContractFactory("FileStorage");
    const fileStorage = await FileStorage.deploy();
  
    console.log("FileStorage contract deployed to:", fileStorage.address);
  }
  
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
  