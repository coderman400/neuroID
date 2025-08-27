import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const NETWORK_CONFIG = {
  chainId: 1337,
  blockTime: 2, // Faster block time for better throughput
  gasLimit: 30000000, // Higher gas limit per block
  gasPrice: 1000000000, // 1 Gwei
  accounts: 20, // More accounts for parallel testing
  balance: "1000", // 1000 ETH per account
  hardfork: "london",

  // Network optimization
  vmErrorsOnRPCResponse: false,
  asyncRequestProcessing: true,

  // Storage optimization
  db: "./ganache_db",
  noVMErrorsOnRPCResponse: true,
};

class NetworkManager {
  constructor() {
    this.ganacheProcess = null;
    this.configFile = "ganache-scalability.json";
  }

  generateConfig() {
    const config = {
      server: {
        port: 8545,
        host: "0.0.0.0",
      },
      chain: {
        chainId: NETWORK_CONFIG.chainId,
        hardfork: NETWORK_CONFIG.hardfork,
        vmErrorsOnRPCResponse: NETWORK_CONFIG.vmErrorsOnRPCResponse,
        asyncRequestProcessing: NETWORK_CONFIG.asyncRequestProcessing,
      },
      miner: {
        blockTime: NETWORK_CONFIG.blockTime,
        defaultGasPrice: NETWORK_CONFIG.gasPrice,
      },
      wallet: {
        totalAccounts: NETWORK_CONFIG.accounts,
        defaultBalance: NETWORK_CONFIG.balance,
      },
      database: {
        dbPath: NETWORK_CONFIG.db,
      },
      logging: {
        verbose: false,
        quiet: false,
      },
    };

    fs.writeFileSync(this.configFile, JSON.stringify(config, null, 2));
    console.log(` Network configuration saved to ${this.configFile}`);
    return config;
  }

  async startNetwork() {
    console.log(" Starting optimized private Ethereum network...");

    return new Promise((resolve, reject) => {
      // Start Ganache with command line arguments
      this.ganacheProcess = spawn(
        "npx",
        [
          "ganache",
          "--port",
          "8545",
          "--host",
          "0.0.0.0",
          "--chain.chainId",
          NETWORK_CONFIG.chainId.toString(),
          "--miner.blockTime",
          NETWORK_CONFIG.blockTime.toString(),
          "--miner.defaultGasPrice",
          NETWORK_CONFIG.gasPrice.toString(),
          "--wallet.totalAccounts",
          NETWORK_CONFIG.accounts.toString(),
          "--wallet.defaultBalance",
          NETWORK_CONFIG.balance,
          "--chain.hardfork",
          NETWORK_CONFIG.hardfork,
          "--database.dbPath",
          NETWORK_CONFIG.db,
        ],
        {
          stdio: "pipe",
        }
      );

      let networkReady = false;

      this.ganacheProcess.stdout.on("data", (data) => {
        const output = data.toString();
        console.log(output);

        // Check if network is ready
        if (output.includes("Listening on") && !networkReady) {
          networkReady = true;
          console.log(" Network is ready for testing");
          resolve();
        }
      });

      this.ganacheProcess.stderr.on("data", (data) => {
        console.error(`Ganache error: ${data}`);
      });

      this.ganacheProcess.on("close", (code) => {
        console.log(`Ganache process exited with code ${code}`);
      });

      this.ganacheProcess.on("error", (error) => {
        console.error("Failed to start Ganache:", error);
        reject(error);
      });

      // Timeout if network doesn't start in 30 seconds
      setTimeout(() => {
        if (!networkReady) {
          reject(new Error("Network startup timeout"));
        }
      }, 30000);
    });
  }

  stopNetwork() {
    if (this.ganacheProcess) {
      console.log(" Stopping network...");
      this.ganacheProcess.kill("SIGTERM");
      this.ganacheProcess = null;
    }
  }

  async deployContracts() {
    console.log(" Deploying contracts to network...");

    return new Promise((resolve, reject) => {
      const migrateProcess = spawn("npx", ["truffle", "migrate", "--reset"], {
        stdio: "pipe",
      });

      migrateProcess.stdout.on("data", (data) => {
        console.log(data.toString());
      });

      migrateProcess.stderr.on("data", (data) => {
        console.error(data.toString());
      });

      migrateProcess.on("close", (code) => {
        if (code === 0) {
          console.log(" Contracts deployed successfully");
          resolve();
        } else {
          reject(new Error(`Contract deployment failed with code ${code}`));
        }
      });
    });
  }

  printNetworkInfo() {
    console.log("\n" + "=".repeat(50));
    console.log(" NETWORK CONFIGURATION");
    console.log("=".repeat(50));
    console.log(`Chain ID: ${NETWORK_CONFIG.chainId}`);
    console.log(`Block Time: ${NETWORK_CONFIG.blockTime}s`);
    console.log(`Gas Limit: ${NETWORK_CONFIG.gasLimit.toLocaleString()}`);
    console.log(`Gas Price: ${NETWORK_CONFIG.gasPrice / 1e9} Gwei`);
    console.log(`Accounts: ${NETWORK_CONFIG.accounts}`);
    console.log(`Balance per Account: ${NETWORK_CONFIG.balance} ETH`);
    console.log(`RPC URL: http://localhost:8545`);
    console.log("=".repeat(50));
  }
}

// CLI interface
async function main() {
  const networkManager = new NetworkManager();
  const command = process.argv[2];

  try {
    switch (command) {
      case "start":
        networkManager.printNetworkInfo();
        await networkManager.startNetwork();

        // Keep process alive
        process.on("SIGINT", () => {
          networkManager.stopNetwork();
          process.exit(0);
        });

        console.log("\nPress Ctrl+C to stop the network");
        break;

      case "deploy":
        await networkManager.deployContracts();
        break;

      case "setup":
        networkManager.printNetworkInfo();
        console.log(" Setting up complete testing environment...");
        await networkManager.startNetwork();

        // Wait a moment for network to stabilize
        await new Promise((resolve) => setTimeout(resolve, 3000));

        await networkManager.deployContracts();
        console.log("\n Environment ready for scalability testing!");
        console.log("Run: node scripts/scalabilityTest.js");

        // Keep network running
        process.on("SIGINT", () => {
          networkManager.stopNetwork();
          process.exit(0);
        });

        console.log("\nPress Ctrl+C to stop the network");
        break;

      case "config":
        networkManager.generateConfig();
        networkManager.printNetworkInfo();
        break;

      default:
        console.log(`Use setup or start`);
    }
  } catch (error) {
    console.error(" Error:", error.message);
    networkManager.stopNetwork();
    process.exit(1);
  }
}

main().catch(console.error);
