const readline = require('readline');
const pupperteer = require('puppeteer');

(async function () {
    // Browser Initiate
    const browser = await pupperteer.launch({
        headless: false,
        //slowMo: 250,
    });

    const page = await browser.newPage();

    // Fetch page and wait it's load.
    await page.goto("https://internetbanking.bancointer.com.br/login.jsf", { waitUntil: 'networkidle0' });

    await page.setDefaultNavigationTimeout(0); 

    // Execute javascript inside the page
    await page.evaluate(function(){
        document.getElementById('loginv20170605').value = "3861518-5";

        document.getElementsByClassName("topo10 bottom10")[0].click();
    });

    await page.waitForNavigation();

    await page.evaluate(function(){
        document.getElementById("j_idt159").click();
    });

    let password = await askQuestion("Please, type your password: ");

    for (var i = 0; i < password.length; i++) {
        let letter = password[i];

        if (letter != letter.toUpperCase()) {
            console.log(`m: ${letter}`);
            await page.waitForSelector(`input[title='${letter}']`);
            await page.evaluate((letter) => document.querySelector(`input[title='${letter}']`).click(), letter);
        } else {
            console.log(`M: ${letter}`);
            await page.evaluate(() => document.getElementById("j_idt65:8:j_idt67").click());

            await page.waitForSelector(`input[title='${letter}']`);
            await page.evaluate((letter) => document.querySelector(`input[title='${letter}']`).click(), letter);

            await page.evaluate(() => document.getElementById("j_idt65:8:j_idt67").click());
        }
    }

    let found = false;
    while(found == false) {

        let response = await page.evaluate(() => {
            let isDisabled = document.getElementById("j_idt51").disabled;

            return {
                isDisabled
            }
        });

        if (response.isDisabled == false) {
            found = true;
        }
    }

    await page.evaluate(() => document.getElementById("j_idt51").click());

    let factorPass = await askQuestion("Please, type your two factor authentication code: ");

    await page.waitForSelector("#codigoAutorizacaoAOTP");

    await page.evaluate((factorPass) => {
        document.getElementById("codigoAutorizacaoAOTP").value = factorPass;

        document.getElementById("confirmarCodigoTransacaoAOTP").click();
    }, factorPass);

    await page.waitForNavigation();

    const newPagePromise = new Promise(x => browser.once('targetdestroyed', target => x(target.page())));
    const popup = await newPagePromise;
    console.log(popup.url());

    await page.goto("https://internetbanking.bancointer.com.br/homeBroker", { waitUntil: 'networkidle0' });
    
    await page.waitForNavigation();
})();

function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }))
}

// async function initialLogin() {
//     let input = await document.getElementById('loginv20170605');
//     input.value = login;

//     let advanceLoginButton = await document.getElementsByClassName("topo10 bottom10")[0];
//     await advanceLoginButton.click();
// }