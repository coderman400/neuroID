const BiometricIdentityManager = artifacts.require("BiometricIdentityManager");

module.exports = function(deployer) {
  deployer.deploy(BiometricIdentityManager);
};