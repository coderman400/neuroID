#!/bin/bash


set -e

# Configuration
NETWORK_ID=2025
CHAIN_NAME="test-poa-network"
DATA_DIR="./poa-data"
GENESIS_FILE="genesis.json"
PASSWORD_FILE="password.txt"

declare -A VALIDATORS=(
    ["validator1"]="10.0.1.10:30303"
    ["validator2"]="10.0.1.11:30303"
    ["validator3"]="10.0.1.12:30303"
    ["validator4"]="10.0.1.13:30303"
    ["validator5"]="10.0.1.14:30303"
    ["validator6"]="10.0.1.15:30303"
    ["validator7"]="10.0.1.16:30303"
)

# RPC ports for each validator
declare -A RPC_PORTS=(
    ["validator1"]="8545"
    ["validator2"]="8546"
    ["validator3"]="8547"
    ["validator4"]="8548"
    ["validator5"]="8549"
    ["validator6"]="8550"
    ["validator7"]="8551"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Check if geth is installed
check_dependencies() {
    log "Checking dependencies..."
    
    if ! command -v geth &> /dev/null; then
        error "geth is not installed. Please install go-ethereum first."
    fi
    
    if ! command -v puppeth &> /dev/null; then
        warn "puppeth is not available. Some features may be limited."
    fi
    
    log "Dependencies check completed."
}

# Clean up existing data
cleanup() {
    log "Cleaning up existing data..."
    
    if [ -d "$DATA_DIR" ]; then
        rm -rf "$DATA_DIR"
        log "Removed existing data directory"
    fi
    
    # Kill any existing geth processes
    pkill -f "geth.*$NETWORK_ID" || true
    sleep 2
    
    log "Cleanup completed."
}

# Generate validator accounts
generate_accounts() {
    log "Generating validator accounts..."
    
    mkdir -p "$DATA_DIR/accounts"
    echo "testpassword" > "$PASSWORD_FILE"
    
    # Generate accounts for each validator
    for validator in "${!VALIDATORS[@]}"; do
        log "Generating account for $validator..."
        
        account_dir="$DATA_DIR/accounts/$validator"
        mkdir -p "$account_dir"
        
        # Generate new account
        geth --datadir "$account_dir" account new --password "$PASSWORD_FILE" > "$account_dir/account.txt"
        
        # Extract address
        address=$(geth --datadir "$account_dir" account list 2>/dev/null | head -1 | sed 's/.*{\(.*\)}.*/\1/')
        echo "$address" > "$account_dir/address.txt"
        
        log "Generated account for $validator: $address"
    done
    
    log "Account generation completed."
}

# Create genesis file
create_genesis() {
    log "Creating genesis file..."
    
    # Collect all validator addresses
    validator_addresses=()
    for validator in "${!VALIDATORS[@]}"; do
        address=$(cat "$DATA_DIR/accounts/$validator/address.txt")
        validator_addresses+=("\"0x$address\"")
    done
    
    # Join addresses with commas
    validators_list=$(IFS=','; echo "${validator_addresses[*]}")
    
    # Create genesis.json
    cat > "$GENESIS_FILE" << EOF
{
  "config": {
    "chainId": $NETWORK_ID,
    "homesteadBlock": 0,
    "eip150Block": 0,
    "eip155Block": 0,
    "eip158Block": 0,
    "byzantiumBlock": 0,
    "constantinopleBlock": 0,
    "petersburgBlock": 0,
    "istanbulBlock": 0,
    "berlinBlock": 0,
    "londonBlock": 0,
    "clique": {
      "period": 5,
      "epoch": 30000
    }
  },
  "difficulty": "0x1",
  "gasLimit": "0x8000000",
  "extraData": "0x0000000000000000000000000000000000000000000000000000000000000000$(echo ${validator_addresses[*]} | sed 's/\"0x//g' | sed 's/\"//g' | tr -d ' ')0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
  "alloc": {
EOF

    # Add initial balances for validators
    first=true
    for validator in "${!VALIDATORS[@]}"; do
        address=$(cat "$DATA_DIR/accounts/$validator/address.txt")
        if [ "$first" = true ]; then
            first=false
        else
            echo "," >> "$GENESIS_FILE"
        fi
        echo "    \"0x$address\": { \"balance\": \"0x200000000000000000000\" }" >> "$GENESIS_FILE"
    done

    cat >> "$GENESIS_FILE" << EOF
  }
}
EOF

    log "Genesis file created successfully."
}

# Initialize validator nodes
initialize_nodes() {
    log "Initializing validator nodes..."
    
    for validator in "${!VALIDATORS[@]}"; do
        log "Initializing $validator..."
        
        validator_dir="$DATA_DIR/$validator"
        mkdir -p "$validator_dir"
        
        # Copy account keystore
        cp -r "$DATA_DIR/accounts/$validator/keystore" "$validator_dir/" 2>/dev/null || true
        
        # Initialize with genesis
        geth --datadir "$validator_dir" init "$GENESIS_FILE"
        
        log "$validator initialized successfully."
    done
    
    log "All nodes initialized."
}

# Generate node startup scripts
generate_startup_scripts() {
    log "Generating startup scripts..."
    
    mkdir -p "$DATA_DIR/scripts"
    
    # Generate enode list for bootnode discovery
    enode_list=""
    for validator in "${!VALIDATORS[@]}"; do
        ip_port=${VALIDATORS[$validator]}
        ip=$(echo $ip_port | cut -d':' -f1)
        port=$(echo $ip_port | cut -d':' -f2)
        
        # Generate static node ID
        node_id=$(echo -n "$validator" | sha256sum | cut -c1-128)
        enode="enode://$node_id@$ip:$port"
        
        if [ -z "$enode_list" ]; then
            enode_list="\"$enode\""
        else
            enode_list="$enode_list,\"$enode\""
        fi
    done
    
    # Create startup script for each validator
    for validator in "${!VALIDATORS[@]}"; do
        script_file="$DATA_DIR/scripts/start-$validator.sh"
        validator_dir="$DATA_DIR/$validator"
        rpc_port=${RPC_PORTS[$validator]}
        ip_port=${VALIDATORS[$validator]}
        port=$(echo $ip_port | cut -d':' -f2)
        
        cat > "$script_file" << EOF
#!/bin/bash

# Startup script for $validator
# Run this script on the machine designated for $validator

VALIDATOR_DIR="$validator_dir"
NETWORK_ID=$NETWORK_ID
RPC_PORT=$rpc_port
P2P_PORT=$port

# Get validator address
VALIDATOR_ADDRESS=\$(cat "$DATA_DIR/accounts/$validator/address.txt")

echo "Starting $validator..."
echo "Validator Address: 0x\$VALIDATOR_ADDRESS"
echo "RPC Port: \$RPC_PORT"
echo "P2P Port: \$P2P_PORT"

# Create static nodes file
cat > "\$VALIDATOR_DIR/static-nodes.json" << 'EOFSTATIC'
[$enode_list]
EOFSTATIC

# Start geth
geth \\
    --datadir "\$VALIDATOR_DIR" \\
    --networkid \$NETWORK_ID \\
    --port \$P2P_PORT \\
    --http \\
    --http.addr "0.0.0.0" \\
    --http.port \$RPC_PORT \\
    --http.api "eth,net,web3,personal,admin,miner,clique" \\
    --http.corsdomain "*" \\
    --ws \\
    --ws.addr "0.0.0.0" \\
    --ws.port \$((\$RPC_PORT + 1000)) \\
    --ws.api "eth,net,web3,personal,admin,miner,clique" \\
    --ws.origins "*" \\
    --mine \\
    --miner.etherbase "0x\$VALIDATOR_ADDRESS" \\
    --unlock "0x\$VALIDATOR_ADDRESS" \\
    --password "$PASSWORD_FILE" \\
    --allow-insecure-unlock \\
    --nodiscover \\
    --maxpeers 25 \\
    --nat "extip:$(echo ${VALIDATORS[$validator]} | cut -d':' -f1)" \\
    --verbosity 3 \\
    --syncmode "full" \\
    --gcmode "archive" \\
    --metrics \\
    --metrics.addr "0.0.0.0" \\
    --metrics.port \$((\$RPC_PORT + 2000)) \\
    console
EOF

        chmod +x "$script_file"
        log "Created startup script: $script_file"
    done
    
    log "Startup scripts generated successfully."
}

# Generate deployment instructions
generate_instructions() {
    log "Generating deployment instructions..."
    
    cat > "$DATA_DIR/DEPLOYMENT_INSTRUCTIONS.md" << EOF
# Multi-Node PoA Network Deployment Instructions

## Network Configuration
- **Network ID**: $NETWORK_ID
- **Chain Name**: $CHAIN_NAME
- **Consensus**: Proof of Authority (Clique)
- **Block Time**: 5 seconds
- **Validators**: 7 nodes

## Validator Nodes Configuration

EOF

    for validator in "${!VALIDATORS[@]}"; do
        rpc_port=${RPC_PORTS[$validator]}
        ip_port=${VALIDATORS[$validator]}
        address=$(cat "$DATA_DIR/accounts/$validator/address.txt")
        
        cat >> "$DATA_DIR/DEPLOYMENT_INSTRUCTIONS.md" << EOF
### $validator
- **Machine IP**: $(echo $ip_port | cut -d':' -f1)
- **P2P Port**: $(echo $ip_port | cut -d':' -f2)
- **RPC Port**: $rpc_port
- **WS Port**: $((rpc_port + 1000))
- **Metrics Port**: $((rpc_port + 2000))
- **Validator Address**: 0x$address

EOF
    done

    cat >> "$DATA_DIR/DEPLOYMENT_INSTRUCTIONS.md" << EOF

## Deployment Steps

1. **Distribute Files**: Copy the entire \`$DATA_DIR\` directory to each validator machine.

2. **Install Dependencies**: Ensure go-ethereum is installed on each machine:
   \`\`\`bash
   # Ubuntu/Debian
   sudo add-apt-repository -y ppa:ethereum/ethereum
   sudo apt-get update
   sudo apt-get install ethereum
   
   # Or download from https://geth.ethereum.org/downloads/
   \`\`\`

3. **Configure Firewall**: Open required ports on each machine:
   \`\`\`bash
   # Allow P2P communication
   sudo ufw allow 30303/tcp
   sudo ufw allow 30303/udp
   
   # Allow RPC (adjust port for each validator)
   sudo ufw allow 8545/tcp  # validator1
   sudo ufw allow 8546/tcp  # validator2
   # ... etc for other validators
   
   # Allow WebSocket
   sudo ufw allow 9545/tcp  # validator1 WS
   sudo ufw allow 9546/tcp  # validator2 WS
   # ... etc
   
   # Allow metrics
   sudo ufw allow 10545/tcp  # validator1 metrics
   sudo ufw allow 10546/tcp  # validator2 metrics
   # ... etc
   \`\`\`

4. **Start Validators**: On each machine, run the corresponding startup script:
   \`\`\`bash
   cd $DATA_DIR
   ./scripts/start-validator1.sh  # On machine 1
   ./scripts/start-validator2.sh  # On machine 2
   # ... etc
   \`\`\`

5. **Verify Network**: Check that all validators are connected and mining:
   \`\`\`bash
   # Connect to any validator's console
   geth attach http://10.0.1.10:8545
   
   # Check peer count
   > net.peerCount
   
   # Check if mining
   > miner.mining
   
   # Check latest block
   > eth.blockNumber
   \`\`\`

## Network Endpoints

For testing applications, use any of these RPC endpoints:
EOF

    for validator in "${!VALIDATORS[@]}"; do
        rpc_port=${RPC_PORTS[$validator]}
        ip=$(echo ${VALIDATORS[$validator]} | cut -d':' -f1)
        echo "- **$validator**: http://$ip:$rpc_port" >> "$DATA_DIR/DEPLOYMENT_INSTRUCTIONS.md"
    done

    cat >> "$DATA_DIR/DEPLOYMENT_INSTRUCTIONS.md" << EOF

## Monitoring

Each validator exposes metrics on port (RPC_PORT + 2000):
EOF

    for validator in "${!VALIDATORS[@]}"; do
        rpc_port=${RPC_PORTS[$validator]}
        ip=$(echo ${VALIDATORS[$validator]} | cut -d':' -f1)
        metrics_port=$((rpc_port + 2000))
        echo "- **$validator**: http://$ip:$metrics_port/debug/metrics" >> "$DATA_DIR/DEPLOYMENT_INSTRUCTIONS.md"
    done

    log "Deployment instructions created: $DATA_DIR/DEPLOYMENT_INSTRUCTIONS.md"
}

# Main setup function
main() {
    log "Starting Multi-Node PoA Network Setup..."
    log "Network ID: $NETWORK_ID"
    log "Validators: ${#VALIDATORS[@]}"
    
    check_dependencies
    cleanup
    generate_accounts
    create_genesis
    initialize_nodes
    generate_startup_scripts
    generate_instructions
    
    log "Setup completed successfully!"
    log "Next steps:"
    log "1. Review the deployment instructions: $DATA_DIR/DEPLOYMENT_INSTRUCTIONS.md"
    log "2. Distribute the $DATA_DIR directory to each validator machine"
    log "3. Run the startup scripts on each machine"
    log "4. Use the multi-node scalability test suite to run experiments"
}

# Run main function
main "$@" 