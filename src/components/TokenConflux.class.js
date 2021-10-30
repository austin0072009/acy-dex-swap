import { findAllByDisplayValue } from "@testing-library/dom";
import { Token } from "@uniswap/sdk";

export class TokenConflux extends Token{
    //构造函数
    constructor(chainId, address, decimals, symbol, name ) {
        super(
            chainId, 
            '0x0000000000000000000000000000000000000000',
            decimals,
            symbol,
            name
        );
        this.address  = address;
    }
    //类中函数
    equals(TokenConflux){
        if(TokenConflux.symbol == this.symbol)return true;
        else return false;
    }
    sortsBefore(other){
        return this.address.toLowerCase() < other.address.toLowerCase();
    }
 
}
