// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {ERC20} from '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import {ChessEscrow} from '../src/ChessEscrow.sol';
interface VmSafety {function prank(address) external;function startPrank(address) external;function stopPrank() external;function chainId(uint256) external;function expectRevert() external;}
contract AdversarialToken is ERC20 {
 bool public chargeFee; bool public attack; bool public blocked; ChessEscrow public escrow; bytes32 public matchId;
 constructor() ERC20('Adversarial test token','BAD'){}
 function mint(address a,uint256 amount) external {_mint(a,amount);}
 function configure(bool fee,bool reenter,ChessEscrow e,bytes32 id) external {chargeFee=fee;attack=reenter;escrow=e;matchId=id;}
 function transferFrom(address from,address to,uint256 amount) public override returns(bool){bool ok=super.transferFrom(from,to,amount);if(chargeFee)_burn(to,1);if(attack){try escrow.fund(matchId){blocked=false;}catch{blocked=true;}}return ok;}
}
contract TokenSafetyTest {
 VmSafety constant vm=VmSafety(address(uint160(uint256(keccak256('hevm cheat code')))));address a=address(0xA);address b=address(0xB);bytes32 id=keccak256('bad');
 function setupToken() internal returns(AdversarialToken t,ChessEscrow e){vm.chainId(31337);t=new AdversarialToken();e=new ChessEscrow(t,address(this));t.mint(a,100);vm.startPrank(a);t.approve(address(e),100);e.create(id,b,10);vm.stopPrank();}
 function testFeeOnTransferRollsBackDeposit() public {(AdversarialToken t,ChessEscrow e)=setupToken();t.configure(true,false,e,id);vm.expectRevert();vm.prank(a);e.fund(id);require(t.balanceOf(a)==100&&t.balanceOf(address(e))==0);}
 function testReentrantFundingIsBlocked() public {(AdversarialToken t,ChessEscrow e)=setupToken();t.configure(false,true,e,id);vm.prank(a);e.fund(id);require(t.blocked());require(t.balanceOf(address(e))==10);}
 function testUnsupportedNetworkCannotDeploy() public {vm.chainId(1);AdversarialToken t=new AdversarialToken();vm.expectRevert();new ChessEscrow(t,address(this));}
 function testStakeBoundsAndUnauthorizedPause() public {(AdversarialToken t,ChessEscrow e)=setupToken();vm.expectRevert();vm.prank(a);e.create(keccak256('zero'),b,0);vm.expectRevert();vm.prank(a);e.create(keccak256('huge'),b,1001e6);vm.expectRevert();vm.prank(a);e.setPaused(true);require(t.balanceOf(a)==100);}
}
