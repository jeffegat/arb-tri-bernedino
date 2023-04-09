const Bot = require("./Bot");
const Api = require("./Api");

const api = new Api();
const bot = new Bot(process.env.COIN, process.env.VALUE_BUY, process.env.PROFITABILITY_BBS, process.env.PROFITABILITY_BSS, api);

// bot.setUrlApi("https://api1.binance.com")


setInterval(async function() {
    bot.run();
    // console.log(await api.balances());
    // (await api.balances()).forEach(item => {
    //     if (item.asset.toUpperCase() === process.env.COIN) {
    //         console.log(item);
    //     }
    // });
}, process.env.SLEEP * 1000);