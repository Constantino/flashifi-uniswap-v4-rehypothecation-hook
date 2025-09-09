// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";

import {BaseScript} from "./base/BaseScript.sol";

import {ReHypothecation} from "../src/ReHypothecation.sol";

/// @notice Mines the address and deploys the Counter.sol Hook contract
contract DeployHookScript is BaseScript {
    function run() public {
        // hook contracts must have specific flags encoded in the address
        uint160 flags = uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG);

        // Mine a salt that will produce a hook address with the correct flags
        bytes memory constructorArgs = abi.encode(poolManager);

        (address hookAddress, bytes32 _salt) =
            HookMiner.find(CREATE2_FACTORY, flags, type(ReHypothecation).creationCode, constructorArgs);

        vm.label(address(hookAddress), "HookAddress");
        // Deploy the hook using CREATE2
        vm.startBroadcast();
        ReHypothecation reHypothecation = new ReHypothecation{salt: _salt}(poolManager);
        vm.label(address(reHypothecation), "ReHypothecation");
        vm.stopBroadcast();

        require(address(reHypothecation) == hookAddress, "DeployHookScript: Hook Address Mismatch");
    }
}
