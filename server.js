const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const PORT = process.env.PORT || 3005;
const API_KEY = process.env.API_KEY;
const SPREADSHEET_ID = '1Vaygqh0gD54ZLP2OJd5gpapETvLzQFh-gHf8fNsfVIE';

// 環境変数からGoogle認証情報を取得
const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const server = http.createServer((req, res) => {
    // CORS設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // --- ルーティング ---

    // 1. トップ画面 (index.html)
    if (req.url === '/' || req.url === '/index.html') {
        fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
            if (err) { res.writeHead(404); res.end("index.html Not Found"); return; }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });

    // 2. JavaScriptファイル
    } else if (req.url === '/script.js') {
        fs.readFile(path.join(__dirname, 'script.js'), (err, data) => {
            if (err) { res.writeHead(404); res.end("script.js Not Found"); return; }
            res.writeHead(200, { 'Content-Type': 'application/javascript' });
            res.end(data);
        });
　　// 2.5 CSSファイル
    } else if (req.url === '/style.css') {
        fs.readFile(path.join(__dirname, 'Style.css'), (err, data) => {
            if (err) { res.writeHead(404); res.end("Style.css Not Found"); return; }
            res.writeHead(200, { 'Content-Type': 'text/css' });
            res.end(data);
        });
    // 3. ニュース取得API
    } else if (req.url === '/api/get-news') {
        const NEWS_RSS_URL = "https://news.google.com/rss/search?q=AI%20%E4%B8%8D%E5%8B%95%E7%94%A3&hl=ja&gl=JP&ceid=JP:ja";
        https.get(NEWS_RSS_URL, (rssRes) => {
            let data = '';
            rssRes.on('data', chunk => { data += chunk; });
            rssRes.on('end', () => {
                const items = [];
                const itemMatches = data.matchAll(/<item>([\s\S]*?)<\/item>/g);
                for (const match of itemMatches) {
                    const content = match[1];
                    const title = content.match(/<title>(.*?)<\/title>/)?.[1] || "No Title";
                    const link = content.match(/<link>(.*?)<\/link>/)?.[1] || "";
                    items.push({ title, link });
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ news: items }));
            });
        });

    // 4. スプレッドシート保存API
    } else if (req.url === '/api/save-sheet') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const { title, summary, link } = JSON.parse(body);
                const sheets = google.sheets({ version: 'v4', auth });
                await sheets.spreadsheets.values.append({
                    spreadsheetId: SPREADSHEET_ID,
                    range: 'シート1!A:D',
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: [[new Date().toLocaleString(), title, summary, link]] },
                });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: "ok" }));
            } catch (err) {
                console.error(err);
                res.writeHead(500);
                res.end(JSON.stringify({ error: err.message }));
            }
        });

    } else {
        res.writeHead(404);
        res.end("Not Found");
    }
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);

});

