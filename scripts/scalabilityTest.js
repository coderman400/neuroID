import { ethers } from "ethers";
import fs from "fs";
import path from "path";

// Configuration
const CONFIG = {
  // Test parameters
  TOTAL_IDENTITIES: 5000, // Number of identities to create
  BATCH_SIZE: 100, // Identities per batch
  CONCURRENT_BATCHES: 5, // Parallel batches

  GANACHE_URL: "http://localhost:8545",
  CHAIN_ID: 1337,

  RESULTS_FILE: "scalability_results.json",
  CSV_FILE: "scalability_metrics.csv",
  LOG_FILE: "scalability_test.log",
};

class ScalabilityTester {
  constructor() {
    this.provider = null;
    this.contract = null;
    this.accounts = [];
    this.signers = [];
    this.results = {
      testStart: null,
      testEnd: null,
      totalDuration: 0,
      identitiesCreated: 0,
      transactions: [],
      blockTimes: [],
      storageMetrics: {
        initialBlockNumber: 0,
        finalBlockNumber: 0,
        totalBlocks: 0,
        estimatedStorageGrowth: 0,
      },
      performanceMetrics: {
        avgTPS: 0,
        maxTPS: 0,
        minTPS: 0,
        avgBlockTime: 0,
        avgGasUsed: 0,
        totalGasUsed: 0,
      },
      errors: [],
    };
  }

  async initialize() {
    console.log(" Initializing Scalability Test Suite");
    this.log("Starting scalability test initialization");

    // Connect to provider
    this.provider = new ethers.JsonRpcProvider(CONFIG.GANACHE_URL);

    // Verify connection
    const network = await this.provider.getNetwork();
    console.log(
      `📡 Connected to network: ${network.name} (Chain ID: ${network.chainId})`
    );

    if (network.chainId !== BigInt(CONFIG.CHAIN_ID)) {
      throw new Error(
        `Expected chain ID ${CONFIG.CHAIN_ID}, got ${network.chainId}`
      );
    }

    // Get accounts
    const accountAddresses = await this.provider.send("eth_accounts", []);
    if (accountAddresses.length < CONFIG.CONCURRENT_BATCHES) {
      throw new Error(
        `Need at least ${CONFIG.CONCURRENT_BATCHES} accounts, got ${accountAddresses.length}`
      );
    }

    this.accounts = accountAddresses.slice(0, CONFIG.CONCURRENT_BATCHES);
    this.signers = await Promise.all(
      this.accounts.map((_, index) => this.provider.getSigner(index))
    );

    console.log(` Using ${this.signers.length} signers for parallel testing`);

    // Deploy contract
    await this.deployContract();

    // Record initial state
    this.results.initialBlockNumber = await this.provider.getBlockNumber();
    console.log(` Initial block number: ${this.results.initialBlockNumber}`);
  }

  async deployContract() {
    console.log(" Deploying BiometricIdentityManager contract...");

    // Read contract artifacts
    const contractPath = path.join(
      process.cwd(),
      "build/contracts/BiometricIdentityManager.json"
    );
    if (!fs.existsSync(contractPath)) {
      throw new Error('Contract not compiled. Run "truffle compile" first.');
    }

    const contractData = JSON.parse(fs.readFileSync(contractPath, "utf8"));
    const contractFactory = new ethers.ContractFactory(
      contractData.abi,
      contractData.bytecode,
      this.signers[0]
    );

    const deployTx = await contractFactory.deploy();
    await deployTx.waitForDeployment();

    this.contract = deployTx;
    const contractAddress = await this.contract.getAddress();

    console.log(` Contract deployed at: ${contractAddress}`);
    this.log(`Contract deployed at ${contractAddress}`);
  }

  async runScalabilityTest() {
    console.log(
      `\n Starting scalability test with ${CONFIG.TOTAL_IDENTITIES} identities`
    );
    console.log(
      ` Batch size: ${CONFIG.BATCH_SIZE}, Concurrent batches: ${CONFIG.CONCURRENT_BATCHES}`
    );

    this.results.testStart = Date.now();
    const startBlock = await this.provider.getBlockNumber();
    this.results.storageMetrics.initialBlockNumber = startBlock;

    let completedIdentities = 0;
    const totalBatches = Math.ceil(CONFIG.TOTAL_IDENTITIES / CONFIG.BATCH_SIZE);

    // Process batches
    for (
      let batchGroup = 0;
      batchGroup < totalBatches;
      batchGroup += CONFIG.CONCURRENT_BATCHES
    ) {
      const batchPromises = [];

      // Create concurrent batches
      for (
        let i = 0;
        i < CONFIG.CONCURRENT_BATCHES && batchGroup + i < totalBatches;
        i++
      ) {
        const batchIndex = batchGroup + i;
        const signerIndex = i % this.signers.length;
        const startIdentity = batchIndex * CONFIG.BATCH_SIZE;
        const endIdentity = Math.min(
          startIdentity + CONFIG.BATCH_SIZE,
          CONFIG.TOTAL_IDENTITIES
        );

        batchPromises.push(
          this.processBatch(signerIndex, startIdentity, endIdentity, batchIndex)
        );
      }

      // Wait for all batches in this group to complete
      const batchResults = await Promise.allSettled(batchPromises);

      // Process results
      batchResults.forEach((result, index) => {
        if (result.status === "fulfilled") {
          completedIdentities += result.value.identitiesProcessed;
          this.results.transactions.push(...result.value.transactions);
        } else {
          this.results.errors.push({
            batchIndex: batchGroup + index,
            error: result.reason.message,
          });
        }
      });

      const progress = (
        ((batchGroup + CONFIG.CONCURRENT_BATCHES) / totalBatches) *
        100
      ).toFixed(1);
      console.log(
        ` Progress: ${progress}% (${completedIdentities}/${CONFIG.TOTAL_IDENTITIES} identities)`
      );
    }

    this.results.testEnd = Date.now();
    this.results.totalDuration = this.results.testEnd - this.results.testStart;
    this.results.identitiesCreated = completedIdentities;

    console.log(
      ` Test completed: ${completedIdentities} identities in ${
        this.results.totalDuration / 1000
      }s`
    );
  }

  async processBatch(signerIndex, startIdentity, endIdentity, batchIndex) {
    const batchTransactions = [];
    let identitiesProcessed = 0;

    for (let i = startIdentity; i < endIdentity; i++) {
      try {
        // Use a different signer for each identity (cycle through available accounts)
        const accountIndex = i % 20;
        const currentSigner = await this.provider.getSigner(accountIndex);
        const currentContract = this.contract.connect(currentSigner);

        const biometricHash = ethers.keccak256(
          ethers.toUtf8Bytes(
            `identity-${i}-${accountIndex}-${batchIndex}-${Date.now()}-${Math.random()}`
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
          biometricHash: biometricHash,
        });

        identitiesProcessed++;
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
    console.log("\n Analyzing results...");

    // Calculate final metrics
    const endBlock = await this.provider.getBlockNumber();
    this.results.storageMetrics.finalBlockNumber = endBlock;
    this.results.storageMetrics.totalBlocks =
      endBlock - this.results.storageMetrics.initialBlockNumber;

    // Calculate TPS metrics
    const timeWindows = this.calculateTPSWindows();
    this.results.performanceMetrics.avgTPS =
      this.results.identitiesCreated / (this.results.totalDuration / 1000);
    this.results.performanceMetrics.maxTPS = Math.max(
      ...timeWindows.map((w) => w.tps)
    );
    this.results.performanceMetrics.minTPS = Math.min(
      ...timeWindows.map((w) => w.tps)
    );

    // Calculate block time metrics
    await this.analyzeBlockTimes();

    // Calculate gas metrics
    const totalGasUsed = this.results.transactions.reduce(
      (sum, tx) => sum + tx.gasUsed,
      0
    );
    this.results.performanceMetrics.totalGasUsed = totalGasUsed;
    this.results.performanceMetrics.avgGasUsed =
      totalGasUsed / this.results.transactions.length;

    // Estimate storage growth
    await this.estimateStorageGrowth();

    this.printResults();
    await this.saveResults();
  }

  calculateTPSWindows() {
    const windows = [];
    const windowSize = 10000; // 10 second windows

    if (this.results.transactions.length === 0) return [];

    const startTime = Math.min(
      ...this.results.transactions.map((tx) => tx.timestamp)
    );
    const endTime = Math.max(
      ...this.results.transactions.map((tx) => tx.timestamp)
    );

    for (
      let windowStart = startTime;
      windowStart < endTime;
      windowStart += windowSize
    ) {
      const windowEnd = windowStart + windowSize;
      const windowTxs = this.results.transactions.filter(
        (tx) => tx.timestamp >= windowStart && tx.timestamp < windowEnd
      );

      if (windowTxs.length > 0) {
        windows.push({
          start: windowStart,
          end: windowEnd,
          transactions: windowTxs.length,
          tps: windowTxs.length / (windowSize / 1000),
        });
      }
    }

    return windows;
  }

  async analyzeBlockTimes() {
    const uniqueBlocks = [
      ...new Set(this.results.transactions.map((tx) => tx.blockNumber)),
    ];
    const blockTimes = [];

    for (let i = 1; i < uniqueBlocks.length; i++) {
      const prevBlock = await this.provider.getBlock(uniqueBlocks[i - 1]);
      const currentBlock = await this.provider.getBlock(uniqueBlocks[i]);

      if (prevBlock && currentBlock) {
        const timeDiff = currentBlock.timestamp - prevBlock.timestamp;
        blockTimes.push(timeDiff);
      }
    }

    this.results.blockTimes = blockTimes;
    if (blockTimes.length > 0) {
      this.results.performanceMetrics.avgBlockTime =
        blockTimes.reduce((sum, time) => sum + time, 0) / blockTimes.length;
    }
  }

  async estimateStorageGrowth() {
    // Estimate storage growth based on transaction data
    const avgTxSize = 200; // Estimated bytes per transaction
    const blockHeaderSize = 500; // Estimated bytes per block header

    const txStorageGrowth = this.results.transactions.length * avgTxSize;
    const blockStorageGrowth =
      this.results.storageMetrics.totalBlocks * blockHeaderSize;

    this.results.storageMetrics.estimatedStorageGrowth =
      txStorageGrowth + blockStorageGrowth;
  }

  printResults() {
    console.log("\n" + "=".repeat(60));
    console.log(" SCALABILITY TEST RESULTS");
    console.log("=".repeat(60));

    console.log(`\n Test Overview:`);
    console.log(
      `   Identities Created: ${this.results.identitiesCreated.toLocaleString()}`
    );
    console.log(
      `   Total Duration: ${(this.results.totalDuration / 1000).toFixed(2)}s`
    );
    console.log(
      `   Success Rate: ${(
        (this.results.identitiesCreated / CONFIG.TOTAL_IDENTITIES) *
        100
      ).toFixed(2)}%`
    );
    console.log(`   Errors: ${this.results.errors.length}`);

    console.log(`\n Performance Metrics:`);
    console.log(
      `   Average TPS: ${this.results.performanceMetrics.avgTPS.toFixed(2)}`
    );
    console.log(
      `   Maximum TPS: ${this.results.performanceMetrics.maxTPS.toFixed(2)}`
    );
    console.log(
      `   Minimum TPS: ${this.results.performanceMetrics.minTPS.toFixed(2)}`
    );
    console.log(
      `   Average Block Time: ${this.results.performanceMetrics.avgBlockTime.toFixed(
        2
      )}s`
    );

    console.log(`\n Gas Metrics:`);
    console.log(
      `   Total Gas Used: ${this.results.performanceMetrics.totalGasUsed.toLocaleString()}`
    );
    console.log(
      `   Average Gas per Tx: ${this.results.performanceMetrics.avgGasUsed.toLocaleString()}`
    );

    console.log(`\n Storage Metrics:`);
    console.log(
      `   Blocks Created: ${this.results.storageMetrics.totalBlocks}`
    );
    console.log(
      `   Estimated Storage Growth: ${(
        this.results.storageMetrics.estimatedStorageGrowth /
        1024 /
        1024
      ).toFixed(2)} MB`
    );

    if (this.results.errors.length > 0) {
      console.log(`\n Errors (${this.results.errors.length}):`);
      this.results.errors.slice(0, 5).forEach((error) => {
        console.log(`   ${error.error}`);
      });
      if (this.results.errors.length > 5) {
        console.log(`   ... and ${this.results.errors.length - 5} more`);
      }
    }
  }

  async saveResults() {
    // Save JSON results
    fs.writeFileSync(
      CONFIG.RESULTS_FILE,
      JSON.stringify(this.results, null, 2)
    );

    // Save CSV for analysis
    const csvContent = this.generateCSV();
    fs.writeFileSync(CONFIG.CSV_FILE, csvContent);

    console.log(`\n Results saved:`);
    console.log(`   JSON: ${CONFIG.RESULTS_FILE}`);
    console.log(`   CSV: ${CONFIG.CSV_FILE}`);
    console.log(`   Log: ${CONFIG.LOG_FILE}`);
  }

  generateCSV() {
    const headers = [
      "Identity Index",
      "Batch Index",
      "Signer Index",
      "Block Number",
      "Gas Used",
      "Duration (ms)",
      "Timestamp",
    ];

    const rows = this.results.transactions.map((tx) => [
      tx.identityIndex,
      tx.batchIndex,
      tx.signerIndex,
      tx.blockNumber,
      tx.gasUsed,
      tx.duration,
      tx.timestamp,
    ]);

    return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp}: ${message}\n`;
    fs.appendFileSync(CONFIG.LOG_FILE, logMessage);
  }
}

// Main execution
async function runScalabilityTest() {
  const tester = new ScalabilityTester();

  try {
    await tester.initialize();
    await tester.runScalabilityTest();
    await tester.analyzeResults();

    console.log("\n Scalability test completed successfully!");
  } catch (error) {
    console.error("\n Test failed:", error.message);
    tester.log(`Test failed: ${error.message}`);
    process.exit(1);
  }
}

// Parse command line arguments
const identitiesIndex = process.argv.indexOf("--identities");
if (identitiesIndex !== -1 && process.argv[identitiesIndex + 1]) {
  const requestedIdentities = parseInt(process.argv[identitiesIndex + 1]);

  CONFIG.TOTAL_IDENTITIES = requestedIdentities;
}

const batchSizeIndex = process.argv.indexOf("--batch-size");
if (batchSizeIndex !== -1 && process.argv[batchSizeIndex + 1]) {
  CONFIG.BATCH_SIZE = parseInt(process.argv[batchSizeIndex + 1]);
}

const concurrentIndex = process.argv.indexOf("--concurrent");
if (concurrentIndex !== -1 && process.argv[concurrentIndex + 1]) {
  CONFIG.CONCURRENT_BATCHES = parseInt(process.argv[concurrentIndex + 1]);
}

// Run the test
runScalabilityTest().catch(console.error);
