import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { spawn, exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const CONFIG = {
  ORCHESTRATOR_CONFIG: {
    coordinatorNode: "http://10.0.1.10:8545", // Primary coordinator
    resultsDirectory: "./multi-node-test-results",
    logDirectory: "./multi-node-logs",
    reportDirectory: "./multi-node-reports",
  },

  // Validator endpoints
  VALIDATORS: [
    {
      name: "validator1",
      rpc: "http://10.0.1.10:8545",
      ws: "ws://10.0.1.10:9545",
      host: "10.0.1.10",
      ssh: { user: "ubuntu", keyPath: "~/.ssh/validator-key.pem" },
    },
    {
      name: "validator2",
      rpc: "http://10.0.1.11:8546",
      ws: "ws://10.0.1.11:9546",
      host: "10.0.1.11",
      ssh: { user: "ubuntu", keyPath: "~/.ssh/validator-key.pem" },
    },
    {
      name: "validator3",
      rpc: "http://10.0.1.12:8547",
      ws: "ws://10.0.1.12:9547",
      host: "10.0.1.12",
      ssh: { user: "ubuntu", keyPath: "~/.ssh/validator-key.pem" },
    },
    {
      name: "validator4",
      rpc: "http://10.0.1.13:8548",
      ws: "ws://10.0.1.13:9548",
      host: "10.0.1.13",
      ssh: { user: "ubuntu", keyPath: "~/.ssh/validator-key.pem" },
    },
    {
      name: "validator5",
      rpc: "http://10.0.1.14:8549",
      ws: "ws://10.0.1.14:9549",
      host: "10.0.1.14",
      ssh: { user: "ubuntu", keyPath: "~/.ssh/validator-key.pem" },
    },
    {
      name: "validator6",
      rpc: "http://10.0.1.15:8550",
      ws: "ws://10.0.1.15:9550",
      host: "10.0.1.15",
      ssh: { user: "ubuntu", keyPath: "~/.ssh/validator-key.pem" },
    },
    {
      name: "validator7",
      rpc: "http://10.0.1.16:8551",
      ws: "ws://10.0.1.16:9551",
      host: "10.0.1.16",
      ssh: { user: "ubuntu", keyPath: "~/.ssh/validator-key.pem" },
    },
  ],

  // Test suite configuration
  TEST_SUITES: [
    {
      name: "baseline_scalability",
      script: "scalabilityTest.js",
      description: "Enhanced baseline scalability test",
      duration: 600000, // 10 minutes
      parameters: {
        identities: 10000,
        batchSize: 200,
        concurrent: 10,
      },
      critical: true,
    },
    {
      name: "block_propagation",
      script: "blockPropagationTest.js",
      description: "Block propagation latency analysis",
      duration: 300000, // 5 minutes
      parameters: {
        duration: 300000,
        interval: 2000,
      },
      critical: true,
    },
    {
      name: "gas_price_sensitivity",
      script: "gasPriceSensitivityTest.js",
      description: "Gas price sensitivity analysis",
      duration: 1800000, // 30 minutes
      parameters: {
        transactions: 100,
        concurrent: 15,
      },
      critical: true,
    },
    {
      name: "failure_analysis",
      script: "failureAnalysisTest.js",
      description: "Network failure and resilience testing",
      duration: 2400000, // 40 minutes
      parameters: {
        baseline: 120000,
        recovery: 180000,
      },
      critical: true,
    },
    {
      name: "stress_test",
      script: "stressTest.js",
      description: "High-load stress testing",
      duration: 900000, // 15 minutes
      parameters: {
        load_multiplier: 5,
        duration: 900000,
      },
      critical: false,
    },
    {
      name: "network_topology",
      script: "networkTopologyTest.js",
      description: "Network topology and peer analysis",
      duration: 180000, // 3 minutes
      parameters: {},
      critical: false,
    },
  ],

  // Execution settings
  EXECUTION: {
    maxConcurrentTests: 2,
    testTimeoutMultiplier: 1.5, // 50% buffer on test duration
    retryFailedTests: true,
    maxRetries: 2,
    cleanupBetweenTests: true,
    generateReports: true,
  },

  // Output files
  ORCHESTRATOR_LOG: "orchestrator.log",
  EXECUTION_SUMMARY: "execution_summary.json",
  COMPREHENSIVE_REPORT: "comprehensive_analysis_report.html",
  TEST_MATRIX: "test_execution_matrix.json",
};

class TestOrchestrator {
  constructor() {
    this.providers = new Map();
    this.testResults = new Map();
    this.executionLog = [];
    this.networkStatus = null;
    this.currentPhase = "initialization";
    this.startTime = Date.now();
  }

  async initialize() {
    console.log("ORCHESTRATOR Initializing Multi-Node PoA Test Orchestrator");
    console.log(`METRICS Managing ${CONFIG.VALIDATORS.length} validators`);
    console.log(
      `TESTING Orchestrating ${CONFIG.TEST_SUITES.length} test suites`
    );

    this.log("Starting test orchestrator initialization");

    // Create directories
    this.createDirectories();

    // Initialize network connections
    await this.initializeNetworkConnections();

    // Verify network health
    await this.verifyNetworkHealth();

    // Prepare test environment
    await this.prepareTestEnvironment();

    console.log("SUCCESS Orchestrator initialization completed");
    this.log("Orchestrator initialization completed successfully");
  }

  createDirectories() {
    const directories = [
      CONFIG.ORCHESTRATOR_CONFIG.resultsDirectory,
      CONFIG.ORCHESTRATOR_CONFIG.logDirectory,
      CONFIG.ORCHESTRATOR_CONFIG.reportDirectory,
    ];

    directories.forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Created directory: ${dir}`);
      }
    });
  }

  async initializeNetworkConnections() {
    console.log("CONNECTING Initializing network connections...");

    let successfulConnections = 0;

    for (const validator of CONFIG.VALIDATORS) {
      try {
        const provider = new ethers.JsonRpcProvider(validator.rpc);

        // Test connection
        const blockNumber = await provider.getBlockNumber();
        const network = await provider.getNetwork();

        this.providers.set(validator.name, provider);

        console.log(
          `SUCCESS Connected to ${validator.name}: Block ${blockNumber}, Chain ${network.chainId}`
        );
        successfulConnections++;
      } catch (error) {
        console.error(
          `ERROR Failed to connect to ${validator.name}:`,
          error.message
        );
        this.log(`Failed to connect to ${validator.name}: ${error.message}`);
      }
    }

    if (successfulConnections === 0) {
      throw new Error("Could not connect to any validators");
    }

    if (successfulConnections < CONFIG.VALIDATORS.length) {
      console.warn(
        `WARNING Only ${successfulConnections}/${CONFIG.VALIDATORS.length} validators are accessible`
      );
    }

    this.log(
      `Connected to ${successfulConnections}/${CONFIG.VALIDATORS.length} validators`
    );
  }

  async verifyNetworkHealth() {
    console.log("HEALTH Verifying network health...");

    const healthChecks = {
      consensusCheck: false,
      blockProgression: false,
      peerConnectivity: false,
      validatorActivity: false,
    };

    try {
      // Check consensus across validators
      const blockNumbers = await Promise.all(
        Array.from(this.providers.values()).map((provider) =>
          provider.getBlockNumber()
        )
      );

      const maxBlock = Math.max(...blockNumbers);
      const minBlock = Math.min(...blockNumbers);
      healthChecks.consensusCheck = maxBlock - minBlock <= 2; // Allow 2 block difference

      // Check block progression
      await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 10 seconds
      const newBlockNumbers = await Promise.all(
        Array.from(this.providers.values()).map((provider) =>
          provider.getBlockNumber()
        )
      );
      healthChecks.blockProgression = newBlockNumbers.some(
        (newBlock, index) => newBlock > blockNumbers[index]
      );

      // Check peer connectivity (simplified)
      let totalPeers = 0;
      for (const provider of this.providers.values()) {
        try {
          const peerCount = await provider.send("net_peerCount", []);
          totalPeers += parseInt(peerCount, 16);
        } catch (error) {
          // Peer count not available
        }
      }
      healthChecks.peerConnectivity = totalPeers > CONFIG.VALIDATORS.length;

      // Check validator activity (mining)
      healthChecks.validatorActivity = healthChecks.blockProgression;
    } catch (error) {
      console.error("ERROR Network health check failed:", error.message);
      this.log(`Network health check failed: ${error.message}`);
    }

    const healthScore = Object.values(healthChecks).filter(Boolean).length;
    const totalChecks = Object.keys(healthChecks).length;

    console.log(
      `HEALTH Network Health: ${healthScore}/${totalChecks} checks passed`
    );
    Object.entries(healthChecks).forEach(([check, passed]) => {
      console.log(`   ${passed ? "SUCCESS" : "ERROR"} ${check}`);
    });

    this.networkStatus = {
      healthy: healthScore >= totalChecks * 0.75, // 75% threshold
      checks: healthChecks,
      score: healthScore,
      timestamp: new Date().toISOString(),
    };

    if (!this.networkStatus.healthy) {
      console.warn(
        "WARNING Network health is suboptimal - tests may produce unreliable results"
      );
    }

    this.log(
      `Network health verification completed: ${healthScore}/${totalChecks} checks passed`
    );
  }

  async prepareTestEnvironment() {
    console.log("TOOLS Preparing test environment...");

    // Create test matrix
    const testMatrix = {
      timestamp: new Date().toISOString(),
      orchestratorVersion: "1.0.0",
      networkConfig: {
        validators: CONFIG.VALIDATORS.length,
        healthStatus: this.networkStatus,
        chainId: null,
      },
      testPlan: CONFIG.TEST_SUITES.map((suite) => ({
        name: suite.name,
        description: suite.description,
        estimatedDuration: suite.duration,
        critical: suite.critical,
        parameters: suite.parameters,
      })),
      estimatedTotalDuration: CONFIG.TEST_SUITES.reduce(
        (sum, suite) => sum + suite.duration,
        0
      ),
    };

    // Get chain ID
    try {
      const firstProvider = Array.from(this.providers.values())[0];
      const network = await firstProvider.getNetwork();
      testMatrix.networkConfig.chainId = Number(network.chainId);
    } catch (error) {
      console.warn("Could not retrieve chain ID");
    }

    // Save test matrix
    fs.writeFileSync(
      path.join(
        CONFIG.ORCHESTRATOR_CONFIG.resultsDirectory,
        CONFIG.TEST_MATRIX
      ),
      JSON.stringify(testMatrix, null, 2)
    );

    console.log(
      `CHECKLIST Test matrix created: ${testMatrix.testPlan.length} tests planned`
    );
    console.log(
      `⏱️ Estimated total duration: ${(
        testMatrix.estimatedTotalDuration /
        1000 /
        60
      ).toFixed(1)} minutes`
    );

    this.log("Test environment preparation completed");
  }

  async runTestSuite() {
    console.log("\nSTARTING Starting Multi-Node PoA Test Suite Execution");
    console.log("=" * 80);

    this.currentPhase = "execution";
    const executionStart = Date.now();

    // Separate critical and non-critical tests
    const criticalTests = CONFIG.TEST_SUITES.filter((suite) => suite.critical);
    const nonCriticalTests = CONFIG.TEST_SUITES.filter(
      (suite) => !suite.critical
    );

    console.log(`TARGETING Critical tests: ${criticalTests.length}`);
    console.log(`METRICS Non-critical tests: ${nonCriticalTests.length}`);

    // Run critical tests first
    console.log("\nCRITICAL Executing critical test suites...");
    await this.executeTestGroup(criticalTests, "critical");

    // Check if critical tests passed
    const criticalResults = Array.from(this.testResults.values()).filter(
      (result) => criticalTests.some((test) => test.name === result.testName)
    );

    const criticalFailures = criticalResults.filter(
      (result) => result.status === "failed"
    ).length;

    if (criticalFailures > 0) {
      console.warn(
        `WARNING ${criticalFailures} critical tests failed - continuing with non-critical tests`
      );
      this.log(`${criticalFailures} critical tests failed`);
    }

    // Run non-critical tests
    if (nonCriticalTests.length > 0) {
      console.log("\nANALYZING Executing non-critical test suites...");
      await this.executeTestGroup(nonCriticalTests, "non-critical");
    }

    const executionEnd = Date.now();
    const totalDuration = executionEnd - executionStart;

    console.log(
      `\nSUCCESS Test suite execution completed in ${(
        totalDuration /
        1000 /
        60
      ).toFixed(1)} minutes`
    );

    // Generate comprehensive analysis
    await this.generateComprehensiveAnalysis();
  }

  async executeTestGroup(testSuites, groupType) {
    const semaphore = new Array(CONFIG.EXECUTION.maxConcurrentTests).fill(null);
    let testIndex = 0;

    const executeTest = async (semaphoreIndex) => {
      while (testIndex < testSuites.length) {
        const currentTestIndex = testIndex++;
        const testSuite = testSuites[currentTestIndex];

        console.log(
          `\nTESTING [${groupType.toUpperCase()}] Starting ${testSuite.name} (${
            currentTestIndex + 1
          }/${testSuites.length})`
        );

        try {
          const result = await this.executeIndividualTest(testSuite);
          this.testResults.set(testSuite.name, result);

          if (result.status === "passed") {
            console.log(`SUCCESS ${testSuite.name} completed successfully`);
          } else {
            console.log(`ERROR ${testSuite.name} failed: ${result.error}`);
          }
        } catch (error) {
          console.error(`CRASH ${testSuite.name} crashed:`, error.message);
          this.testResults.set(testSuite.name, {
            testName: testSuite.name,
            status: "crashed",
            error: error.message,
            duration: 0,
            timestamp: new Date().toISOString(),
          });
        }

        // Cleanup between tests if configured
        if (CONFIG.EXECUTION.cleanupBetweenTests) {
          await this.performTestCleanup();
        }

        // Brief pause between tests
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    };

    // Start concurrent test execution
    await Promise.all(semaphore.map((_, index) => executeTest(index)));
  }

  async executeIndividualTest(testSuite) {
    const testStart = Date.now();
    const timeoutDuration =
      testSuite.duration * CONFIG.EXECUTION.testTimeoutMultiplier;

    this.log(`Starting test: ${testSuite.name}`);

    // Build command parameters
    const params = Object.entries(testSuite.parameters)
      .map(([key, value]) => `--${key} ${value}`)
      .join(" ");

    const command = `node ${testSuite.script} ${params}`;

    console.log(`   COMMAND Command: ${command}`);
    console.log(
      `   ⏱️ Timeout: ${(timeoutDuration / 1000 / 60).toFixed(1)} minutes`
    );

    return new Promise((resolve) => {
      const testProcess = spawn(
        "node",
        [testSuite.script, ...params.split(" ").filter((p) => p)],
        {
          cwd: "./scripts/multi-node-poa",
          stdio: ["ignore", "pipe", "pipe"],
        }
      );

      let stdout = "";
      let stderr = "";
      let completed = false;

      testProcess.stdout.on("data", (data) => {
        stdout += data.toString();
        // Log real-time output for monitoring
        console.log(`   📤 ${testSuite.name}: ${data.toString().trim()}`);
      });

      testProcess.stderr.on("data", (data) => {
        stderr += data.toString();
        console.error(
          `   📥 ${testSuite.name} ERROR: ${data.toString().trim()}`
        );
      });

      testProcess.on("close", (code) => {
        if (completed) return;
        completed = true;

        const testEnd = Date.now();
        const duration = testEnd - testStart;

        const result = {
          testName: testSuite.name,
          status: code === 0 ? "passed" : "failed",
          exitCode: code,
          duration,
          command,
          stdout,
          stderr,
          timestamp: new Date().toISOString(),
        };

        if (code !== 0) {
          result.error = `Process exited with code ${code}`;
        }

        // Save individual test output
        this.saveTestOutput(testSuite.name, result);

        this.log(
          `Test ${testSuite.name} completed: ${result.status} (${duration}ms)`
        );
        resolve(result);
      });

      testProcess.on("error", (error) => {
        if (completed) return;
        completed = true;

        const result = {
          testName: testSuite.name,
          status: "failed",
          error: error.message,
          duration: Date.now() - testStart,
          command,
          timestamp: new Date().toISOString(),
        };

        this.saveTestOutput(testSuite.name, result);
        this.log(`Test ${testSuite.name} failed with error: ${error.message}`);
        resolve(result);
      });

      // Set timeout
      const timeout = setTimeout(() => {
        if (completed) return;
        completed = true;

        testProcess.kill("SIGKILL");

        const result = {
          testName: testSuite.name,
          status: "timeout",
          error: `Test exceeded timeout of ${timeoutDuration}ms`,
          duration: timeoutDuration,
          command,
          timestamp: new Date().toISOString(),
        };

        this.saveTestOutput(testSuite.name, result);
        this.log(`Test ${testSuite.name} timed out after ${timeoutDuration}ms`);
        resolve(result);
      }, timeoutDuration);

      testProcess.on("close", () => clearTimeout(timeout));
      testProcess.on("error", () => clearTimeout(timeout));
    });
  }

  saveTestOutput(testName, result) {
    const outputDir = path.join(
      CONFIG.ORCHESTRATOR_CONFIG.logDirectory,
      testName
    );

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save result metadata
    fs.writeFileSync(
      path.join(outputDir, "result.json"),
      JSON.stringify(result, null, 2)
    );

    // Save stdout
    if (result.stdout) {
      fs.writeFileSync(path.join(outputDir, "stdout.log"), result.stdout);
    }

    // Save stderr
    if (result.stderr) {
      fs.writeFileSync(path.join(outputDir, "stderr.log"), result.stderr);
    }
  }

  async performTestCleanup() {
    console.log("   CLEANING Performing test cleanup...");

    try {
      // Give network time to settle
      await new Promise((resolve) => setTimeout(resolve, 10000));

      // Check if network is still healthy
      const quickHealthCheck = await this.quickNetworkHealthCheck();
      if (!quickHealthCheck) {
        console.warn(
          "   WARNING Network health degraded - additional recovery time"
        );
        await new Promise((resolve) => setTimeout(resolve, 30000));
      }

      this.log("Test cleanup completed");
    } catch (error) {
      console.warn(`   WARNING Cleanup warning: ${error.message}`);
      this.log(`Cleanup warning: ${error.message}`);
    }
  }

  async quickNetworkHealthCheck() {
    try {
      const blockNumbers = await Promise.all(
        Array.from(this.providers.values()).map(async (provider) => {
          try {
            return await provider.getBlockNumber();
          } catch (error) {
            return -1; // Indicate failure
          }
        })
      );

      const validBlocks = blockNumbers.filter((block) => block >= 0);
      const healthyValidators = validBlocks.length / this.providers.size;

      return healthyValidators >= 0.7; // 70% of validators must be responding
    } catch (error) {
      return false;
    }
  }

  async generateComprehensiveAnalysis() {
    console.log("\nMETRICS Generating comprehensive analysis report...");

    this.currentPhase = "analysis";

    const analysis = {
      executionSummary: this.generateExecutionSummary(),
      networkAnalysis: await this.generateNetworkAnalysis(),
      performanceMetrics: this.aggregatePerformanceMetrics(),
      failureAnalysis: this.analyzeFailures(),
      recommendations: this.generateRecommendations(),
      timestamp: new Date().toISOString(),
    };

    // Save execution summary
    fs.writeFileSync(
      path.join(
        CONFIG.ORCHESTRATOR_CONFIG.resultsDirectory,
        CONFIG.EXECUTION_SUMMARY
      ),
      JSON.stringify(analysis, null, 2)
    );

    // Generate HTML report
    await this.generateHTMLReport(analysis);

    // Print summary
    this.printExecutionSummary(analysis);

    console.log("CHECKLIST Comprehensive analysis completed");
    this.log("Comprehensive analysis generation completed");
  }

  generateExecutionSummary() {
    const results = Array.from(this.testResults.values());
    const totalTests = results.length;
    const passedTests = results.filter((r) => r.status === "passed").length;
    const failedTests = results.filter((r) => r.status === "failed").length;
    const crashedTests = results.filter((r) => r.status === "crashed").length;
    const timedOutTests = results.filter((r) => r.status === "timeout").length;

    const totalDuration = Date.now() - this.startTime;
    const testDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0);

    return {
      testCounts: {
        total: totalTests,
        passed: passedTests,
        failed: failedTests,
        crashed: crashedTests,
        timedOut: timedOutTests,
        successRate: totalTests > 0 ? (passedTests / totalTests) * 100 : 0,
      },
      timing: {
        totalExecutionTime: totalDuration,
        testExecutionTime: testDuration,
        overhead: totalDuration - testDuration,
        averageTestDuration: totalTests > 0 ? testDuration / totalTests : 0,
      },
      criticalTestResults: this.analyzeCriticalTests(),
      networkHealth: this.networkStatus,
    };
  }

  analyzeCriticalTests() {
    const criticalTests = CONFIG.TEST_SUITES.filter((suite) => suite.critical);
    const criticalResults = Array.from(this.testResults.values()).filter(
      (result) => criticalTests.some((test) => test.name === result.testName)
    );

    const criticalPassed = criticalResults.filter(
      (r) => r.status === "passed"
    ).length;
    const criticalTotal = criticalResults.length;

    return {
      total: criticalTotal,
      passed: criticalPassed,
      failed: criticalTotal - criticalPassed,
      successRate:
        criticalTotal > 0 ? (criticalPassed / criticalTotal) * 100 : 0,
      allCriticalPassed: criticalPassed === criticalTotal,
    };
  }

  async generateNetworkAnalysis() {
    console.log("   ANALYZING Analyzing network performance...");

    const analysis = {
      validatorStatus: {},
      consensusMetrics: {},
      performanceBaseline: {},
    };

    // Current validator status
    for (const [name, provider] of this.providers) {
      try {
        const [blockNumber, gasPrice, peerCount] = await Promise.all([
          provider.getBlockNumber(),
          provider.getGasPrice(),
          provider.send("net_peerCount", []).catch(() => "0x0"),
        ]);

        analysis.validatorStatus[name] = {
          active: true,
          blockNumber,
          gasPrice: Number(gasPrice),
          peerCount: parseInt(peerCount, 16),
        };
      } catch (error) {
        analysis.validatorStatus[name] = {
          active: false,
          error: error.message,
        };
      }
    }

    // Calculate consensus metrics
    const activeBlocks = Object.values(analysis.validatorStatus)
      .filter((status) => status.active)
      .map((status) => status.blockNumber);

    if (activeBlocks.length > 0) {
      analysis.consensusMetrics = {
        activeValidators: activeBlocks.length,
        totalValidators: CONFIG.VALIDATORS.length,
        maxBlock: Math.max(...activeBlocks),
        minBlock: Math.min(...activeBlocks),
        blockSpread: Math.max(...activeBlocks) - Math.min(...activeBlocks),
        consensusHealth:
          Math.max(...activeBlocks) - Math.min(...activeBlocks) <= 1,
      };
    }

    return analysis;
  }

  aggregatePerformanceMetrics() {
    console.log("   ANALYZING Aggregating performance metrics...");

    const metrics = {
      scalabilityMetrics: {},
      blockPropagationMetrics: {},
      gasPriceMetrics: {},
      failureResilienceMetrics: {},
    };

    // Extract metrics from test results files
    try {
      // Scalability metrics
      const scalabilityFile = path.join(
        CONFIG.ORCHESTRATOR_CONFIG.resultsDirectory,
        "scalability_results.json"
      );
      if (fs.existsSync(scalabilityFile)) {
        const scalabilityData = JSON.parse(
          fs.readFileSync(scalabilityFile, "utf8")
        );
        metrics.scalabilityMetrics = {
          maxTPS: scalabilityData.statistics?.performanceMetrics?.avgTPS || 0,
          totalTransactions:
            scalabilityData.statistics?.testSummary?.identitiesCreated || 0,
          averageGasUsed:
            scalabilityData.statistics?.performanceMetrics?.avgGasUsed || 0,
          successRate:
            scalabilityData.statistics?.testSummary?.successRate || 0,
        };
      }

      // Block propagation metrics
      const propagationFile = path.join(
        CONFIG.ORCHESTRATOR_CONFIG.resultsDirectory,
        "block_propagation_results.json"
      );
      if (fs.existsSync(propagationFile)) {
        const propagationData = JSON.parse(
          fs.readFileSync(propagationFile, "utf8")
        );
        metrics.blockPropagationMetrics = {
          avgPropagationTime:
            propagationData.statistics?.propagationLatency
              ?.avgPropagationTime || 0,
          maxPropagationTime:
            propagationData.statistics?.propagationLatency
              ?.maxPropagationTime || 0,
          p95PropagationTime:
            propagationData.statistics?.propagationLatency
              ?.p95PropagationTime || 0,
          networkHealth:
            propagationData.statistics?.networkHealth?.overall || "unknown",
        };
      }

      // Gas price metrics
      const gasFile = path.join(
        CONFIG.ORCHESTRATOR_CONFIG.resultsDirectory,
        "gas_sensitivity_results.json"
      );
      if (fs.existsSync(gasFile)) {
        const gasData = JSON.parse(fs.readFileSync(gasFile, "utf8"));
        metrics.gasPriceMetrics = {
          optimalGasPrice: gasData.analysis?.optimalGasPrice?.gasPrice || 0,
          overallSuccessRate:
            gasData.analysis?.testSummary?.overallSuccessRate || 0,
          priceRangesTested:
            gasData.analysis?.testSummary?.priceRangesTested || 0,
        };
      }

      // Failure resilience metrics
      const failureFile = path.join(
        CONFIG.ORCHESTRATOR_CONFIG.resultsDirectory,
        "failure_analysis_results.json"
      );
      if (fs.existsSync(failureFile)) {
        const failureData = JSON.parse(fs.readFileSync(failureFile, "utf8"));
        metrics.failureResilienceMetrics = {
          averageResilience:
            failureData.analysis?.resilienceAnalysis?.averageResilience || 0,
          faultTolerance:
            failureData.analysis?.resilienceAnalysis?.faultTolerance ||
            "unknown",
          criticalScenarios:
            failureData.analysis?.resilienceAnalysis?.criticalScenarios || 0,
        };
      }
    } catch (error) {
      console.warn(
        `   WARNING Could not aggregate some performance metrics: ${error.message}`
      );
    }

    return metrics;
  }

  analyzeFailures() {
    console.log("   ANALYZING Analyzing test failures...");

    const failedResults = Array.from(this.testResults.values()).filter(
      (result) => result.status !== "passed"
    );

    const analysis = {
      totalFailures: failedResults.length,
      failuresByType: {},
      criticalFailures: [],
      commonErrors: {},
      recommendations: [],
    };

    // Categorize failures
    failedResults.forEach((result) => {
      if (!analysis.failuresByType[result.status]) {
        analysis.failuresByType[result.status] = [];
      }
      analysis.failuresByType[result.status].push(result.testName);

      // Track critical failures
      const testSuite = CONFIG.TEST_SUITES.find(
        (suite) => suite.name === result.testName
      );
      if (testSuite?.critical) {
        analysis.criticalFailures.push({
          testName: result.testName,
          error: result.error,
          status: result.status,
        });
      }

      // Track common errors
      if (result.error) {
        const errorKey = result.error.substring(0, 100); // First 100 chars
        if (!analysis.commonErrors[errorKey]) {
          analysis.commonErrors[errorKey] = [];
        }
        analysis.commonErrors[errorKey].push(result.testName);
      }
    });

    // Generate failure-specific recommendations
    if (analysis.criticalFailures.length > 0) {
      analysis.recommendations.push(
        "Critical test failures detected - immediate investigation required"
      );
    }

    if (analysis.failuresByType.timeout?.length > 0) {
      analysis.recommendations.push(
        "Timeout failures suggest network performance issues or insufficient test duration"
      );
    }

    if (analysis.failuresByType.crashed?.length > 0) {
      analysis.recommendations.push(
        "Test crashes indicate infrastructure or code stability issues"
      );
    }

    return analysis;
  }

  generateRecommendations() {
    console.log("   RECOMMENDATION Generating recommendations...");

    const recommendations = [];
    const executionSummary = this.generateExecutionSummary();
    const performanceMetrics = this.aggregatePerformanceMetrics();

    // Success rate recommendations
    if (executionSummary.testCounts.successRate < 80) {
      recommendations.push({
        category: "Test Execution",
        severity: "high",
        message:
          "Low test success rate indicates network instability or configuration issues",
        action: "Review network setup and test configuration parameters",
      });
    }

    // Critical test recommendations
    if (!executionSummary.criticalTestResults.allCriticalPassed) {
      recommendations.push({
        category: "Critical Tests",
        severity: "critical",
        message:
          "Not all critical tests passed - network may not meet production requirements",
        action: "Address critical test failures before deploying to production",
      });
    }

    // Performance recommendations
    if (performanceMetrics.scalabilityMetrics.maxTPS < 100) {
      recommendations.push({
        category: "Performance",
        severity: "medium",
        message: "TPS performance below expected threshold",
        action: "Optimize block time, gas limits, or validator configuration",
      });
    }

    if (performanceMetrics.blockPropagationMetrics.avgPropagationTime > 1000) {
      recommendations.push({
        category: "Network Latency",
        severity: "medium",
        message: "High block propagation latency detected",
        action: "Check network connectivity and optimize peer connections",
      });
    }

    // Resilience recommendations
    if (performanceMetrics.failureResilienceMetrics.averageResilience < 70) {
      recommendations.push({
        category: "Fault Tolerance",
        severity: "high",
        message: "Network shows limited resilience to failures",
        action: "Increase validator count or improve consensus parameters",
      });
    }

    // Default success recommendation
    if (recommendations.length === 0) {
      recommendations.push({
        category: "Overall Assessment",
        severity: "info",
        message:
          "All tests passed successfully - network is ready for production",
        action: "Consider regular monitoring and periodic re-testing",
      });
    }

    return recommendations;
  }

  async generateHTMLReport(analysis) {
    console.log("   FILE Generating HTML report...");

    const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Multi-Node PoA Scalability Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; border-bottom: 3px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
        .section { margin: 30px 0; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .metric-card { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 20px; }
        .metric-value { font-size: 2em; font-weight: bold; color: #007bff; }
        .status-passed { color: #28a745; }
        .status-failed { color: #dc3545; }
        .status-timeout { color: #ffc107; }
        .recommendation { padding: 15px; margin: 10px 0; border-left: 4px solid; border-radius: 4px; }
        .rec-critical { border-color: #dc3545; background: #f8d7da; }
        .rec-high { border-color: #fd7e14; background: #fff3cd; }
        .rec-medium { border-color: #ffc107; background: #fff3cd; }
        .rec-info { border-color: #17a2b8; background: #d1ecf1; }
        .test-result { padding: 10px; margin: 5px 0; border-radius: 4px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; font-weight: bold; }
        .chart-placeholder { background: #e9ecef; height: 300px; display: flex; align-items: center; justify-content: center; border-radius: 8px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Multi-Node PoA Network Scalability Analysis</h1>
            <p>Comprehensive Test Report Generated on ${new Date().toLocaleString()}</p>
            <p>Network: ${CONFIG.VALIDATORS.length} Validators | Chain ID: ${
      analysis.networkAnalysis?.consensusMetrics?.chainId || "Unknown"
    }</p>
        </div>

        <div class="section">
            <h2>METRICS Executive Summary</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <h3>Test Success Rate</h3>
                    <div class="metric-value ${
                      analysis.executionSummary.testCounts.successRate >= 80
                        ? "status-passed"
                        : "status-failed"
                    }">
                        ${analysis.executionSummary.testCounts.successRate.toFixed(
                          1
                        )}%
                    </div>
                    <p>${analysis.executionSummary.testCounts.passed}/${
      analysis.executionSummary.testCounts.total
    } tests passed</p>
                </div>
                <div class="metric-card">
                    <h3>Network Throughput</h3>
                    <div class="metric-value">${
                      analysis.performanceMetrics.scalabilityMetrics.maxTPS?.toFixed(
                        1
                      ) || "N/A"
                    }</div>
                    <p>Maximum TPS achieved</p>
                </div>
                <div class="metric-card">
                    <h3>Block Propagation</h3>
                    <div class="metric-value">${
                      analysis.performanceMetrics.blockPropagationMetrics.avgPropagationTime?.toFixed(
                        0
                      ) || "N/A"
                    }ms</div>
                    <p>Average propagation latency</p>
                </div>
                <div class="metric-card">
                    <h3>Network Resilience</h3>
                    <div class="metric-value ${
                      (analysis.performanceMetrics.failureResilienceMetrics
                        .averageResilience || 0) >= 70
                        ? "status-passed"
                        : "status-failed"
                    }">
                        ${
                          analysis.performanceMetrics.failureResilienceMetrics.averageResilience?.toFixed(
                            1
                          ) || "N/A"
                        }%
                    </div>
                    <p>Fault tolerance score</p>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>TESTING Test Execution Results</h2>
            <table>
                <thead>
                    <tr>
                        <th>Test Name</th>
                        <th>Status</th>
                        <th>Duration</th>
                        <th>Critical</th>
                        <th>Description</th>
                    </tr>
                </thead>
                <tbody>
                    ${Array.from(this.testResults.values())
                      .map((result) => {
                        const testSuite = CONFIG.TEST_SUITES.find(
                          (s) => s.name === result.testName
                        );
                        const statusClass =
                          result.status === "passed"
                            ? "status-passed"
                            : result.status === "failed"
                            ? "status-failed"
                            : "status-timeout";
                        return `
                        <tr>
                            <td>${result.testName}</td>
                            <td class="${statusClass}">${result.status.toUpperCase()}</td>
                            <td>${(result.duration / 1000 / 60).toFixed(
                              1
                            )} min</td>
                            <td>${
                              testSuite?.critical
                                ? "CRITICAL Yes"
                                : "METRICS No"
                            }</td>
                            <td>${testSuite?.description || "N/A"}</td>
                        </tr>`;
                      })
                      .join("")}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>TARGETING Performance Analysis</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <h3>Scalability Metrics</h3>
                    <p><strong>Max TPS:</strong> ${
                      analysis.performanceMetrics.scalabilityMetrics.maxTPS?.toFixed(
                        2
                      ) || "N/A"
                    }</p>
                    <p><strong>Total Transactions:</strong> ${
                      analysis.performanceMetrics.scalabilityMetrics.totalTransactions?.toLocaleString() ||
                      "N/A"
                    }</p>
                    <p><strong>Success Rate:</strong> ${
                      analysis.performanceMetrics.scalabilityMetrics.successRate?.toFixed(
                        1
                      ) || "N/A"
                    }%</p>
                </div>
                <div class="metric-card">
                    <h3>Block Propagation</h3>
                    <p><strong>Average:</strong> ${
                      analysis.performanceMetrics.blockPropagationMetrics.avgPropagationTime?.toFixed(
                        0
                      ) || "N/A"
                    }ms</p>
                    <p><strong>P95:</strong> ${
                      analysis.performanceMetrics.blockPropagationMetrics.p95PropagationTime?.toFixed(
                        0
                      ) || "N/A"
                    }ms</p>
                    <p><strong>Max:</strong> ${
                      analysis.performanceMetrics.blockPropagationMetrics.maxPropagationTime?.toFixed(
                        0
                      ) || "N/A"
                    }ms</p>
                </div>
                <div class="metric-card">
                    <h3>Gas Price Analysis</h3>
                    <p><strong>Optimal Price:</strong> ${
                      analysis.performanceMetrics.gasPriceMetrics
                        .optimalGasPrice || "N/A"
                    } gwei</p>
                    <p><strong>Overall Success:</strong> ${
                      analysis.performanceMetrics.gasPriceMetrics.overallSuccessRate?.toFixed(
                        1
                      ) || "N/A"
                    }%</p>
                    <p><strong>Ranges Tested:</strong> ${
                      analysis.performanceMetrics.gasPriceMetrics
                        .priceRangesTested || "N/A"
                    }</p>
                </div>
                <div class="metric-card">
                    <h3>Fault Tolerance</h3>
                    <p><strong>Resilience Score:</strong> ${
                      analysis.performanceMetrics.failureResilienceMetrics.averageResilience?.toFixed(
                        1
                      ) || "N/A"
                    }%</p>
                    <p><strong>Tolerance Level:</strong> ${
                      analysis.performanceMetrics.failureResilienceMetrics.faultTolerance?.replace(
                        /_/g,
                        " "
                      ) || "N/A"
                    }</p>
                    <p><strong>Critical Scenarios:</strong> ${
                      analysis.performanceMetrics.failureResilienceMetrics
                        .criticalScenarios || "N/A"
                    }</p>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>SECURITY Network Health Status</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <h3>Validator Status</h3>
                    <p><strong>Active Validators:</strong> ${
                      Object.values(
                        analysis.networkAnalysis.validatorStatus
                      ).filter((v) => v.active).length
                    }/${CONFIG.VALIDATORS.length}</p>
                    <p><strong>Consensus Health:</strong> ${
                      analysis.networkAnalysis.consensusMetrics?.consensusHealth
                        ? "SUCCESS Good"
                        : "WARNING Issues Detected"
                    }</p>
                    <p><strong>Block Spread:</strong> ${
                      analysis.networkAnalysis.consensusMetrics?.blockSpread ||
                      "N/A"
                    } blocks</p>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>RECOMMENDATION Recommendations</h2>
            ${analysis.recommendations
              .map(
                (rec) => `
                <div class="recommendation rec-${rec.severity}">
                    <h4>${rec.category} (${rec.severity.toUpperCase()})</h4>
                    <p><strong>Issue:</strong> ${rec.message}</p>
                    <p><strong>Action:</strong> ${rec.action}</p>
                </div>
            `
              )
              .join("")}
        </div>

        <div class="section">
            <h2>CHECKLIST Test Configuration</h2>
            <table>
                <thead>
                    <tr>
                        <th>Parameter</th>
                        <th>Value</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td>Total Validators</td><td>${
                      CONFIG.VALIDATORS.length
                    }</td></tr>
                    <tr><td>Test Suites</td><td>${
                      CONFIG.TEST_SUITES.length
                    }</td></tr>
                    <tr><td>Critical Tests</td><td>${
                      CONFIG.TEST_SUITES.filter((s) => s.critical).length
                    }</td></tr>
                    <tr><td>Total Execution Time</td><td>${(
                      analysis.executionSummary.timing.totalExecutionTime /
                      1000 /
                      60
                    ).toFixed(1)} minutes</td></tr>
                    <tr><td>Test Timeout Multiplier</td><td>${
                      CONFIG.EXECUTION.testTimeoutMultiplier
                    }x</td></tr>
                    <tr><td>Max Concurrent Tests</td><td>${
                      CONFIG.EXECUTION.maxConcurrentTests
                    }</td></tr>
                </tbody>
            </table>
        </div>

        <div class="section">
            <p style="text-align: center; color: #666; margin-top: 40px;">
                Report generated by Multi-Node PoA Test Orchestrator v1.0.0<br>
                ${new Date().toISOString()}
            </p>
        </div>
    </div>
</body>
</html>`;

    fs.writeFileSync(
      path.join(
        CONFIG.ORCHESTRATOR_CONFIG.reportDirectory,
        CONFIG.COMPREHENSIVE_REPORT
      ),
      htmlTemplate
    );

    console.log(`   FILE HTML report saved: ${CONFIG.COMPREHENSIVE_REPORT}`);
  }

  printExecutionSummary(analysis) {
    console.log("\n" + "=".repeat(80));
    console.log("ORCHESTRATOR MULTI-NODE POA TEST ORCHESTRATOR SUMMARY");
    console.log("=".repeat(80));

    console.log(`\nMETRICS Execution Summary:`);
    console.log(
      `   Total Tests: ${analysis.executionSummary.testCounts.total}`
    );
    console.log(
      `   Passed: ${analysis.executionSummary.testCounts.passed} SUCCESS`
    );
    console.log(
      `   Failed: ${analysis.executionSummary.testCounts.failed} ERROR`
    );
    console.log(
      `   Crashed: ${analysis.executionSummary.testCounts.crashed} CRASH`
    );
    console.log(
      `   Timed Out: ${analysis.executionSummary.testCounts.timedOut} TIMEOUT`
    );
    console.log(
      `   Success Rate: ${analysis.executionSummary.testCounts.successRate.toFixed(
        1
      )}%`
    );

    console.log(`\n⏱️ Timing:`);
    console.log(
      `   Total Execution: ${(
        analysis.executionSummary.timing.totalExecutionTime /
        1000 /
        60
      ).toFixed(1)} minutes`
    );
    console.log(
      `   Test Execution: ${(
        analysis.executionSummary.timing.testExecutionTime /
        1000 /
        60
      ).toFixed(1)} minutes`
    );
    console.log(
      `   Overhead: ${(
        analysis.executionSummary.timing.overhead /
        1000 /
        60
      ).toFixed(1)} minutes`
    );

    console.log(`\nTARGETING Critical Tests:`);
    console.log(
      `   Status: ${
        analysis.executionSummary.criticalTestResults.allCriticalPassed
          ? "SUCCESS ALL PASSED"
          : "ERROR FAILURES DETECTED"
      }`
    );
    console.log(
      `   Passed: ${analysis.executionSummary.criticalTestResults.passed}/${analysis.executionSummary.criticalTestResults.total}`
    );

    console.log(`\nANALYZING Key Performance Metrics:`);
    console.log(
      `   Max TPS: ${
        analysis.performanceMetrics.scalabilityMetrics.maxTPS?.toFixed(1) ||
        "N/A"
      }`
    );
    console.log(
      `   Avg Block Propagation: ${
        analysis.performanceMetrics.blockPropagationMetrics.avgPropagationTime?.toFixed(
          0
        ) || "N/A"
      }ms`
    );
    console.log(
      `   Network Resilience: ${
        analysis.performanceMetrics.failureResilienceMetrics.averageResilience?.toFixed(
          1
        ) || "N/A"
      }%`
    );
    console.log(
      `   Optimal Gas Price: ${
        analysis.performanceMetrics.gasPriceMetrics.optimalGasPrice || "N/A"
      } gwei`
    );

    console.log(`\nSECURITY Network Health:`);
    console.log(
      `   Active Validators: ${
        Object.values(analysis.networkAnalysis.validatorStatus).filter(
          (v) => v.active
        ).length
      }/${CONFIG.VALIDATORS.length}`
    );
    console.log(
      `   Consensus Health: ${
        analysis.networkAnalysis.consensusMetrics?.consensusHealth
          ? "Good"
          : "Issues Detected"
      }`
    );

    console.log(`\nRECOMMENDATION Top Recommendations:`);
    analysis.recommendations.slice(0, 3).forEach((rec, index) => {
      console.log(
        `   ${index + 1}. [${rec.severity.toUpperCase()}] ${rec.message}`
      );
    });

    console.log(`\nCHECKLIST Generated Files:`);
    console.log(
      `   FILE Execution Summary: ${CONFIG.ORCHESTRATOR_CONFIG.resultsDirectory}/${CONFIG.EXECUTION_SUMMARY}`
    );
    console.log(
      `   METRICS HTML Report: ${CONFIG.ORCHESTRATOR_CONFIG.reportDirectory}/${CONFIG.COMPREHENSIVE_REPORT}`
    );
    console.log(`   COMMAND Orchestrator Log: ${CONFIG.ORCHESTRATOR_LOG}`);
    console.log(
      `   📁 Individual Test Logs: ${CONFIG.ORCHESTRATOR_CONFIG.logDirectory}/`
    );

    const overallStatus =
      analysis.executionSummary.criticalTestResults.allCriticalPassed &&
      analysis.executionSummary.testCounts.successRate >= 80
        ? "SUCCESS"
        : "NEEDS_ATTENTION";

    console.log(
      `\nTARGETING Overall Assessment: ${
        overallStatus === "SUCCESS"
          ? "SUCCESS SUCCESS"
          : "WARNING NEEDS ATTENTION"
      }`
    );

    if (overallStatus === "SUCCESS") {
      console.log(
        "   The multi-node PoA network demonstrates good scalability and resilience characteristics."
      );
      console.log(
        "   Network is ready for production deployment with regular monitoring."
      );
    } else {
      console.log(
        "   Critical issues detected that require attention before production deployment."
      );
      console.log(
        "   Review failed tests and implement recommended improvements."
      );
    }
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp}: ${message}\n`;
    fs.appendFileSync(CONFIG.ORCHESTRATOR_LOG, logMessage);

    this.executionLog.push({
      timestamp: Date.now(),
      phase: this.currentPhase,
      message,
    });
  }
}

// Main execution function
async function runTestOrchestrator() {
  const orchestrator = new TestOrchestrator();

  try {
    await orchestrator.initialize();
    await orchestrator.runTestSuite();
    console.log(
      "\nCELEBRATION Multi-Node PoA test orchestration completed successfully!"
    );
  } catch (error) {
    console.error("\nCRASH Test orchestration failed:", error.message);
    orchestrator.log(`Test orchestration failed: ${error.message}`);
    process.exit(1);
  }
}

// Parse command line arguments
if (process.argv.includes("--help")) {
  console.log(`
Multi-Node PoA Test Orchestrator

Usage: node testOrchestrator.js [options]

Options:
  --critical-only         Run only critical test suites
  --test <name>          Run specific test suite only
  --max-concurrent <num>  Maximum concurrent tests (default: 2)
  --no-cleanup           Skip cleanup between tests
  --help                 Show this help message

Available test suites: ${CONFIG.TEST_SUITES.map((s) => s.name).join(", ")}

Example:
  node testOrchestrator.js --critical-only
  node testOrchestrator.js --test baseline_scalability
`);
  process.exit(0);
}

// Process command line arguments
if (process.argv.includes("--critical-only")) {
  CONFIG.TEST_SUITES = CONFIG.TEST_SUITES.filter((suite) => suite.critical);
  console.log("Running critical test suites only");
}

const testIndex = process.argv.indexOf("--test");
if (testIndex !== -1 && process.argv[testIndex + 1]) {
  const testName = process.argv[testIndex + 1];
  CONFIG.TEST_SUITES = CONFIG.TEST_SUITES.filter(
    (suite) => suite.name === testName
  );

  if (CONFIG.TEST_SUITES.length === 0) {
    console.error(`Unknown test suite: ${testName}`);
    process.exit(1);
  }
  console.log(`Running specific test suite: ${testName}`);
}

const concurrentIndex = process.argv.indexOf("--max-concurrent");
if (concurrentIndex !== -1 && process.argv[concurrentIndex + 1]) {
  CONFIG.EXECUTION.maxConcurrentTests = parseInt(
    process.argv[concurrentIndex + 1]
  );
}

if (process.argv.includes("--no-cleanup")) {
  CONFIG.EXECUTION.cleanupBetweenTests = false;
  console.log("Cleanup between tests disabled");
}

// Run the orchestrator
runTestOrchestrator().catch(console.error);
