import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const CONFIG = {
  // Validator endpoints
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

  // Failure scenarios to test
  FAILURE_SCENARIOS: [
    {
      name: "single_validator_failure",
      description: "Single validator node failure",
      validators_to_fail: 1,
      failure_duration: 60000, // 1 minute
    },
    {
      name: "minority_failure",
      description: "Minority validator failure (3 out of 7)",
      validators_to_fail: 3,
      failure_duration: 120000, // 2 minutes
    },
    {
      name: "network_partition",
      description: "Network partition (split network)",
      validators_to_fail: 0, // Special case - network isolation
      failure_duration: 180000, // 3 minutes
    },
    {
      name: "cascading_failure",
      description: "Cascading failure simulation",
      validators_to_fail: 0, // Special case - gradual failures
      failure_duration: 300000, // 5 minutes
    },
    {
      name: "byzantine_behavior",
      description: "Byzantine validator behavior",
      validators_to_fail: 0, // Special case - malicious behavior
      failure_duration: 240000, // 4 minutes
    },
  ],

  // Test parameters
  BASELINE_DURATION: 60000, // 1 minute baseline before failure
  RECOVERY_DURATION: 120000, // 2 minutes recovery monitoring
  TRANSACTION_INTERVAL: 3000, // Send transaction every 3 seconds
  MONITORING_INTERVAL: 1000, // Monitor network every second

  // Output files
  FAILURE_RESULTS_FILE: "failure_analysis_results.json",
  FAILURE_CSV_FILE: "failure_analysis_metrics.csv",
  NETWORK_HEALTH_FILE: "network_health_log.json",
  FAILURE_LOG_FILE: "failure_analysis.log",
};

class FailureAnalysisTester {
  constructor() {
    this.providers = new Map();
    this.wsProviders = new Map();
    this.signers = new Map();
    this.contract = null;
    this.failureResults = [];
    this.networkHealthLog = [];
    this.baselineMetrics = null;
    this.activeMonitoring = false;
    this.transactionCounter = 0;
  }

  async initialize() {
    console.log("SECURITY Initializing Network Failure Analysis Test Suite");
    this.log("Starting failure analysis test initialization");

    // Initialize providers for each validator
    for (const validator of CONFIG.VALIDATORS) {
      try {
        const httpProvider = new ethers.JsonRpcProvider(validator.rpc);
        const wsProvider = new ethers.WebSocketProvider(validator.ws);

        this.providers.set(validator.name, httpProvider);
        this.wsProviders.set(validator.name, wsProvider);

        // Get signers
        const signers = [];
        for (let i = 0; i < 3; i++) {
          try {
            const signer = await httpProvider.getSigner(i);
            signers.push(signer);
          } catch (error) {
            break;
          }
        }
        this.signers.set(validator.name, signers);

        const blockNumber = await httpProvider.getBlockNumber();
        console.log(
          `SUCCESS Connected to ${validator.name}: Block ${blockNumber}`
        );
      } catch (error) {
        console.warn(
          `WARNING Could not connect to ${validator.name}:`,
          error.message
        );
      }
    }

    if (this.providers.size === 0) {
      throw new Error("Could not connect to any validators");
    }

    // Deploy test contract
    await this.deployTestContract();

    // Establish baseline
    await this.establishBaseline();

    console.log("TARGETING Initialization completed successfully");
  }

  async deployTestContract() {
    console.log("DEPLOYING Deploying test contract...");

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
    console.log(`SUCCESS Test contract deployed at: ${contractAddress}`);
    this.log(`Test contract deployed at ${contractAddress}`);
  }

  async establishBaseline() {
    console.log("METRICS Establishing network baseline...");

    this.activeMonitoring = true;
    const baselineStart = Date.now();

    // Start monitoring
    const monitoringPromise = this.startNetworkMonitoring();

    // Generate baseline transactions
    const baselineTransactions = this.startTransactionGeneration();

    // Wait for baseline period
    await new Promise((resolve) =>
      setTimeout(resolve, CONFIG.BASELINE_DURATION)
    );

    this.activeMonitoring = false;

    // Calculate baseline metrics
    const baselineEnd = Date.now();
    const baselineHealthData = this.networkHealthLog.filter(
      (entry) =>
        entry.timestamp >= baselineStart && entry.timestamp <= baselineEnd
    );

    this.baselineMetrics = this.calculateBaselineMetrics(baselineHealthData);
    console.log(
      `ANALYZING Baseline established: ${this.baselineMetrics.avgTPS.toFixed(
        2
      )} TPS, ${this.baselineMetrics.avgBlockTime.toFixed(2)}s blocks`
    );

    this.log(`Baseline metrics: ${JSON.stringify(this.baselineMetrics)}`);
  }

  calculateBaselineMetrics(healthData) {
    if (healthData.length === 0) {
      return {
        avgTPS: 0,
        avgBlockTime: 0,
        avgActiveValidators: 0,
        avgGasPrice: 0,
        transactionSuccessRate: 100,
      };
    }

    const validData = healthData.filter((entry) => entry.networkMetrics);

    const avgTPS =
      validData.reduce(
        (sum, entry) => sum + (entry.networkMetrics.estimatedTPS || 0),
        0
      ) / validData.length;
    const avgBlockTime =
      validData.reduce(
        (sum, entry) => sum + (entry.networkMetrics.avgBlockTime || 0),
        0
      ) / validData.length;
    const avgActiveValidators =
      validData.reduce((sum, entry) => sum + entry.activeValidators, 0) /
      validData.length;
    const avgGasPrice =
      validData.reduce(
        (sum, entry) => sum + (entry.networkMetrics.avgGasPrice || 0),
        0
      ) / validData.length;

    return {
      avgTPS,
      avgBlockTime,
      avgActiveValidators,
      avgGasPrice,
      transactionSuccessRate: 100, // Assume 100% during baseline
    };
  }

  async runFailureAnalysis() {
    console.log("\nSECURITY Starting comprehensive failure analysis");
    console.log(
      `ANALYZING Testing ${CONFIG.FAILURE_SCENARIOS.length} failure scenarios`
    );

    for (const scenario of CONFIG.FAILURE_SCENARIOS) {
      console.log(`\nFAILURE Testing scenario: ${scenario.description}`);

      try {
        await this.testFailureScenario(scenario);

        // Recovery period between tests
        console.log(" Waiting for network recovery...");
        await new Promise((resolve) =>
          setTimeout(resolve, CONFIG.RECOVERY_DURATION)
        );
      } catch (error) {
        console.error(`ERROR Scenario ${scenario.name} failed:`, error.message);
        this.log(`Scenario ${scenario.name} failed: ${error.message}`);
      }
    }

    console.log("\nANALYZING Analyzing failure analysis results...");
    await this.analyzeFailureResults();
  }

  async testFailureScenario(scenario) {
    const testStart = Date.now();
    this.networkHealthLog = []; // Reset for this test
    this.transactionCounter = 0;

    console.log(
      `   TIMING Starting ${scenario.description} (${
        scenario.failure_duration / 1000
      }s)`
    );

    // Start monitoring and transaction generation
    this.activeMonitoring = true;
    const monitoringPromise = this.startNetworkMonitoring();
    const transactionPromise = this.startTransactionGeneration();

    let failureStart, failureEnd;

    try {
      // Wait for pre-failure monitoring period
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Trigger failure
      failureStart = Date.now();
      await this.triggerFailure(scenario);

      // Monitor during failure
      await new Promise((resolve) =>
        setTimeout(resolve, scenario.failure_duration)
      );

      // Restore network
      failureEnd = Date.now();
      await this.restoreNetwork(scenario);

      // Monitor recovery
      await new Promise((resolve) =>
        setTimeout(resolve, CONFIG.RECOVERY_DURATION)
      );
    } finally {
      this.activeMonitoring = false;
    }

    const testEnd = Date.now();

    // Analyze this scenario's results
    const result = await this.analyzeScenarioResults(scenario, {
      testStart,
      testEnd,
      failureStart,
      failureEnd,
      healthData: [...this.networkHealthLog],
    });

    this.failureResults.push(result);
    console.log(
      `   SUCCESS Scenario completed: ${result.metrics.impactSeverity} impact`
    );

    this.log(
      `Completed scenario ${scenario.name}: ${result.metrics.impactSeverity} impact`
    );
  }

  async triggerFailure(scenario) {
    console.log(`   FAILURE Triggering ${scenario.name}...`);

    switch (scenario.name) {
      case "single_validator_failure":
        await this.simulateValidatorFailure([CONFIG.VALIDATORS[0].name]);
        break;

      case "minority_failure":
        const minorityValidators = CONFIG.VALIDATORS.slice(0, 3).map(
          (v) => v.name
        );
        await this.simulateValidatorFailure(minorityValidators);
        break;

      case "network_partition":
        await this.simulateNetworkPartition();
        break;

      case "cascading_failure":
        await this.simulateCascadingFailure();
        break;

      case "byzantine_behavior":
        await this.simulateByzantineBehavior();
        break;

      default:
        throw new Error(`Unknown failure scenario: ${scenario.name}`);
    }
  }

  async simulateValidatorFailure(validatorNames) {
    console.log(
      `   CONNECTING Simulating failure of validators: ${validatorNames.join(
        ", "
      )}`
    );

    // mark them as unavailable and stop using them
    for (const validatorName of validatorNames) {
      const provider = this.providers.get(validatorName);
      const wsProvider = this.wsProviders.get(validatorName);

      if (provider) {
        // Simulate network unavailability by removing from active providers
        this.providers.delete(validatorName);
        this.wsProviders.delete(validatorName);
        this.signers.delete(validatorName);

        console.log(`   WARNING Validator ${validatorName} marked as failed`);
      }
    }
  }

  async simulateNetworkPartition() {
    console.log("   NETWORK Simulating network partition...");

    // Simulate by splitting validators into two groups
    const group1 = CONFIG.VALIDATORS.slice(0, 3);
    const group2 = CONFIG.VALIDATORS.slice(3);

    console.log(
      `   LOCATION Partition Group 1: ${group1.map((v) => v.name).join(", ")}`
    );
    console.log(
      `   LOCATION Partition Group 2: ${group2.map((v) => v.name).join(", ")}`
    );
    ``;
    const failedValidators = group2.slice(0, 2).map((v) => v.name);
    await this.simulateValidatorFailure(failedValidators);
  }

  async simulateCascadingFailure() {
    console.log("   CHAIN Simulating cascading failure...");

    // Gradually fail validators over time
    const failureIntervals = [10000, 20000, 30000]; // 10s, 20s, 30s

    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve, failureIntervals[i]));

      const validatorToFail = CONFIG.VALIDATORS[i].name;
      console.log(`   FAILURE Cascading failure: ${validatorToFail} failed`);
      await this.simulateValidatorFailure([validatorToFail]);
    }
  }

  async simulateByzantineBehavior() {
    console.log("   MASK Simulating Byzantine behavior...");

    const byzantineValidator = CONFIG.VALIDATORS[0].name;
    console.log(
      `   MASK Validator ${byzantineValidator} exhibiting Byzantine behavior`
    );

    await this.generateConflictingTransactions(byzantineValidator);
  }

  async generateConflictingTransactions(validatorName) {
    const signers = this.signers.get(validatorName);
    if (!signers || signers.length === 0) return;

    const signer = signers[0];
    const contract = this.contract.connect(signer);

    try {
      const nonce = await signer.getNonce();

      for (let i = 0; i < 3; i++) {
        const biometricHash = ethers.keccak256(
          ethers.toUtf8Bytes(`byzantine-conflict-${i}-${Date.now()}`)
        );

        contract.registerIdentity(biometricHash, { nonce }).catch(() => {});
      }
    } catch (error) {
      console.log(`   MASK Byzantine transaction conflict generated`);
    }
  }

  async restoreNetwork(scenario) {
    console.log(`   RESTORING Restoring network after ${scenario.name}...`);

    for (const validator of CONFIG.VALIDATORS) {
      if (!this.providers.has(validator.name)) {
        try {
          const httpProvider = new ethers.JsonRpcProvider(validator.rpc);
          const wsProvider = new ethers.WebSocketProvider(validator.ws);

          // Test connection
          await httpProvider.getBlockNumber();

          this.providers.set(validator.name, httpProvider);
          this.wsProviders.set(validator.name, wsProvider);

          // Restore signers
          const signers = [];
          for (let i = 0; i < 3; i++) {
            try {
              const signer = await httpProvider.getSigner(i);
              signers.push(signer);
            } catch (error) {
              break;
            }
          }
          this.signers.set(validator.name, signers);

          console.log(`   SUCCESS Restored ${validator.name}`);
        } catch (error) {
          console.warn(
            `   WARNING Could not restore ${validator.name}:`,
            error.message
          );
        }
      }
    }
  }

  async startNetworkMonitoring() {
    while (this.activeMonitoring) {
      const healthSnapshot = await this.captureNetworkHealth();
      healthSnapshot.timestamp = Date.now();
      this.networkHealthLog.push(healthSnapshot);

      await new Promise((resolve) =>
        setTimeout(resolve, CONFIG.MONITORING_INTERVAL)
      );
    }
  }

  async captureNetworkHealth() {
    const health = {
      activeValidators: 0,
      totalValidators: CONFIG.VALIDATORS.length,
      blockNumbers: {},
      consensusStatus: {},
      networkMetrics: {},
      validatorStatus: {},
    };

    const activeProviders = Array.from(this.providers.entries());
    health.activeValidators = activeProviders.length;

    // Gather data from active validators
    const validatorPromises = activeProviders.map(async ([name, provider]) => {
      try {
        const [blockNumber, gasPrice, peerCount] = await Promise.all([
          provider.getBlockNumber(),
          provider.getGasPrice(),
          provider.send("net_peerCount", []).catch(() => "0x0"),
        ]);

        health.blockNumbers[name] = blockNumber;
        health.validatorStatus[name] = {
          active: true,
          blockNumber,
          gasPrice: Number(gasPrice),
          peerCount: parseInt(peerCount, 16),
        };
      } catch (error) {
        health.validatorStatus[name] = {
          active: false,
          error: error.message,
        };
      }
    });

    await Promise.allSettled(validatorPromises);

    // Calculate consensus metrics
    const activeBlocks = Object.values(health.blockNumbers);
    if (activeBlocks.length > 0) {
      const maxBlock = Math.max(...activeBlocks);
      const minBlock = Math.min(...activeBlocks);

      health.consensusStatus = {
        maxBlock,
        minBlock,
        blockSpread: maxBlock - minBlock,
        consensusAchieved: maxBlock - minBlock <= 1, // Within 1 block is good consensus
      };

      // Estimate TPS based on recent blocks
      if (this.networkHealthLog.length > 0) {
        const prevSnapshot =
          this.networkHealthLog[this.networkHealthLog.length - 1];
        const timeDiff = (Date.now() - prevSnapshot.timestamp) / 1000;
        const blockDiff =
          maxBlock -
          (Math.max(...Object.values(prevSnapshot.blockNumbers || {})) ||
            maxBlock);

        health.networkMetrics = {
          estimatedTPS: blockDiff / timeDiff,
          avgBlockTime: timeDiff / (blockDiff || 1),
          avgGasPrice: this.calculateAverageGasPrice(health.validatorStatus),
        };
      }
    }

    return health;
  }

  calculateAverageGasPrice(validatorStatus) {
    const gasPrices = Object.values(validatorStatus)
      .filter((status) => status.active && status.gasPrice)
      .map((status) => status.gasPrice);

    return gasPrices.length > 0
      ? gasPrices.reduce((sum, price) => sum + price, 0) / gasPrices.length
      : 0;
  }

  async startTransactionGeneration() {
    while (this.activeMonitoring) {
      try {
        await this.sendTestTransaction();
        await new Promise((resolve) =>
          setTimeout(resolve, CONFIG.TRANSACTION_INTERVAL)
        );
      } catch (error) {
        // Transaction failures are expected during failure scenarios
        this.log(`Transaction failed during monitoring: ${error.message}`);
      }
    }
  }

  async sendTestTransaction() {
    const activeValidators = Array.from(this.signers.keys());
    if (activeValidators.length === 0) {
      throw new Error("No active validators available for transactions");
    }

    const validatorName =
      activeValidators[this.transactionCounter % activeValidators.length];
    const signers = this.signers.get(validatorName);
    const signer = signers[this.transactionCounter % signers.length];

    const contract = this.contract.connect(signer);
    const biometricHash = ethers.keccak256(
      ethers.toUtf8Bytes(
        `failure-test-${this.transactionCounter}-${Date.now()}`
      )
    );

    const tx = await contract.registerIdentity(biometricHash);
    await tx.wait();

    this.transactionCounter++;
  }

  async analyzeScenarioResults(scenario, testData) {
    const result = {
      scenarioName: scenario.name,
      description: scenario.description,
      testDuration: testData.testEnd - testData.testStart,
      failureDuration: testData.failureEnd - testData.failureStart,
      metrics: {},
      healthAnalysis: {},
      impactAssessment: {},
      recoveryAnalysis: {},
    };

    // Analyze network health during different phases
    const preFailureData = testData.healthData.filter(
      (entry) => entry.timestamp < testData.failureStart
    );
    const failureData = testData.healthData.filter(
      (entry) =>
        entry.timestamp >= testData.failureStart &&
        entry.timestamp <= testData.failureEnd
    );
    const recoveryData = testData.healthData.filter(
      (entry) => entry.timestamp > testData.failureEnd
    );

    // Calculate metrics for each phase
    result.healthAnalysis = {
      preFailure: this.calculatePhaseMetrics(preFailureData),
      duringFailure: this.calculatePhaseMetrics(failureData),
      recovery: this.calculatePhaseMetrics(recoveryData),
    };

    // Impact assessment
    result.impactAssessment = this.assessFailureImpact(
      result.healthAnalysis.preFailure,
      result.healthAnalysis.duringFailure
    );

    // Recovery analysis
    result.recoveryAnalysis = this.analyzeRecovery(
      result.healthAnalysis.duringFailure,
      result.healthAnalysis.recovery
    );

    // Overall metrics
    result.metrics = {
      impactSeverity: this.categorizeImpactSeverity(result.impactAssessment),
      recoveryTime: this.calculateRecoveryTime(recoveryData),
      consensusMaintained:
        result.healthAnalysis.duringFailure.avgConsensusAchieved > 0.5,
      networkResilience: this.calculateNetworkResilience(result),
    };

    return result;
  }

  calculatePhaseMetrics(phaseData) {
    if (phaseData.length === 0) {
      return {
        avgActiveValidators: 0,
        avgTPS: 0,
        avgBlockTime: 0,
        avgConsensusAchieved: 0,
        dataPoints: 0,
      };
    }

    const validData = phaseData.filter(
      (entry) => entry.activeValidators !== undefined
    );

    return {
      avgActiveValidators:
        validData.reduce((sum, entry) => sum + entry.activeValidators, 0) /
        validData.length,
      avgTPS:
        validData.reduce(
          (sum, entry) => sum + (entry.networkMetrics?.estimatedTPS || 0),
          0
        ) / validData.length,
      avgBlockTime:
        validData.reduce(
          (sum, entry) => sum + (entry.networkMetrics?.avgBlockTime || 0),
          0
        ) / validData.length,
      avgConsensusAchieved:
        validData.reduce(
          (sum, entry) =>
            sum + (entry.consensusStatus?.consensusAchieved ? 1 : 0),
          0
        ) / validData.length,
      dataPoints: validData.length,
    };
  }

  assessFailureImpact(preFailure, duringFailure) {
    return {
      validatorLoss:
        ((preFailure.avgActiveValidators - duringFailure.avgActiveValidators) /
          preFailure.avgActiveValidators) *
        100,
      tpsReduction:
        ((preFailure.avgTPS - duringFailure.avgTPS) / preFailure.avgTPS) * 100,
      consensusLoss:
        ((preFailure.avgConsensusAchieved -
          duringFailure.avgConsensusAchieved) /
          preFailure.avgConsensusAchieved) *
        100,
      blockTimeIncrease:
        ((duringFailure.avgBlockTime - preFailure.avgBlockTime) /
          preFailure.avgBlockTime) *
        100,
    };
  }

  analyzeRecovery(duringFailure, recovery) {
    return {
      validatorRecovery:
        recovery.avgActiveValidators - duringFailure.avgActiveValidators,
      tpsRecovery: recovery.avgTPS - duringFailure.avgTPS,
      consensusRecovery:
        recovery.avgConsensusAchieved - duringFailure.avgConsensusAchieved,
      blockTimeRecovery: duringFailure.avgBlockTime - recovery.avgBlockTime,
    };
  }

  categorizeImpactSeverity(impact) {
    const maxImpact = Math.max(
      Math.abs(impact.validatorLoss || 0),
      Math.abs(impact.tpsReduction || 0),
      Math.abs(impact.consensusLoss || 0)
    );

    if (maxImpact > 70) return "critical";
    if (maxImpact > 40) return "high";
    if (maxImpact > 20) return "medium";
    return "low";
  }

  calculateRecoveryTime(recoveryData) {
    // Find when network returned to stable state
    for (let i = 0; i < recoveryData.length; i++) {
      const entry = recoveryData[i];
      if (
        entry.consensusStatus?.consensusAchieved &&
        entry.activeValidators >= CONFIG.VALIDATORS.length * 0.7
      ) {
        return i * CONFIG.MONITORING_INTERVAL; // Convert to milliseconds
      }
    }
    return recoveryData.length * CONFIG.MONITORING_INTERVAL; // Full recovery time
  }

  calculateNetworkResilience(scenarioResult) {
    const impact = scenarioResult.impactAssessment;
    const recovery = scenarioResult.recoveryAnalysis;

    // Calculate resilience score (0-100)
    const impactScore =
      100 -
      Math.max(
        Math.abs(impact.validatorLoss || 0),
        Math.abs(impact.tpsReduction || 0),
        Math.abs(impact.consensusLoss || 0)
      );

    const recoveryScore = Math.min(
      100,
      (recovery.validatorRecovery || 0) * 10 +
        (recovery.consensusRecovery || 0) * 50
    );

    return (impactScore + recoveryScore) / 2;
  }

  async analyzeFailureResults() {
    console.log("METRICS Analyzing comprehensive failure results...");

    const analysis = {
      testSummary: {
        totalScenarios: this.failureResults.length,
        scenarioResults: this.failureResults.map((r) => ({
          name: r.scenarioName,
          severity: r.metrics.impactSeverity,
          resilience: r.metrics.networkResilience.toFixed(1),
        })),
      },
      resilienceAnalysis: this.analyzeOverallResilience(),
      criticalFindings: this.identifyCriticalFindings(),
      recommendations: this.generateFailureRecommendations(),
      comparisonToBaseline: this.compareToBaseline(),
    };

    this.printFailureResults(analysis);
    await this.saveFailureResults(analysis);
  }

  analyzeOverallResilience() {
    const resiliences = this.failureResults.map(
      (r) => r.metrics.networkResilience
    );
    const severities = this.failureResults.map((r) => r.metrics.impactSeverity);

    return {
      averageResilience:
        resiliences.reduce((sum, r) => sum + r, 0) / resiliences.length,
      worstScenario: this.failureResults.find(
        (r) => r.metrics.networkResilience === Math.min(...resiliences)
      ),
      bestScenario: this.failureResults.find(
        (r) => r.metrics.networkResilience === Math.max(...resiliences)
      ),
      criticalScenarios: this.failureResults.filter(
        (r) => r.metrics.impactSeverity === "critical"
      ).length,
      faultTolerance: this.calculateFaultTolerance(),
    };
  }

  calculateFaultTolerance() {
    const singleValidatorFailure = this.failureResults.find(
      (r) => r.scenarioName === "single_validator_failure"
    );
    const minorityFailure = this.failureResults.find(
      (r) => r.scenarioName === "minority_failure"
    );

    if (!singleValidatorFailure || !minorityFailure) {
      return "insufficient_data";
    }

    if (
      singleValidatorFailure.metrics.impactSeverity === "low" &&
      minorityFailure.metrics.impactSeverity !== "critical"
    ) {
      return "byzantine_fault_tolerant";
    }

    if (singleValidatorFailure.metrics.impactSeverity !== "critical") {
      return "crash_fault_tolerant";
    }

    return "limited_fault_tolerance";
  }

  identifyCriticalFindings() {
    const findings = [];

    // Check for critical scenarios
    const criticalScenarios = this.failureResults.filter(
      (r) => r.metrics.impactSeverity === "critical"
    );
    if (criticalScenarios.length > 0) {
      findings.push({
        severity: "critical",
        type: "high_impact_scenarios",
        description: `${criticalScenarios.length} scenarios caused critical network impact`,
        scenarios: criticalScenarios.map((s) => s.scenarioName),
      });
    }

    // Check for poor recovery
    const poorRecovery = this.failureResults.filter(
      (r) => r.metrics.recoveryTime > 60000
    ); // > 1 minute
    if (poorRecovery.length > 0) {
      findings.push({
        severity: "warning",
        type: "slow_recovery",
        description: "Some scenarios showed slow network recovery",
        scenarios: poorRecovery.map((s) => s.scenarioName),
      });
    }

    // Check consensus issues
    const consensusIssues = this.failureResults.filter(
      (r) => !r.metrics.consensusMaintained
    );
    if (consensusIssues.length > 0) {
      findings.push({
        severity: "high",
        type: "consensus_loss",
        description: "Consensus was lost during some failure scenarios",
        scenarios: consensusIssues.map((s) => s.scenarioName),
      });
    }

    return findings;
  }

  generateFailureRecommendations() {
    const recommendations = [];
    const resilience = this.analyzeOverallResilience();

    if (resilience.averageResilience < 70) {
      recommendations.push(
        "Consider increasing network redundancy and validator count"
      );
    }

    if (resilience.faultTolerance === "limited_fault_tolerance") {
      recommendations.push(
        "Network shows limited fault tolerance - implement additional safety mechanisms"
      );
    }

    if (resilience.criticalScenarios > 0) {
      recommendations.push(
        "Address critical failure scenarios with improved monitoring and auto-recovery"
      );
    }

    const byzantineTest = this.failureResults.find(
      (r) => r.scenarioName === "byzantine_behavior"
    );
    if (byzantineTest && byzantineTest.metrics.impactSeverity !== "low") {
      recommendations.push(
        "Implement additional Byzantine fault detection and mitigation"
      );
    }

    const partitionTest = this.failureResults.find(
      (r) => r.scenarioName === "network_partition"
    );
    if (partitionTest && partitionTest.metrics.impactSeverity === "critical") {
      recommendations.push(
        "Improve network partition detection and automatic resolution"
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        "Network demonstrates good resilience across tested failure scenarios"
      );
    }

    return recommendations;
  }

  compareToBaseline() {
    if (!this.baselineMetrics) {
      return { error: "No baseline metrics available for comparison" };
    }

    const worstCase = this.analyzeOverallResilience().worstScenario;
    if (!worstCase) {
      return { error: "No failure scenarios completed successfully" };
    }

    return {
      baselineComparison: {
        normalTPS: this.baselineMetrics.avgTPS,
        worstCaseTPS: worstCase.healthAnalysis.duringFailure.avgTPS,
        tpsDegraduation:
          ((this.baselineMetrics.avgTPS -
            worstCase.healthAnalysis.duringFailure.avgTPS) /
            this.baselineMetrics.avgTPS) *
          100,
      },
      resilientQualities: {
        maintainsBasicOperation:
          worstCase.healthAnalysis.duringFailure.avgActiveValidators > 0,
        acceptablePerformance:
          worstCase.healthAnalysis.duringFailure.avgTPS >
          this.baselineMetrics.avgTPS * 0.5,
        quickRecovery: worstCase.metrics.recoveryTime < 120000, // 2 minutes
      },
    };
  }

  printFailureResults(analysis) {
    console.log("\n" + "=".repeat(80));
    console.log("SECURITY NETWORK FAILURE ANALYSIS RESULTS");
    console.log("=".repeat(80));

    console.log(`\nMETRICS Test Summary:`);
    console.log(
      `   Total Scenarios Tested: ${analysis.testSummary.totalScenarios}`
    );
    console.log(`   Scenario Results:`);
    analysis.testSummary.scenarioResults.forEach((result) => {
      console.log(
        `     • ${result.name}: ${result.severity.toUpperCase()} impact (${
          result.resilience
        }% resilience)`
      );
    });

    console.log(`\nSECURITY Overall Resilience Analysis:`);
    console.log(
      `   Average Network Resilience: ${analysis.resilienceAnalysis.averageResilience.toFixed(
        1
      )}%`
    );
    console.log(
      `   Fault Tolerance Level: ${analysis.resilienceAnalysis.faultTolerance
        .replace(/_/g, " ")
        .toUpperCase()}`
    );
    console.log(
      `   Critical Scenarios: ${analysis.resilienceAnalysis.criticalScenarios}`
    );
    console.log(
      `   Best Performing Scenario: ${
        analysis.resilienceAnalysis.bestScenario?.scenarioName || "N/A"
      }`
    );
    console.log(
      `   Worst Performing Scenario: ${
        analysis.resilienceAnalysis.worstScenario?.scenarioName || "N/A"
      }`
    );

    if (analysis.criticalFindings.length > 0) {
      console.log(`\nWARNING Critical Findings:`);
      analysis.criticalFindings.forEach((finding) => {
        console.log(
          `   ${finding.severity.toUpperCase()}: ${finding.description}`
        );
        console.log(`     Affected scenarios: ${finding.scenarios.join(", ")}`);
      });
    }

    console.log(`\nANALYZING Baseline Comparison:`);
    if (analysis.comparisonToBaseline.error) {
      console.log(`   ${analysis.comparisonToBaseline.error}`);
    } else {
      const baseline = analysis.comparisonToBaseline.baselineComparison;
      console.log(`   Normal TPS: ${baseline.normalTPS.toFixed(2)}`);
      console.log(`   Worst Case TPS: ${baseline.worstCaseTPS.toFixed(2)}`);
      console.log(
        `   Performance Degradation: ${baseline.tpsDegraduation.toFixed(1)}%`
      );
    }

    console.log(`\nRECOMMENDATION Recommendations:`);
    analysis.recommendations.forEach((rec) => {
      console.log(`   • ${rec}`);
    });
  }

  async saveFailureResults(analysis) {
    // Save comprehensive results
    const fullResults = {
      timestamp: new Date().toISOString(),
      config: CONFIG,
      baselineMetrics: this.baselineMetrics,
      analysis,
      detailedResults: this.failureResults,
      healthLog: this.networkHealthLog,
    };

    fs.writeFileSync(
      CONFIG.FAILURE_RESULTS_FILE,
      JSON.stringify(fullResults, null, 2)
    );

    // Generate CSV
    const csvContent = this.generateFailureCSV();
    fs.writeFileSync(CONFIG.FAILURE_CSV_FILE, csvContent);

    // Save health log
    fs.writeFileSync(
      CONFIG.NETWORK_HEALTH_FILE,
      JSON.stringify(this.networkHealthLog, null, 2)
    );

    console.log(`\nSAVING Results saved:`);
    console.log(`   FILE Full results: ${CONFIG.FAILURE_RESULTS_FILE}`);
    console.log(`   METRICS CSV data: ${CONFIG.FAILURE_CSV_FILE}`);
    console.log(`   🏥 Health log: ${CONFIG.NETWORK_HEALTH_FILE}`);
    console.log(`   DEPLOYING Logs: ${CONFIG.FAILURE_LOG_FILE}`);
  }

  generateFailureCSV() {
    const headers = [
      "Scenario Name",
      "Impact Severity",
      "Network Resilience",
      "Recovery Time (ms)",
      "Consensus Maintained",
      "Validator Loss (%)",
      "TPS Reduction (%)",
      "Block Time Increase (%)",
      "Test Duration (ms)",
    ];

    const rows = this.failureResults.map((result) => [
      result.scenarioName,
      result.metrics.impactSeverity,
      result.metrics.networkResilience.toFixed(1),
      result.metrics.recoveryTime,
      result.metrics.consensusMaintained ? "Yes" : "No",
      result.impactAssessment.validatorLoss?.toFixed(1) || "0",
      result.impactAssessment.tpsReduction?.toFixed(1) || "0",
      result.impactAssessment.blockTimeIncrease?.toFixed(1) || "0",
      result.testDuration,
    ]);

    return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp}: ${message}\n`;
    fs.appendFileSync(CONFIG.FAILURE_LOG_FILE, logMessage);
  }

  async cleanup() {
    console.log("CLEANING Cleaning up connections...");

    this.activeMonitoring = false;

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
async function runFailureAnalysisTest() {
  const tester = new FailureAnalysisTester();

  try {
    await tester.initialize();
    await tester.runFailureAnalysis();
    console.log("\nSUCCESS Failure analysis test completed successfully!");
  } catch (error) {
    console.error("\nERROR Test failed:", error.message);
    tester.log(`Test failed: ${error.message}`);
  } finally {
    await tester.cleanup();
    process.exit(0);
  }
}

// Parse command line arguments
if (process.argv.includes("--help")) {
  console.log(`
Network Failure Analysis and Resilience Testing

Usage: node failureAnalysisTest.js [options]

Options:
  --baseline <ms>         Baseline duration in milliseconds (default: 60000)
  --recovery <ms>         Recovery monitoring duration (default: 120000)
  --scenario <name>       Run specific scenario only
  --help                 Show this help message

Available scenarios: ${CONFIG.FAILURE_SCENARIOS.map((s) => s.name).join(", ")}

Example:
  node failureAnalysisTest.js --baseline 120000 --scenario single_validator_failure
`);
  process.exit(0);
}

const baselineIndex = process.argv.indexOf("--baseline");
if (baselineIndex !== -1 && process.argv[baselineIndex + 1]) {
  CONFIG.BASELINE_DURATION = parseInt(process.argv[baselineIndex + 1]);
}

const recoveryIndex = process.argv.indexOf("--recovery");
if (recoveryIndex !== -1 && process.argv[recoveryIndex + 1]) {
  CONFIG.RECOVERY_DURATION = parseInt(process.argv[recoveryIndex + 1]);
}

const scenarioIndex = process.argv.indexOf("--scenario");
if (scenarioIndex !== -1 && process.argv[scenarioIndex + 1]) {
  const scenarioName = process.argv[scenarioIndex + 1];
  CONFIG.FAILURE_SCENARIOS = CONFIG.FAILURE_SCENARIOS.filter(
    (s) => s.name === scenarioName
  );

  if (CONFIG.FAILURE_SCENARIOS.length === 0) {
    console.error(`Unknown scenario: ${scenarioName}`);
    process.exit(1);
  }
}

// Run the test
runFailureAnalysisTest().catch(console.error);
