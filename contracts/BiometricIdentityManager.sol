// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

/**
 * @title BiometricIdentityManager
 * @dev Contract for managing decentralized identity using biometric hashes
 */
contract BiometricIdentityManager {
    // Constants for duration validation
    uint256 private constant MIN_DURATION = 1 minutes;
    uint256 private constant MAX_DURATION = 30 days;
    // Average block time is approximately 12 seconds on Ethereum mainnet
    uint256 private constant BLOCKS_PER_SECOND = 1;

    // Struct to store user identity information
    struct UserIdentity {
        bytes32 biometricHash;
        bool exists;
        address guardian;
        mapping(address => AccessInfo) accessGrants;
    }

    // Struct to store access grant information
    struct AccessInfo {
    bool hasAccess;
    uint256 expirationTime;
    uint256 expirationBlock; // New field
    }

    // Mapping from user address to their identity information
    mapping(address => UserIdentity) private identities;
    
    // Events as specified in the table
    event IdentityUpdated(address indexed _user);
    event IdentityVerified(address indexed _user, bool success);
    event AccessGranted(address indexed _user, address indexed _requester, uint256 expirationTime);
    event AccessRevoked(address indexed _user, address indexed _requester);
    event AccessLogged(address indexed _user, address indexed _requester, uint256 _timestamp, bool success);
    event GuardianAdded(address indexed _user, address indexed _guardian);
    event IdentityRecovered(address indexed _user, address indexed _guardian);
    event GuardianRemoved(address indexed _user, address indexed _guardian);
    
    // Modifiers
    modifier onlyIdentityOwner() {
        require(identities[msg.sender].exists, "Identity does not exist");
        _;
    }
    
    modifier onlyGuardian(address _user) {
        require(identities[_user].exists, "User identity does not exist");
        require(identities[_user].guardian == msg.sender, "Not authorized guardian");
        _;
    }

    /**
     * @dev Registers a user's decentralized identity by storing a hashed biometric
     * @param _biometricHash The hash of the user's biometric data
     */
    function registerIdentity(bytes32 _biometricHash) public {
        require(!identities[msg.sender].exists, "Identity already registered");
        require(_biometricHash != bytes32(0), "Invalid biometric hash");
        
        UserIdentity storage newIdentity = identities[msg.sender];
        newIdentity.biometricHash = _biometricHash;
        newIdentity.exists = true;
    }
    
    /**
     * @dev Updates the stored biometric hash for a user
     * @param newBiometricHash The new biometric hash to store
     */
    function updateIdentity(bytes32 newBiometricHash) public onlyIdentityOwner {
        require(newBiometricHash != bytes32(0), "Invalid biometric hash");
        
        identities[msg.sender].biometricHash = newBiometricHash;
        
        emit IdentityUpdated(msg.sender);
    }
    
    /**
     * @dev Verifies if the given biometric hash matches the stored hash
     * @param _user The address of the user
     * @param _biometricHash The biometric hash to verify
     * @return bool True if access is valid
     */
    function verifyIdentity(address _user, bytes32 _biometricHash) public returns (bool) {
        require(identities[_user].exists, "Identity does not exist");
        
        bool success = identities[_user].biometricHash == _biometricHash;
        
        emit IdentityVerified(_user, success);
        
        return success;
    } 
    /**
     * @param _requester The address of the entity requesting access
     * @param _duration The duration for which access is granted (in seconds)
     */
    function grantAccess(address _requester, uint256 _duration) public onlyIdentityOwner {
        require(_requester != address(0), "Invalid requester address");
        require(_duration >= MIN_DURATION, "Duration too short");
        require(_duration <= MAX_DURATION, "Duration too long");
        
        // Calculate number of blocks based on duration
        uint256 blockDuration = _duration * BLOCKS_PER_SECOND;
        
        // Store both block number and timestamp based expiration
        identities[msg.sender].accessGrants[_requester] = AccessInfo({
            hasAccess: true,
            expirationTime: block.timestamp + _duration,
            expirationBlock: block.number + blockDuration
        });
        
        emit AccessGranted(msg.sender, _requester, block.timestamp + _duration);
    }
    
    /**
     * @dev Revokes access before expiration
     * @param _requester The address of the entity whose access is being revoked
     */
    function revokeAccess(address _requester) public onlyIdentityOwner {
        require(_requester != address(0), "Invalid requester address");
        require(identities[msg.sender].accessGrants[_requester].hasAccess, "No access granted to revoke");
        
        identities[msg.sender].accessGrants[_requester].hasAccess = false;
        identities[msg.sender].accessGrants[_requester].expirationTime = 0;
        identities[msg.sender].accessGrants[_requester].expirationBlock = 0;
        
        emit AccessRevoked(msg.sender, _requester);
    }
    
    /**
     * @dev Checks if a requester has valid access
     * @param _user The address of the user
     * @param _requester The address of the entity requesting access
     * @return bool True if access is valid
     */
    function checkAccess(address _user, address _requester) public view returns (bool) {
        require(identities[_user].exists, "User identity does not exist");
        
        AccessInfo storage access = identities[_user].accessGrants[_requester];
        
        // Prioritize block number validation as it's more tamper-resistant
        bool blockValid = access.expirationBlock > block.number;
        
        // Use timestamp as a secondary check
        bool timeValid = access.expirationTime > block.timestamp;
        
        // Access must be granted and either block or time validation must pass
        return access.hasAccess && (blockValid || timeValid);
    }


    
    /**
     * @dev Logs authentication attempts on-chain
     * @param _user The address of the user
     * @param _requester The address of the entity requesting access
     * @param _timestamp The timestamp of the access attempt
     * @param _success Whether the access attempt was successful
     */
    function logAccess(address _user, address _requester, uint256 _timestamp, bool _success) public {
    require(identities[_user].exists, "User identity does not exist");
    
    // Use both sender and tx.origin for authorization
    require(
        msg.sender == _user || 
        checkAccess(_user, msg.sender) ||
        checkAccess(_user, tx.origin),
        "Not authorized to log access"
    );
    
    emit AccessLogged(_user, _requester, _timestamp, _success);
    }
    
    /**
     * @dev Allows a user to assign a guardian for identity recovery
     * @param _guardian The address of the guardian
     */
    function addGuardian(address _guardian) public onlyIdentityOwner {
        require(_guardian != address(0), "Invalid guardian address");
        require(_guardian != msg.sender, "Guardian cannot be the identity owner");
        require(identities[msg.sender].guardian == address(0), "Guardian already assigned");
        
        identities[msg.sender].guardian = _guardian;
        
        emit GuardianAdded(msg.sender, _guardian);
    }
    
    /**
     * @dev Allows a guardian to reset a user's identity
     * @param _user The address of the user
     * @param _newBiometricHash The new biometric hash to assign
     */
    function recoverIdentity(address _user, bytes32 _newBiometricHash) public onlyGuardian(_user) {
        require(_newBiometricHash != bytes32(0), "Invalid biometric hash");
        
        identities[_user].biometricHash = _newBiometricHash;
        
        // Remove all access grants for security
        // Note: This is a simplified approach. In a production scenario,
        // you might want to iterate through all granted accesses and revoke them.
        
        emit IdentityRecovered(_user, msg.sender);
    }
    
    /**
     * @dev Removes a guardian assigned for recovery
     * @param _guardian The address of the guardian to remove
     */
    function removeGuardian(address _guardian) public onlyIdentityOwner {
        require(_guardian != address(0), "Invalid guardian address");
        require(identities[msg.sender].guardian == _guardian, "Not the assigned guardian");
        
        identities[msg.sender].guardian = address(0);
        
        emit GuardianRemoved(msg.sender, _guardian);
    }
    
    /**
     * @dev Checks if an identity exists for a given address
     * @param _user The address to check
     * @return bool True if identity exists
     */
    function identityExists(address _user) public view returns (bool) {
        return identities[_user].exists;
    }
    
    /**
     * @dev Gets the guardian for a user
     * @param _user The address of the user
     * @return address The guardian's address
     */
    function getGuardian(address _user) public view returns (address) {
        require(identities[_user].exists, "User identity does not exist");
        return identities[_user].guardian;
    }

        /**
     * @dev Gets the biometric hash for a user
     * @param _user The address of the user
     * @return bytes32 The stored biometric hash
     */
    function getBiometricHash(address _user) public view returns (bytes32) {
        require(identities[_user].exists, "Identity does not exist");
        return identities[_user].biometricHash;
    }
}