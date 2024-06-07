const puppeteer = require('puppeteer-extra');
const fs = require('fs');
const ExcelJS = require('exceljs');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const pageURL = 'https://fifaindex.com';

async function autoScroll(page) {
    await page.evaluate(async () => {
        await new Promise((resolve, reject) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= scrollHeight - window.innerHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 10);
        });
    });
}

const extractItemData = async (page) => {
    try {
        const itemData = await page.evaluate(() => {
            let extractedData = {};
            const items = [...document.querySelectorAll('.masonry .item')];

            items.map((item) => {
                const title = item.querySelector('.card-header')?.textContent;

                const cardBody = [...item.querySelectorAll('p')];
                const innerSpans = cardBody[0].querySelector('.float-right');

                if (innerSpans) {
                    let cardBodyData = {};

                    cardBody.map((cb) => {
                        cardBodyData[cb?.childNodes[0].textContent.trim()] = cb.querySelector('.float-right span')?.textContent.trim();
                    });

                    extractedData[title] = cardBodyData;
                }

                else {
                    const cardBodyData = [];

                    cardBody.map((cb) => cardBodyData.push(cb?.textContent.trim()));

                    extractedData[title] = cardBodyData;
                }

            });


            return extractedData;

        });

        return itemData;
    } catch (error) {
        console.log(error);
        return;
    }
}


const eachPlayerData = async (page) => {
    try {
        await page.waitForSelector('.card');

        const playerData = await page.evaluate(() => {
            const name = document.querySelector('.breadcrumb-item.active')?.textContent;
            const nationality = document.querySelectorAll('h2 .link-nation')[1]?.textContent;
            const cardData = [...document.querySelectorAll('.card-body p .float-right')];
            const height = cardData[0].querySelector('.data-units-metric')?.textContent;
            const weight = cardData[1].querySelector('.data-units-metric')?.textContent;
            const preferredFoot = cardData[2]?.textContent;
            const birthDate = cardData[3]?.textContent;
            const age = cardData[4]?.textContent;

            const prefPosSpans = [...cardData[5].querySelectorAll('a span')];
            const prefPositions = prefPosSpans.map((span) => span?.textContent);

            const workRate = cardData[6]?.textContent;

            const value = cardData[9]?.textContent;
            const wage = cardData[12]?.textContent;

            return {
                name,
                nationality,
                height,
                weight,
                preferredFoot,
                birthDate,
                age,
                prefPositions,
                workRate,
                value,
                wage
            }
        });


        const footballerItemData = await extractItemData(page);

        return { ...playerData, ...footballerItemData };
    } catch (error) {
        console.log(error);
        return;
    }

}


const main = async () => {
    const browser = await puppeteer.launch({ headless: true });

    for (let i = 1; i <= 609; i++) {
        const allData = [];
        let workbook;
        let worksheet;

        if (fs.existsSync('players.xlsx')) {
            workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile('players.xlsx');
            worksheet = workbook.getWorksheet('Football Players');
        } else {
            workbook = new ExcelJS.Workbook();
            worksheet = workbook.addWorksheet('Football Players');
            const row = worksheet.addRow([
                'Name',
                'Nationality',
                'Height',
                'Weight',
                'Preferred Foot',
                'Birth Date',
                'Age',
                'Preferred Positions',
                'Player Work Rate',
                'Value',
                'Wage',
                'Ball Control (Ball skills)',
                'Dribbling (Ball skills)',
                'Marking (Defence)',
                'Slide Tackle (Defence)',
                'Stand Tackle (Defence)',
                'Aggression (Mental)',
                'Reactions (Mental)',
                'Att. Position (Mental)',
                'Interceptions (Mental)',
                'Vision (Mental)',
                'Composure (Mental)',
                'Crossing (Passing)',
                'Short Pass (Passing)',
                'Long Pass (Passing)',
                'Acceleration (Physical)',
                'Stamina (Physical)',
                'Strength (Physical)',
                'Balance (Physical)',
                'Sprint Speed (Physical)',
                'Agility (Physical)',
                'Jumping (Physical)',
                'Heading (Shooting)',
                'Shot Power (Shooting)',
                'Finishing (Shooting)',
                'Long Shots (Shooting)',
                'Curve (Shooting)',
                'FK Acc. (Shooting)',
                'Penalties (Shooting)',
                'Volleys (Shooting)',
                'GK Positioning (Goalkeeper)',
                'GK Diving (Goalkeeper)',
                'GK Handling (Goalkeeper)',
                'GK Kicking (Goalkeeper)',
                'GK Reflexes (Goalkeeper)',
                'Specialities',
                'Traits'
            ]);

            row.font = { color: { argb: 'FF305496' }, bold: true, size: 12 };
        }

        const page = await browser.newPage();

        let requestCount = 0;
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            const resourceType = request.resourceType();
            const url = request.url();

            if (['image', 'stylesheet', 'font'].includes(resourceType) ||
                url.includes('analytics') ||
                url.includes('ads')) {
                request.abort();
            } else {
                if (requestCount < 50) {
                    request.continue();
                    requestCount++;
                } else {
                    request.abort();
                }
            }
        });

        await page.goto(`${pageURL}/players/?page=${i}`);

        await autoScroll(page);

        await page.waitForSelector('.link-player')

        const playerLinks = await page.evaluate(() => {
            const allLinks = [];
            const links = [...document.querySelectorAll('.player .link-player')];
            links.map((link) => allLinks.push(link.href));

            return allLinks
        });

        for (let i = 0; i < playerLinks.length; i++) {
            const detailPage = await browser.newPage();
            let requestCount = 0;
            await detailPage.setRequestInterception(true);
            detailPage.on('request', (request) => {
                const resourceType = request.resourceType();
                const url = request.url();

                if (['image', 'stylesheet', 'font'].includes(resourceType) ||
                    url.includes('analytics') ||
                    url.includes('ads')) {
                    request.abort();
                } else {
                    if (requestCount < 50) {
                        request.continue();
                        requestCount++;
                    } else {
                        request.abort();
                    }
                }
            });
            await detailPage.goto(playerLinks[i]);

            const playerData = await eachPlayerData(detailPage);
            allData.push(playerData);
            console.log(`${playerData.name} - ${playerData.nationality}`);

            await detailPage.close();
        }

        allData.map((data) => {
            worksheet.addRow([
                data.name,
                data.nationality,
                data.height,
                data.weight,
                data.preferredFoot,
                data.birthDate,
                data.age,
                data.prefPositions?.join(', '),
                data.workRate,
                data.value,
                data.wage,
                data['Ball Skills']['Ball Control'],
                data['Ball Skills']['Dribbling'],
                data['Defence']['Marking'],
                data['Defence']['Slide Tackle'],
                data['Defence']['Stand Tackle'],
                data['Mental']['Aggression'],
                data['Mental']['Reactions'],
                data['Mental']['Att. Position'],
                data['Mental']['Interceptions'],
                data['Mental']['Vision'],
                data['Mental']['Composure'],
                data['Passing']['Crossing'],
                data['Passing']['Short Pass'],
                data['Passing']['Long Pass'],
                data['Physical']['Acceleration'],
                data['Physical']['Stamina'],
                data['Physical']['Strength'],
                data['Physical']['Balance'],
                data['Physical']['Sprint Speed'],
                data['Physical']['Agility'],
                data['Physical']['Jumping'],
                data['Shooting']['Heading'],
                data['Shooting']['Shot Power'],
                data['Shooting']['Finishing'],
                data['Shooting']['Long Shots'],
                data['Shooting']['Curve'],
                data['Shooting']['FK Acc.'],
                data['Shooting']['Penalties'],
                data['Shooting']['Volleys'],
                data['Goalkeeper']['GK Positioning'],
                data['Goalkeeper']['GK Diving'],
                data['Goalkeeper']['GK Handling'],
                data['Goalkeeper']['GK Kicking'],
                data['Goalkeeper']['GK Reflexes'],
                data['Specialities']?.join(', '),
                data['Traits']?.join(', '),
            ]);
        });

        await workbook.xlsx.writeFile('players.xlsx');

        await page.close();
    }


    await browser.close();
}

main();