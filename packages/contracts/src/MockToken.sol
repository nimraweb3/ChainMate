// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {ERC20} from '@openzeppelin/contracts/token/ERC20/ERC20.sol';
contract MockToken is ERC20 {
 constructor() ERC20('ChainMate Demo Dollar','cmUSD') {require(block.chainid==31337 || block.chainid==84532,'TESTNET ONLY');}
 function decimals() public pure override returns(uint8){return 6;}
 function faucet() external {_mint(msg.sender,1000 * 10**6);}
}
