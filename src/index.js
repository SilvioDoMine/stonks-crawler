const readline = require('readline');
const pupperteer = require('puppeteer');
const mysql = require('mysql');
const { exit } = require('process');
let userStocks = [];
// Lista global de ações, que o NodeJS tem acesso
let stocks = {};

/**
 * MySQL functions
 */
const connection = mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: 'root',
    database: 'stonks',
});

connection.connect(error => {
    if (error) {
        throw error;
    }
});

(async () => {

    // Função que futuramente salvará as ações.
    setInterval(() => {

        // Função que atualiza todas as ações
        getAllStocks();

        if (Object.keys(stocks).length) {
            //console.log(stocks);
        }
    }, 1000);

    // Inicia o Browser
    const browser = await pupperteer.launch({
        // Debug Session
        headless: false,
        //slowMo: 250,
    });

    // Abre uma nova página no Browser
    const page = await browser.newPage();

    // Seta tempo de expiração (Timeout) infinito para esta página.
    await page.setDefaultNavigationTimeout(0);

    // Na página previamente aberta, acessa a rota de login e espera carregar até o fim
    await page.goto("https://internetbanking.bancointer.com.br/login.jsf", { waitUntil: 'networkidle0' }); 

    // Dentro da página de Login, vamos executar o seguinte código:
    await page.evaluate(function(){
        // Seta o campo de login para a minha conta pessoal.
        document.getElementById('loginv20170605').value = "3861518-5";
        // Clica no botão de login.
        document.getElementsByClassName("topo10 bottom10")[0].click();
    });

    // Agora que clicamos em login, a página vai recarregar. Mas, para prosseguir
    // precisamos que a página já tenha concluído o carregamento, então vamos pedir
    // pro puppeteer esperar.
    await page.waitForNavigation();

    // Agora ele redirecionou para uma página que tem o nome do usuário.
    // Vamos navegar no DOM e executar o seguinte código:
    await page.evaluate(function(){
        // Procure o botão que está escrito as iniciais do usuário, e clique nele.
        document.getElementById("j_idt159").click();
    });

    // Agora deve ter aberto um teclado digital para o usuário digitar a sua senha.
    // Para ser mais seguro, vamos pedir pro usuário digitar a senha no NodeJS.
    let password = await askQuestion("Please, type your password: ");

    // Agora vamos varrer cada letra da senha digitada, e simular um click
    // no teclado virtual do Banco Inter.
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

    // Agora com a senha digitada, vamos fazer um workarround para
    // esperar o campo de CONTINUAR não estar mais disabled. 
    // É necessário esse workarround pois o puppeteer não tem funções
    // para elementos que estão DISABLED. Apenas HIDDEN.
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

    // Agora vamos clicar em Continuar, pois a senha foi inserida corretamente.
    await page.evaluate(() => document.getElementById("j_idt51").click());

    // Agora que a senha foi digitada com sucesso, nós precisamos do código de autenticação
    // de dois fatores. Vamos pedir pro cliente informar isto.
    let factorPass = await askQuestion("Please, type your two factor authentication code: ");

    // Após o cliente ter passado, vamos esperar a página de autenticação de dois fatores aparecer...
    await page.waitForSelector("#codigoAutorizacaoAOTP");

    // Agora que apareceu, vamos executar a seguinte função:
    await page.evaluate((factorPass) => {
        // Digita o valor do código de autenticação no input correto
        document.getElementById("codigoAutorizacaoAOTP").value = factorPass;
        // Clica para logar na plataforma
        document.getElementById("confirmarCodigoTransacaoAOTP").click();
    }, factorPass);

    // Precisamos aguardar o usuário logar e a página carregar normalmente.
    await page.waitForNavigation();

    // Agora que a página carregou, e o usuário está logado... vamos
    // redirecionar ele para a página do Homebroker
    await page.goto("https://internetbanking.bancointer.com.br/idtvm/homeBroker.jsf", { waitUntil: 'networkidle0' });

    // Assim que a gente redirecionar ele para a página do homebroker, vamos esperar
    // ela carregar e aparecer o link para abrir o homebroker.
    await page.waitForSelector("#btnHomeBroker", { waitUntil: 'networkidle0' });
    
    // Agora que apareceu, vamos clicar no botão para abrir o Homebroker em uma nova janela.
    await page.evaluate(() => document.getElementById("btnHomeBroker").click());

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

        while(true) {
            await crawlerLoop(brokerPage);
        }

    });

})();

/**
 * 
 * @param {*} page Homebroker page
 */
async function crawlerLoop(page) {

    console.log(`> --------------------------------------`);
    console.log(`> Iniciando a leitura do homebroker.`);
    console.log(`> --------------------------------------`);

    let allStocksToCrawl = userStocks;

    for (let i = 0; i < allStocksToCrawl.length; i++) {

        let stockToCrawl = allStocksToCrawl[i];

        console.log(`> Vamos tentar buscar o papel ${stockToCrawl} da ação ${i + 1}/${allStocksToCrawl.length}.`);

        console.log(`> Vamos buscar a lista de carteiras disponíveis.`);
        
        let allPortfolios = await page.evaluate(() => {
            let portfolios = document.querySelectorAll(`#cboCarteira-ct1 > option`);

            let ids = [];

            portfolios.forEach((portfolioNode) => ids.push(portfolioNode.id));

            return { ids };
        });

        let portfolioIds = allPortfolios.ids;
        let stockData = {};

        console.log(`> Temos um total de ${portfolioIds.length} carteiras. Vamos varrer todas elas, até encontrar ação que nós queremos.`);

        for (let j = 0; j < portfolioIds.length; j++) {
            console.log(`> Vamos acessar a carteira ${j+1}/${portfolioIds.length}.`);

            await page.evaluate((portfolioId) => {
                console.log(portfolioId);
                document.getElementById(portfolioId).selected = true;
                document.getElementById(`cboCarteira-ct1`).dispatchEvent(new Event('change'));
            }, portfolioIds[j]);

            console.log(`> Esperando 2000ms para carregar os dados...`);
            await page.waitFor(2000);

            console.log(`> Vamos verificar se essa carteira (${j+1} de ${portfolioIds.length}) tem o papel ${stockToCrawl}.`);

            let findStock = await page.evaluate((stockToCrawl) => {

                let rows = document.querySelectorAll("#table-ct1 > tbody > tr");

                let thisStock = {};

                for (let k = 0; k < rows.length; k++) {
                    let elements = rows[k].childNodes;

                    // Dados em string para facilitar leitura.
                    let stockName = elements[1].innerText;

                    if (stockName != stockToCrawl) {
                        continue;
                    }

                    thisStock = {
                        ultima: elements[3].innerText,
                        variacao: elements[4].innerText,
                        abertura: elements[5].innerText,
                        minima: elements[6].innerText,
                        maxima: elements[7].innerText,
                        fechamento: elements[8].innerText,
                        volume: elements[9].innerText,
                        preco_teorico: elements[12].innerText,
                    };

                    break;
                }

                return thisStock;

            }, stockToCrawl);

            stockData = findStock;

            if (Object.keys(findStock).length > 0) {
                break;
            }
            
        }

        if (Object.keys(stockData).length == 0) {
            console.log(`> Não foi possível encontrar a ação em nenhum papel. Precisamos criar.`);
        } else {
            console.log(`> Ação encontrada! Dados abaixo:`);
        }

        stocks[stockToCrawl] = stockData;

        console.log({[stockToCrawl]: stockData});
        console.log(`===================================`);
    }

    await page.waitFor(30000);
}


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

/**
 * Crawler 
 */
function getAllStocks()
{
    let sql = "SELECT code FROM stock_data";

    let allStocks = connection.query(sql, function(err, results) {
        if (err) {
            throw err;
        }

        userStocks = [];

        results.forEach(function(item){
            
            let contains = userStocks.includes(item.code);

            if (!contains) {
                userStocks.push(item.code);
            }
        });
    });
}
