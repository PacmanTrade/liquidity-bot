import xeggexApi from './xeggexApi.js'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { v4 as uuidv4 } from 'uuid';
import Big from 'big.js';
import { onShutdown } from "node-graceful-shutdown";
import process from 'process';
import fs from 'fs';

const argv = yargs(hideBin(process.argv)).argv


const opts = {
    //apiKey: argv.apiKey,            	/// API key
    //apiSecret: argv.apiSecret,      	/// API secret
	sessionKey: argv.sessionKey,
    base: argv.base,                	/// Base asset to use e.g. BTC for BTC_ETH
    stock: argv.stock,               	/// Stock to use e.g. ETH for BTC_ETH
    numorders: parseInt(argv.numorders),	/// Number of orders per side
	delta: parseFloat(argv.delta),
	quantity: parseInt(argv.quantity)
}

// Get the command line args and save into opts
Object.keys(opts).forEach(key => {
    if (opts[key] === undefined) {
        console.log(`
            ${key} must be passed into the program
            e.g. node . run --${key}=<value>
            `)
        process.exit(1);
    }
});

console.log(
    `
        Running market maker with the following options;
        Base Asset: ${opts.base}
        Stock Asset: ${opts.stock}
        NumOrders: ${opts.numorders}
        Delta: ${opts.delta}
        Quantity: ${opts.quantity}
    `)

console.log(opts.stock + '_' + opts.base + " process id is " + process.pid);

fs.writeFileSync("./pidfiles/" + opts.stock + "_" + opts.base + ".pid", process.pid.toString());

const restapi = new xeggexApi(opts.sessionKey);

console.log('start first del');
async function cancelOrders()
{
		try {
			var orders = [];
            orders = await restapi.getUserOrders(opts.stock + '/' + opts.base, 0, 1000);
            console.log(orders.length)
            for (var i = 0; i < orders.length; i++)
            {
            	var orderCur = orders[i];
            	var orderCurId = orderCur.orderId;
            	var res = await restapi.cancelOrder(orderCurId);
            }
			//await restapi.cancelAllOrders(opts.stock + '/' + opts.base, 'all');
		} catch (e) {
			console.log(e);
		}
	
        console.log('Cancel open orders');
}
await cancelOrders();
console.log('end first del');

var is_initialised = false;


runIt();

// On Shutdown - Cancel open orders
process.on('SIGTERM', async function () {

  return new Promise((resolve, reject) => {

    (async () => {

	  cancelOrders();
      
      fs.unlinkSync("./pidfiles/" + opts.stock + "_" + opts.base + ".pid");

	  console.log('Remove PID file');
	  
	  process.exit;
	  
      resolve(true);
				
    })();
			
  });
	
});


async function runIt()
{

	if (!is_initialised) {
	  await init_grid();
	  is_initialised = true;
	}

	var orders = [];
	orders = await restapi.getUserOrders(opts.stock + '/' + opts.base, 0, 1000);
	console.log(orders.length)
	if (orders.length !== opts.numorders * 2) {
		await cancelOrders();
		await init_grid();
	}

	setTimeout(function() {
	
		runIt();
	
	},5000);


}


// Enter a buy order with n% from account (y/2)% away from the last price
// Enter a sell order with n% from accoutn (y/2)% away from the last price

async function init_grid() {
	console.log('init_grid');

	var lasttrade = await restapi.getTradeHistorySince(opts.stock + '/' + opts.base, 1);
	var last_price = parseFloat(lasttrade[0].price);


	for (var i = 0; i < opts.numorders; i++) {
		try {
			var buyorderinfo = await restapi.createLimitOrder(opts.stock + '/' +  opts.base, last_price - (i + 1) * opts.delta, opts.quantity, 'BUY', 'LIMIT_PRICE', 0);
			console.log(buyorderinfo);
		} catch (e) {
			console.log(e);
		}
		try {
			var sellorderinfo = await restapi.createLimitOrder(opts.stock + '/' +  opts.base, last_price + (i + 1) * opts.delta, opts.quantity, 'SELL', 'LIMIT_PRICE', 0);
			console.log(sellorderinfo);
		} catch (e) {
			console.log(e);
		}
	}
}
