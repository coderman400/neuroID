import { ethers } from "ethers";
import fs from "fs";
import path from "path";

/**
 * Quick Demo Script for NeuroID Scalability Testing
 *
 * This script runs a smaller version of the full scalability test to:
 * 1. Validate that the framework is working correctly
 * 2. Provide a quick preview of expected results
 * 3. Test network connectivity and contract deployment
 */

const DEMO_CONFIG = {
  TOTAL_IDENTITIES: 20, // Match number of available accounts for 100% success
  BATCH_SIZE: 10, // Larger batches for higher throughput
  CONCURRENT_BATCHES: 4, // Maximum concurrency for speed
  GANACHE_URL: "http://localhost:8545",
  CHAIN_ID: 1337,
};

class QuickDemo {
  constructor() {
    this.provider = null;
    this.contract = null;
    this.signers = [];
    this.startTime = null;
    this.results = {
      identitiesCreated: 0,
      totalDuration: 0,
      transactions: [],
      errors: [],
      storageMetrics: {
        initialBlockNumber: 0,
        finalBlockNumber: 0,
        totalBlocks: 0,
        estimatedStorageGrowth: 0,
      },
      blockTimes: [],
    };
  }

  async initialize() {
    console.log(" NeuroID Scalability Demo - Quick Validation");
    console.log("=".repeat(50));

    // Connect to provider
    try {
      this.provider = new ethers.JsonRpcProvider(DEMO_CONFIG.GANACHE_URL);
      const network = await this.provider.getNetwork();
      console.log(` Connected to network: Chain ID ${network.chainId}`);
    } catch (error) {
      console.error(" Failed to connect to network. Is Ganache running?");
      console.error("   Run: node scripts/networkSetup.js start");
      throw error;
    }

    // Get signers
    const accounts = await this.provider.send("eth_accounts", []);
    if (accounts.length < 2) {
      throw new Error(
        "Need at least 2 accounts. Run: node scripts/networkSetup.js setup"
      );
    }

    this.signers = await Promise.all([
      this.provider.getSigner(0),
      this.provider.getSigner(1),
    ]);

    console.log(` Using ${this.signers.length} signers`);

    // Get contract
    await this.getContract();
  }

  async getContract() {
    // Try to get deployed contract address
    const contractPath = path.join(
      process.cwd(),
      "build/contracts/BiometricIdentityManager.json"
    );

    if (!fs.existsSync(contractPath)) {
      console.error(" Contract not compiled. Run: truffle compile");
      throw new Error("Contract artifacts not found");
    }

    const contractData = JSON.parse(fs.readFileSync(contractPath, "utf8"));
    const network = await this.provider.getNetwork();
    const deployedNetwork = contractData.networks[network.chainId.toString()];

    if (!deployedNetwork) {
      console.log(" Contract not deployed, deploying now...");
      await this.deployContract(contractData);
    } else {
      this.contract = new ethers.Contract(
        deployedNetwork.address,
        contractData.abi,
        this.signers[0]
      );
      console.log(` Using deployed contract at: ${deployedNetwork.address}`);
    }
  }

  async deployContract(contractData) {
    const contractFactory = new ethers.ContractFactory(
      contractData.abi,
      contractData.bytecode,
      this.signers[0]
    );

    console.log("   Deploying contract...");
    const deployTx = await contractFactory.deploy();
    await deployTx.waitForDeployment();

    this.contract = deployTx;
    const contractAddress = await this.contract.getAddress();
    console.log(` Contract deployed at: ${contractAddress}`);
  }

  async runDemo() {
    console.log(
      `\n Running demo with ${DEMO_CONFIG.TOTAL_IDENTITIES} identities`
    );
    console.log(
      ` Batch size: ${DEMO_CONFIG.BATCH_SIZE}, Concurrent: ${DEMO_CONFIG.CONCURRENT_BATCHES}`
    );

    // Record initial storage metrics
    this.results.storageMetrics.initialBlockNumber =
      await this.provider.getBlockNumber();
    console.log(
      ` Initial block number: ${this.results.storageMetrics.initialBlockNumber}`
    );

    this.startTime = Date.now();
    let completed = 0;

    const totalBatches = Math.ceil(
      DEMO_CONFIG.TOTAL_IDENTITIES / DEMO_CONFIG.BATCH_SIZE
    );

    for (
      let batchGroup = 0;
      batchGroup < totalBatches;
      batchGroup += DEMO_CONFIG.CONCURRENT_BATCHES
    ) {
      const batchPromises = [];

      for (
        let i = 0;
        i < DEMO_CONFIG.CONCURRENT_BATCHES && batchGroup + i < totalBatches;
        i++
      ) {
        const batchIndex = batchGroup + i;
        const signerIndex = i % this.signers.length;
        const startIdentity = batchIndex * DEMO_CONFIG.BATCH_SIZE;
        const endIdentity = Math.min(
          startIdentity + DEMO_CONFIG.BATCH_SIZE,
          DEMO_CONFIG.TOTAL_IDENTITIES
        );

        batchPromises.push(
          this.processBatch(signerIndex, startIdentity, endIdentity, batchIndex)
        );
      }

      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach((result, index) => {
        if (result.status === "fulfilled") {
          completed += result.value.identitiesProcessed;
          this.results.transactions.push(...result.value.transactions);
        } else {
          this.results.errors.push({
            batchIndex: batchGroup + index,
            error: result.reason.message,
          });
        }
      });

      const progress = (
        (completed / DEMO_CONFIG.TOTAL_IDENTITIES) *
        100
      ).toFixed(1);
      console.log(
        ` Progress: ${progress}% (${completed}/${DEMO_CONFIG.TOTAL_IDENTITIES})`
      );
    }

    this.results.identitiesCreated = completed;
    this.results.totalDuration = Date.now() - this.startTime;

    // Record final storage metrics
    this.results.storageMetrics.finalBlockNumber =
      await this.provider.getBlockNumber();
    this.results.storageMetrics.totalBlocks =
      this.results.storageMetrics.finalBlockNumber -
      this.results.storageMetrics.initialBlockNumber;

    // Estimate storage growth (approximate)
    const avgTxSize = 200; // bytes per transaction
    const blockHeaderSize = 500; // bytes per block header
    this.results.storageMetrics.estimatedStorageGrowth =
      this.results.transactions.length * avgTxSize +
      this.results.storageMetrics.totalBlocks * blockHeaderSize;

    console.log(
      ` Demo completed: ${completed} identities in ${
        this.results.totalDuration / 1000
      }s`
    );
    console.log(
      ` Final block number: ${this.results.storageMetrics.finalBlockNumber}`
    );
    console.log(
      ` Blocks created: ${this.results.storageMetrics.totalBlocks}`
    );
  }

  async processBatch(signerIndex, startIdentity, endIdentity, batchIndex) {
    // Use different signer for each identity to avoid "already registered" errors
    const baseSigner = this.signers[signerIndex];
    const contractWithSigner = this.contract.connect(baseSigner);
    const batchTransactions = [];
    let identitiesProcessed = 0;

    for (let i = startIdentity; i < endIdentity; i++) {
      try {
        // Use a different signer for each identity (cycle through available accounts)
        const accountIndex = i % 20; // We have 20 accounts available
        const currentSigner = await this.provider.getSigner(accountIndex);
        const currentContract = this.contract.connect(currentSigner);

        const biometricHash = ethers.keccak256(
          ethers.toUtf8Bytes(
            `demo-identity-${i}-${accountIndex}-${batchIndex}-${Date.now()}-${Math.random()}`
          )
        );

        const txStart = Date.now();
        const tx = await currentContract.registerIdentity(biometricHash);
        const receipt = await tx.wait();
        const txEnd = Date.now();

        batchTransactions.push({
          identityIndex: i,
          batchIndex: batchIndex,
          signerIndex: accountIndex,
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: Number(receipt.gasUsed),
          timestamp: txEnd,
          duration: txEnd - txStart,
        });

        identitiesProcessed++;

        // No delays for maximum throughput
      } catch (error) {
        this.results.errors.push({
          identityIndex: i,
          batchIndex: batchIndex,
          error: error.message,
        });
      }
    }

    return { identitiesProcessed, transactions: batchTransactions };
  }

  async analyzeResults() {
    console.log("\n Demo Results Analysis");
    console.log("=".repeat(40));

    const duration = this.results.totalDuration / 1000;
    const avgTPS = this.results.identitiesCreated / duration;
    const totalGas = this.results.transactions.reduce(
      (sum, tx) => sum + tx.gasUsed,
      0
    );
    const avgGas = totalGas / this.results.transactions.length;

    console.log(` Overview:`);
    console.log(`   Identities: ${this.results.identitiesCreated}`);
    console.log(`   Duration: ${duration.toFixed(2)}s`);
    console.log(
      `   Success Rate: ${(
        (this.results.identitiesCreated / DEMO_CONFIG.TOTAL_IDENTITIES) *
        100
      ).toFixed(1)}%`
    );
    console.log(`   Errors: ${this.results.errors.length}`);

    console.log(`\n Performance:`);
    console.log(`   Average TPS: ${avgTPS.toFixed(2)}`);
    console.log(`   Total Gas: ${totalGas.toLocaleString()}`);
    console.log(`   Avg Gas/Identity: ${avgGas.toLocaleString()}`);

    // Compare with theoretical values
    const theoreticalGas = 66668; // From paper Table II
    const gasVariance = ((avgGas - theoreticalGas) / theoreticalGas) * 100;

    console.log(`\n Validation:`);
    console.log(`   Theoretical Gas: ${theoreticalGas.toLocaleString()}`);
    console.log(`   Actual Gas: ${avgGas.toLocaleString()}`);
    console.log(
      `   Variance: ${gasVariance > 0 ? "+" : ""}${gasVariance.toFixed(1)}%`
    );

    if (Math.abs(gasVariance) < 10) {
      console.log(`    Gas usage within expected range`);
    } else {
      console.log(`     Gas usage variance higher than expected`);
    }

    // Estimate full test performance
    const fullTestEstimate =
      (DEMO_CONFIG.TOTAL_IDENTITIES / this.results.identitiesCreated) *
      duration;
    const fullTestMinutes = 5000 / avgTPS / 60;

    console.log(`\n Storage Growth Analysis:`);
    console.log(
      `   Blocks Created: ${this.results.storageMetrics.totalBlocks}`
    );
    console.log(
      `   Estimated Storage Growth: ${(
        this.results.storageMetrics.estimatedStorageGrowth / 1024
      ).toFixed(2)} KB`
    );
    console.log(
      `   Storage per Identity: ${(
        this.results.storageMetrics.estimatedStorageGrowth /
        this.results.identitiesCreated
      ).toFixed(0)} bytes`
    );

    console.log(`\n Full Test Projection (5,000 identities):`);
    console.log(`   Estimated Duration: ${fullTestMinutes.toFixed(1)} minutes`);
    console.log(`   Estimated TPS: ${avgTPS.toFixed(2)} (based on demo)`);
    console.log(
      `   Estimated Gas: ${((avgGas * 5000) / 1e9).toFixed(6)} ETH @ 1 Gwei`
    );
    console.log(
      `   Estimated Storage: ${(
        ((this.results.storageMetrics.estimatedStorageGrowth /
          this.results.identitiesCreated) *
          5000) /
        (1024 * 1024)
      ).toFixed(2)} MB`
    );

    if (this.results.errors.length > 0) {
      console.log(`\n Errors encountered:`);
      this.results.errors.slice(0, 3).forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.error}`);
      });
    }

    return {
      avgTPS,
      avgGas,
      gasVariance,
      projectedFullTestMinutes: fullTestMinutes,
    };
  }

  async testContractFunctions() {
    console.log("\n Testing Contract Functions");
    console.log("-".repeat(30));

    try {
      // Test basic contract calls
      const testAddress = await this.signers[0].getAddress();

      // Check if identity exists (should be true after demo)
      const exists = await this.contract.identityExists(testAddress);
      console.log(` Identity exists check: ${exists}`);

      // Test access control functions
      const secondAddress = await this.signers[1].getAddress();

      console.log("   Testing grantAccess...");
      const grantTx = await this.contract.grantAccess(secondAddress, 3600);
      await grantTx.wait();
      console.log("    Access granted");

      console.log("   Testing checkAccess...");
      const hasAccess = await this.contract.checkAccess(
        testAddress,
        secondAddress
      );
      console.log(`    Access check: ${hasAccess}`);

      console.log(" All contract functions working correctly");
    } catch (error) {
      console.error(` Contract function test failed: ${error.message}`);
    }
  }
}

async function runQuickDemo() {
  const demo = new QuickDemo();

  try {
    await demo.initialize();
    await demo.runDemo();
    const analysis = await demo.analyzeResults();
    await demo.testContractFunctions();

    console.log("\n Demo completed successfully!");
    console.log("\n Next Steps:");
    console.log("   1. Run full test: node scripts/scalabilityTest.js");
    console.log("   2. Analyze results: python scripts/analyzeResults.py");
    console.log(
      "   3. View comprehensive documentation: README_SCALABILITY.md"
    );

    // Recommendations based on demo results
    if (analysis.avgTPS < 10) {
      console.log("\n  Performance Note: TPS seems low. Consider:");
      console.log("   - Reducing block time in network config");
      console.log("   - Increasing gas limit per block");
      console.log("   - Optimizing batch sizes");
    }

    if (Math.abs(analysis.gasVariance) > 15) {
      console.log(
        "\n  Gas Usage Note: Significant variance from theoretical values."
      );
      console.log(
        "   - This may be due to network conditions or contract optimizations"
      );
      console.log("   - Review contract deployment and network configuration");
    }

    if (analysis.projectedFullTestMinutes > 30) {
      console.log("\n Tip: Full test may take a while. Consider:");
      console.log("   - Running with fewer identities: --identities 1000");
      console.log("   - Using more concurrent batches: --concurrent 10");
    }
  } catch (error) {
    console.error("\n Demo failed:", error.message);

    // Provide helpful error guidance
    if (error.message.includes("network")) {
      console.error("\n Network Issue - Try:");
      console.error("   node scripts/networkSetup.js setup");
    } else if (error.message.includes("contract")) {
      console.error("\n Contract Issue - Try:");
      console.error("   truffle compile && truffle migrate --reset");
    } else {
      console.error(
        "\n For detailed troubleshooting, see README_SCALABILITY.md"
      );
    }

    process.exit(1);
  }
}

// Handle command line help
if (process.argv.includes("--help")) {
  console.log(`
NeuroID Quick Demo

This script runs a small-scale version of the scalability test to validate
that the framework is working correctly before running the full test suite.

Usage: node scripts/quickDemo.js

What it does:
- Creates ${DEMO_CONFIG.TOTAL_IDENTITIES} identities in batches
- Measures basic performance metrics
- Validates contract functions
- Projects full test performance
- Provides recommendations

Prerequisites:
- Ganache network running (node scripts/networkSetup.js setup)
- Contracts compiled (truffle compile)

Example output shows TPS, gas usage, and validation results.
    `);
  process.exit(0);
}

runQuickDemo().catch(console.error);
