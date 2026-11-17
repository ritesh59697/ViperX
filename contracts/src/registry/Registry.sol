// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ViperX Agent Registry
 * @notice Manages registered copy-trading agents, their strategy parameters, and execution vaults on EVM (Base).
 */
contract Registry {
    struct Agent {
        address owner;
        string name;
        string strategyUri;
        address vaultAddress;
        string status; // "Active" | "Paused" | "Retired"
        uint256 createdAt;
        uint256 updatedAt;
    }

    // Mapping from agent ID (e.g., "momentum_bot_1") to Agent details
    mapping(string => Agent) private _agents;
    
    // Mapping from owner address to their registered agent IDs
    mapping(address => string[]) private _ownerAgents;
    
    // Global list of all registered agent IDs
    string[] private _allAgentIds;

    event AgentRegistered(
        address indexed owner,
        string agentId,
        string name,
        string strategyUri,
        address indexed vaultAddress
    );

    event AgentStatusChanged(
        address indexed owner,
        string agentId,
        string status
    );

    event AgentMetadataUpdated(
        address indexed owner,
        string agentId,
        string name,
        string strategyUri
    );

    modifier onlyAgentOwner(string calldata agentId) {
        require(_agents[agentId].owner == msg.sender, "Registry: caller is not the agent owner");
        _;
    }

    /**
     * @notice Registers a new copy-trading agent on-chain.
     */
    function registerAgent(
        string calldata agentId,
        string calldata name,
        string calldata strategyUri,
        address vaultAddress
    ) external {
        require(_agents[agentId].owner == address(0), "Registry: agent ID already registered");
        require(bytes(agentId).length > 0, "Registry: agent ID cannot be empty");
        require(bytes(name).length > 0, "Registry: name cannot be empty");
        require(vaultAddress != address(0), "Registry: invalid vault address");

        _agents[agentId] = Agent({
            owner: msg.sender,
            name: name,
            strategyUri: strategyUri,
            vaultAddress: vaultAddress,
            status: "Active",
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });

        _ownerAgents[msg.sender].push(agentId);
        _allAgentIds.push(agentId);

        emit AgentRegistered(msg.sender, agentId, name, strategyUri, vaultAddress);
    }

    /**
     * @notice Changes the operational status of an agent (e.g. Active -> Paused).
     */
    function changeStatus(
        string calldata agentId,
        string calldata status
    ) external onlyAgentOwner(agentId) {
        bytes32 statusHash = keccak256(abi.encodePacked(status));
        require(
            statusHash == keccak256(abi.encodePacked("Active")) ||
            statusHash == keccak256(abi.encodePacked("Paused")) ||
            statusHash == keccak256(abi.encodePacked("Retired")),
            "Registry: invalid status value"
        );

        _agents[agentId].status = status;
        _agents[agentId].updatedAt = block.timestamp;

        emit AgentStatusChanged(msg.sender, agentId, status);
    }

    /**
     * @notice Updates the metadata for an agent strategy.
     */
    function updateMetadata(
        string calldata agentId,
        string calldata name,
        string calldata strategyUri
    ) external onlyAgentOwner(agentId) {
        require(bytes(name).length > 0, "Registry: name cannot be empty");

        _agents[agentId].name = name;
        _agents[agentId].strategyUri = strategyUri;
        _agents[agentId].updatedAt = block.timestamp;

        emit AgentMetadataUpdated(msg.sender, agentId, name, strategyUri);
    }

    /**
     * @notice Returns details of a specific agent.
     */
    function getAgent(string calldata agentId) external view returns (Agent memory) {
        require(_agents[agentId].owner != address(0), "Registry: agent not found");
        return _agents[agentId];
    }

    /**
     * @notice Returns all agent IDs owned by a specific wallet.
     */
    function getOwnerAgents(address owner) external view returns (string[] memory) {
        return _ownerAgents[owner];
    }

    /**
     * @notice Returns all registered agent IDs.
     */
    function getAllAgentIds() external view returns (string[] memory) {
        return _allAgentIds;
    }
}
