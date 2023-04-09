const querystring = require("querystring");
const crypto = require("crypto");
const axios = require("axios");

const API_KEY = process.env.API_KEY;
const SECRET_KEY = process.env.SECRET_KEY;
const URL_API = process.env.URL_API;


class Api
{
    async publicCall(path, data = {}, method = "GET") 
    {
        const queryStr = Object.keys(data).length ? `?${querystring.stringify(data)}` : "";
        
        const url =  `${process.env.URL_API}${path}${queryStr}`;
        const result = await fetch(url)
            .then(resp => {
                return resp.json()
            });
    
        return result;
    }
    
    async privateCall(path, data = {}, method = "GET") 
    {
        const timestamp = Date.now();
        const signature = crypto.createHmac("sha256", SECRET_KEY)
            .update(`${querystring.stringify({...data, timestamp})}`)
            .digest("hex");
    
        const newData = {...data, signature, timestamp};
        const qs = querystring.stringify(newData);
        const url = `${URL_API}${path}?${qs}`;
        
        try {
            const result = await axios({
                method,
                url,
                headers: {
                    "X-MBX-APIKEY": API_KEY
                }
            });
            return result.data;
        } catch (e) {
            // console.log(e.data);
            // console.log("Deu erro");
            console.log(data);
            console.log(e.response.data);
            dsadsa;
            return e.response.data;
        }
    }
    
    
    async time() 
    {
        return await this.publicCall("/api/v3/time");
    }
    
    async ping() 
    {
        return await this.publicCall("/api/v3/ping");
    }
    
    async depth(symbol, limit = 2) 
    {
        return (await this.publicCall("/api/v3/depth", {
            symbol,
            limit
        }));
    }
    
    async exchangeInfo() 
    {
        return await this.publicCall("/api/v3/exchangeInfo");
    }
    
    
    async accountInfo() 
    {
        return await this.privateCall("/api/v3/account");
    }

    async balances()
    {
        return (await this.privateCall("/api/v3/account"))["balances"] ?? [];
    }
    
    
    async newOrder(symbol, quantity, price, side = "BUY/SELL", type="MARKET") {
        const data = {symbol, quantity, side,type};
    
        if (price || price !== null) data.price = price;
    
        // console.log("aqui");
        // console.log(data);
    
        return this.privateCall("/api/v3/order", data, "POST");
    }
}



module.exports = Api;