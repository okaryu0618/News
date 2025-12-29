process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const http = require('http');
const https = require('https');
const { google } = require('googleapis');

// --- 設定情報 ---
const API_KEY = "AIzaSyBmbSkjc0MMOKho-laxg3LpKRvysZRKdrs";
const PORT = process.env.PORT || 3005; // Renderが指定するポートを使うconst SPREADSHEET_ID = "1Vaygqh0gD54ZLP2OJd5gpapETvLzQFh-gHf8fNsfVIE";
const NEWS_RSS_URL = "https://news.google.com/rss/search?q=" + encodeURIComponent("人材業界 AI") + "&hl=ja&gl=JP&ceid=JP:ja";

// credentials.json を直接読み込むのではなく、環境変数から読み込む
const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT), 
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const server = http.createServer((req, res) => {
    // CORS設定（すべてのリクエストに適用）
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // デバッグログ：ブラウザから届いたURLをそのまま表示
    console.log(`[受信リクエスト]: ${req.url}`);

    // --- 1. ニュース取得 ---
    // includes を使うことで、多少のパスのズレがあっても反応するようにします
    if (req.url.includes('/api/get-news')) {
        console.log("-> ニュース取得処理を開始します");
        https.get(NEWS_RSS_URL, (newsRes) => {
            let data = '';
            newsRes.on('data', chunk => { data += chunk; });
            newsRes.on('end', () => {
                const items = [];
                const entries = data.match(/<item>([\s\S]*?)<\/item>/g) || [];
                entries.forEach(entry => {
                    const title = entry.match(/<title>(.*?)<\/title>/)?.[1] || "";
                    const link = entry.match(/<link>(.*?)<\/link>/)?.[1] || "#";
                    const pubDate = entry.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || "";
                    const keywords = ["AI", "人工知能", "採用", "人材", "DX"];
                    if (keywords.some(k => title.includes(k))) {
                        items.push({ title: title.replace(/ - .*$/, ""), link, date: new Date(pubDate) });
                    }
                });
                items.sort((a, b) => b.date - a.date);
                const result = JSON.stringify({ news: items.slice(0, 5) });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(result);
                console.log(`<- ニュース5件を返信しました`);
            });
        }).on('error', (e) => {
            console.error("RSS取得エラー:", e);
            res.writeHead(500); res.end();
        });

    // --- 2. Gemini AI プロキシ ---
    } else if (req.url.includes('/api/gemini')) {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            console.log("-> Gemini AIへリクエスト送信中...");
            const options = {
                hostname: 'generativelanguage.googleapis.com',
                // 先ほど確認した「gemini-2.0-flash」を使用
                path: `/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            };
            const gReq = https.request(options, (gRes) => {
                let gData = '';
                gRes.on('data', d => { gData += d; });
                gRes.on('end', () => {
                    console.log(`<- AI応答ステータス: ${gRes.statusCode}`);
                    res.writeHead(gRes.statusCode, { 'Content-Type': 'application/json' });
                    res.end(gData);
                });
            });
            gReq.write(body);
            gReq.end();
        });

    // --- 3. スプレッドシート保存 ---
    } else if (req.url.includes('/api/save-sheet')) {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const { title, summary, link } = JSON.parse(body);
                const sheets = google.sheets({ version: 'v4', auth });
                await sheets.spreadsheets.values.append({
                    spreadsheetId: SPREADSHEET_ID,
                    range: "シート1!A:D",
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: [[new Date().toLocaleString(), title, summary, link]] },
                });
                console.log(`<- シートに保存成功: ${title.slice(0, 10)}...`);
                res.writeHead(200); res.end(JSON.stringify({ status: "ok" }));
            } catch (err) {
                console.error("保存エラー:", err);
                res.writeHead(500); res.end();
            }
        });

    } else {
        // どのURLにも一致しない場合
        console.log(`[Warning] 未定義のパスへのアクセス: ${req.url}`);
        res.writeHead(404);
        res.end();
    }
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
