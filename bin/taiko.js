#! /usr/bin/env node

const path = require('path');
const util = require('util');
const fs = require('fs');
const taiko = require('../lib/taiko');
const repl = require('../lib/repl');
const { removeQuotes, symbols, isTaikoRunner } = require('../lib/util');
const observeAgrv = ['--observe','--slow-mo','--watch'];
const argv = process.argv;
let repl_mode = false;

async function exitOnUnhandledFailures(e){
    if(!repl_mode){
        console.error(e);
        if(await taiko.client())await taiko.closeBrowser();
        process.exit(1);
    }
}

process.on('unhandledRejection', exitOnUnhandledFailures);
process.on('uncaughtException',exitOnUnhandledFailures);
if(isTaikoRunner(process.argv[1]))
    if (process.argv.length > 2){
        runFile(process.argv[2]);
    }else{
        repl_mode = true;
        repl.initiaize();
    }
else
    module.exports = taiko;    

function runFile(file) {
    validate(file);
    const realFuncs = {};
    for (let func in taiko) {
        realFuncs[func] = taiko[func];
        if (realFuncs[func].constructor.name === 'AsyncFunction') global[func] = async function() {
            let res,args = arguments;
            if(func === 'openBrowser' && observeAgrv.some((val) => argv.includes(val)))
                if (args['0']) args['0'].headless = false;
                else args = [{headless:false}] ;
            res = await realFuncs[func].apply(this, args);
            if (res.description) {
                res.description = symbols.pass + res.description;
                console.log(removeQuotes(util.inspect(res.description, { colors: true }), res.description));
            }
            if(observeAgrv.some((val) => argv.includes(val))) await taiko.waitFor(3000);
            return res;
        };
        else global[func] = function() {
            return realFuncs[func].apply(this, arguments);
        };
        require.cache[path.join(__dirname, 'taiko.js')].exports[func] = global[func];
    }
    const oldNodeModulesPaths = module.constructor._nodeModulePaths;
    module.constructor._nodeModulePaths = function() {
        const ret = oldNodeModulesPaths.apply(this, arguments);
        ret.push(__dirname);
        return ret;
    };
    require(path.resolve(file).slice(0, -3));
}

function validate(file) {
    if (!file.endsWith('.js')) {
        console.log('Invalid file extension. Only javascript files are accepted.');
        process.exit(1);
    }
    if (!fs.existsSync(file)) {
        console.log('File does not exist.');
        process.exit(1);
    }
}