const api = require("./Api");

setInterval(async function() {
    result = await api.exchangeInfo();

    availables = Object.values(result.symbols).filter(symbol => {
        return symbol.symbol.indexOf("USDT") != -1;
    });

    console.log(availables);

}, 3000);