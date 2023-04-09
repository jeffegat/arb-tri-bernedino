const Api = require("./Api");

const api = new Api();

setInterval(async function() {

    (await api.balances()).forEach(item => {
        if (item.asset === "CVP" || item.asset === "BUSD" || item.asset === "USDT") console.log(item);
    });
    // console.log(await api.newOrder("CVPUSDT", 12, null, "SELL", "MARKET"));
    
    // (await api.exchangeInfo())["symbols"].forEach(item => {
    //     if (item.symbol === "BUSDUSD") console.log(item);
    // })

}, 2000);