import { ethers } from "ethers";
import fs from "fs";
import path from "path";

// Enhanced Multi-Node PoA Scalability Test
// This is an improved version of the original scalability test designed specifically for multi-node PoA networks

const CONFIG = {
  // Multi-node validator endpoints
  VALIDATORS: [
    {
      name: "validator1",
      rpc: "http://10.0.1.10:8545",
      ws: "ws://10.0.1.10:9545",
    },
    {
      name: "validator2",
      rpc: "http://10.0.1.11:8546",
      ws: "ws://10.0.1.11:9546",
    },
    {
      name: "validator3",
      rpc: "http://10.0.1.12:8547",
      ws: "ws://10.0.1.12:9547",
    },
    {
      name: "validator4",
      rpc: "http://10.0.1.13:8548",
      ws: "ws://10.0.1.13:9548",
    },
    {
      name: "validator5",
      rpc: "http://10.0.1.14:8549",
      ws: "ws://10.0.1.14:9549",
    },
    {
      name: "validator6",
      rpc: "http://10.0.1.15:8550",
      ws: "ws://10.0.1.15:9550",
    },
    {
      name: "validator7",
      rpc: "http://10.0.1.16:8551",
      ws: "ws://10.0.1.16:9551",
    },
  ],

  // Enhanced test parameters
  TOTAL_IDENTITIES: 10000, // Increased for stress testing
  BATCH_SIZE: 200, // Larger batches for efficiency
  CONCURRENT_BATCHES: 10, // More concurrent operations
  VALIDATOR_DISTRIBUTION: true, // Distribute load across validators

  // Advanced monitoring
  REAL_TIME_MONITORING: true,
  BLOCK_MONITORING: true,
  MEMPOOL_MONITORING: true,
  PERFORMANCE_PROFILING: true,

  // Load testing phases
  PHASES: [
    { name: "ramp_up", duration: 120000, load_multiplier: 0.5 },
    { name: "sustained", duration: 300000, load_multiplier: 1.0 },
    { name: "peak", duration: 180000, load_multiplier: 1.5 },
    { name: "ramp_down", duration: 120000, load_multiplier: 0.7 },
  ],

  // Output files
  RESULTS_FILE: "enhanced_scalability_results.json",
  CSV_FILE: "enhanced_scalability_metrics.csv",
  PERFORMANCE_LOG: "performance_profile.json",
  REAL_TIME_LOG: "realtime_metrics.log",
};

class EnhancedScalabilityTester {
  constructor() {
    this.providers = new Map();
    this.wsProviders = new Map();
    this.signers = new Map();
    this.contract = null;
    this.results = {
      testStart: null,
      testEnd: null,
      totalDuration: 0,
      identitiesCreated: 0,
      phases: [],
      transactions: [],
      blockMetrics: [],
      mempoolMetrics: [],
      validatorMetrics: new Map(),
      performanceProfile: {},
      networkHealth: {},
      errors: [],
    };
    this.realTimeMonitor = null;
    this.currentPhase = null;
  }

  async initialize() {
    console.log("STARTING Initializing Enhanced Multi-Node PoA Scalability Test");
    this.log("Starting enhanced scalability test initialization");

    // Initialize connections to all validators
    await this.initializeValidatorConnections();

    // Deploy test contract
    await this.deployTestContract();

    // Initialize monitoring systems
    if (CONFIG.REAL_TIME_MONITORING) {
      await this.initializeRealTimeMonitoring();
    }

    // Establish baseline metrics
    await this.establishBaseline();

    console.log("SUCCESS Enhanced initialization completed");
  }

  async initializeValidatorConnections() {
    console.log("CONNECTING Connecting to all validators...");

    let connectedValidators = 0;

    for (const validator of CONFIG.VALIDATORS) {
      try {
        // HTTP provider for transactions
        const httpProvider = new ethers.JsonRpcProvider(validator.rpc);
        this.providers.set(validator.name, httpProvider);

        // WebSocket provider for real-time monitoring
        if (CONFIG.REAL_TIME_MONITORING) {
          const wsProvider = new ethers.WebSocketProvider(validator.ws);
          this.wsProviders.set(validator.name, wsProvider);
        }

        // Get multiple signers for distributed load
        const signers = [];
        for (let i = 0; i < 10; i++) {
          // More signers per validator
          try {
            const signer = await httpProvider.getSigner(i);
            signers.push(signer);
          } catch (error) {
            break; // No more signers available
          }
        }
        this.signers.set(validator.name, signers);

        // Test connection
        const blockNumber = await httpProvider.getBlockNumber();
        console.log(
          `SUCCESS Connected to ${validator.name}: Block ${blockNumber}, ${signers.length} signers`
        );
        connectedValidators++;

        // Initialize validator metrics tracking
        this.results.validatorMetrics.set(validator.name, {
          transactionsSent: 0,
          transactionsConfirmed: 0,
          errors: 0,
          avgConfirmationTime: 0,
          gasUsed: 0,
        });
      } catch (error) {
        console.error(
          `ERROR Failed to connect to ${validator.name}:`,
          error.message
        );
        this.results.errors.push({
          phase: "initialization",
          validator: validator.name,
          error: error.message,
          timestamp: Date.now(),
        });
      }
    }

    if (connectedValidators === 0) {
      throw new Error("Could not connect to any validators");
    }

    console.log(
      `METRICS Connected to ${connectedValidators}/${CONFIG.VALIDATORS.length} validators`
    );
    this.log(
      `Connected to ${connectedValidators}/${CONFIG.VALIDATORS.length} validators`
    );
  }

  async deployTestContract() {
    console.log("DEPLOYING Deploying enhanced test contract...");

    const contractPath = path.join(
      process.cwd(),
      "build/contracts/BiometricIdentityManager.json"
    );

    if (!fs.existsSync(contractPath)) {
      throw new Error('Contract not compiled. Run "truffle compile" first.');
    }

    const contractData = JSON.parse(fs.readFileSync(contractPath, "utf8"));

    // Use the first available signer
    const firstValidator = Array.from(this.signers.keys())[0];
    const signers = this.signers.get(firstValidator);
    const deploySigner = signers[0];

    const contractFactory = new ethers.ContractFactory(
      contractData.abi,
      contractData.bytecode,
      deploySigner
    );

    const deployTx = await contractFactory.deploy();
    await deployTx.waitForDeployment();
    this.contract = deployTx;

    const contractAddress = await this.contract.getAddress();
    console.log(`SUCCESS Contract deployed at: ${contractAddress}`);
    this.log(`Contract deployed at ${contractAddress}`);
  }

  async initializeRealTimeMonitoring() {
    console.log("MONITORING Initializing real-time monitoring...");

    // Start block monitoring for all validators
    for (const [validatorName, wsProvider] of this.wsProviders) {
      wsProvider.on("block", (blockNumber) => {
        this.recordBlockMetric(validatorName, blockNumber);
      });
    }

    // Start periodic mempool monitoring
    this.startMempoolMonitoring();

    console.log("METRICS Real-time monitoring active");
  }

  startMempoolMonitoring() {
    const mempoolInterval = setInterval(async () => {
      if (!this.currentPhase) return;

      const mempoolSnapshot = {
        timestamp: Date.now(),
        phase: this.currentPhase.name,
        validators: {},
      };

      for (const [validatorName, provider] of this.providers) {
        try {
          const mempoolStatus = await provider.send("txpool_status", []);
          const pendingCount = await provider.send(
            "eth_getBlockTransactionCountByNumber",
            ["pending"]
          );

          mempoolSnapshot.validators[validatorName] = {
            pending: parseInt(pendingCount, 16),
            mempoolStatus,
          };
        } catch (error) {
          mempoolSnapshot.validators[validatorName] = { error: error.message };
        }
      }

      this.results.mempoolMetrics.push(mempoolSnapshot);
    }, 5000); // Every 5 seconds

    this.mempoolMonitorInterval = mempoolInterval;
  }

  recordBlockMetric(validatorName, blockNumber) {
    const blockMetric = {
      timestamp: Date.now(),
      validator: validatorName,
      blockNumber,
      phase: this.currentPhase?.name || "unknown",
    };

    this.results.blockMetrics.push(blockMetric);

    // Real-time logging
    this.logRealTime(`Block ${blockNumber} seen by ${validatorName}`);
  }

  async establishBaseline() {
    console.log("METRICS Establishing network baseline...");

    const baseline = {
      timestamp: Date.now(),
      validators: {},
      networkMetrics: {},
    };

    // Get baseline from each validator
    for (const [validatorName, provider] of this.providers) {
      try {
        const [blockNumber, gasPrice, balance] = await Promise.all([
          provider.getBlockNumber(),
          provider.getGasPrice(),
          provider.getBalance(await provider.getSigner(0).getAddress()),
        ]);

        baseline.validators[validatorName] = {
          blockNumber,
          gasPrice: Number(gasPrice),
          balance: Number(balance),
        };
      } catch (error) {
        baseline.validators[validatorName] = { error: error.message };
      }
    }

    // Calculate network-wide metrics
    const validValidators = Object.values(baseline.validators).filter(
      (v) => !v.error
    );
    if (validValidators.length > 0) {
      baseline.networkMetrics = {
        avgGasPrice:
          validValidators.reduce((sum, v) => sum + v.gasPrice, 0) /
          validValidators.length,
        blockSpread:
          Math.max(...validValidators.map((v) => v.blockNumber)) -
          Math.min(...validValidators.map((v) => v.blockNumber)),
        activeValidators: validValidators.length,
      };
    }

    this.results.baseline = baseline;
    console.log(
      `ANALYZING Baseline: ${baseline.networkMetrics.activeValidators} active validators, ${baseline.networkMetrics.blockSpread} block spread`
    );
  }

  async runEnhancedScalabilityTest() {
    console.log(`\nSTARTING Starting enhanced multi-phase scalability test`);
    console.log(`METRICS Total identities: ${CONFIG.TOTAL_IDENTITIES}`);
    console.log(`PROCESSING Test phases: ${CONFIG.PHASES.length}`);

    this.results.testStart = Date.now();

    for (const [phaseIndex, phase] of CONFIG.PHASES.entries()) {
      console.log(
        `\nTARGETING Phase ${phaseIndex + 1}/${
          CONFIG.PHASES.length
        }: ${phase.name.toUpperCase()}`
      );
      console.log(
        `   Duration: ${phase.duration / 1000}s, Load: ${
          phase.load_multiplier
        }x`
      );

      this.currentPhase = phase;
      const phaseResult = await this.executePhase(phase, phaseIndex);
      this.results.phases.push(phaseResult);

      // Brief pause between phases
      if (phaseIndex < CONFIG.PHASES.length - 1) {
        console.log("   PAUSING Phase transition pause...");
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    }

    this.results.testEnd = Date.now();
    this.results.totalDuration = this.results.testEnd - this.results.testStart;

    // Stop monitoring
    if (this.mempoolMonitorInterval) {
      clearInterval(this.mempoolMonitorInterval);
    }

    console.log(
      `\nSUCCESS Test completed: ${this.results.identitiesCreated} identities in ${
        this.results.totalDuration / 1000
      }s`
    );

    await this.analyzeEnhancedResults();
  }

  async executePhase(phase, phaseIndex) {
    const phaseStart = Date.now();
    const phaseResult = {
      name: phase.name,
      index: phaseIndex,
      startTime: phaseStart,
      duration: phase.duration,
      loadMultiplier: phase.load_multiplier,
      identitiesCreated: 0,
      transactions: [],
      errors: [],
      metrics: {},
    };

    // Calculate adjusted parameters for this phase
    const adjustedBatchSize = Math.floor(
      CONFIG.BATCH_SIZE * phase.load_multiplier
    );
    const adjustedConcurrent = Math.floor(
      CONFIG.CONCURRENT_BATCHES * phase.load_multiplier
    );
    const targetIdentities = Math.floor(
      (CONFIG.TOTAL_IDENTITIES * phase.load_multiplier) / CONFIG.PHASES.length
    );

    console.log(
      `   ANALYZING Adjusted params: ${adjustedBatchSize} batch size, ${adjustedConcurrent} concurrent, ${targetIdentities} target identities`
    );

    let completedIdentities = 0;
    let identityCounter = phaseIndex * 10000; // Ensure unique IDs across phases

    const phaseEndTime = phaseStart + phase.duration;

    while (
      Date.now() < phaseEndTime &&
      completedIdentities < targetIdentities
    ) {
      const remainingTime = phaseEndTime - Date.now();
      const remainingIdentities = targetIdentities - completedIdentities;

      if (remainingTime <= 0) break;

      // Create concurrent batches for this iteration
      const batchPromises = [];
      const batchesToCreate = Math.min(
        adjustedConcurrent,
        Math.ceil(remainingIdentities / adjustedBatchSize)
      );

      for (let i = 0; i < batchesToCreate; i++) {
        const batchStart = identityCounter;
        const batchEnd = Math.min(
          batchStart + adjustedBatchSize,
          identityCounter + remainingIdentities
        );

        if (batchStart >= batchEnd) break;

        // Distribute load across validators
        const validatorIndex = i % this.providers.size;
        const validatorName = Array.from(this.providers.keys())[validatorIndex];

        batchPromises.push(
          this.executeDistributedBatch(
            validatorName,
            batchStart,
            batchEnd,
            phaseIndex
          )
        );

        identityCounter = batchEnd;
      }

      // Execute batches and collect results
      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach((result, index) => {
        if (result.status === "fulfilled") {
          completedIdentities += result.value.identitiesProcessed;
          phaseResult.transactions.push(...result.value.transactions);
        } else {
          phaseResult.errors.push({
            batchIndex: index,
            error: result.reason?.message || "Unknown error",
            timestamp: Date.now(),
          });
        }
      });

      // Dynamic progress reporting
      const progress = Math.min(
        (completedIdentities / targetIdentities) * 100,
        100
      );
      const timeProgress = ((Date.now() - phaseStart) / phase.duration) * 100;
      console.log(
        `   METRICS Progress: ${progress.toFixed(
          1
        )}% identities, ${timeProgress.toFixed(
          1
        )}% time (${completedIdentities}/${targetIdentities})`
      );

      // Brief pause to prevent overwhelming the network
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    phaseResult.endTime = Date.now();
    phaseResult.actualDuration = phaseResult.endTime - phaseResult.startTime;
    phaseResult.identitiesCreated = completedIdentities;
    phaseResult.metrics = this.calculatePhaseMetrics(phaseResult);

    // Update total counter
    this.results.identitiesCreated += completedIdentities;
    this.results.transactions.push(...phaseResult.transactions);
    this.results.errors.push(...phaseResult.errors);

    console.log(
      `   SUCCESS Phase completed: ${completedIdentities} identities in ${
        phaseResult.actualDuration / 1000
      }s`
    );

    return phaseResult;
  }

  async executeDistributedBatch(
    validatorName,
    startIdentity,
    endIdentity,
    phaseIndex
  ) {
    const batchTransactions = [];
    let identitiesProcessed = 0;

    const provider = this.providers.get(validatorName);
    const signers = this.signers.get(validatorName);

    if (!provider || !signers || signers.length === 0) {
      throw new Error(`Validator ${validatorName} not available`);
    }

    for (let i = startIdentity; i < endIdentity; i++) {
      try {
        // Distribute across signers within this validator
        const signerIndex = i % signers.length;
        const signer = signers[signerIndex];
        const contract = this.contract.connect(signer);

        // Generate unique biometric hash
        const biometricHash = ethers.keccak256(
          ethers.toUtf8Bytes(
            `enhanced-identity-${i}-${phaseIndex}-${validatorName}-${Date.now()}-${Math.random()}`
          )
        );

        const txStart = Date.now();
        const tx = await contract.registerIdentity(biometricHash);
        const receipt = await tx.wait();
        const txEnd = Date.now();

        const transaction = {
          identityIndex: i,
          phaseIndex,
          validatorName,
          signerIndex,
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: Number(receipt.gasUsed),
          timestamp: txEnd,
          confirmationTime: txEnd - txStart,
          biometricHash,
        };

        batchTransactions.push(transaction);
        identitiesProcessed++;

        // Update validator metrics
        const validatorMetrics =
          this.results.validatorMetrics.get(validatorName);
        validatorMetrics.transactionsSent++;
        validatorMetrics.transactionsConfirmed++;
        validatorMetrics.gasUsed += transaction.gasUsed;

        // Real-time logging
        this.logRealTime(
          `TX confirmed: ${validatorName} block ${receipt.blockNumber} gas ${transaction.gasUsed}`
        );
      } catch (error) {
        this.results.errors.push({
          identityIndex: i,
          phaseIndex,
          validatorName,
          error: error.message,
          timestamp: Date.now(),
        });

        // Update validator error count
        const validatorMetrics =
          this.results.validatorMetrics.get(validatorName);
        validatorMetrics.errors++;
      }
    }

    return { identitiesProcessed, transactions: batchTransactions };
  }

  calculatePhaseMetrics(phaseResult) {
    const transactions = phaseResult.transactions;

    if (transactions.length === 0) {
      return {
        tps: 0,
        avgConfirmationTime: 0,
        avgGasUsed: 0,
        successRate: 0,
      };
    }

    const actualDuration = phaseResult.actualDuration / 1000; // Convert to seconds
    const tps = transactions.length / actualDuration;
    const avgConfirmationTime =
      transactions.reduce((sum, tx) => sum + tx.confirmationTime, 0) /
      transactions.length;
    const avgGasUsed =
      transactions.reduce((sum, tx) => sum + tx.gasUsed, 0) /
      transactions.length;
    const successRate =
      (transactions.length /
        (transactions.length + phaseResult.errors.length)) *
      100;

    return {
      tps,
      avgConfirmationTime,
      avgGasUsed,
      successRate,
      totalGasUsed: transactions.reduce((sum, tx) => sum + tx.gasUsed, 0),
    };
  }

  async analyzeEnhancedResults() {
    console.log("\nMETRICS Analyzing enhanced scalability results...");

    // Calculate overall metrics
    const overallMetrics = this.calculateOverallMetrics();

    // Analyze validator performance
    const validatorAnalysis = this.analyzeValidatorPerformance();

    // Analyze phase performance
    const phaseAnalysis = this.analyzePhasePerformance();

    // Analyze network health throughout test
    const networkHealthAnalysis = this.analyzeNetworkHealth();

    // Generate performance profile
    const performanceProfile = this.generatePerformanceProfile();

    // Compile comprehensive results
    const comprehensiveResults = {
      testMetadata: {
        testType: "enhanced_multi_node_scalability",
        startTime: new Date(this.results.testStart).toISOString(),
        endTime: new Date(this.results.testEnd).toISOString(),
        totalDuration: this.results.totalDuration,
        validatorCount: CONFIG.VALIDATORS.length,
        phaseCount: CONFIG.PHASES.length,
      },
      overallMetrics,
      validatorAnalysis,
      phaseAnalysis,
      networkHealthAnalysis,
      performanceProfile,
      rawResults: {
        transactions: this.results.transactions,
        phases: this.results.phases,
        blockMetrics: this.results.blockMetrics,
        mempoolMetrics: this.results.mempoolMetrics,
        errors: this.results.errors,
      },
      recommendations: this.generateEnhancedRecommendations(
        overallMetrics,
        validatorAnalysis
      ),
    };

    this.printEnhancedResults(comprehensiveResults);
    await this.saveEnhancedResults(comprehensiveResults);
  }

  calculateOverallMetrics() {
    const totalTransactions = this.results.transactions.length;
    const totalDuration = this.results.totalDuration / 1000; // Convert to seconds

    const overallTPS = totalTransactions / totalDuration;
    const avgConfirmationTime =
      this.results.transactions.reduce(
        (sum, tx) => sum + tx.confirmationTime,
        0
      ) / totalTransactions;
    const avgGasUsed =
      this.results.transactions.reduce((sum, tx) => sum + tx.gasUsed, 0) /
      totalTransactions;
    const totalGasUsed = this.results.transactions.reduce(
      (sum, tx) => sum + tx.gasUsed,
      0
    );
    const successRate =
      (totalTransactions / (totalTransactions + this.results.errors.length)) *
      100;

    // Calculate peak TPS (highest TPS in any 10-second window)
    const peakTPS = this.calculatePeakTPS();

    return {
      totalTransactions,
      totalDuration,
      overallTPS,
      peakTPS,
      avgConfirmationTime,
      avgGasUsed,
      totalGasUsed,
      successRate,
      errorCount: this.results.errors.length,
      identitiesCreated: this.results.identitiesCreated,
    };
  }

  calculatePeakTPS() {
    const windowSize = 10000; // 10 seconds
    let maxTPS = 0;

    if (this.results.transactions.length === 0) return 0;

    const sortedTxs = this.results.transactions.sort(
      (a, b) => a.timestamp - b.timestamp
    );
    const startTime = sortedTxs[0].timestamp;
    const endTime = sortedTxs[sortedTxs.length - 1].timestamp;

    for (
      let windowStart = startTime;
      windowStart <= endTime;
      windowStart += windowSize
    ) {
      const windowEnd = windowStart + windowSize;
      const windowTxs = sortedTxs.filter(
        (tx) => tx.timestamp >= windowStart && tx.timestamp < windowEnd
      );
      const windowTPS = windowTxs.length / (windowSize / 1000);
      maxTPS = Math.max(maxTPS, windowTPS);
    }

    return maxTPS;
  }

  analyzeValidatorPerformance() {
    const analysis = {};

    for (const [validatorName, metrics] of this.results.validatorMetrics) {
      const validatorTxs = this.results.transactions.filter(
        (tx) => tx.validatorName === validatorName
      );

      analysis[validatorName] = {
        transactionsSent: metrics.transactionsSent,
        transactionsConfirmed: metrics.transactionsConfirmed,
        errors: metrics.errors,
        successRate:
          metrics.transactionsSent > 0
            ? (metrics.transactionsConfirmed / metrics.transactionsSent) * 100
            : 0,
        avgConfirmationTime:
          validatorTxs.length > 0
            ? validatorTxs.reduce((sum, tx) => sum + tx.confirmationTime, 0) /
              validatorTxs.length
            : 0,
        totalGasUsed: metrics.gasUsed,
        avgGasUsed:
          metrics.transactionsConfirmed > 0
            ? metrics.gasUsed / metrics.transactionsConfirmed
            : 0,
        transactionShare:
          (validatorTxs.length / this.results.transactions.length) * 100,
      };
    }

    return analysis;
  }

  analyzePhasePerformance() {
    return this.results.phases.map((phase) => ({
      name: phase.name,
      index: phase.index,
      loadMultiplier: phase.loadMultiplier,
      identitiesCreated: phase.identitiesCreated,
      duration: phase.actualDuration,
      tps: phase.metrics.tps,
      avgConfirmationTime: phase.metrics.avgConfirmationTime,
      successRate: phase.metrics.successRate,
      errorCount: phase.errors.length,
      efficiency: phase.identitiesCreated / (phase.actualDuration / 1000), // Identities per second
    }));
  }

  analyzeNetworkHealth() {
    const blockMetrics = this.results.blockMetrics;
    const mempoolMetrics = this.results.mempoolMetrics;

    // Calculate block production consistency
    const blocksByValidator = {};
    blockMetrics.forEach((metric) => {
      if (!blocksByValidator[metric.validator]) {
        blocksByValidator[metric.validator] = [];
      }
      blocksByValidator[metric.validator].push(metric);
    });

    // Calculate average mempool sizes
    const avgMempoolSizes = {};
    mempoolMetrics.forEach((snapshot) => {
      Object.entries(snapshot.validators).forEach(([validator, data]) => {
        if (!data.error && data.pending !== undefined) {
          if (!avgMempoolSizes[validator]) {
            avgMempoolSizes[validator] = [];
          }
          avgMempoolSizes[validator].push(data.pending);
        }
      });
    });

    return {
      blockProductionConsistency:
        this.calculateBlockConsistency(blocksByValidator),
      avgMempoolSizes: Object.fromEntries(
        Object.entries(avgMempoolSizes).map(([validator, sizes]) => [
          validator,
          sizes.reduce((sum, size) => sum + size, 0) / sizes.length,
        ])
      ),
      consensusHealth: this.assessConsensusHealth(),
    };
  }

  calculateBlockConsistency(blocksByValidator) {
    const consistency = {};

    Object.entries(blocksByValidator).forEach(([validator, blocks]) => {
      if (blocks.length <= 1) {
        consistency[validator] = { intervals: [], avgInterval: 0, stdDev: 0 };
        return;
      }

      const intervals = [];
      for (let i = 1; i < blocks.length; i++) {
        const interval = blocks[i].timestamp - blocks[i - 1].timestamp;
        intervals.push(interval);
      }

      const avgInterval =
        intervals.reduce((sum, interval) => sum + interval, 0) /
        intervals.length;
      const variance =
        intervals.reduce(
          (sum, interval) => sum + Math.pow(interval - avgInterval, 2),
          0
        ) / intervals.length;
      const stdDev = Math.sqrt(variance);

      consistency[validator] = {
        intervals,
        avgInterval,
        stdDev,
        coefficient: stdDev / avgInterval, // Lower is more consistent
      };
    });

    return consistency;
  }

  assessConsensusHealth() {
    // Simplified consensus health assessment based on block metrics
    const recentBlocks = this.results.blockMetrics.filter(
      (metric) => metric.timestamp > Date.now() - 60000 // Last minute
    );

    if (recentBlocks.length === 0)
      return { health: "unknown", reason: "no recent blocks" };

    const uniqueBlocks = new Set(
      recentBlocks.map((metric) => metric.blockNumber)
    );
    const validatorsSeen = new Set(
      recentBlocks.map((metric) => metric.validator)
    );

    const health = {
      uniqueBlocks: uniqueBlocks.size,
      validatorsActive: validatorsSeen.size,
      totalValidators: CONFIG.VALIDATORS.length,
      consensusParticipation:
        (validatorsSeen.size / CONFIG.VALIDATORS.length) * 100,
    };

    if (health.consensusParticipation >= 70) {
      health.status = "good";
    } else if (health.consensusParticipation >= 50) {
      health.status = "fair";
    } else {
      health.status = "poor";
    }

    return health;
  }

  generatePerformanceProfile() {
    return {
      testConfiguration: {
        validators: CONFIG.VALIDATORS.length,
        totalIdentities: CONFIG.TOTAL_IDENTITIES,
        batchSize: CONFIG.BATCH_SIZE,
        concurrentBatches: CONFIG.CONCURRENT_BATCHES,
        phases: CONFIG.PHASES.length,
      },
      resourceUtilization: {
        signersUsed: Array.from(this.signers.values()).reduce(
          (sum, signers) => sum + signers.length,
          0
        ),
        gasUtilization: this.results.transactions.reduce(
          (sum, tx) => sum + tx.gasUsed,
          0
        ),
        validatorDistribution: this.analyzeValidatorPerformance(),
      },
      scalabilityCharacteristics: {
        linearScaling: this.assessLinearScaling(),
        bottlenecks: this.identifyBottlenecks(),
        optimalLoad: this.findOptimalLoad(),
      },
    };
  }

  assessLinearScaling() {
    // Analyze if performance scales linearly with load
    const phaseMetrics = this.results.phases.map((phase) => ({
      load: phase.loadMultiplier,
      tps: phase.metrics.tps,
      efficiency: phase.metrics.tps / phase.loadMultiplier,
    }));

    // Calculate correlation between load and TPS
    const avgEfficiency =
      phaseMetrics.reduce((sum, p) => sum + p.efficiency, 0) /
      phaseMetrics.length;
    const efficiencyVariance =
      phaseMetrics.reduce(
        (sum, p) => sum + Math.pow(p.efficiency - avgEfficiency, 2),
        0
      ) / phaseMetrics.length;

    return {
      phaseMetrics,
      avgEfficiency,
      efficiencyVariance,
      linearityScore: Math.max(
        0,
        100 - (efficiencyVariance / avgEfficiency) * 100
      ),
    };
  }

  identifyBottlenecks() {
    const bottlenecks = [];

    // Check for validator imbalances
    const validatorAnalysis = this.analyzeValidatorPerformance();
    const transactionCounts = Object.values(validatorAnalysis).map(
      (v) => v.transactionsConfirmed
    );
    const maxTxs = Math.max(...transactionCounts);
    const minTxs = Math.min(...transactionCounts);

    if (maxTxs > minTxs * 1.5) {
      bottlenecks.push({
        type: "validator_imbalance",
        description: "Uneven transaction distribution across validators",
        impact: "medium",
      });
    }

    // Check for high confirmation times
    const avgConfirmationTime =
      this.results.transactions.reduce(
        (sum, tx) => sum + tx.confirmationTime,
        0
      ) / this.results.transactions.length;
    if (avgConfirmationTime > 5000) {
      bottlenecks.push({
        type: "high_confirmation_time",
        description: "Average confirmation time exceeds 5 seconds",
        impact: "high",
      });
    }

    // Check error rates
    const errorRate =
      (this.results.errors.length /
        (this.results.transactions.length + this.results.errors.length)) *
      100;
    if (errorRate > 5) {
      bottlenecks.push({
        type: "high_error_rate",
        description: `Error rate of ${errorRate.toFixed(
          1
        )}% indicates network stress`,
        impact: "high",
      });
    }

    return bottlenecks;
  }

  findOptimalLoad() {
    // Find the phase with the best efficiency (TPS per load multiplier)
    const optimalPhase = this.results.phases.reduce((best, current) => {
      const currentEfficiency = current.metrics.tps / current.loadMultiplier;
      const bestEfficiency = best.metrics.tps / best.loadMultiplier;
      return currentEfficiency > bestEfficiency ? current : best;
    });

    return {
      optimalPhase: optimalPhase.name,
      loadMultiplier: optimalPhase.loadMultiplier,
      achievedTPS: optimalPhase.metrics.tps,
      efficiency: optimalPhase.metrics.tps / optimalPhase.loadMultiplier,
    };
  }

  generateEnhancedRecommendations(overallMetrics, validatorAnalysis) {
    const recommendations = [];

    // Performance recommendations
    if (overallMetrics.overallTPS < 100) {
      recommendations.push({
        category: "Performance",
        priority: "high",
        message: "Overall TPS below target threshold",
        suggestion:
          "Consider increasing block gas limit, reducing block time, or optimizing contract execution",
      });
    }

    // Validator balance recommendations
    const validatorTPS = Object.values(validatorAnalysis).map(
      (v) => v.transactionShare
    );
    const maxShare = Math.max(...validatorTPS);
    const minShare = Math.min(...validatorTPS);

    if (maxShare > minShare * 2) {
      recommendations.push({
        category: "Load Distribution",
        priority: "medium",
        message: "Uneven load distribution across validators",
        suggestion:
          "Implement better load balancing or check for validator performance issues",
      });
    }

    // Error rate recommendations
    if (overallMetrics.successRate < 95) {
      recommendations.push({
        category: "Reliability",
        priority: "high",
        message: `Success rate of ${overallMetrics.successRate.toFixed(
          1
        )}% below acceptable threshold`,
        suggestion:
          "Investigate network stability, gas price settings, or transaction timeout configurations",
      });
    }

    // Gas usage recommendations
    if (overallMetrics.avgGasUsed > 150000) {
      recommendations.push({
        category: "Gas Optimization",
        priority: "medium",
        message: "High average gas usage per transaction",
        suggestion:
          "Review smart contract efficiency and consider gas optimizations",
      });
    }

    // Success recommendations
    if (recommendations.length === 0) {
      recommendations.push({
        category: "Overall Performance",
        priority: "info",
        message: "Excellent performance across all metrics",
        suggestion: "Network is well-configured for the tested load patterns",
      });
    }

    return recommendations;
  }

  printEnhancedResults(results) {
    console.log("\n" + "=".repeat(90));
    console.log("STARTING ENHANCED MULTI-NODE POA SCALABILITY TEST RESULTS");
    console.log("=".repeat(90));

    // Overall metrics
    console.log(`\nMETRICS Overall Performance:`);
    console.log(
      `   Total Transactions: ${results.overallMetrics.totalTransactions.toLocaleString()}`
    );
    console.log(
      `   Identities Created: ${results.overallMetrics.identitiesCreated.toLocaleString()}`
    );
    console.log(
      `   Test Duration: ${(results.overallMetrics.totalDuration / 60).toFixed(
        1
      )} minutes`
    );
    console.log(
      `   Overall TPS: ${results.overallMetrics.overallTPS.toFixed(2)}`
    );
    console.log(`   Peak TPS: ${results.overallMetrics.peakTPS.toFixed(2)}`);
    console.log(
      `   Success Rate: ${results.overallMetrics.successRate.toFixed(2)}%`
    );
    console.log(
      `   Avg Confirmation Time: ${results.overallMetrics.avgConfirmationTime.toFixed(
        0
      )}ms`
    );

    // Phase performance
    console.log(`\nTARGETING Phase Performance:`);
    results.phaseAnalysis.forEach((phase) => {
      console.log(
        `   ${phase.name.toUpperCase()} (${phase.loadMultiplier}x load):`
      );
      console.log(
        `     TPS: ${phase.tps.toFixed(
          2
        )}, Success: ${phase.successRate.toFixed(1)}%, Errors: ${
          phase.errorCount
        }`
      );
    });

    // Validator performance
    console.log(`\nPOWER Validator Performance:`);
    Object.entries(results.validatorAnalysis).forEach(
      ([validator, metrics]) => {
        console.log(`   ${validator}:`);
        console.log(
          `     Transactions: ${
            metrics.transactionsConfirmed
          }, Share: ${metrics.transactionShare.toFixed(1)}%`
        );
        console.log(
          `     Success Rate: ${metrics.successRate.toFixed(
            1
          )}%, Avg Time: ${metrics.avgConfirmationTime.toFixed(0)}ms`
        );
      }
    );

    // Network health
    console.log(`\n🏥 Network Health:`);
    console.log(
      `   Consensus Participation: ${results.networkHealthAnalysis.consensusHealth.consensusParticipation?.toFixed(
        1
      )}%`
    );
    console.log(
      `   Consensus Status: ${results.networkHealthAnalysis.consensusHealth.status?.toUpperCase()}`
    );

    // Performance insights
    console.log(`\nANALYZING Performance Insights:`);
    console.log(
      `   Optimal Load: ${results.performanceProfile.scalabilityCharacteristics.optimalLoad.loadMultiplier}x`
    );
    console.log(
      `   Linearity Score: ${results.performanceProfile.scalabilityCharacteristics.linearScaling.linearityScore.toFixed(
        1
      )}%`
    );

    if (
      results.performanceProfile.scalabilityCharacteristics.bottlenecks.length >
      0
    ) {
      console.log(
        `   Bottlenecks Detected: ${results.performanceProfile.scalabilityCharacteristics.bottlenecks.length}`
      );
    }

    // Recommendations
    console.log(`\nRECOMMENDATION Recommendations:`);
    results.recommendations.forEach((rec) => {
      console.log(
        `   [${rec.priority.toUpperCase()}] ${rec.category}: ${rec.message}`
      );
      console.log(`     → ${rec.suggestion}`);
    });
  }

  async saveEnhancedResults(results) {
    // Save comprehensive JSON results
    fs.writeFileSync(CONFIG.RESULTS_FILE, JSON.stringify(results, null, 2));

    // Generate enhanced CSV
    const csvContent = this.generateEnhancedCSV(results);
    fs.writeFileSync(CONFIG.CSV_FILE, csvContent);

    // Save performance profile
    fs.writeFileSync(
      CONFIG.PERFORMANCE_LOG,
      JSON.stringify(results.performanceProfile, null, 2)
    );

    console.log(`\nSAVING Enhanced results saved:`);
    console.log(`   FILE JSON: ${CONFIG.RESULTS_FILE}`);
    console.log(`   METRICS CSV: ${CONFIG.CSV_FILE}`);
    console.log(`   ANALYZING Performance Profile: ${CONFIG.PERFORMANCE_LOG}`);
    console.log(`   DEPLOYING Real-time Log: ${CONFIG.REAL_TIME_LOG}`);
  }

  generateEnhancedCSV(results) {
    const headers = [
      "Identity Index",
      "Phase Index",
      "Phase Name",
      "Validator",
      "Signer Index",
      "Block Number",
      "Gas Used",
      "Confirmation Time (ms)",
      "Timestamp",
      "Load Multiplier",
    ];

    const rows = results.rawResults.transactions.map((tx) => {
      const phase = results.rawResults.phases[tx.phaseIndex];
      return [
        tx.identityIndex,
        tx.phaseIndex,
        phase?.name || "unknown",
        tx.validatorName,
        tx.signerIndex,
        tx.blockNumber,
        tx.gasUsed,
        tx.confirmationTime,
        tx.timestamp,
        phase?.loadMultiplier || 1,
      ];
    });

    return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp}: ${message}\n`;

    // Write to performance log
    if (!fs.existsSync(CONFIG.PERFORMANCE_LOG)) {
      fs.writeFileSync(CONFIG.PERFORMANCE_LOG, "");
    }
    fs.appendFileSync(CONFIG.PERFORMANCE_LOG, logMessage);
  }

  logRealTime(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp}: ${message}\n`;
    fs.appendFileSync(CONFIG.REAL_TIME_LOG, logMessage);
  }

  async cleanup() {
    console.log("CLEANING Cleaning up enhanced test environment...");

    // Stop mempool monitoring
    if (this.mempoolMonitorInterval) {
      clearInterval(this.mempoolMonitorInterval);
    }

    // Close WebSocket connections
    for (const [name, provider] of this.wsProviders) {
      try {
        provider.removeAllListeners();
        await provider.destroy();
      } catch (error) {
        console.warn(`Warning: Could not clean up ${name}:`, error.message);
      }
    }
  }
}

// Main execution function
async function runEnhancedScalabilityTest() {
  const tester = new EnhancedScalabilityTester();

  try {
    await tester.initialize();
    await tester.runEnhancedScalabilityTest();
    console.log("\nSUCCESS Enhanced scalability test completed successfully!");
  } catch (error) {
    console.error("\nERROR Enhanced test failed:", error.message);
    tester.log(`Enhanced test failed: ${error.message}`);
  } finally {
    await tester.cleanup();
    process.exit(0);
  }
}

// Parse command line arguments for enhanced configuration
const identitiesIndex = process.argv.indexOf("--identities");
if (identitiesIndex !== -1 && process.argv[identitiesIndex + 1]) {
  CONFIG.TOTAL_IDENTITIES = parseInt(process.argv[identitiesIndex + 1]);
}

const batchSizeIndex = process.argv.indexOf("--batch-size");
if (batchSizeIndex !== -1 && process.argv[batchSizeIndex + 1]) {
  CONFIG.BATCH_SIZE = parseInt(process.argv[batchSizeIndex + 1]);
}

const concurrentIndex = process.argv.indexOf("--concurrent");
if (concurrentIndex !== -1 && process.argv[concurrentIndex + 1]) {
  CONFIG.CONCURRENT_BATCHES = parseInt(process.argv[concurrentIndex + 1]);
}

const phasesIndex = process.argv.indexOf("--phases");
if (phasesIndex !== -1 && process.argv[phasesIndex + 1]) {
  const phasesFile = process.argv[phasesIndex + 1];
  if (fs.existsSync(phasesFile)) {
    CONFIG.PHASES = JSON.parse(fs.readFileSync(phasesFile, "utf8"));
    console.log(`Loaded custom phases from ${phasesFile}`);
  }
}

if (process.argv.includes("--help")) {
  console.log(`
Enhanced Multi-Node PoA Scalability Test

Usage: node enhancedScalabilityTest.js [options]

Options:
  --identities <num>      Total identities to create (default: 10000)
  --batch-size <num>      Base batch size (default: 200)
  --concurrent <num>      Base concurrent batches (default: 10)
  --phases <file>         Custom phases configuration file
  --help                 Show this help message

Features:
  • Multi-phase load testing with ramp-up/ramp-down
  • Real-time monitoring of all validators
  • Advanced performance profiling
  • Comprehensive bottleneck analysis
  • Enhanced metrics and reporting

Example:
  node enhancedScalabilityTest.js --identities 20000 --batch-size 300
`);
  process.exit(0);
}

// Run the enhanced test
runEnhancedScalabilityTest().catch(console.error);
