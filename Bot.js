const Websocket = require("ws");
class Bot
{
    constructor(coin, entryCoinValue,profitabilityBBS, profitabilityBSS, api)
    {
        console.log(coin, entryCoinValue, profitabilityBBS, profitabilityBSS);
        console.log(api);

        this.isTrading = false;

        this.book = {};

        this.coin = coin;
        this.entryCoinValue = entryCoinValue;
        this.profitabilityBBS = profitabilityBBS;
        this.profitabilityBSS = profitabilityBSS;
        this.api = api;

        this.urlApi = process.env.URL_API;

        this.webhook();
    }

    setUrlApi(url)
    {
        this.urlApi = url;
    }

    /**
     * Função obter informações das moedas disponíveis, e nela filtro pelas moedas que estão
     * disponíveis para fazer TRADING
     * 
     * @returns {object} 
     */
    async getInfo()
    {
        const resp = await fetch(this.urlApi + "/api/v3/exchangeInfo")
            .then(resp => resp.json());

        if (!resp.symbols) return [];


        const isTrading = resp["symbols"].filter(item => item["status"] === "TRADING");

        return isTrading.map(item => {
            return {
                symbol: item["symbol"],
                base: item["baseAsset"],
                baseAssetPrecision: item["baseAssetPrecision"],
                quote: item["quoteAsset"],
                quotePrecision: item["quotePrecision"],
                filters: item["filters"]
            }
        });
    }

    /**
     * Função de compra, compra e venda
     * 
     * @param {object} buySymbols 
     * @param {object} allSymbols 
     * @returns 
     */
    getBuyBuySell(buySymbols, allSymbols) 
    {
        const buybuySell = [];

        for (let i = 0; i < buySymbols.length; i++) {
            const buy1 = buySymbols[i];

            const right = allSymbols.filter(item => item.quote === buy1.base);

            for (let i2 = 0; i2 < right.length; i2++) {
                const buy2 = right[i2];

                const sell = allSymbols.find(item => item.base === buy2.base && item.quote === buy1.quote);

                if (!sell) continue;

                buybuySell.push({
                    buy1,
                    buy2,
                    sell
                });
            }
        }
        return buybuySell;
    }

    /**
     * Função de compra, venda e venda
     * 
     * @param {object} buySymbols 
     * @param {object} allSymbols 
     * @returns 
     */
    getBuySellSell(buySymbols, allSymbols) 
    {
        const buySellSell = [];

        for (let i = 0; i < buySymbols.length; i++) {
            const buy = buySymbols[i];

            const right = allSymbols.filter(item => item.base === buy.base && item.quote !== buy.quote);

            for (let i2 = 0; i2 < right.length; i2++) {
                const sell1 = right[i2];

                const sell2 = allSymbols.find(item => item.base === sell1.quote && item.quote === buy.quote);

                if (!sell2) continue;

                buySellSell.push({
                    buy,
                    sell1,
                    sell2
                });
            }
        }

        return buySellSell;
    }


    /**
     * Processa os cadidatos a triangulação BBS , visando lucro.
     * @param {object} buyBuySell 
     */
    async processBuyBuySell(buyBuySell) 
    {
        for (let i = 0; i < buyBuySell.length; i++) {
            const candidate = buyBuySell[i];

            let priceBuy1 = this.book[candidate.buy1.symbol];
            if (!priceBuy1) continue;
            priceBuy1 = priceBuy1.askPrice;

            let priceBuy2 = this.book[candidate.buy2.symbol];
            if (!priceBuy2) continue;
            priceBuy2 = priceBuy2.askPrice;

            let priceSell = this.book[candidate.sell.symbol];
            if (!priceSell) continue;

            priceSell = priceSell.bidPrice;

            const crossRate = (1/priceBuy1) * (1/priceBuy2) * priceSell;

            /** foi comparado por 1.03 pois a binance, cobra  1% de cada operação, vidando que 
             * serão 3, foi ajustado o valor 
            */
            if (crossRate > this.profitabilityBBS) {
                const entryCoin = parseFloat(this.entryCoinValue);

                
                const candidateBuy1 = candidate.buy1;
                const candidateBuy2 = candidate.buy2;
                const candidateSell = candidate.sell;

                // console.log(`Oportunidade em BBS: ${candidate.buy1.symbol} > ${candidate.buy2.symbol} > ${candidate.sell.symbol} = ${crossRate}`);
                
                let quantityBuy1 = this.roundNumber(entryCoin / priceBuy1, candidateBuy1.filters);
                let quantityBuy2 = this.roundNumber(quantityBuy1 / priceBuy2, candidateBuy2.filters);
                let quantitySell = this.roundNumber(quantityBuy2, candidateSell.filters);

                
                if (!quantityBuy1 || !quantityBuy2 || !quantitySell) {
                    // console.log("LOT SIZE");
                    continue;
                } else if (
                    !this.checkLotSize(quantityBuy1, candidateBuy1.filters)
                    || !this.checkLotSize(quantityBuy2, candidateBuy2.filters)
                    || !this.checkLotSize(quantitySell, candidateSell.filters)
                ) {
                    // console.log("LOT SIZE NO this.checkLotSize")
                    continue;
                }

                if (
                    !this.checkFilterMinNotion(quantityBuy1 * priceBuy1, candidateBuy1.filters)
                    || !this.checkFilterMinNotion(quantityBuy2 * priceBuy2, candidateBuy2.filters)
                    || !this.checkFilterMinNotion(quantitySell * priceSell, candidateSell.filters)
                ) {
                    // console.log("MIN_NOTION");
                    continue;
                }
                console.log(`Oportunidade em BBS: ${candidate.buy1.symbol} > ${candidate.buy2.symbol} > ${candidate.sell.symbol} = ${crossRate}`);


                // console.log(`Compra (${candidateBuy1.symbol}): ${quantityBuy1}`);
                this.isTrading = true;
                const resp1 = await this.buy(candidateBuy1.symbol, quantityBuy1);
                const entryRealCoin = quantityBuy1 * priceBuy1
                console.log(`${entryRealCoin} > buy > ${quantityBuy1} > buy2 > ${quantityBuy2} > sell > ${quantitySell} == $${quantitySell * priceSell}`);
                if (resp1.status === "FILLED") {
                    priceBuy2 = this.book[candidateBuy2.symbol].askPrice;
                    quantityBuy2 = this.roundNumber(parseFloat(resp1.origQty) / priceBuy2, candidateBuy2.filters);
                    quantityBuy2 = this.roundNumber(quantityBuy2, candidateBuy2.filters);

                    // console.log(`Compra 2 (${candidateBuy2.symbol}): ${quantityBuy2}`);
                    let resp2 = await this.buy(candidateBuy2.symbol, quantityBuy2);
                    if (resp2.code) {
                        priceBuy2 = this.book[candidateBuy2.symbol].askPrice;
                        quantityBuy2 = (parseFloat(resp1.origQty) / priceBuy2)
                        quantityBuy2 = this.roundNumber(quantityBuy2, candidateBuy2.filters);
                        
                        // console.log(`Compra 2 (recompra) (${candidateBuy2.symbol}): ${quantityBuy2}`);
                        resp2 = await this.buy(candidateBuy2.symbol, quantityBuy2);
                        if (resp2.code) {
                            dadasda;
                        }
                    }
                    if (resp2.status === "FILLED") {
                        // console.log(resp2)
                        // console.log("Aqui na venda")
                        quantitySell = parseFloat(resp2.origQty)
                        quantitySell = this.roundNumber(quantitySell, candidateSell.filters);
                        
                        const resp3 = await this.sell(candidateSell.symbol, quantitySell);
                        if (resp3.code) {
                            csdfadasd;
                        }
                        if (resp3.status === "FILLED") {
                            console.log(`Operação BBS concluída: entrou com $${entryRealCoin}, saiu com $${resp3.cummulativeQuoteQty}`);
                            (await this.api.balances()).forEach(item => {
                                if (item.asset.toUpperCase() === process.env.COIN) {
                                    console.log(item);
                                }
                            });
                        }
                    }

                }
            }
            if (this.isTrading) {
                console.log("\n\n");
                break;
            }
        }
        if (this.isTrading) {
            setTimeout(() => {
                // console.log("Acabei de fazer trade");
                this.isTrading = false;
            }, process.env.SLEEP_PER_OPERATION * 1000);
        }
    }

    /**
     * Processa os cadidatos a triangulação BBS , visando lucro.
     * @param {object} buySellSell 
     */
    async processBuySellSell(buySellSell) {
        for (let i = 0; i < buySellSell.length; i++) {
            const candidate = buySellSell[i];
            
            let priceBuy = this.book[candidate.buy.symbol];
            if (!priceBuy) continue;
            priceBuy = priceBuy.askPrice;

            let priceSell1 = this.book[candidate.sell1.symbol];
            if (!priceSell1) continue;
            priceSell1 = priceSell1.bidPrice;

            let priceSell2 = this.book[candidate.sell2.symbol];
            if (!priceSell2) continue;

            priceSell2 = priceSell2.bidPrice;

            const crossRate = (1/priceBuy) * priceSell1 * priceSell2;

            /** foi comparado por 1.03 pois a binance, cobra  1% de cada operação, vidando que 
             * serão 3, foi ajustado o valor 
            */
            if (crossRate > this.profitabilityBSS) {
                const entryCoin = parseFloat(this.entryCoinValue);

                const candidateBuy = candidate.buy;
                const candidateSell1 = candidate.sell1;
                const candidateSell2 = candidate.sell2;

                let quantityBuy = parseFloat(entryCoin / priceBuy);
                quantityBuy = this.roundNumber(quantityBuy, candidateBuy.filters);


                let quantitySell1 = parseFloat(quantityBuy);
                quantitySell1 = this.roundNumber(quantitySell1, candidateSell1.filters);

                let quantitySell2 = parseFloat(quantitySell1 * priceSell1);
                quantitySell2 = this.roundNumber(quantitySell2, candidateSell2.filters);

                // if (candidateBuy.symbol.indexOf("LTC") >= 0 || candidateSell1.symbol.indexOf("LTC") >= 0 || candidateSell2.symbol.indexOf("LTC") >= 0) {
                //     console.log("É LTC");
                //     continue;
                // }

                if (!quantityBuy || !quantitySell1 || !quantitySell2) { 
                    // console.log("LOT_SIZE");
                    continue;
                } else if (
                    !this.checkLotSize(quantityBuy, candidateBuy.filters)
                    || !this.checkLotSize(quantitySell1, candidateSell1.filters)
                    || !this.checkLotSize(quantitySell2, candidateSell2.filters)
                ) {
                    // console.log("LOT SIZE NO this.checkLotSize")
                    continue;
                }

                if (
                    !this.checkFilterMinNotion(quantityBuy * priceBuy, candidateBuy.filters)
                    || !this.checkFilterMinNotion(quantitySell1 * priceSell1, candidateSell1.filters)
                    || !this.checkFilterMinNotion(quantitySell2 * priceSell2, candidateSell2.filters)
                ) {
                    // console.log("MIN_NOTIONAL");
                    continue;
                }
                console.log(`Oportunidade em BSS: ${candidateBuy.symbol} > ${candidateSell1.symbol} > ${candidateSell2.symbol} = ${crossRate}`);
                console.log(`${entryCoin} > buy > ${quantityBuy} > sell > ${quantitySell1} > sell > ${quantitySell2} == $${quantitySell2 * priceSell2}`);

                // console.log(`${candidateBuy.symbol} == ${quantityBuy}`);
                const entryRealCoin = quantityBuy * priceBuy
                console.log(`${entryRealCoin} > buy > ${quantityBuy} > sell > ${quantitySell1} > sell > ${quantitySell2} == $${quantitySell2 * priceSell2}`);
                const resp1 = await this.buy(candidateBuy.symbol, quantityBuy);

                if (resp1.status === "FILLED") {
                    this.isTrading = true;

                    quantitySell1 = resp1.executedQty;
                    quantitySell1 = this.roundNumber(quantitySell1, candidateSell1.filters) 

                    const resp2 = await this.sell(candidateSell1.symbol, quantitySell1);
                    if (resp2.status === "FILLED") {
                        quantitySell2 = resp2.cummulativeQuoteQty;
                        quantitySell2 = this.roundNumber(quantitySell2, candidateSell2.filters);

                        const resp3 = await this.sell(candidateSell2.symbol, quantitySell2);
                        
                        if (resp3.status === "FILLED") {
                            console.log(`Operação BSS concluída: Entrou com $${entryRealCoin}, saiu com $${resp3.cummulativeQuoteQty}`);
                            (await this.api.balances()).forEach(item => {
                                if (item.asset.toUpperCase() === process.env.COIN) {
                                    console.log(item);
                                }
                            });
                        }
                    }                    
                }

                if (this.isTrading) {
                    console.log("\n\n");
                    break;
                }
            }
        }
        if (this.isTrading) {
            setTimeout(() => {
                this.isTrading = false;
            }, process.env.SLEEP_PER_OPERATION * 1000);
        }
    }

    async buy(symbol, quantity)
    {
        return await this.api.newOrder(symbol, quantity, null, "BUY", "MARKET");
    }

    async sell(symbol, quantity)
    {
        return await this.api.newOrder(symbol, quantity, null, "SELL", "MARKET");
    }

    webhook()
    {
        const ws = new Websocket("wss://stream.binance.com:9443/ws/!bookTicker");

        ws.onmessage = async (event) => {
            const obj = JSON.parse(event.data);
            
            this.book[obj.s] = {
                askPrice: parseFloat(obj.a),
                bidPrice: parseFloat(obj.b)
            };
        
        }
    }

    // faz a checagem para ver se o lost size, minQuantity e maxQuantity  é suprido
    checkLotSize(quantity, filters)
    {
        const minQuantity = (filters[2]["minQty"]);
        const maxQuantity = (filters[2]["maxQty"]);
        const stepSize = (filters[2]["stepSize"]);

        const result = parseFloat(parseFloat((quantity / stepSize) * stepSize).toFixed(8));

        if ( result !== parseFloat(quantity)) return false;
        else if (quantity < minQuantity) return false;
        else if (quantity > maxQuantity) return false;

        return true;
    }


    checkFilterMinNotion(entryCoin, filters)
    {
        const minNotion = (filters[3]["minNotional"]);

        if (entryCoin < minNotion) {
            return false;
        }
        return true;
    }
    
    roundNumber(value, filters)
    {
        if (!value) return false;
        
        const stepSize = String(filters[2]["stepSize"]);

        if (parseFloat(stepSize) === parseInt(stepSize)) {
            return parseInt(value);
        }

        let precision = 0;
        let decimals = stepSize.match(/\.\d+/);

        if (decimals) {
            precision = decimals[0].indexOf(1);//.match(/\d+/)[0].length;
        }
        if (!precision) {
            return parseInt(value);
        }
        value = String(value);
        const rounded = parseFloat(value.slice(0, value.indexOf(".") + 1 + precision));
        return rounded;
    }

    async run() {
        const allSymbols = await this.getInfo();
        // console.log(`Existem ${allSymbols.length} pares disponíveis na binance`);

        const buySymbols = allSymbols.filter(item => item.quote === this.coin);

        const buyBuySell = this.getBuyBuySell(buySymbols, allSymbols);
        // console.log(`Existem ${buyBuySell.length} possíveis triangulações BBS`);

        const buySellSell = this.getBuySellSell(buySymbols, allSymbols);
        // console.log(`Existem ${buySellSell.length} possíveis triangulações BSS`);

        if (this.isTrading) return ;

        await this.processBuyBuySell(buyBuySell);
        await this.processBuySellSell(buySellSell);
    }
} 

module.exports = Bot;