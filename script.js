document.addEventListener('DOMContentLoaded', () => {
    fetchBinanceSymbols();
    setupPeriodButtons();
    setupThemeToggle();
});

let allBinancePairs = [];
let priceChart = null;
let currentSymbol = null;
let currentBase = null;
let currentPeriod = 7;
let currentPrice = null;

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
                updateChartHeader(allBinancePairs[0].symbol, allBinancePairs[0].baseAsset);
                fetchBinancePrice(allBinancePairs[0].symbol, true);
                fetchCryptoNews(allBinancePairs[0].baseAsset);
                fetchAndRenderChart(allBinancePairs[0].symbol, currentPeriod);
            }
            select.addEventListener('change', (e) => {
                const symbol = e.target.value;
                const base = symbol.replace(/(RUB|USDT)$/,'');
                updateChartHeader(symbol, base);
                fetchBinancePrice(symbol, true);
                fetchCryptoNews(base);
                fetchAndRenderChart(symbol, currentPeriod);
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
                        updateChartHeader(filtered[0].symbol, filtered[0].baseAsset);
                        fetchBinancePrice(filtered[0].symbol, true);
                        fetchCryptoNews(filtered[0].baseAsset);
                        fetchAndRenderChart(filtered[0].symbol, currentPeriod);
                    } else {
                        document.getElementById('rates-list').innerHTML = '<p>Нет такой валюты.</p>';
                        document.getElementById('news-list').innerHTML = '';
                        clearChart();
                        updateChartHeader(null, null);
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

function fetchBinancePrice(symbol, updateHeader = false) {
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
                const priceStr = parseFloat(data.price).toLocaleString('ru-RU', {maximumFractionDigits: 8});
                ratesList.innerHTML = `<div class=\"crypto-rate\"><span>${priceStr}</span></div>`;
                currentPrice = priceStr;
                if (updateHeader) {
                    updateChartHeader(symbol, match ? match[1] : symbol);
                }
            } else {
                ratesList.innerHTML = '<p>Нет данных по выбранной валюте.</p>';
                currentPrice = null;
            }
        })
        .catch(() => {
            ratesList.innerHTML = '<p style="color:red">Ошибка загрузки курса.</p>';
            currentPrice = null;
        });
}

function updateChartHeader(symbol, base) {
    const pairEl = document.getElementById('chart-pair');
    const priceEl = document.getElementById('chart-price');
    if (!symbol || !base) {
        pairEl.textContent = '—';
        priceEl.textContent = '—';
        currentSymbol = null;
        currentBase = null;
        return;
    }
    const match = symbol.match(/^([A-Z0-9]+)(RUB|USDT)$/);
    let pairLabel = symbol;
    if (match) {
        pairLabel = match[1] + '/' + match[2];
    }
    pairEl.textContent = pairLabel;
    priceEl.textContent = currentPrice ? currentPrice : '...';
    currentSymbol = symbol;
    currentBase = base;
}

function setupPeriodButtons() {
    const periodBtns = document.querySelectorAll('.period-btn');
    periodBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            periodBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentPeriod = parseInt(btn.dataset.period);
            if (currentSymbol) {
                fetchAndRenderChart(currentSymbol, currentPeriod);
            }
        });
    });
    // По умолчанию выделить 7 дней
    document.querySelector('.period-btn[data-period="7"]').classList.add('active');
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

function fetchAndRenderChart(symbol, period) {
    const ctx = document.getElementById('price-chart').getContext('2d');
    let interval, startTime;
    const now = Date.now();
    if (period === 1) {
        interval = '15m';
        startTime = now - 1 * 24 * 60 * 60 * 1000;
    } else if (period === 7) {
        interval = '1h';
        startTime = now - 7 * 24 * 60 * 60 * 1000;
    } else if (period === 30) {
        interval = '4h';
        startTime = now - 30 * 24 * 60 * 60 * 1000;
    } else {
        interval = '1d';
        startTime = now - 90 * 24 * 60 * 60 * 1000;
    }
    fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${startTime}&endTime=${now}`)
        .then(response => response.json())
        .then(data => {
            if (!Array.isArray(data) || data.length === 0) {
                clearChart();
                return;
            }
            let labels;
            if (period === 1) {
                labels = data.map(item => {
                    const date = new Date(item[0]);
                    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                });
            } else {
                labels = data.map(item => {
                    const date = new Date(item[0]);
                    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
                });
            }
            let prices = data.map(item => parseFloat(item[4])); // close price
            renderChart(ctx, labels, prices, symbol, period);
        })
        .catch(() => {
            clearChart();
        });
}

function renderChart(ctx, labels, prices, symbol, period) {
    if (priceChart) {
        priceChart.destroy();
    }
    const match = symbol.match(/^([A-Z0-9]+)(RUB|USDT)$/);
    let pairLabel = symbol;
    if (match) {
        pairLabel = match[1] + '/' + match[2];
    }
    // Обновить цену справа
    document.getElementById('chart-pair').textContent = pairLabel;
    document.getElementById('chart-price').textContent = currentPrice ? currentPrice : (prices.length ? prices[prices.length-1].toLocaleString('ru-RU', {maximumFractionDigits:8}) : '—');
    priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '',
                data: prices,
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37,99,235,0.10)',
                pointRadius: 4,
                pointBackgroundColor: '#2563eb',
                pointBorderColor: '#fff',
                borderWidth: 2.5,
                tension: 0.25,
                fill: true,
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                title: { display: false }
            },
            scales: {
                x: {
                    display: true,
                    ticks: { maxTicksLimit: 8, color: '#888', font: { size: 13 } },
                    grid: { display: false }
                },
                y: {
                    display: true,
                    ticks: { color: '#2563eb', font: { size: 13 } },
                    grid: { color: '#e0e7ef' }
                }
            },
            elements: {
                line: { borderJoinStyle: 'round' },
                point: { radius: 4, hoverRadius: 6 }
            },
            interaction: {
                intersect: false,
                mode: 'index',
            },
            animation: {
                duration: 600,
            }
        }
    });
}

function clearChart() {
    if (priceChart) {
        priceChart.destroy();
        priceChart = null;
    }
    const ctx = document.getElementById('price-chart').getContext('2d');
    ctx.clearRect(0, 0, 600, 260);
}

function setupThemeToggle() {
    const btn = document.getElementById('theme-toggle');
    const body = document.body;
    // Проверяем localStorage
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        body.classList.add('dark-theme');
        btn.textContent = '☀️ Светлая тема';
    }
    btn.addEventListener('click', () => {
        body.classList.toggle('dark-theme');
        const isDark = body.classList.contains('dark-theme');
        btn.textContent = isDark ? '☀️ Светлая тема' : '🌙 Тёмная тема';
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });
}