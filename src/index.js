const readline = require('readline');
const pupperteer = require('puppeteer');

(async () => {

    // Lista global de ações, que o NodeJS tem acesso
    let stocks = {};

    // Função que futuramente salvará as ações.
    setInterval(() => {
        if (Object.keys(stocks).length) {
            console.log(stocks);
        }
    }, 1000);

    // Inicia o Browser
    const browser = await pupperteer.launch({
        // Debug Session
        //headless: false,
        //slowMo: 250,
    });

    // Quando uma nova janela abrir, vamos executar essa função
    // NOTA: Isso precisa existir pois o Banco Inter abre uma nova
    // janela pra abrir o Homebroker. Pegaremos essa tela por aqui!
    browser.on('targetcreated', async function(target) {

        const homebrokerUrl = "https://home-broker.bancointer.com.br/hbnet2/hbweb2/Default.aspx";

        // Se não for a tela do homebroker, vaza dessa função!
        if (target._targetInfo.url != homebrokerUrl) {
            return;
        }
        
        // Vamos pegar a página em si, para trabalhar com ela.
        let brokerPage = await target.page();

        // Vamos esperar 3 segundos para prosseguir. Esse vai ser o tempo
        // do homebroker carregar por completo.
        await brokerPage.waitFor(3000);

        // Agora com o homebroker carregado, vamos rodar essa função em LOOP!
        setInterval(async () => {

            // Vamos navegar no DOM do Homebroker e procurar uns valores.
            let result = await brokerPage.evaluate((stocks) => {

                    let allStocks = {};

                    // Vou procurar a lista de todas ações da carteira.
                    let rows = document.querySelectorAll("#table-ct1 > tbody > tr");

                    // Para cada uma das ações, eu vou...
                    rows.forEach(function(row){
                        // ver os elementos da tabela
                        let elements = row.childNodes;

                        // E montar um novo objeto com todos os dados.
                        // NOTA: Estou inserindo esses dados para dentro
                        // do objeto allStocks previamente criado, neste escopo.
                        allStocks[elements[1].innerText] = {
                            ultima: elements[3].innerText,
                            variacao: elements[4].innerText,
                            abertura: elements[5].innerText,
                            minima: elements[6].innerText,
                            maxima: elements[7].innerText,
                            fechamento: elements[8].innerText,
                            volume: elements[9].innerText,
                            preco_teorico: elements[12].innerText,
                        };
                    });

                    // Simula um clique para evitar desconexão por inatividade
                    document.getElementById("tdIcon_win_ct1").click();

                    // Retorna um objeto com allStocks nele.
                    return { allStocks };

                }, stocks);

                // Agora eu pego o resultado da consulta no DOM acima, dentro
                // do resultado eu vou pegar a propriedade allStocks e vou inserir
                // o valor dentro do objeto global do NodeJS stocks.
                stocks = result.allStocks;

        }, 1000);
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
            await page.waitForSelector(`input[title='${letter}']`);
            await page.evaluate((letter) => document.querySelector(`input[title='${letter}']`).click(), letter);
        } else {
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

    await page.goto("https://internetbanking.bancointer.com.br/idtvm/homeBroker.jsf", { waitUntil: 'networkidle0' });

    await page.waitForSelector("#btnHomeBroker", { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.getElementById("btnHomeBroker").click());

    let targets = [];
    let resolve;

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
