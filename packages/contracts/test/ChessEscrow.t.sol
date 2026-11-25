// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {ChessEscrow} from '../src/ChessEscrow.sol';
import {MockToken} from '../src/MockToken.sol';
interface Vm {function prank(address) external;function startPrank(address) external;function stopPrank() external;function warp(uint256) external;function chainId(uint256) external;function addr(uint256) external returns(address);function sign(uint256,bytes32) external returns(uint8,bytes32,bytes32);function expectRevert() external;function expectRevert(bytes4) external;}
contract ChessEscrowTest {
 Vm constant vm=Vm(address(uint160(uint256(keccak256('hevm cheat code')))));MockToken t;ChessEscrow e;address a=address(0xA);address b=address(0xB);uint256 signerKey=12345;bytes32 id=keccak256('match');uint256 stake=5e6;
 function setUp() public {vm.chainId(31337);t=new MockToken();e=new ChessEscrow(t,vm.addr(signerKey));vm.startPrank(a);t.faucet();t.approve(address(e),type(uint256).max);e.create(id,b,stake);vm.stopPrank();vm.startPrank(b);t.faucet();t.approve(address(e),type(uint256).max);vm.stopPrank();}
 function fund() internal {vm.prank(a);e.fund(id);vm.prank(b);e.fund(id);}
 function signature(uint8 outcome,uint256 nonce,uint256 expiry,uint256 key,address verifying,uint256 chain) internal returns(bytes memory){bytes32 domain=keccak256(abi.encode(keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'),keccak256('ChainMate'),keccak256('1'),chain,verifying));bytes32 msgHash=keccak256(abi.encode(e.RESULT_TYPEHASH(),id,a,b,outcome,keccak256('record'),nonce,expiry));(uint8 v,bytes32 r,bytes32 s)=vm.sign(key,keccak256(abi.encodePacked('\x19\x01',domain,msgHash)));return abi.encodePacked(r,s,v);}
 function result(uint8 outcome) internal {uint256 expiry=block.timestamp+600;e.submitResult(id,outcome,keccak256('record'),0,expiry,signature(outcome,0,expiry,signerKey,address(e),31337));}
 function testWinnerSettlement() public {fund();result(1);vm.warp(block.timestamp+120);e.settle(id);require(t.balanceOf(a)==1005e6);require(t.balanceOf(b)==995e6);require(t.balanceOf(address(e))==0);vm.expectRevert();e.settle(id);}
 function testDrawRefunds() public {fund();result(3);vm.warp(block.timestamp+120);e.settle(id);require(t.balanceOf(a)==1000e6&&t.balanceOf(b)==1000e6);}
 function testUnauthorizedAndDuplicateFunding() public {vm.expectRevert();e.fund(id);vm.prank(a);e.fund(id);vm.expectRevert();vm.prank(a);e.fund(id);}
 function testPartialFundingRecovery() public {vm.prank(a);e.fund(id);vm.expectRevert();e.recover(id);vm.warp(block.timestamp+900);e.recover(id);require(t.balanceOf(a)==1000e6);}
 function testActiveRecovery() public {fund();vm.warp(block.timestamp+86400);e.recover(id);require(t.balanceOf(a)==1000e6&&t.balanceOf(b)==1000e6);}
 function testDisputeRecovery() public {fund();result(1);vm.prank(b);e.dispute(id,keccak256('evidence'));vm.expectRevert();e.settle(id);vm.warp(block.timestamp+86400);e.recover(id);require(t.balanceOf(address(e))==0);}
 function testArbiterCannotRedirectFunds() public {fund();result(1);vm.prank(b);e.dispute(id,keccak256('evidence'));vm.expectRevert();e.resolve(id,2);vm.prank(vm.addr(signerKey));e.resolve(id,3);require(t.balanceOf(a)==1000e6&&t.balanceOf(b)==1000e6);}
 function testEarlySettlementAndLateDispute() public {fund();result(1);vm.expectRevert();e.settle(id);vm.warp(block.timestamp+120);vm.expectRevert();vm.prank(a);e.dispute(id,bytes32(0));e.settle(id);}
 function testInvalidSignatures() public {fund();uint256 expiry=block.timestamp+600;bytes memory s=signature(1,0,expiry,777,address(e),31337);vm.expectRevert();e.submitResult(id,1,keccak256('record'),0,expiry,s);s=signature(1,0,expiry,signerKey,address(e),1);vm.expectRevert();e.submitResult(id,1,keccak256('record'),0,expiry,s);s=signature(1,0,expiry,signerKey,address(t),31337);vm.expectRevert();e.submitResult(id,1,keccak256('record'),0,expiry,s);}
 function testExpiredAndReplayResults() public {fund();uint256 expiry=block.timestamp+30;bytes memory s=signature(1,0,expiry,signerKey,address(e),31337);vm.warp(expiry+1);vm.expectRevert();e.submitResult(id,1,keccak256('record'),0,expiry,s);result(1);expiry=block.timestamp+600;s=signature(1,0,expiry,signerKey,address(e),31337);vm.expectRevert();e.submitResult(id,1,keccak256('record'),0,expiry,s);}
 function testPauseDoesNotBlockRecovery() public {fund();vm.prank(vm.addr(signerKey));e.setPaused(true);vm.warp(block.timestamp+86400);e.recover(id);require(t.balanceOf(address(e))==0);}
 function testFundingDeadlineBoundary() public {vm.warp(block.timestamp+900);vm.expectRevert();vm.prank(a);e.fund(id);}
 function testUnfundedResult() public {uint256 expiry=block.timestamp+600;bytes memory s=signature(1,0,expiry,signerKey,address(e),31337);vm.expectRevert();e.submitResult(id,1,keccak256('record'),0,expiry,s);}
 function testFuzzConservation(uint8 outcome) public {outcome=uint8(uint256(outcome)%3+1);fund();result(outcome);vm.warp(block.timestamp+120);e.settle(id);require(t.balanceOf(a)+t.balanceOf(b)+t.balanceOf(address(e))==2000e6);}
}
