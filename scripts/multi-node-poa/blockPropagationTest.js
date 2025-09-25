import { ethers } from "ethers";
import fs from "fs";
import path from "path";

const CONFIG = {
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

  // Test parameters
  TEST_DURATION: 300000, // 5 minutes in milliseconds
  TRANSACTION_INTERVAL: 2000, // Send transaction every 2 seconds
  SAMPLE_SIZE: 100, // Number of block propagation samples to collect

  // Output files
  PROPAGATION_RESULTS: "block_propagation_results.json",
  PROPAGATION_CSV: "block_propagation_metrics.csv",
  NETWORK_TOPOLOGY: "network_topology.json",
  LATENCY_LOG: "propagation_latency.log",
};

class BlockPropagationTester {
  constructor() {
    this.providers = new Map();
    this.wsProviders = new Map();
    this.blockSubscriptions = new Map();
    this.blockTimes = new Map(); // blockNumber -> { validator -> timestamp }
    this.propagationMetrics = [];
    this.networkTopology = {};
    this.testActive = false;
    this.contract = null;
    this.deploySigner = null;
  }

  async initialize() {
    console.log("STARTING Initializing Block Propagation Test Suite");
    this.log("Starting block propagation test initialization");

    // Initialize providers for each validator
    for (const validator of CONFIG.VALIDATORS) {
      try {
        // HTTP provider for transactions
        const httpProvider = new ethers.JsonRpcProvider(validator.rpc);
        this.providers.set(validator.name, httpProvider);

        // WebSocket provider for real-time block monitoring
        const wsProvider = new ethers.WebSocketProvider(validator.ws);
        this.wsProviders.set(validator.name, wsProvider);

        // Test connection
        const blockNumber = await httpProvider.getBlockNumber();
        console.log(
          `SUCCESS Connected to ${validator.name}: Block ${blockNumber}`
        );

        // Initialize block times map
        this.blockTimes.set(validator.name, new Map());
      } catch (error) {
        console.error(
          `ERROR Failed to connect to ${validator.name}:`,
          error.message
        );
        throw new Error(`Cannot connect to validator ${validator.name}`);
      }
    }

    // Use the first validator as the primary for deployments
    this.deploySigner = await this.providers
      .get(CONFIG.VALIDATORS[0].name)
      .getSigner(0);

    // Deploy test contract
    await this.deployTestContract();

    // Analyze network topology
    await this.analyzeNetworkTopology();

    console.log("TARGETING Initialization completed successfully");
  }

  async deployTestContract() {
    console.log(
      "DEPLOYING Deploying test contract for transaction generation..."
    );

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
      this.deploySigner
    );

    const deployTx = await contractFactory.deploy();
    await deployTx.waitForDeployment();
    this.contract = deployTx;

    const contractAddress = await this.contract.getAddress();
    console.log(`SUCCESS Test contract deployed at: ${contractAddress}`);
    this.log(`Test contract deployed at ${contractAddress}`);
  }

  async analyzeNetworkTopology() {
    console.log("ANALYZING Analyzing network topology...");

    const topology = {
      validators: [],
      peerConnections: {},
      networkLatency: {},
      timestamp: new Date().toISOString(),
    };

    // Get peer information from each validator
    for (const validator of CONFIG.VALIDATORS) {
      try {
        const provider = this.providers.get(validator.name);

        // Get admin info (peer connections)
        const peers = await provider.send("admin_peers", []);
        const nodeInfo = await provider.send("admin_nodeInfo", []);

        topology.validators.push({
          name: validator.name,
          endpoint: validator.rpc,
          nodeId: nodeInfo.id,
          peerCount: peers.length,
          peers: peers.map((peer) => ({
            id: peer.id.substring(0, 16) + "...", // Truncate for readability
            remoteAddress: peer.network.remoteAddress,
            inbound: peer.network.inbound,
          })),
        });

        topology.peerConnections[validator.name] = peers.length;
      } catch (error) {
        console.warn(
          `WARNING Could not get topology info from ${validator.name}:`,
          error.message
        );
        topology.peerConnections[validator.name] = 0;
      }
    }

    // Measure network latency between validators
    await this.measureNetworkLatency(topology);

    this.networkTopology = topology;

    // Save topology
    fs.writeFileSync(
      CONFIG.NETWORK_TOPOLOGY,
      JSON.stringify(topology, null, 2)
    );
    console.log(`DATA Network topology saved to ${CONFIG.NETWORK_TOPOLOGY}`);
  }

  async measureNetworkLatency(topology) {
    console.log("TIMING Measuring inter-validator network latency...");

    for (const validator1 of CONFIG.VALIDATORS) {
      topology.networkLatency[validator1.name] = {};

      for (const validator2 of CONFIG.VALIDATORS) {
        if (validator1.name === validator2.name) {
          topology.networkLatency[validator1.name][validator2.name] = 0;
          continue;
        }

        try {
          const provider1 = this.providers.get(validator1.name);
          const provider2 = this.providers.get(validator2.name);

          // Measure latency by comparing block timestamp differences
          const latencies = [];
          for (let i = 0; i < 5; i++) {
            const start = Date.now();
            const [block1, block2] = await Promise.all([
              provider1.getBlockNumber(),
              provider2.getBlockNumber(),
            ]);
            const end = Date.now();

            // Simple latency approximation
            latencies.push(end - start);
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          const avgLatency =
            latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
          topology.networkLatency[validator1.name][validator2.name] =
            avgLatency;
        } catch (error) {
          topology.networkLatency[validator1.name][validator2.name] = -1; // Error indicator
        }
      }
    }
  }

  async startBlockMonitoring() {
    console.log(
      "MONITORING Starting real-time block monitoring on all validators..."
    );

    for (const validator of CONFIG.VALIDATORS) {
      const wsProvider = this.wsProviders.get(validator.name);

      // Subscribe to new blocks
      wsProvider.on("block", (blockNumber) => {
        const timestamp = Date.now();

        // Record when this validator saw this block
        if (!this.blockTimes.has(blockNumber)) {
          this.blockTimes.set(blockNumber, new Map());
        }

        this.blockTimes.get(blockNumber).set(validator.name, timestamp);

        // Analyze propagation if we have enough data
        this.analyzePropagationLatency(blockNumber);
      });

      this.log(`Started block monitoring on ${validator.name}`);
    }
  }

  analyzePropagationLatency(blockNumber) {
    const blockTimestamps = this.blockTimes.get(blockNumber);

    // Wait until we have timestamps from all validators
    if (blockTimestamps.size < CONFIG.VALIDATORS.length) {
      return;
    }

    const timestamps = Array.from(blockTimestamps.values());
    const validatorNames = Array.from(blockTimestamps.keys());

    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const propagationTime = maxTime - minTime;

    // Calculate propagation times from first to each validator
    const firstValidator = validatorNames[timestamps.indexOf(minTime)];
    const propagationDetails = {};

    for (const [validator, timestamp] of blockTimestamps) {
      propagationDetails[validator] = {
        timestamp,
        latencyFromFirst: timestamp - minTime,
        isFirst: validator === firstValidator,
      };
    }

    const metrics = {
      blockNumber,
      timestamp: new Date().toISOString(),
      firstSeenBy: firstValidator,
      totalPropagationTime: propagationTime,
      averagePropagationTime:
        timestamps.reduce((sum, t) => sum + (t - minTime), 0) /
        timestamps.length,
      validatorDetails: propagationDetails,
      networkLatency: this.calculateNetworkLatencyMetrics(blockTimestamps),
    };

    this.propagationMetrics.push(metrics);

    // Log significant propagation delays
    if (propagationTime > 1000) {
      // More than 1 second
      console.warn(
        `WARNING Slow propagation for block ${blockNumber}: ${propagationTime}ms`
      );
      this.log(
        `Slow propagation detected: Block ${blockNumber}, ${propagationTime}ms`
      );
    }

    // Clean up old block data to prevent memory issues
    if (this.blockTimes.size > 100) {
      const oldestBlock = Math.min(...this.blockTimes.keys());
      this.blockTimes.delete(oldestBlock);
    }
  }

  calculateNetworkLatencyMetrics(blockTimestamps) {
    const metrics = {
      p50: 0,
      p95: 0,
      p99: 0,
      standardDeviation: 0,
    };

    const timestamps = Array.from(blockTimestamps.values());
    const minTime = Math.min(...timestamps);
    const latencies = timestamps.map((t) => t - minTime).sort((a, b) => a - b);

    if (latencies.length > 0) {
      metrics.p50 = latencies[Math.floor(latencies.length * 0.5)];
      metrics.p95 = latencies[Math.floor(latencies.length * 0.95)];
      metrics.p99 = latencies[Math.floor(latencies.length * 0.99)];

      const mean =
        latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
      const variance =
        latencies.reduce((sum, lat) => sum + Math.pow(lat - mean, 2), 0) /
        latencies.length;
      metrics.standardDeviation = Math.sqrt(variance);
    }

    return metrics;
  }

  async generateTransactionLoad() {
    console.log("PROCESSING Starting transaction load generation...");

    let transactionCount = 0;
    const interval = setInterval(async () => {
      if (!this.testActive) {
        clearInterval(interval);
        return;
      }

      try {
        // Generate a unique biometric hash
        const biometricHash = ethers.keccak256(
          ethers.toUtf8Bytes(
            `test-identity-${transactionCount}-${Date.now()}-${Math.random()}`
          )
        );

        // Send transaction to trigger block creation
        const tx = await this.contract.registerIdentity(biometricHash);

        transactionCount++;
        this.log(`Sent transaction ${transactionCount}: ${tx.hash}`);
      } catch (error) {
        console.error(`ERROR Transaction failed:`, error.message);
        this.log(`Transaction failed: ${error.message}`);
      }
    }, CONFIG.TRANSACTION_INTERVAL);

    return interval;
  }

  async runPropagationTest() {
    console.log(
      `\nSTARTING Starting ${
        CONFIG.TEST_DURATION / 1000
      }s block propagation test`
    );
    console.log(`DATA Monitoring ${CONFIG.VALIDATORS.length} validators`);
    console.log(
      `POWER Generating transactions every ${CONFIG.TRANSACTION_INTERVAL}ms`
    );

    this.testActive = true;

    // Start monitoring
    await this.startBlockMonitoring();

    // Start generating transactions
    const txInterval = await this.generateTransactionLoad();

    // Wait for test duration
    await new Promise((resolve) => setTimeout(resolve, CONFIG.TEST_DURATION));

    // Stop test
    this.testActive = false;
    clearInterval(txInterval);

    console.log("STOPPING Test completed, analyzing results...");

    // Give some time for final blocks to propagate
    await new Promise((resolve) => setTimeout(resolve, 10000));

    await this.analyzeResults();
  }

  async analyzeResults() {
    console.log("ANALYZING Analyzing block propagation results...");

    if (this.propagationMetrics.length === 0) {
      console.warn("WARNING No propagation data collected!");
      return;
    }

    // Calculate overall statistics
    const propagationTimes = this.propagationMetrics.map(
      (m) => m.totalPropagationTime
    );
    const avgPropagationTimes = this.propagationMetrics.map(
      (m) => m.averagePropagationTime
    );

    const stats = {
      testSummary: {
        totalBlocks: this.propagationMetrics.length,
        testDuration: CONFIG.TEST_DURATION,
        validatorCount: CONFIG.VALIDATORS.length,
        avgBlocksPerMinute: (
          this.propagationMetrics.length /
          (CONFIG.TEST_DURATION / 60000)
        ).toFixed(2),
      },
      propagationLatency: {
        maxPropagationTime: Math.max(...propagationTimes),
        minPropagationTime: Math.min(...propagationTimes),
        avgPropagationTime:
          propagationTimes.reduce((sum, t) => sum + t, 0) /
          propagationTimes.length,
        medianPropagationTime: this.calculateMedian(propagationTimes),
        p95PropagationTime: this.calculatePercentile(propagationTimes, 95),
        p99PropagationTime: this.calculatePercentile(propagationTimes, 99),
        standardDeviation: this.calculateStandardDeviation(propagationTimes),
      },
      validatorPerformance: this.analyzeValidatorPerformance(),
      networkHealth: this.assessNetworkHealth(),
      recommendations: this.generateRecommendations(),
    };

    this.printResults(stats);
    await this.saveResults(stats);
  }

  analyzeValidatorPerformance() {
    const validatorStats = {};

    // Initialize stats for each validator
    CONFIG.VALIDATORS.forEach((validator) => {
      validatorStats[validator.name] = {
        firstToSeeCount: 0,
        avgLatencyFromFirst: 0,
        maxLatencyFromFirst: 0,
        latencies: [],
      };
    });

    // Analyze each block's propagation
    this.propagationMetrics.forEach((metric) => {
      // Count who saw the block first
      validatorStats[metric.firstSeenBy].firstToSeeCount++;

      // Calculate latencies for each validator
      Object.entries(metric.validatorDetails).forEach(
        ([validator, details]) => {
          validatorStats[validator].latencies.push(details.latencyFromFirst);
        }
      );
    });

    // Calculate averages and max values
    Object.keys(validatorStats).forEach((validator) => {
      const latencies = validatorStats[validator].latencies;
      if (latencies.length > 0) {
        validatorStats[validator].avgLatencyFromFirst =
          latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
        validatorStats[validator].maxLatencyFromFirst = Math.max(...latencies);
      }
    });

    return validatorStats;
  }

  assessNetworkHealth() {
    const health = {
      overall: "good",
      issues: [],
      metrics: {},
    };

    // Check average propagation time
    const avgPropTime =
      this.propagationMetrics.reduce(
        (sum, m) => sum + m.totalPropagationTime,
        0
      ) / this.propagationMetrics.length;

    health.metrics.avgPropagationTime = avgPropTime;

    if (avgPropTime > 2000) {
      health.overall = "poor";
      health.issues.push("High average propagation time (>2s)");
    } else if (avgPropTime > 1000) {
      health.overall = "fair";
      health.issues.push("Moderate propagation time (>1s)");
    }

    // Check for validator imbalances
    const validatorPerf = this.analyzeValidatorPerformance();
    const firstSeenCounts = Object.values(validatorPerf).map(
      (v) => v.firstToSeeCount
    );
    const maxFirstSeen = Math.max(...firstSeenCounts);
    const minFirstSeen = Math.min(...firstSeenCounts);

    if (maxFirstSeen > minFirstSeen * 3) {
      health.issues.push("Significant validator performance imbalance");
      if (health.overall === "good") health.overall = "fair";
    }

    // Check for network partitions
    const maxLatencies = Object.values(validatorPerf).map(
      (v) => v.maxLatencyFromFirst
    );
    if (Math.max(...maxLatencies) > 5000) {
      health.issues.push(
        "Potential network partition detected (>5s max latency)"
      );
      health.overall = "poor";
    }

    return health;
  }

  generateRecommendations() {
    const recommendations = [];
    const health = this.assessNetworkHealth();
    const validatorPerf = this.analyzeValidatorPerformance();

    if (health.overall === "poor") {
      recommendations.push(
        "Consider reducing block time or optimizing network infrastructure"
      );
      recommendations.push(
        "Investigate network latency between validator nodes"
      );
    }

    // Check for underperforming validators
    const avgFirstSeenCount =
      this.propagationMetrics.length / CONFIG.VALIDATORS.length;
    Object.entries(validatorPerf).forEach(([validator, stats]) => {
      if (stats.firstToSeeCount < avgFirstSeenCount * 0.5) {
        recommendations.push(
          `Validator ${validator} appears to be underperforming`
        );
      }
    });

    if (recommendations.length === 0) {
      recommendations.push(
        "Network is performing well within expected parameters"
      );
    }

    return recommendations;
  }

  calculateMedian(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  calculatePercentile(arr, percentile) {
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  calculateStandardDeviation(arr) {
    const mean = arr.reduce((sum, val) => sum + val, 0) / arr.length;
    const variance =
      arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
    return Math.sqrt(variance);
  }

  printResults(stats) {
    console.log("\n" + "=".repeat(80));
    console.log("ANALYZING BLOCK PROPAGATION LATENCY TEST RESULTS");
    console.log("=".repeat(80));

    console.log(`\nDATA Test Summary:`);
    console.log(`   Total Blocks Analyzed: ${stats.testSummary.totalBlocks}`);
    console.log(`   Test Duration: ${stats.testSummary.testDuration / 1000}s`);
    console.log(`   Validator Count: ${stats.testSummary.validatorCount}`);
    console.log(
      `   Avg Blocks/Minute: ${stats.testSummary.avgBlocksPerMinute}`
    );

    console.log(`\nPOWER Propagation Latency Metrics:`);
    console.log(
      `   Average: ${stats.propagationLatency.avgPropagationTime.toFixed(2)}ms`
    );
    console.log(
      `   Median: ${stats.propagationLatency.medianPropagationTime.toFixed(
        2
      )}ms`
    );
    console.log(
      `   P95: ${stats.propagationLatency.p95PropagationTime.toFixed(2)}ms`
    );
    console.log(
      `   P99: ${stats.propagationLatency.p99PropagationTime.toFixed(2)}ms`
    );
    console.log(
      `   Max: ${stats.propagationLatency.maxPropagationTime.toFixed(2)}ms`
    );
    console.log(
      `   Std Dev: ${stats.propagationLatency.standardDeviation.toFixed(2)}ms`
    );

    console.log(`\nTARGETING Validator Performance:`);
    Object.entries(stats.validatorPerformance).forEach(([validator, perf]) => {
      console.log(`   ${validator}:`);
      console.log(`     First to see blocks: ${perf.firstToSeeCount}x`);
      console.log(`     Avg latency: ${perf.avgLatencyFromFirst.toFixed(2)}ms`);
      console.log(`     Max latency: ${perf.maxLatencyFromFirst.toFixed(2)}ms`);
    });

    console.log(
      `\nHEALTH Network Health: ${stats.networkHealth.overall.toUpperCase()}`
    );
    if (stats.networkHealth.issues.length > 0) {
      console.log(`   Issues detected:`);
      stats.networkHealth.issues.forEach((issue) => {
        console.log(`   WARNING ${issue}`);
      });
    }

    console.log(`\nRECOMMENDATION Recommendations:`);
    stats.recommendations.forEach((rec) => {
      console.log(`   • ${rec}`);
    });
  }

  async saveResults(stats) {
    // Save comprehensive results
    const fullResults = {
      timestamp: new Date().toISOString(),
      config: CONFIG,
      networkTopology: this.networkTopology,
      statistics: stats,
      rawMetrics: this.propagationMetrics,
    };

    fs.writeFileSync(
      CONFIG.PROPAGATION_RESULTS,
      JSON.stringify(fullResults, null, 2)
    );

    // Generate CSV for analysis
    const csvContent = this.generateCSV();
    fs.writeFileSync(CONFIG.PROPAGATION_CSV, csvContent);

    console.log(`\nSAVING Results saved:`);
    console.log(`   FILE Full results: ${CONFIG.PROPAGATION_RESULTS}`);
    console.log(`   DATA CSV data: ${CONFIG.PROPAGATION_CSV}`);
    console.log(`   NETWORK Network topology: ${CONFIG.NETWORK_TOPOLOGY}`);
    console.log(`   DEPLOYING Logs: ${CONFIG.LATENCY_LOG}`);
  }

  generateCSV() {
    const headers = [
      "Block Number",
      "Timestamp",
      "First Seen By",
      "Total Propagation Time (ms)",
      "Average Propagation Time (ms)",
      "P95 Latency (ms)",
      "Standard Deviation (ms)",
      ...CONFIG.VALIDATORS.map((v) => `${v.name} Latency (ms)`),
    ];

    const rows = this.propagationMetrics.map((metric) => {
      const row = [
        metric.blockNumber,
        metric.timestamp,
        metric.firstSeenBy,
        metric.totalPropagationTime,
        metric.averagePropagationTime.toFixed(2),
        metric.networkLatency.p95,
        metric.networkLatency.standardDeviation.toFixed(2),
      ];

      // Add individual validator latencies
      CONFIG.VALIDATORS.forEach((validator) => {
        const latency =
          metric.validatorDetails[validator.name]?.latencyFromFirst || 0;
        row.push(latency);
      });

      return row;
    });

    return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp}: ${message}\n`;
    fs.appendFileSync(CONFIG.LATENCY_LOG, logMessage);
  }

  async cleanup() {
    console.log("CLEANING Cleaning up connections...");

    // Close all WebSocket connections
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
async function runBlockPropagationTest() {
  const tester = new BlockPropagationTester();

  try {
    await tester.initialize();
    await tester.runPropagationTest();
    console.log("\nSUCCESS Block propagation test completed successfully!");
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
Block Propagation Latency Test

Usage: node blockPropagationTest.js [options]

Options:
  --duration <ms>     Test duration in milliseconds (default: 300000)
  --interval <ms>     Transaction interval in milliseconds (default: 2000)
  --validators <json> Path to validators configuration file
  --help             Show this help message

Example:
  node blockPropagationTest.js --duration 600000 --interval 1000
`);
  process.exit(0);
}

const durationIndex = process.argv.indexOf("--duration");
if (durationIndex !== -1 && process.argv[durationIndex + 1]) {
  CONFIG.TEST_DURATION = parseInt(process.argv[durationIndex + 1]);
}

const intervalIndex = process.argv.indexOf("--interval");
if (intervalIndex !== -1 && process.argv[intervalIndex + 1]) {
  CONFIG.TRANSACTION_INTERVAL = parseInt(process.argv[intervalIndex + 1]);
}

// Run the test
runBlockPropagationTest().catch(console.error);
