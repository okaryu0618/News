// script.js の冒頭
// 本番環境（Render）ならそのURLを、ローカルならlocalhostを使う
const API_BASE_URL = window.location.origin; 

const localGeminiUrl = `${API_BASE_URL}/api/gemini`;
const localNewsUrl = `${API_BASE_URL}/api/get-news`;
const localSheetUrl = `${API_BASE_URL}/api/save-sheet`;

async function initApp() {
    try {
        console.log("ニュースを取得します...");
        const newsRes = await fetch(localNewsUrl);
        const newsData = await newsRes.json();
        
        const validNews = newsData.news.slice(0, 5);

        if (validNews.length === 0) {
            document.body.innerHTML += "<p>該当するニュースがありませんでした。</p>";
            return;
        }

        validNews.forEach((item, i) => {
            const cardP = document.getElementById(`card-${i+1}`);
            const detailBtn = document.getElementById(`link-${i+1}`);
            
            if (cardP) {
                // AI要約の代わりに、タイトルの詳細を表示
                cardP.innerText = `【最新記事】\n${item.title}`;
            }
            
            if (detailBtn) {
                detailBtn.href = item.link;
                detailBtn.style.display = "inline-block";
                
                // 保存ボタンとして機能させる
                detailBtn.innerText = "シートに保存";
                detailBtn.onclick = async (e) => {
                    e.preventDefault();
                    await fetch(localSheetUrl, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ 
                            title: item.title, 
                            summary: "（要約なし）", 
                            link: item.link 
                        })
                    });
                    alert("スプレッドシートにタイトルを保存しました！");
                    window.open(item.link, '_blank'); // 保存後に記事を開く
                };
            }
        });
        console.log("ニュース5件の表示が完了しました。");
    } catch (e) {
        console.error("エラー:", e);
    }
}

initApp();