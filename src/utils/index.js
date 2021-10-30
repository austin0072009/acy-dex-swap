import { abi as IUniswapV2Router02ABI } from "../abis/IUniswapV2Router02.json";
import { abi as IUniswapV2PairABI } from "@uniswap/v2-core/build/IUniswapV2Pair.json";
import { abi as FACTORY_ABI } from "@uniswap/v2-core/build/IUniswapV2Factory.json";
import ERC20ABI from "../abis/ERC20.json";
import { getAddress } from "@ethersproject/address";
import { Contract } from "@ethersproject/contracts";
import { AddressZero } from "@ethersproject/constants";
import { BigNumber } from "@ethersproject/bignumber";
import { parseUnits, formatUnits } from "@ethersproject/units";
import {
  JSBI,
  Token,
  TokenAmount,
  TradeType,
  Route,
  Trade,
  Fetcher,
  Percent,
  WETH,
  ETHER,
  CurrencyAmount,
  InsufficientReservesError,
} from "@acyswap/sdk";
import { MaxUint256 } from "@ethersproject/constants";
import { TokenConflux } from "../components/TokenConflux.class";
const { Conflux } = require('js-conflux-sdk');

export const INITIAL_ALLOWED_SLIPPAGE = 50; //bips

export const ROUTER_ADDRESS  = "cfxtest:acez2pf23veg3h978v6czc2gcrhdapwzdau7gjcrgu";
export const FACTORY_ADDRESS = "cfxtest:achewsya8dah9guctnjuexdgjfb4cusrmjk7ynkzvt";
// export const ROUTER_ADDRESS = "0xF3726d6acfeda3E73a6F2328b948834f3Af39A2B";
//0x8e493a80f0c07f9a027ad1024c664143a141cd52 

export const  supportedTokens= [
 
  {
    symbol: "GG1",
    address: "cfxtest:acajea4m28rw90gge2efyf8mvk7z05w1hybdk23dhj",
    decimal: 18,
  },
  {
    symbol: "JJ1",
    address: "cfxtest:acf4kfxvb263vvthkrjt5ar5djpf7w531ey0knkk8u",
    decimal: 18,
  },
 { symbol: "THU00",
  address: "cfxtest:accy2y4xv3g9du0j6kt9uuk353g6vrz03ubtssgsju",
  decimal: 18,
},
{
  symbol: "THU01",
  address: "cfxtest:acd2f05trwk0wnvazm40jc3tucn362w3bemw8gd0dy",
  decimal: 18,
},
];


export function isAddress(value) {
  try {
    return getAddress(value);
  } catch {
    return false;
  }
}

// account is not optional
export function getSigner(library, account) {
  return library.getSigner(account).connectUnchecked();
}

// account is optional
export function getProviderOrSigner(library, account) {
  return account ? getSigner(library, account) : library;
}

// account is optional
// export function getContract(address, ABI, library, account) {
//   if (!isAddress(address) || address === AddressZero) {
//     throw Error(`Invalid 'address' parameter '${address}'.`);
//   }

//   return new Contract(address, ABI, getProviderOrSigner(library, account));
// }

//conflux 
export function getContract(address, ABI, library, account) {

  return   library.Contract({
    abi: ABI,
    address: address,
  });
}

export function getFactoryContract(library, account) {
  return getContract(FACTORY_ADDRESS, FACTORY_ABI, library, account);
}


export function getRouterContract(library, account) {
  return getContract(ROUTER_ADDRESS, IUniswapV2Router02ABI, library, account);
}

export function getPairContract(pairAddress, library, account) {
  return getContract(pairAddress, IUniswapV2PairABI, library, account);
}


// return gas with 10% added margin in BigNumber
export function calculateGasMargin(value) {

  console.log("just calculateGasMargin");
  return value
      *(BigNumber.from(10000)+(BigNumber.from(1000)))
      /(BigNumber.from(10000));
}

// check if hex string is zero
export function isZero(hexNumberString) {
  return /^0x0*$/.test(hexNumberString);
}

// return token allowance in BigNumber
export async function getAllowance(
    tokenAddress,
    owner,
    spender,
    library,
    account
) {
  let tokenContract = getContract(tokenAddress, ERC20ABI, library, account);
  let allowance = await tokenContract.allowance(owner, spender);
  console.log("allowance is" +  allowance[0]);
  return allowance[0];
}

// a custom error class for custom error text and handling
export class ACYSwapErrorStatus {
  getErrorText() {
    return this.errorText;
  }
  constructor(errorText) {
    this.errorText = errorText;
  }
}

// taken from Uniswap, used for price impact and realized liquid provider fee
export function computeTradePriceBreakdown(trade) {
  const BASE_FEE = new Percent(JSBI.BigInt(30), JSBI.BigInt(10000));
  const ONE_HUNDRED_PERCENT = new Percent(
      JSBI.BigInt(10000),
      JSBI.BigInt(10000)
  );
  const INPUT_FRACTION_AFTER_FEE = ONE_HUNDRED_PERCENT.subtract(BASE_FEE);

  // for each hop in our trade, take away the x*y=k price impact from 0.3% fees
  // e.g. for 3 tokens/2 hops: 1 - ((1 - .03) * (1-.03))
  const realizedLPFee = !trade
      ? undefined
      : ONE_HUNDRED_PERCENT.subtract(
          trade.route.pairs.reduce(
              (currentFee) => currentFee.multiply(INPUT_FRACTION_AFTER_FEE),
              ONE_HUNDRED_PERCENT
          )
      );

  // remove lp fees from price impact
  const priceImpactWithoutFeeFraction =
      trade && realizedLPFee
          ? trade.priceImpact.subtract(realizedLPFee)
          : undefined;

  // the x*y=k impact
  const priceImpactWithoutFeePercent = priceImpactWithoutFeeFraction
      ? new Percent(
          priceImpactWithoutFeeFraction?.numerator,
          priceImpactWithoutFeeFraction?.denominator
      )
      : undefined;

  // the amount of the input that accrues to LPs
  const realizedLPFeeAmount =
      realizedLPFee &&
      trade &&
      (trade.inputAmount instanceof TokenAmount
          ? new TokenAmount(
              trade.inputAmount.token,
              realizedLPFee.multiply(trade.inputAmount.raw).quotient
          )
          : CurrencyAmount.ether(
              realizedLPFee.multiply(trade.inputAmount.raw).quotient
          ));

  return {
    priceImpactWithoutFee: priceImpactWithoutFeePercent,
    realizedLPFee: realizedLPFeeAmount,
  };
}

// get user token balance in BigNumber
export async function getUserTokenBalanceRaw(token, account, library) {
  if (token === ETHER) {
    return await library.getBalance(account);
  } else {
    let contractToCheckForBalance = getContract(
        token.address,
        ERC20ABI,
        library,
        account
    );
    return await contractToCheckForBalance.balanceOf(account);
  }
}

// get user token balance in readable string foramt
export async function getUserTokenBalance(token, chainId, account, library) {
  let { address, symbol, decimals } = token;

  if (!token) return;
  let tokenContract = library.Contract({
    abi: ERC20ABI,
    address: address,
  });

  // return formatUnits(
  //   await tokenContract.balanceOf(account),
  //     decimals
  // );
  return await tokenContract.balanceOf(account);
}

// return slippage adjusted amount for arguments when adding liquidity. Returns JSBI
export function calculateSlippageAmount(value, slippage) {
  if (slippage < 0 || slippage > 10000) {
    throw Error(`Unexpected slippage value: ${slippage}`);
  }
  return [
    JSBI.divide(
        JSBI.multiply(value.raw, JSBI.BigInt(10000 - slippage)),
        JSBI.BigInt(10000)
    ),
    JSBI.divide(
        JSBI.multiply(value.raw, JSBI.BigInt(10000 + slippage)),
        JSBI.BigInt(10000)
    ),
  ];
}

// approve an ERC-20 token
export async function approve(tokenAddress, requiredAmount, library, account) {
  if (requiredAmount === "0") {
    console.log("Unncessary call to approve");
    return true;
  }

  let allowance = await getAllowance(
      tokenAddress,
      account, // owner
      ROUTER_ADDRESS, //spender
      library, // provider
      account // active account
  );

  console.log(`ALLOWANCE FOR TOKEN ${tokenAddress}`);
  console.log(allowance);

  console.log("REquired amount");
  console.log(requiredAmount);
  if (allowance <= (BigNumber.from(requiredAmount))) {
    let tokenContract = getContract(tokenAddress, ERC20ABI, library, account);
    let useExact = false;
    console.log("NOT ENOUGH ALLOWANCE");
    // try to get max allowance
    let estimatedGas = await tokenContract.approve(
        ROUTER_ADDRESS,
        MaxUint256
    ).estimateGasAndCollateral({from:account }).catch(async() => {
      // general fallback for tokens who restrict approval amounts
      useExact = true;
      let result= await tokenContract.approve(
          ROUTER_ADDRESS,
          requiredAmount.raw.toString()
      ).estimateGasAndCollateral({from: account});
      return result;
    });

    console.log(`Exact? ${useExact}`);
    let res=await tokenContract.approve(
        ROUTER_ADDRESS,
        requiredAmount
    ).catch(()=>{
      console.log("not approve success");
        return false;
    });
    console.log(res);

    if(res==false){
      return false;

    }

    let flag=false;
    
    while(1){
      let newAllowance = await getAllowance(
        tokenAddress,
        account, // owner
        ROUTER_ADDRESS, //spender
        library, // provider
        account // active account
     );
      
      if(newAllowance >= (BigNumber.from(requiredAmount))){
        flag=true;
        break;
        
      }
    }
    if(flag) return true;

  } else {
    console.log("Allowance sufficient");
    return true;
  }
}

// should be used in polling to check status of token approval every n seconds
export async function checkTokenIsApproved(tokenAddress,requiredAmount,library,account) {
  // const conflux = new Conflux();
  // const confluxPortal = window.conflux;

  // conflux.provider = confluxPortal;

  // confluxPortal.enable();

  // const accounts = await confluxPortal.send('cfx_requestAccounts');
  // console.log('accounts');
  // console.log(accounts);

  // const account = accounts[0];
  // console.log(account);

  const tokenContract = library.Contract({
    abi: ERC20ABI,
    address: tokenAddress,
  });


  const result = await tokenContract.allowance(account,ROUTER_ADDRESS);
  console.log("allowane amount is  ")
  console.log(result);
  if(result[0] >= requiredAmount)return true;
  else return false;
}




// get total supply of a ERC-20 token, can be liquidity token
export async function getTokenTotalSupply(token, library, account) {
  let tokenContract = getContract(token.address, ERC20ABI, library, account);
  let totalSupply = await tokenContract.totalSupply();
  let parsedResult = new TokenAmount(token, totalSupply.toString());

  return parsedResult;
}


