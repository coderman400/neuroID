import { ethers } from "ethers";
import fs from "fs";
import path from "path";

/**
 * NeuroID Diagnostic Script
 * Identifies issues with network setup, contract deployment, and transaction execution
 */

class NetworkDiagnostics {
  constructor() {
    this.provider = null;
    this.contract = null;
    this.signer = null;
  }

  async runFullDiagnostics() {
    console.log(" NeuroID Network Diagnostics");
    console.log("=".repeat(50));

    try {
      await this.checkNetworkConnection();
      await this.checkAccountsAndBalances();
      await this.checkContractDeployment();
      await this.testContractFunctions();
      await this.testTransactionExecution();

      console.log("\n Diagnostics completed");
    } catch (error) {
      console.error(`\n Diagnostics failed: ${error.message}`);
    }
  }

  async checkNetworkConnection() {
    console.log("\n1.  Network Connection Check");
    console.log("-".repeat(30));

    try {
      this.provider = new ethers.JsonRpcProvider("http://localhost:8545");
      const network = await this.provider.getNetwork();
      const blockNumber = await this.provider.getBlockNumber();

      console.log(` Connected to network`);
      console.log(`   Chain ID: ${network.chainId}`);
      console.log(`   Block Number: ${blockNumber}`);
      console.log(`   Network Name: ${network.name}`);
    } catch (error) {
      console.error(` Network connection failed: ${error.message}`);
      console.error(
        "   Make sure Ganache is running: node scripts/networkSetup.js start"
      );
      throw error;
    }
  }

  async checkAccountsAndBalances() {
    console.log("\n2.  Accounts and Balances Check");
    console.log("-".repeat(30));

    try {
      const accounts = await this.provider.send("eth_accounts", []);
      console.log(` Found ${accounts.length} accounts`);

      this.signer = await this.provider.getSigner(0);
      const signerAddress = await this.signer.getAddress();
      const balance = await this.provider.getBalance(signerAddress);

      console.log(`   Primary Account: ${signerAddress}`);
      console.log(`   Balance: ${ethers.formatEther(balance)} ETH`);

      if (parseFloat(ethers.formatEther(balance)) < 1) {
        console.warn(
          "  Low balance detected - may cause transaction failures"
        );
      }
    } catch (error) {
      console.error(` Account check failed: ${error.message}`);
      throw error;
    }
  }

  async checkContractDeployment() {
    console.log("\n3.  Contract Deployment Check");
    console.log("-".repeat(30));

    try {
      const contractPath = path.join(
        process.cwd(),
        "build/contracts/BiometricIdentityManager.json"
      );

      if (!fs.existsSync(contractPath)) {
        console.error(" Contract artifacts not found");
        console.error("   Run: truffle compile");
        throw new Error("Contract not compiled");
      }

      const contractData = JSON.parse(fs.readFileSync(contractPath, "utf8"));
      console.log(` Contract artifacts found`);

      // Check if contract is deployed
      const network = await this.provider.getNetwork();
      const deployedNetwork = contractData.networks[network.chainId.toString()];

      if (!deployedNetwork) {
        console.log("  Contract not deployed, deploying now...");
        await this.deployContract(contractData);
      } else {
        console.log(` Contract deployed at: ${deployedNetwork.address}`);
        this.contract = new ethers.Contract(
          deployedNetwork.address,
          contractData.abi,
          this.signer
        );

        // Verify contract is actually at that address
        const code = await this.provider.getCode(deployedNetwork.address);
        if (code === "0x") {
          console.error(" No contract code at deployed address");
          console.error("   Contract may have been destroyed or network reset");
          console.error("   Run: truffle migrate --reset");
          throw new Error("Contract not found at deployed address");
        } else {
          console.log(` Contract code verified at address`);
        }
      }
    } catch (error) {
      console.error(` Contract deployment check failed: ${error.message}`);
      throw error;
    }
  }

  async deployContract(contractData) {
    try {
      const contractFactory = new ethers.ContractFactory(
        contractData.abi,
        contractData.bytecode,
        this.signer
      );

      console.log("   Deploying contract...");
      const deployTx = await contractFactory.deploy();
      const receipt = await deployTx.waitForDeployment();

      this.contract = deployTx;
      const contractAddress = await this.contract.getAddress();

      console.log(` Contract deployed successfully`);
      console.log(`   Address: ${contractAddress}`);
      console.log(
        `   Gas Used: ${receipt.deploymentTransaction().gasUsed || "Unknown"}`
      );
    } catch (error) {
      console.error(` Contract deployment failed: ${error.message}`);
      throw error;
    }
  }

  async testContractFunctions() {
    console.log("\n4.  Contract Functions Test");
    console.log("-".repeat(30));

    if (!this.contract) {
      console.error(" No contract available for testing");
      return;
    }

    try {
      const signerAddress = await this.signer.getAddress();

      // Test view function first
      console.log("   Testing identityExists (view function)...");
      const exists = await this.contract.identityExists(signerAddress);
      console.log(`    identityExists returned: ${exists}`);

      // Test contract address and ABI
      const contractAddress = await this.contract.getAddress();
      console.log(`   Contract Address: ${contractAddress}`);

      // Check if we can call other view functions
      console.log("   Testing contract interface...");
      const contractInterface = this.contract.interface;
      console.log(
        `    Contract has ${contractInterface.fragments.length} functions`
      );
    } catch (error) {
      console.error(` Contract function test failed: ${error.message}`);

      if (error.message.includes("could not decode result data")) {
        console.error("   This usually means:");
        console.error("   - Contract ABI mismatch");
        console.error("   - Contract not properly deployed");
        console.error("   - Network connection issues");
      }
    }
  }

  async testTransactionExecution() {
    console.log("\n5.  Transaction Execution Test");
    console.log("-".repeat(30));

    if (!this.contract) {
      console.error(" No contract available for testing");
      return;
    }

    try {
      const signerAddress = await this.signer.getAddress();

      // Check if identity already exists
      console.log("   Checking existing identity...");
      const existsBefore = await this.contract.identityExists(signerAddress);
      console.log(`   Identity exists before: ${existsBefore}`);

      if (!existsBefore) {
        console.log("   Testing registerIdentity transaction...");

        const biometricHash = ethers.keccak256(
          ethers.toUtf8Bytes(`diagnostic-test-${Date.now()}`)
        );

        // Estimate gas first
        console.log("   Estimating gas...");
        const gasEstimate = await this.contract.registerIdentity.estimateGas(
          biometricHash
        );
        console.log(`   Gas Estimate: ${gasEstimate.toString()}`);

        // Execute transaction
        console.log("   Executing transaction...");
        const tx = await this.contract.registerIdentity(biometricHash);
        console.log(`   Transaction Hash: ${tx.hash}`);

        console.log("   Waiting for confirmation...");
        const receipt = await tx.wait();
        console.log(
          `    Transaction confirmed in block ${receipt.blockNumber}`
        );
        console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);

        // Verify the transaction worked
        console.log("   Verifying identity was created...");
        const existsAfter = await this.contract.identityExists(signerAddress);
        console.log(`   Identity exists after: ${existsAfter}`);

        if (existsAfter) {
          console.log("    Identity successfully created");
        } else {
          console.error(
            "    Identity was not created despite successful transaction"
          );
        }
      } else {
        console.log(
          "    Identity already exists, testing other functions..."
        );

        // Test getBiometricHash if identity exists
        try {
          const hash = await this.contract.getBiometricHash(signerAddress);
          console.log(`    Retrieved biometric hash: ${hash}`);
        } catch (error) {
          console.error(
            `    Could not retrieve biometric hash: ${error.message}`
          );
        }
      }
    } catch (error) {
      console.error(` Transaction execution failed: ${error.message}`);

      if (error.message.includes("gas")) {
        console.error("   Gas-related issue - check network configuration");
      } else if (error.message.includes("revert")) {
        console.error("   Transaction reverted - check contract logic");
      }
    }
  }

  async checkNetworkPerformance() {
    console.log("\n6.  Network Performance Check");
    console.log("-".repeat(30));

    try {
      const startTime = Date.now();
      const startBlock = await this.provider.getBlockNumber();

      // Wait for a few blocks
      console.log("   Measuring block time...");
      console.log(`   Starting at block ${startBlock}`);

      let currentBlock = startBlock;
      let blockCount = 0;
      const targetBlocks = 3;

      while (blockCount < targetBlocks) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const newBlock = await this.provider.getBlockNumber();
        if (newBlock > currentBlock) {
          currentBlock = newBlock;
          blockCount++;
          console.log(`   Block ${currentBlock} mined`);
        }
      }

      const endTime = Date.now();
      const avgBlockTime = (endTime - startTime) / blockCount / 1000;

      console.log(
        `    Average block time: ${avgBlockTime.toFixed(2)} seconds`
      );

      if (avgBlockTime > 5) {
        console.warn("     Block time seems slow for testing");
      }
    } catch (error) {
      console.error(` Performance check failed: ${error.message}`);
    }
  }
}

async function runDiagnostics() {
  const diagnostics = new NetworkDiagnostics();
  await diagnostics.runFullDiagnostics();
  await diagnostics.checkNetworkPerformance();

  console.log("\n Recommendations:");
  console.log("1. If contract deployment failed: truffle migrate --reset");
  console.log(
    "2. If network issues: restart with node scripts/networkSetup.js setup"
  );
  console.log(
    "3. If gas issues: check network configuration in networkSetup.js"
  );
  console.log(
    "4. If ABI issues: ensure truffle compile completed successfully"
  );

  console.log("\n Next Steps:");
  console.log("- Fix any issues found above");
  console.log("- Re-run: node scripts/quickDemo.js");
  console.log("- If successful, proceed with: node scripts/scalabilityTest.js");
}

runDiagnostics().catch(console.error);
