import { findAllByDisplayValue } from "@testing-library/dom";

export class TokenConflux {
    //构造函数
    constructor(chainId, address, decimals, symbol) {
        this.chainId = 1;
        this.address = address;
        this.decimals = decimals;
        this.symbol = symbol;
    }
    //类中函数
    equals(TokenConflux){
        if(TokenConflux.symbol == this.symbol)return true;
        else return false;
    }
 
}
