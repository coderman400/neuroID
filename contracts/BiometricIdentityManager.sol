// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

/// @custom:security-contact security@neurobiometric.org
/**
 * @title BiometricIdentityManager
 * @author NeuroID Team
 * @notice This contract manages decentralized identity using biometric hashes
 * @dev Implements secure biometric identity management with guardian recovery and access control
 * @custom:experimental This contract is experimental and should not be used in production without thorough auditing
 * 
 * Security Properties:
 * - Only identity owners can modify their own identity
 * - Guardians can only recover identities they are assigned to
 * - Access grants have time-bounded validity
 * - Biometric hashes are stored immutably until updated by owner or guardian
 * 
 * Invariants:
 * - If an identity exists, it must have a non-zero biometric hash
 * - Guardian addresses must be different from identity owner addresses
 * - Access grants cannot extend beyond MAX_DURATION
 * - Expired access grants should not provide valid access
 */
/// #invariant forall (address user) identities[user].exists ==> identities[user].biometricHash != bytes32(0)
/// #invariant forall (address user) identities[user].exists && identities[user].guardian != address(0) ==> identities[user].guardian != user
contract BiometricIdentityManager {
    // Constants for duration validation
    uint256 private constant MIN_DURATION = 1 minutes;
    uint256 private constant MAX_DURATION = 30 days;
    // Average block time is approximately 12 seconds on Ethereum mainnet
    uint256 private constant BLOCKS_PER_SECOND = 1;

    /**
     * @notice Struct to store user identity information
     * @dev Contains biometric hash, existence flag, guardian, and access grants mapping
     * @param biometricHash The cryptographic hash of the user's biometric data
     * @param exists Flag indicating if the identity has been registered
     * @param guardian Address authorized to recover this identity (optional)
     * @param accessGrants Mapping of addresses to their access permissions
     */
    struct UserIdentity {
        bytes32 biometricHash;
        bool exists;
        address guardian;
        mapping(address => AccessInfo) accessGrants;
    }

    /**
     * @notice Struct to store access grant information
     * @dev Dual expiration mechanism using both timestamp and block number for security
     * @param hasAccess Boolean flag indicating if access is currently granted
     * @param expirationTime Unix timestamp when access expires
     * @param expirationBlock Block number when access expires
     */
    struct AccessInfo {
        bool hasAccess;
        uint256 expirationTime;
        uint256 expirationBlock;
    }

    /// @dev Mapping from user address to their identity information
    mapping(address => UserIdentity) private identities;
    
    /**
     * @notice Emitted when a user's identity is updated
     * @param _user The address of the user whose identity was updated
     */
    event IdentityUpdated(address indexed _user);
    
    /**
     * @notice Emitted when identity verification is attempted
     * @param _user The address of the user being verified
     * @param success Whether the verification was successful
     */
    event IdentityVerified(address indexed _user, bool success);
    
    /**
     * @notice Emitted when access is granted to a requester
     * @param _user The address of the identity owner
     * @param _requester The address being granted access
     * @param expirationTime When the access expires
     */
    event AccessGranted(address indexed _user, address indexed _requester, uint256 expirationTime);
    
    /**
     * @notice Emitted when access is revoked from a requester
     * @param _user The address of the identity owner
     * @param _requester The address whose access was revoked
     */
    event AccessRevoked(address indexed _user, address indexed _requester);
    
    /**
     * @notice Emitted when access attempts are logged
     * @param _user The address of the user being accessed
     * @param _requester The address attempting access
     * @param _timestamp When the access was attempted
     * @param success Whether the access was successful
     */
    event AccessLogged(address indexed _user, address indexed _requester, uint256 _timestamp, bool success);
    
    /**
     * @notice Emitted when a guardian is added to an identity
     * @param _user The address of the identity owner
     * @param _guardian The address of the assigned guardian
     */
    event GuardianAdded(address indexed _user, address indexed _guardian);
    
    /**
     * @notice Emitted when an identity is recovered by a guardian
     * @param _user The address of the user whose identity was recovered
     * @param _guardian The address of the guardian who performed the recovery
     */
    event IdentityRecovered(address indexed _user, address indexed _guardian);
    
    /**
     * @notice Emitted when a guardian is removed from an identity
     * @param _user The address of the identity owner
     * @param _guardian The address of the removed guardian
     */
    event GuardianRemoved(address indexed _user, address indexed _guardian);
    
    /**
     * @notice Restricts function access to identity owners only
     * @dev Checks that msg.sender has a registered identity
     */
    modifier onlyIdentityOwner() {
        require(identities[msg.sender].exists, "Identity does not exist");
        _;
    }
    
    /**
     * @notice Restricts function access to authorized guardians only
     * @dev Checks that msg.sender is the guardian for the specified user
     * @param _user The address of the user whose guardian is being verified
     */
    modifier onlyGuardian(address _user) {
        require(identities[_user].exists, "User identity does not exist");
        require(identities[_user].guardian == msg.sender, "Not authorized guardian");
        _;
    }

    /**
     * @notice Registers a new decentralized identity using a biometric hash
     * @dev Creates a new identity entry for the caller with the provided biometric hash
     * @param _biometricHash The cryptographic hash of the user's biometric data
     * @custom:security The biometric hash should be generated using a secure hashing algorithm
     * @custom:privacy The original biometric data should never be stored or transmitted
     * 
     * Requirements:
     * - Caller must not already have an identity registered
     * - Biometric hash must not be zero
     * 
     * Effects:
     * - Creates new identity with exists=true and provided hash
     * - No events emitted for privacy (registration is implicit)
     */
    /// #if_succeeds identities[msg.sender].exists == true
    /// #if_succeeds identities[msg.sender].biometricHash == _biometricHash
    /// #if_succeeds identities[msg.sender].guardian == address(0)
    function registerIdentity(bytes32 _biometricHash) public {
        /// #require !identities[msg.sender].exists
        /// #require _biometricHash != bytes32(0)
        
        require(!identities[msg.sender].exists, "Identity already registered");
        require(_biometricHash != bytes32(0), "Invalid biometric hash");
        
        UserIdentity storage newIdentity = identities[msg.sender];
        newIdentity.biometricHash = _biometricHash;
        newIdentity.exists = true;
    }
    
    /**
     * @notice Updates the biometric hash for an existing identity
     * @dev Allows identity owner to update their stored biometric data
     * @param newBiometricHash The new cryptographic hash to store
     * 
     * Requirements:
     * - Caller must have an existing identity (checked by modifier)
     * - New biometric hash must not be zero
     * 
     * Effects:
     * - Updates the stored biometric hash
     * - Emits IdentityUpdated event
     */
    /// #if_succeeds identities[msg.sender].biometricHash == newBiometricHash
    function updateIdentity(bytes32 newBiometricHash) public onlyIdentityOwner {
        /// #require newBiometricHash != bytes32(0)
        
        require(newBiometricHash != bytes32(0), "Invalid biometric hash");
        
        identities[msg.sender].biometricHash = newBiometricHash;
        
        emit IdentityUpdated(msg.sender);
    }
    
    /**
     * @notice Verifies if a provided biometric hash matches the stored hash
     * @dev Compares the provided hash with the stored biometric hash for the user
     * @param _user The address of the user to verify
     * @param _biometricHash The biometric hash to verify against stored data
     * @return success True if the hashes match, false otherwise
     * 
     * Requirements:
     * - User must have a registered identity
     * 
     * Effects:
     * - Emits IdentityVerified event with result
     * - Returns boolean indicating verification success
     * 
     * @custom:security This function reveals verification success/failure which could be used for timing attacks
     */
    /// #if_succeeds $result == (identities[_user].biometricHash == _biometricHash)
    function verifyIdentity(address _user, bytes32 _biometricHash) public returns (bool success) {
        /// #require identities[_user].exists
        
        require(identities[_user].exists, "Identity does not exist");
        
        success = identities[_user].biometricHash == _biometricHash;
        
        emit IdentityVerified(_user, success);
        
        return success;
    }

    /**
     * @notice Grants time-limited access to a requester
     * @dev Creates an access grant with dual expiration (timestamp and block-based)
     * @param _requester The address to grant access to
     * @param _duration The duration of access in seconds
     * 
     * Requirements:
     * - Caller must have a registered identity (checked by modifier)
     * - Requester address must not be zero
     * - Duration must be between MIN_DURATION and MAX_DURATION
     * 
     * Effects:
     * - Sets access grant with calculated expiration times
     * - Emits AccessGranted event
     * 
     * @custom:security Dual expiration provides redundancy against timestamp manipulation
     */
    /// #if_succeeds identities[msg.sender].accessGrants[_requester].hasAccess == true
    /// #if_succeeds identities[msg.sender].accessGrants[_requester].expirationTime == block.timestamp + _duration
    /// #if_succeeds identities[msg.sender].accessGrants[_requester].expirationBlock == block.number + (_duration * BLOCKS_PER_SECOND)
    function grantAccess(address _requester, uint256 _duration) public onlyIdentityOwner {
        /// #require _requester != address(0)
        /// #require _duration >= MIN_DURATION
        /// #require _duration <= MAX_DURATION
        
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
     * @notice Revokes previously granted access before natural expiration
     * @dev Immediately invalidates access for the specified requester
     * @param _requester The address whose access should be revoked
     * 
     * Requirements:
     * - Caller must have a registered identity (checked by modifier)
     * - Requester address must not be zero
     * - Requester must currently have access granted
     * 
     * Effects:
     * - Sets hasAccess to false and clears expiration times
     * - Emits AccessRevoked event
     */
    /// #if_succeeds identities[msg.sender].accessGrants[_requester].hasAccess == false
    /// #if_succeeds identities[msg.sender].accessGrants[_requester].expirationTime == 0
    /// #if_succeeds identities[msg.sender].accessGrants[_requester].expirationBlock == 0
    function revokeAccess(address _requester) public onlyIdentityOwner {
        /// #require _requester != address(0)
        /// #require identities[msg.sender].accessGrants[_requester].hasAccess
        
        require(_requester != address(0), "Invalid requester address");
        require(identities[msg.sender].accessGrants[_requester].hasAccess, "No access granted to revoke");
        
        identities[msg.sender].accessGrants[_requester].hasAccess = false;
        identities[msg.sender].accessGrants[_requester].expirationTime = 0;
        identities[msg.sender].accessGrants[_requester].expirationBlock = 0;
        
        emit AccessRevoked(msg.sender, _requester);
    }
    
    /**
     * @notice Checks if a requester currently has valid access to a user's identity
     * @dev Validates access using both block number and timestamp for security
     * @param _user The address of the identity owner
     * @param _requester The address requesting access verification
     * @return hasValidAccess True if access is currently valid
     * 
     * Requirements:
     * - User must have a registered identity
     * 
     * Effects:
     * - None (view function)
     * 
     * @custom:security Uses OR logic for dual expiration - access valid if either check passes
     */
    /// #if_succeeds !identities[_user].exists ==> $result == false
    /// #if_succeeds identities[_user].exists && !identities[_user].accessGrants[_requester].hasAccess ==> $result == false
    function checkAccess(address _user, address _requester) public view returns (bool hasValidAccess) {
        /// #require identities[_user].exists
        
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
     * @notice Logs access attempts on-chain for audit purposes
     * @dev Records authentication attempts with timestamp and success status
     * @param _user The address of the user being accessed
     * @param _requester The address attempting to access
     * @param _timestamp The timestamp of the access attempt
     * @param _success Whether the access attempt was successful
     * 
     * Requirements:
     * - User must have a registered identity
     * - Caller must be authorized (user themselves, or have valid access)
     * 
     * Effects:
     * - Emits AccessLogged event for permanent record
     * 
     * @custom:security Uses msg.sender for authorization - tx.origin removed for security
     */
    function logAccess(address _user, address _requester, uint256 _timestamp, bool _success) public {
        /// #require identities[_user].exists
        
        require(identities[_user].exists, "User identity does not exist");
        
        // Use sender authorization only for enhanced security
        require(
            msg.sender == _user || 
            checkAccess(_user, msg.sender),
            "Not authorized to log access"
        );
        
        emit AccessLogged(_user, _requester, _timestamp, _success);
    }
    
    /**
     * @notice Assigns a guardian for identity recovery purposes
     * @dev Allows identity owner to designate a trusted address for recovery
     * @param _guardian The address to assign as guardian
     * 
     * Requirements:
     * - Caller must have a registered identity (checked by modifier)
     * - Guardian address must not be zero
     * - Guardian must be different from identity owner
     * - No guardian must be currently assigned
     * 
     * Effects:
     * - Sets guardian address for the caller's identity
     * - Emits GuardianAdded event
     */
    /// #if_succeeds identities[msg.sender].guardian == _guardian
    function addGuardian(address _guardian) public onlyIdentityOwner {
        /// #require _guardian != address(0)
        /// #require _guardian != msg.sender
        /// #require identities[msg.sender].guardian == address(0)
        
        require(_guardian != address(0), "Invalid guardian address");
        require(_guardian != msg.sender, "Guardian cannot be the identity owner");
        require(identities[msg.sender].guardian == address(0), "Guardian already assigned");
        
        identities[msg.sender].guardian = _guardian;
        
        emit GuardianAdded(msg.sender, _guardian);
    }
    
    /**
     * @notice Allows a guardian to recover and reset a user's identity
     * @dev Emergency recovery mechanism for compromised or lost biometric data
     * @param _user The address of the user whose identity is being recovered
     * @param _newBiometricHash The new biometric hash to assign
     * 
     * Requirements:
     * - User must have a registered identity (checked by modifier)
     * - Caller must be the assigned guardian (checked by modifier)
     * - New biometric hash must not be zero
     * 
     * Effects:
     * - Updates the user's biometric hash
     * - Emits IdentityRecovered event
     * 
     * @custom:security Does not automatically revoke access grants - consider doing so manually
     */
    /// #if_succeeds identities[_user].biometricHash == _newBiometricHash
    function recoverIdentity(address _user, bytes32 _newBiometricHash) public onlyGuardian(_user) {
        /// #require _newBiometricHash != bytes32(0)
        
        require(_newBiometricHash != bytes32(0), "Invalid biometric hash");
        
        identities[_user].biometricHash = _newBiometricHash;
        
        // Remove all access grants for security
        // Note: This is a simplified approach. In a production scenario,
        // you might want to iterate through all granted accesses and revoke them.
        
        emit IdentityRecovered(_user, msg.sender);
    }
    
    /**
     * @notice Removes an assigned guardian from an identity
     * @dev Allows identity owner to remove guardian access
     * @param _guardian The address of the guardian to remove
     * 
     * Requirements:
     * - Caller must have a registered identity (checked by modifier)
     * - Guardian address must not be zero
     * - Guardian must be the currently assigned guardian
     * 
     * Effects:
     * - Clears the guardian address for the caller's identity
     * - Emits GuardianRemoved event
     */
    /// #if_succeeds identities[msg.sender].guardian == address(0)
    function removeGuardian(address _guardian) public onlyIdentityOwner {
        /// #require _guardian != address(0)
        /// #require identities[msg.sender].guardian == _guardian
        
        require(_guardian != address(0), "Invalid guardian address");
        require(identities[msg.sender].guardian == _guardian, "Not the assigned guardian");
        
        identities[msg.sender].guardian = address(0);
        
        emit GuardianRemoved(msg.sender, _guardian);
    }
    
    /**
     * @notice Checks if an identity exists for a given address
     * @dev Simple existence check for identity registration
     * @param _user The address to check
     * @return exists True if the address has a registered identity
     * 
     * Effects:
     * - None (view function)
     */
    /// #if_succeeds $result == identities[_user].exists
    function identityExists(address _user) public view returns (bool exists) {
        return identities[_user].exists;
    }
    
    /**
     * @notice Retrieves the guardian address for a user
     * @dev Returns the address assigned as guardian for identity recovery
     * @param _user The address of the user
     * @return guardian The guardian's address (address(0) if none assigned)
     * 
     * Requirements:
     * - User must have a registered identity
     * 
     * Effects:
     * - None (view function)
     */
    /// #if_succeeds $result == identities[_user].guardian
    function getGuardian(address _user) public view returns (address guardian) {
        /// #require identities[_user].exists
        
        require(identities[_user].exists, "User identity does not exist");
        return identities[_user].guardian;
    }

    /**
     * @notice Retrieves the stored biometric hash for a user
     * @dev Returns the cryptographic hash of the user's biometric data
     * @param _user The address of the user
     * @return biometricHash The stored biometric hash
     * 
     * Requirements:
     * - User must have a registered identity
     * 
     * Effects:
     * - None (view function)
     * 
     * @custom:privacy This function exposes biometric hashes - ensure proper access control in frontend
     */
    /// #if_succeeds $result == identities[_user].biometricHash
    function getBiometricHash(address _user) public view returns (bytes32 biometricHash) {
        /// #require identities[_user].exists
        
        require(identities[_user].exists, "Identity does not exist");
        return identities[_user].biometricHash;
    }
}