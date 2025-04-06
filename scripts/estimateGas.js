import { ethers } from 'ethers';
import BiometricIdentityManager from '../build/contracts/BiometricIdentityManager.json' assert { type: 'json' };

async function estimateGasCosts() {
  // 1. Connect to Ganache
  const provider = new ethers.JsonRpcProvider('http://localhost:8545');

  // 2. Get funded accounts
  const accounts = await provider.listAccounts();
  if (accounts.length < 3) {
      // Fetch accounts from the provider directly if listAccounts isn't populated
      const fetchedAccounts = await provider.send("eth_accounts", []);
      if (fetchedAccounts.length < 3) {
          throw new Error("Need at least 3 accounts in Ganache. Ensure Ganache is running and has funded accounts.");
      }
      // Use fetched accounts if necessary (less common now with JsonRpcProvider)
      // accounts = fetchedAccounts; // Uncomment if provider.listAccounts() is empty but eth_accounts works
      // For robustness, it's better to ensure listAccounts works as expected.
      throw new Error("provider.listAccounts() returned too few accounts. Need at least 3 in Ganache.");

  }


  // 3. Create signers and get addresses
  const signer = await provider.getSigner(0);
  const address = await signer.getAddress(); // <<< FIX: Await the result of getAddress()
  const secondAddress = accounts[1];         // This was already correct
  const guardianAddress = accounts[2];       // This was already correct


  // 4. Get contract instance
  const network = await provider.getNetwork();
  const networkId = network.chainId;
  const deployedNetwork = BiometricIdentityManager.networks[networkId.toString()];

  if (!deployedNetwork) {
    throw new Error(`Contract not deployed on network ${networkId} (${network.name}). Run 'truffle migrate' first.`);
  }

  const contract = new ethers.Contract(
    deployedNetwork.address,
    BiometricIdentityManager.abi,
    signer
  );

  // 5. Generate test data and get fee data
  const biometricHash = ethers.keccak256(ethers.toUtf8Bytes('test-biometric-data'));

  // <<< IMPROVEMENT: Use getFeeData for gas price
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice;

  if (!gasPrice) {
      throw new Error("Could not fetch gas price (feeData.gasPrice is null). Check Ganache.");
  }

  // Helper function for formatting output
  const formatGas = (gasEstimate) => {
      // Use BigInt for multiplication for accuracy
      const costWei = gasEstimate * gasPrice;
      return `${gasEstimate} gas (${ethers.formatEther(costWei)} ETH)`;
  };

  console.log('=== GAS COST ESTIMATES ===');
  console.log(`Using gas price: ${ethers.formatUnits(gasPrice, 'gwei')} Gwei`);
  console.log(`Contract address: ${await contract.getAddress()}`);
  console.log(`Signer address: ${address}`);


  try {
    // 1. registerIdentity
    console.log('\nEstimating registerIdentity...');
    const registerEstimate = await contract.registerIdentity.estimateGas(biometricHash);
    console.log(`registerIdentity: ${formatGas(registerEstimate)}`);

    console.log('Executing registerIdentity...');
    const registerTx = await contract.registerIdentity(biometricHash);
    await registerTx.wait();
    console.log('registerIdentity executed.');

    // 2. updateIdentity
    const newHash = ethers.keccak256(ethers.toUtf8Bytes('new-biometric-data'));
    console.log('\nEstimating updateIdentity...');
    const updateEstimate = await contract.updateIdentity.estimateGas(newHash);
    console.log(`updateIdentity: ${formatGas(updateEstimate)}`);
    // You might want to execute this too if subsequent steps depend on it
    // const updateTx = await contract.updateIdentity(newHash);
    // await updateTx.wait();

    // 3. verifyIdentity
    console.log('\nEstimating verifyIdentity...');
    // Ensure the hash being verified actually matches the *current* registered hash
    const verifyEstimate = await contract.verifyIdentity.estimateGas(address, biometricHash); // Or newHash if updated
    console.log(`verifyIdentity: ${formatGas(verifyEstimate)}`);

    // 4. grantAccess
    console.log('\nEstimating grantAccess...');
    const grantEstimate = await contract.grantAccess.estimateGas(secondAddress, 3600);
    console.log(`grantAccess: ${formatGas(grantEstimate)}`);

    console.log('Executing grantAccess...');
    const grantTx = await contract.grantAccess(secondAddress, 3600);
    await grantTx.wait();
    console.log('grantAccess executed.');

    // 5. checkAccess
    console.log('\nEstimating checkAccess...');
    const checkEstimate = await contract.checkAccess.estimateGas(address, secondAddress);
    console.log(`checkAccess: ${formatGas(checkEstimate)}`);

    // 6. revokeAccess
    console.log('\nEstimating revokeAccess...');
    const revokeEstimate = await contract.revokeAccess.estimateGas(secondAddress);
    console.log(`revokeAccess: ${formatGas(revokeEstimate)}`);
    // Execute if needed for subsequent steps
    // const revokeTx = await contract.revokeAccess(secondAddress);
    // await revokeTx.wait();


    // 7. logAccess (Note: This function might only be callable by the contract owner or specific addresses depending on implementation)
    // Make sure the signer (address) has permission if required by the contract
    try {
        console.log('\nEstimating logAccess...');
        const logEstimate = await contract.logAccess.estimateGas(
          address,          // owner
          secondAddress,    // accessor
          Math.floor(Date.now()/1000), // timestamp
          true              // success
        );
        console.log(`logAccess: ${formatGas(logEstimate)}`);
    } catch(logError) {
        console.error(`Could not estimate logAccess: ${logError.message}. Check contract permissions.`);
    }


    // 8. addGuardian
    console.log('\nEstimating addGuardian...');
    const addGuardianEstimate = await contract.addGuardian.estimateGas(guardianAddress);
    console.log(`addGuardian: ${formatGas(addGuardianEstimate)}`);

    console.log('Executing addGuardian...');
    const addTx = await contract.addGuardian(guardianAddress);
    await addTx.wait();
    console.log('addGuardian executed.');

    // 9. removeGuardian
    console.log('\nEstimating removeGuardian...');
    const removeEstimate = await contract.removeGuardian.estimateGas(guardianAddress);
    console.log(`removeGuardian: ${formatGas(removeEstimate)}`);
    // Execute if needed
    // const removeTx = await contract.removeGuardian(guardianAddress);
    // await removeTx.wait();

    // Helper functions (Read-only calls don't typically need gas estimation like this,
    // but estimateGas can still work for view/pure functions, often returning ~21000 base gas)
    console.log('\n=== HELPER FUNCTION ESTIMATES (View/Pure) ===');

    console.log('\nEstimating identityExists...');
    const existsEstimate = await contract.identityExists.estimateGas(address);
    console.log(`identityExists: ${formatGas(existsEstimate)}`);

    // You need to add a guardian first before getting one for a specific address
    // Ensure addGuardian was executed above
    console.log('\nEstimating getGuardian...');
    const guardianEstimate = await contract.getGuardian.estimateGas(address);
    console.log(`getGuardian: ${formatGas(guardianEstimate)}`);

  } catch (error) {
    console.error('\nExecution failed:');
    // Log the full error object for more details
    console.error(error);

     // Provide more specific hints based on common errors
    if (error.message.includes("Contract not deployed")) {
        console.error("Hint: Make sure you have run 'truffle migrate' successfully on the Ganache network.");
    } else if (error.message.includes("sender doesn't have enough funds")) {
        console.error("Hint: Ensure the account used as the signer has enough ETH in Ganache.");
        console.error(`Signer address: ${address}`);
    } else if (error.code === 'CALL_EXCEPTION') {
         console.error("Hint: A contract requirement might not be met (e.g., calling updateIdentity before registerIdentity, permission errors, incorrect arguments). Check the transaction reverted reason if available.");
         if(error.reason) {
             console.error(`Revert Reason: ${error.reason}`);
         }
    }
  }
}

estimateGasCosts()
  .then(() => {
      console.log("\nScript finished.");
      process.exit(0);
  })
  .catch(err => {
      console.error("\nUnhandled error in script execution:", err);
      process.exit(1);
  });