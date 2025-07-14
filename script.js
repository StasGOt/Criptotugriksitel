document.addEventListener('DOMContentLoaded', () => {
    fetchBinanceSymbols();
});

let allBinancePairs = [];

function fetchBinanceSymbols() {
    const select = document.getElementById('currency-select');
    const search = document.getElementById('currency-search');
    const ratesList = document.getElementById('rates-list');
    ratesList.innerHTML = '<p>Загрузка списка валют...</p>';
    fetch('https://api.binance.com/api/v3/exchangeInfo')
        .then(response => response.json())
        .then(data => {
            // Оставляем только пары к RUB и USDT
            allBinancePairs = data.symbols.filter(s =>
                (s.quoteAsset === 'RUB' || s.quoteAsset === 'USDT') && s.status === 'TRADING'
            );
            allBinancePairs.sort((a, b) => a.baseAsset.localeCompare(b.baseAsset));
            renderPairsSelect(allBinancePairs);
            // Показываем курс первой пары
            if (allBinancePairs.length > 0) {
                fetchBinancePrice(allBinancePairs[0].symbol);
                fetchCryptoNews(allBinancePairs[0].baseAsset);
            }
            select.addEventListener('change', (e) => {
                const symbol = e.target.value;
                const base = symbol.replace(/(RUB|USDT)$/,'');
                fetchBinancePrice(symbol);
                fetchCryptoNews(base);
            });
            if (search) {
                search.addEventListener('input', (e) => {
                    const value = e.target.value.trim().toUpperCase();
                    const filtered = value
                        ? allBinancePairs.filter(pair => pair.baseAsset.toUpperCase().includes(value))
                        : allBinancePairs;
                    renderPairsSelect(filtered);
                    // Если есть хотя бы одна пара — сразу показываем её курс и новости
                    if (filtered.length > 0) {
                        fetchBinancePrice(filtered[0].symbol);
                        fetchCryptoNews(filtered[0].baseAsset);
                    } else {
                        document.getElementById('rates-list').innerHTML = '<p>Нет такой валюты.</p>';
                        document.getElementById('news-list').innerHTML = '';
                    }
                });
            }
        })
        .catch(() => {
            ratesList.innerHTML = '<p style="color:red">Ошибка загрузки списка валют.</p>';
        });
}

function renderPairsSelect(pairs) {
    const select = document.getElementById('currency-select');
    select.innerHTML = '';
    pairs.forEach(pair => {
        const label = `${pair.baseAsset}/${pair.quoteAsset}`;
        const value = pair.symbol;
        select.innerHTML += `<option value="${value}">${label}</option>`;
    });
}

function fetchBinancePrice(symbol) {
    const ratesList = document.getElementById('rates-list');
    ratesList.innerHTML = '<p>Загрузка курса...</p>';
    fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`)
        .then(response => response.json())
        .then(data => {
            if (data.price) {
                // Формируем красивое название пары BASE/QUOTE
                const match = symbol.match(/^([A-Z0-9]+)(RUB|USDT)$/);
                let pairLabel = symbol;
                if (match) {
                    pairLabel = match[1] + '/' + match[2];
                }
                ratesList.innerHTML = `<div style="font-size:1.1rem;margin-bottom:4px;color:#888;">Текущий курс для: <b>${pairLabel}</b></div><div class=\"crypto-rate\"><span>${pairLabel}</span><span>${parseFloat(data.price).toLocaleString('ru-RU', {maximumFractionDigits: 8})}</span></div>`;
            } else {
                ratesList.innerHTML = '<p>Нет данных по выбранной валюте.</p>';
            }
        })
        .catch(() => {
            ratesList.innerHTML = '<p style="color:red">Ошибка загрузки курса.</p>';
        });
}

function fetchCryptoNews(baseAsset) {
    const newsList = document.getElementById('news-list');
    newsList.innerHTML = '<p>Загрузка новостей...</p>';
    // Google News RSS по тикеру
    const query = encodeURIComponent(baseAsset);
    const rssUrl = encodeURIComponent(`https://news.google.com/rss/search?q=${query}+криптовалюта+OR+crypto&hl=ru&gl=RU&ceid=RU:ru`);
    fetch(`https://api.rss2json.com/v1/api.json?rss_url=${rssUrl}`)
        .then(response => response.json())
        .then(data => {
            if (!data.items || data.items.length === 0) {
                newsList.innerHTML = '<p>Нет новостей.</p>';
                return;
            }
            // Сортируем по дате публикации (сначала свежие)
            const sorted = data.items.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
            newsList.innerHTML = '';
            sorted.slice(0, 7).forEach(news => {
                newsList.innerHTML += `
                    <div class="news-item">
                        <a class="news-title" href="${news.link}" target="_blank" rel="noopener">${news.title}</a>
                        <div class="news-date">${new Date(news.pubDate).toLocaleString('ru-RU')}</div>
                        <div style="color:#888;font-size:0.95rem;">${news.source ? news.source.title : ''}</div>
                    </div>
                `;
            });
        })
        .catch(() => {
            newsList.innerHTML = '<p style="color:red">Ошибка загрузки новостей.</p>';
        });
}