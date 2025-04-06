/**
* Use this file to configure your truffle project. It's seeded with some
* common settings for different networks and features like migrations,
* compilation, and testing.
*
* For additional details, see http://trufflesuite.com/docs/advanced/configuration
*/

module.exports = {
/**
* Networks define how you connect to your ethereum client and let you set the
* defaults web3 uses to send transactions.
*/
networks: {
    // Useful for testing. The `development` name is special - truffle uses it by default
    // if it's defined here and no other network is specified at the command line.
    development: {
    host: "127.0.0.1",     // Localhost (default: none)
    port: 8545,            // Standard Ethereum port (default: none)
    network_id: "*",       // Ganache network ID
    },
    // An additional network for deploying to a public testnet like Goerli
    // goerli: {
    //   provider: () => new HDWalletProvider(mnemonic, `https://goerli.infura.io/v3/${infuraKey}`),
    //   network_id: 5,       // Goerli's id
    //   confirmations: 2,    // # of confirmations to wait between deployments
    //   timeoutBlocks: 200,  // # of blocks before a deployment times out
    //   skipDryRun: true     // Skip dry run before migrations?
    // },
},

// Set default mocha options here, use special reporters, etc.
mocha: {
    timeout: 100000
},

// Configure your compilers
compilers: {
    solc: {
    version: "0.8.29",      // Fetch exact version from solc-bin
    settings: {
        optimizer: {
        enabled: false,
        runs: 200
        },
        evmVersion: "london"  // Default EVM version for Solidity 0.8.19
    }
    }
}
};

