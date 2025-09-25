import { ethers } from "ethers";
import fs from "fs";
import path from "path";

const CONFIG = {
  // Validator endpoints
  VALIDATORS: [
    { name: "validator1", rpc: "http://10.0.1.10:8545" },
    { name: "validator2", rpc: "http://10.0.1.11:8546" },
    { name: "validator3", rpc: "http://10.0.1.12:8547" },
    { name: "validator4", rpc: "http://10.0.1.13:8548" },
    { name: "validator5", rpc: "http://10.0.1.14:8549" },
    { name: "validator6", rpc: "http://10.0.1.15:8550" },
    { name: "validator7", rpc: "http://10.0.1.16:8551" },
  ],

  // Gas price test ranges (in gwei)
  GAS_PRICE_RANGES: [
    { name: "ultra_low", min: 0.1, max: 1, step: 0.1 },
    { name: "low", min: 1, max: 10, step: 1 },
    { name: "medium", min: 10, max: 50, step: 5 },
    { name: "high", min: 50, max: 100, step: 10 },
    { name: "extreme", min: 100, max: 1000, step: 50 },
  ],

  // Test parameters
  TRANSACTIONS_PER_PRICE: 50, // Number of transactions per gas price test
  CONCURRENT_TRANSACTIONS: 10, // Parallel transactions per test
  TEST_TIMEOUT: 60000, // 60 seconds timeout per gas price test
  MEMPOOL_ANALYSIS_INTERVAL: 1000, // Check mempool every second

  // Output files
  GAS_RESULTS_FILE: "gas_sensitivity_results.json",
  GAS_CSV_FILE: "gas_sensitivity_metrics.csv",
  MEMPOOL_DATA_FILE: "mempool_analysis.json",
  GAS_LOG_FILE: "gas_sensitivity.log",
};

class GasPriceSensitivityTester {
  constructor() {
    this.providers = new Map();
    this.signers = new Map();
    this.contract = null;
    this.testResults = [];
    this.mempoolData = [];
    this.networkBaseline = null;
  }

  async initialize() {
    console.log("GAS Initializing Gas Price Sensitivity Test Suite");
    this.log("Starting gas price sensitivity test initialization");

    // Initialize providers and signers for each validator
    for (const validator of CONFIG.VALIDATORS) {
      try {
        const provider = new ethers.JsonRpcProvider(validator.rpc);
        this.providers.set(validator.name, provider);

        // Get multiple signers from each validator
        const signers = [];
        for (let i = 0; i < 5; i++) {
          try {
            const signer = await provider.getSigner(i);
            signers.push(signer);
          } catch (error) {
            break; // No more signers available
          }
        }
        this.signers.set(validator.name, signers);

        const blockNumber = await provider.getBlockNumber();
        console.log(
          `SUCCESS Connected to ${validator.name}: Block ${blockNumber}, ${signers.length} signers`
        );
      } catch (error) {
        console.error(
          `ERROR Failed to connect to ${validator.name}:`,
          error.message
        );
        throw new Error(`Cannot connect to validator ${validator.name}`);
      }
    }

    // Deploy test contract
    await this.deployTestContract();

    // Establish network baseline
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

    // Use the first signer from the first validator
    const primarySigners = this.signers.get(CONFIG.VALIDATORS[0].name);
    const deploySigner = primarySigners[0];

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

    const baseline = {
      timestamp: new Date().toISOString(),
      validators: {},
      averageBlockTime: 0,
      averageGasPrice: 0,
      networkLoad: {},
    };

    // Get baseline metrics from each validator
    for (const validator of CONFIG.VALIDATORS) {
      const provider = this.providers.get(validator.name);

      try {
        // Get recent blocks to calculate average block time
        const latestBlock = await provider.getBlock("latest");
        const previousBlock = await provider.getBlock(latestBlock.number - 10);
        const avgBlockTime =
          (latestBlock.timestamp - previousBlock.timestamp) / 10;

        // Get current gas price
        const gasPrice = await provider.getGasPrice();

        // Get pending transaction count
        const pendingTxCount = await provider.send("txpool_status", []);

        baseline.validators[validator.name] = {
          latestBlock: latestBlock.number,
          gasPrice: Number(gasPrice),
          avgBlockTime,
          pendingTransactions: pendingTxCount?.pending || 0,
        };
      } catch (error) {
        console.warn(
          `WARNING Could not get baseline from ${validator.name}:`,
          error.message
        );
        baseline.validators[validator.name] = { error: error.message };
      }
    }

    // Calculate network averages
    const validValidators = Object.values(baseline.validators).filter(
      (v) => !v.error
    );
    if (validValidators.length > 0) {
      baseline.averageBlockTime =
        validValidators.reduce((sum, v) => sum + v.avgBlockTime, 0) /
        validValidators.length;
      baseline.averageGasPrice =
        validValidators.reduce((sum, v) => sum + v.gasPrice, 0) /
        validValidators.length;
    }

    this.networkBaseline = baseline;
    console.log(
      `ANALYZING Baseline established: ${baseline.averageBlockTime.toFixed(
        2
      )}s blocks, ${ethers.formatUnits(baseline.averageGasPrice, "gwei")} gwei`
    );
  }

  async runGasSensitivityTest() {
    console.log("\nGAS Starting comprehensive gas price sensitivity analysis");
    console.log(
      `METRICS Testing ${CONFIG.GAS_PRICE_RANGES.length} price ranges`
    );
    console.log(
      `PROCESSING ${CONFIG.TRANSACTIONS_PER_PRICE} transactions per price point`
    );

    for (const priceRange of CONFIG.GAS_PRICE_RANGES) {
      console.log(
        `\nTARGETING Testing ${priceRange.name} range: ${priceRange.min}-${priceRange.max} gwei`
      );

      await this.testGasPriceRange(priceRange);

      // Brief pause between ranges to let network settle
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    console.log("\nANALYZING Analyzing results...");
    await this.analyzeResults();
  }

  async testGasPriceRange(priceRange) {
    const prices = [];
    for (
      let price = priceRange.min;
      price <= priceRange.max;
      price += priceRange.step
    ) {
      prices.push(price);
    }

    console.log(
      `   Testing ${prices.length} price points in ${priceRange.name} range`
    );

    for (const gasPriceGwei of prices) {
      const gasPriceWei = ethers.parseUnits(gasPriceGwei.toString(), "gwei");

      console.log(`   LOCATION Testing ${gasPriceGwei} gwei...`);

      const testResult = await this.testSpecificGasPrice(
        gasPriceGwei,
        gasPriceWei,
        priceRange.name
      );
      this.testResults.push(testResult);

      // Log progress
      this.log(
        `Completed test for ${gasPriceGwei} gwei: ${testResult.successRate}% success rate`
      );
    }
  }

  async testSpecificGasPrice(gasPriceGwei, gasPriceWei, category) {
    const testStart = Date.now();
    const transactions = [];
    const mempoolSnapshots = [];

    // Start mempool monitoring
    const mempoolMonitor = setInterval(async () => {
      const snapshot = await this.captureNetworkSnapshot();
      mempoolSnapshots.push({
        timestamp: Date.now(),
        gasPriceGwei,
        ...snapshot,
      });
    }, CONFIG.MEMPOOL_ANALYSIS_INTERVAL);

    try {
      // Generate transactions with the specified gas price
      const txPromises = [];
      const batchSize = Math.min(
        CONFIG.CONCURRENT_TRANSACTIONS,
        CONFIG.TRANSACTIONS_PER_PRICE
      );

      for (
        let batch = 0;
        batch < Math.ceil(CONFIG.TRANSACTIONS_PER_PRICE / batchSize);
        batch++
      ) {
        const batchPromises = [];

        for (
          let i = 0;
          i < batchSize &&
          batch * batchSize + i < CONFIG.TRANSACTIONS_PER_PRICE;
          i++
        ) {
          const txIndex = batch * batchSize + i;

          // Distribute transactions across validators
          const validatorIndex = txIndex % CONFIG.VALIDATORS.length;
          const validator = CONFIG.VALIDATORS[validatorIndex];
          const signers = this.signers.get(validator.name);
          const signer = signers[txIndex % signers.length];

          const txPromise = this.sendTestTransaction(
            signer,
            gasPriceWei,
            txIndex,
            validator.name
          );
          batchPromises.push(txPromise);
        }

        // Execute batch
        const batchResults = await Promise.allSettled(batchPromises);
        transactions.push(
          ...batchResults.map((result, index) => ({
            batchIndex: batch,
            transactionIndex: batch * batchSize + index,
            ...(result.value || {
              error: result.reason?.message || "Unknown error",
            }),
          }))
        );

        // Small delay between batches
        if (batch < Math.ceil(CONFIG.TRANSACTIONS_PER_PRICE / batchSize) - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    } finally {
      clearInterval(mempoolMonitor);
    }

    const testEnd = Date.now();

    // Analyze this test's results
    const successfulTxs = transactions.filter((tx) => tx.receipt && !tx.error);
    const failedTxs = transactions.filter((tx) => tx.error);

    const result = {
      timestamp: new Date().toISOString(),
      gasPriceGwei,
      gasPriceWei: gasPriceWei.toString(),
      category,
      testDuration: testEnd - testStart,
      transactions,
      mempoolSnapshots,
      metrics: {
        totalTransactions: transactions.length,
        successfulTransactions: successfulTxs.length,
        failedTransactions: failedTxs.length,
        successRate: (successfulTxs.length / transactions.length) * 100,
        avgConfirmationTime:
          successfulTxs.length > 0
            ? successfulTxs.reduce(
                (sum, tx) => sum + (tx.confirmationTime || 0),
                0
              ) / successfulTxs.length
            : 0,
        avgGasUsed:
          successfulTxs.length > 0
            ? successfulTxs.reduce((sum, tx) => sum + (tx.gasUsed || 0), 0) /
              successfulTxs.length
            : 0,
        totalGasCost: successfulTxs.reduce(
          (sum, tx) => sum + (tx.gasCost || 0),
          0
        ),
        validatorDistribution: this.analyzeValidatorDistribution(successfulTxs),
      },
    };

    return result;
  }

  async sendTestTransaction(signer, gasPrice, txIndex, validatorName) {
    const txStart = Date.now();

    try {
      // Connect contract to the specific signer
      const contract = this.contract.connect(signer);

      // Generate unique biometric hash
      const biometricHash = ethers.keccak256(
        ethers.toUtf8Bytes(`gas-test-${txIndex}-${Date.now()}-${Math.random()}`)
      );

      // Send transaction with specified gas price
      const tx = await contract.registerIdentity(biometricHash, {
        gasPrice: gasPrice,
        gasLimit: 200000, // Reasonable gas limit
      });

      const receipt = await tx.wait();
      const txEnd = Date.now();

      return {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: Number(receipt.gasUsed),
        gasCost: Number(receipt.gasUsed) * Number(gasPrice),
        confirmationTime: txEnd - txStart,
        validatorName,
        receipt,
      };
    } catch (error) {
      const txEnd = Date.now();
      return {
        error: error.message,
        confirmationTime: txEnd - txStart,
        validatorName,
      };
    }
  }

  async captureNetworkSnapshot() {
    const snapshot = {
      mempoolStatus: {},
      gasPrice: {},
      blockNumbers: {},
      pendingTxCounts: {},
    };

    // Capture data from all validators
    await Promise.all(
      CONFIG.VALIDATORS.map(async (validator) => {
        try {
          const provider = this.providers.get(validator.name);

          // Get mempool status
          const mempoolStatus = await provider.send("txpool_status", []);
          snapshot.mempoolStatus[validator.name] = mempoolStatus;

          // Get current gas price
          const gasPrice = await provider.getGasPrice();
          snapshot.gasPrice[validator.name] = Number(gasPrice);

          // Get latest block
          const blockNumber = await provider.getBlockNumber();
          snapshot.blockNumbers[validator.name] = blockNumber;

          // Get pending transaction count
          const pendingCount = await provider.send(
            "eth_getBlockTransactionCountByNumber",
            ["pending"]
          );
          snapshot.pendingTxCounts[validator.name] = parseInt(pendingCount, 16);
        } catch (error) {
          snapshot.mempoolStatus[validator.name] = { error: error.message };
        }
      })
    );

    return snapshot;
  }

  analyzeValidatorDistribution(transactions) {
    const distribution = {};
    CONFIG.VALIDATORS.forEach((validator) => {
      distribution[validator.name] = 0;
    });

    transactions.forEach((tx) => {
      if (tx.validatorName) {
        distribution[tx.validatorName]++;
      }
    });

    return distribution;
  }

  async analyzeResults() {
    console.log("METRICS Analyzing gas price sensitivity results...");

    if (this.testResults.length === 0) {
      console.warn("WARNING No test results to analyze!");
      return;
    }

    const analysis = {
      testSummary: {
        totalTests: this.testResults.length,
        priceRangesTested: CONFIG.GAS_PRICE_RANGES.length,
        totalTransactions: this.testResults.reduce(
          (sum, r) => sum + r.metrics.totalTransactions,
          0
        ),
        overallSuccessRate: this.calculateOverallSuccessRate(),
      },
      pricePerformance: this.analyzePricePerformance(),
      optimalGasPrice: this.findOptimalGasPrice(),
      validatorAnalysis: this.analyzeValidatorPerformance(),
      networkEffects: this.analyzeNetworkEffects(),
      recommendations: this.generateRecommendations(),
    };

    this.printResults(analysis);
    await this.saveResults(analysis);
  }

  calculateOverallSuccessRate() {
    const totalTx = this.testResults.reduce(
      (sum, r) => sum + r.metrics.totalTransactions,
      0
    );
    const successfulTx = this.testResults.reduce(
      (sum, r) => sum + r.metrics.successfulTransactions,
      0
    );
    return totalTx > 0 ? (successfulTx / totalTx) * 100 : 0;
  }

  analyzePricePerformance() {
    const performance = {
      byCategory: {},
      priceEfficiency: [],
      confirmationTimeAnalysis: {},
    };

    // Group by category
    CONFIG.GAS_PRICE_RANGES.forEach((range) => {
      const categoryResults = this.testResults.filter(
        (r) => r.category === range.name
      );
      if (categoryResults.length > 0) {
        performance.byCategory[range.name] = {
          averageSuccessRate:
            categoryResults.reduce((sum, r) => sum + r.metrics.successRate, 0) /
            categoryResults.length,
          averageConfirmationTime:
            categoryResults.reduce(
              (sum, r) => sum + r.metrics.avgConfirmationTime,
              0
            ) / categoryResults.length,
          priceRange: `${range.min}-${range.max} gwei`,
          totalCost: categoryResults.reduce(
            (sum, r) => sum + r.metrics.totalGasCost,
            0
          ),
        };
      }
    });

    // Analyze price efficiency (success rate per gwei)
    this.testResults.forEach((result) => {
      if (result.metrics.successRate > 0) {
        performance.priceEfficiency.push({
          gasPriceGwei: result.gasPriceGwei,
          successRate: result.metrics.successRate,
          efficiency: result.metrics.successRate / result.gasPriceGwei,
          confirmationTime: result.metrics.avgConfirmationTime,
        });
      }
    });

    // Sort by efficiency
    performance.priceEfficiency.sort((a, b) => b.efficiency - a.efficiency);

    return performance;
  }

  findOptimalGasPrice() {
    const results = this.testResults.filter((r) => r.metrics.successRate >= 95); // Only consider high success rates

    if (results.length === 0) {
      return {
        gasPrice: null,
        reason: "No gas prices achieved 95% success rate",
      };
    }

    // Find the lowest gas price with 95%+ success rate
    const optimal = results.reduce((min, current) =>
      current.gasPriceGwei < min.gasPriceGwei ? current : min
    );

    return {
      gasPrice: optimal.gasPriceGwei,
      successRate: optimal.metrics.successRate,
      avgConfirmationTime: optimal.metrics.avgConfirmationTime,
      reason: "Lowest gas price with 95%+ success rate",
    };
  }

  analyzeValidatorPerformance() {
    const validatorStats = {};

    CONFIG.VALIDATORS.forEach((validator) => {
      validatorStats[validator.name] = {
        totalTransactions: 0,
        successfulTransactions: 0,
        avgConfirmationTime: 0,
        gasPricePreference: {},
      };
    });

    // Aggregate data across all tests
    this.testResults.forEach((result) => {
      Object.entries(result.metrics.validatorDistribution).forEach(
        ([validator, count]) => {
          validatorStats[validator].totalTransactions += count;

          // Approximate successful transactions (assuming same success rate distribution)
          const successfulCount = Math.round(
            count * (result.metrics.successRate / 100)
          );
          validatorStats[validator].successfulTransactions += successfulCount;

          // Track gas price preferences
          if (
            !validatorStats[validator].gasPricePreference[result.gasPriceGwei]
          ) {
            validatorStats[validator].gasPricePreference[
              result.gasPriceGwei
            ] = 0;
          }
          validatorStats[validator].gasPricePreference[result.gasPriceGwei] +=
            count;
        }
      );
    });

    // Calculate success rates
    Object.keys(validatorStats).forEach((validator) => {
      const stats = validatorStats[validator];
      stats.successRate =
        stats.totalTransactions > 0
          ? (stats.successfulTransactions / stats.totalTransactions) * 100
          : 0;
    });

    return validatorStats;
  }

  analyzeNetworkEffects() {
    const effects = {
      mempoolBehavior: {},
      gasPriceThresholds: {},
      networkCongestion: {},
    };

    // Analyze mempool data
    const allMempoolData = this.testResults.flatMap((r) => r.mempoolSnapshots);

    if (allMempoolData.length > 0) {
      // Group by gas price ranges
      CONFIG.GAS_PRICE_RANGES.forEach((range) => {
        const rangeData = allMempoolData.filter(
          (snapshot) =>
            snapshot.gasPriceGwei >= range.min &&
            snapshot.gasPriceGwei <= range.max
        );

        if (rangeData.length > 0) {
          effects.mempoolBehavior[range.name] = {
            avgPendingTxCount: this.calculateAverageAcrossValidators(
              rangeData,
              "pendingTxCounts"
            ),
            avgMempoolSize: this.calculateAverageAcrossValidators(
              rangeData,
              "mempoolStatus"
            ),
          };
        }
      });
    }

    return effects;
  }

  calculateAverageAcrossValidators(snapshots, field) {
    const averages = {};

    CONFIG.VALIDATORS.forEach((validator) => {
      const values = snapshots
        .map((s) => s[field] && s[field][validator.name])
        .filter((v) => v !== undefined && typeof v === "number");

      averages[validator.name] =
        values.length > 0
          ? values.reduce((sum, val) => sum + val, 0) / values.length
          : 0;
    });

    return averages;
  }

  generateRecommendations() {
    const recommendations = [];
    const optimal = this.findOptimalGasPrice();
    const performance = this.analyzePricePerformance();

    // Gas price recommendations
    if (optimal.gasPrice) {
      recommendations.push(
        `Use ${
          optimal.gasPrice
        } gwei for optimal cost-efficiency (${optimal.successRate.toFixed(
          1
        )}% success rate)`
      );
    } else {
      recommendations.push(
        "Consider increasing gas prices - no tested price achieved 95% success rate"
      );
    }

    // Performance recommendations
    const bestCategory = Object.entries(performance.byCategory).sort(
      (a, b) => b[1].averageSuccessRate - a[1].averageSuccessRate
    )[0];

    if (bestCategory) {
      recommendations.push(
        `Best performance in ${bestCategory[0]} range (${bestCategory[1].priceRange})`
      );
    }

    // Efficiency recommendations
    if (performance.priceEfficiency.length > 0) {
      const mostEfficient = performance.priceEfficiency[0];
      recommendations.push(
        `Most efficient gas price: ${
          mostEfficient.gasPriceGwei
        } gwei (${mostEfficient.efficiency.toFixed(2)} success rate per gwei)`
      );
    }

    // Network health recommendations
    const overallSuccessRate = this.calculateOverallSuccessRate();
    if (overallSuccessRate < 90) {
      recommendations.push(
        "Network shows signs of congestion - consider increasing base gas prices"
      );
    } else if (overallSuccessRate > 98) {
      recommendations.push(
        "Network is performing well - current gas price strategy is effective"
      );
    }

    return recommendations;
  }

  printResults(analysis) {
    console.log("\n" + "=".repeat(80));
    console.log("GAS GAS PRICE SENSITIVITY ANALYSIS RESULTS");
    console.log("=".repeat(80));

    console.log(`\nMETRICS Test Summary:`);
    console.log(`   Total Tests: ${analysis.testSummary.totalTests}`);
    console.log(`   Price Ranges: ${analysis.testSummary.priceRangesTested}`);
    console.log(
      `   Total Transactions: ${analysis.testSummary.totalTransactions}`
    );
    console.log(
      `   Overall Success Rate: ${analysis.testSummary.overallSuccessRate.toFixed(
        2
      )}%`
    );

    console.log(`\nMONEY Optimal Gas Price:`);
    if (analysis.optimalGasPrice.gasPrice) {
      console.log(`   Recommended: ${analysis.optimalGasPrice.gasPrice} gwei`);
      console.log(
        `   Success Rate: ${analysis.optimalGasPrice.successRate.toFixed(2)}%`
      );
      console.log(
        `   Avg Confirmation: ${analysis.optimalGasPrice.avgConfirmationTime.toFixed(
          0
        )}ms`
      );
    } else {
      console.log(`   ${analysis.optimalGasPrice.reason}`);
    }

    console.log(`\nANALYZING Performance by Category:`);
    Object.entries(analysis.pricePerformance.byCategory).forEach(
      ([category, perf]) => {
        console.log(`   ${category.toUpperCase()} (${perf.priceRange}):`);
        console.log(
          `     Success Rate: ${perf.averageSuccessRate.toFixed(2)}%`
        );
        console.log(
          `     Avg Confirmation: ${perf.averageConfirmationTime.toFixed(0)}ms`
        );
        console.log(`     Total Cost: ${perf.totalCost.toLocaleString()} wei`);
      }
    );

    console.log(`\nTARGETING Top 5 Most Efficient Prices:`);
    analysis.pricePerformance.priceEfficiency
      .slice(0, 5)
      .forEach((price, index) => {
        console.log(
          `   ${index + 1}. ${
            price.gasPriceGwei
          } gwei - ${price.efficiency.toFixed(2)} efficiency`
        );
      });

    console.log(`\nPOWER Validator Performance:`);
    Object.entries(analysis.validatorAnalysis).forEach(([validator, stats]) => {
      console.log(`   ${validator}:`);
      console.log(`     Transactions: ${stats.totalTransactions}`);
      console.log(`     Success Rate: ${stats.successRate.toFixed(2)}%`);
    });

    console.log(`\nRECOMMENDATION Recommendations:`);
    analysis.recommendations.forEach((rec) => {
      console.log(`   • ${rec}`);
    });
  }

  async saveResults(analysis) {
    // Save comprehensive results
    const fullResults = {
      timestamp: new Date().toISOString(),
      config: CONFIG,
      networkBaseline: this.networkBaseline,
      analysis,
      rawResults: this.testResults,
    };

    fs.writeFileSync(
      CONFIG.GAS_RESULTS_FILE,
      JSON.stringify(fullResults, null, 2)
    );

    // Generate CSV
    const csvContent = this.generateCSV();
    fs.writeFileSync(CONFIG.GAS_CSV_FILE, csvContent);

    // Save mempool data
    const mempoolData = this.testResults.flatMap((r) => r.mempoolSnapshots);
    fs.writeFileSync(
      CONFIG.MEMPOOL_DATA_FILE,
      JSON.stringify(mempoolData, null, 2)
    );

    console.log(`\nSAVING Results saved:`);
    console.log(`   FILE Full results: ${CONFIG.GAS_RESULTS_FILE}`);
    console.log(`   METRICS CSV data: ${CONFIG.GAS_CSV_FILE}`);
    console.log(`   PROCESSING Mempool data: ${CONFIG.MEMPOOL_DATA_FILE}`);
    console.log(`   DEPLOYING Logs: ${CONFIG.GAS_LOG_FILE}`);
  }

  generateCSV() {
    const headers = [
      "Gas Price (gwei)",
      "Category",
      "Success Rate (%)",
      "Avg Confirmation Time (ms)",
      "Total Transactions",
      "Successful Transactions",
      "Failed Transactions",
      "Avg Gas Used",
      "Total Gas Cost (wei)",
      "Test Duration (ms)",
    ];

    const rows = this.testResults.map((result) => [
      result.gasPriceGwei,
      result.category,
      result.metrics.successRate.toFixed(2),
      result.metrics.avgConfirmationTime.toFixed(0),
      result.metrics.totalTransactions,
      result.metrics.successfulTransactions,
      result.metrics.failedTransactions,
      result.metrics.avgGasUsed.toFixed(0),
      result.metrics.totalGasCost,
      result.testDuration,
    ]);

    return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp}: ${message}\n`;
    fs.appendFileSync(CONFIG.GAS_LOG_FILE, logMessage);
  }
}

// Main execution function
async function runGasPriceSensitivityTest() {
  const tester = new GasPriceSensitivityTester();

  try {
    await tester.initialize();
    await tester.runGasSensitivityTest();
    console.log("\nSUCCESS Gas price sensitivity test completed successfully!");
  } catch (error) {
    console.error("\nERROR Test failed:", error.message);
    tester.log(`Test failed: ${error.message}`);
    process.exit(1);
  }
}

// Parse command line arguments
if (process.argv.includes("--help")) {
  console.log(`
Gas Price Sensitivity Analysis

Usage: node gasPriceSensitivityTest.js [options]

Options:
  --transactions <num>    Transactions per price point (default: 50)
  --concurrent <num>      Concurrent transactions (default: 10)
  --timeout <ms>          Test timeout per price (default: 60000)
  --help                 Show this help message

Example:
  node gasPriceSensitivityTest.js --transactions 100 --concurrent 20
`);
  process.exit(0);
}

const transactionsIndex = process.argv.indexOf("--transactions");
if (transactionsIndex !== -1 && process.argv[transactionsIndex + 1]) {
  CONFIG.TRANSACTIONS_PER_PRICE = parseInt(process.argv[transactionsIndex + 1]);
}

const concurrentIndex = process.argv.indexOf("--concurrent");
if (concurrentIndex !== -1 && process.argv[concurrentIndex + 1]) {
  CONFIG.CONCURRENT_TRANSACTIONS = parseInt(process.argv[concurrentIndex + 1]);
}

const timeoutIndex = process.argv.indexOf("--timeout");
if (timeoutIndex !== -1 && process.argv[timeoutIndex + 1]) {
  CONFIG.TEST_TIMEOUT = parseInt(process.argv[timeoutIndex + 1]);
}

// Run the test
runGasPriceSensitivityTest().catch(console.error);
