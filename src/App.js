import React, { useState, useRef } from 'react';
import './App.css';

function App() {
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('');
  const [keyword, setKeyword] = useState('');
  const [period, setPeriod] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ received: 0, total: 0 });
  const [results, setResults] = useState([]);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [exportFormat, setExportFormat] = useState('');
  const [inputErrors, setInputErrors] = useState({
    email: false,
    category: false,
    keyword: false,
    period: false,
  });
  const socketRef = useRef(null);

  // WebSocket接続
  const connectWebSocket = () => {
    if (socketRef.current) {
      socketRef.current.close();
    }
    const socket = new window.WebSocket("wss://b96kdpstti.execute-api.ap-northeast-1.amazonaws.com/dev/");
    socketRef.current = socket;

    socket.onopen = () => {
      // 接続成功
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      // CSVダウンロード
      if (data.message === "CSVファイルが生成されました。以下のリンクからダウンロードできます。" && data.url) {
        setDownloadUrl(data.url);
        return;
      }

      // 総検索件数
      if (data.message === "総検索件数") {
        setProgress({ received: 0, total: data.data });
        setResults([]);
        return;
      }

      // 分析結果
      if (data.message === "分析結果" && data.data) {
        setProgress(prev => ({ ...prev, received: prev.received + 1 }));
        setResults(prev => [...prev, data.data]);
        return;
      }

      // 全件完了
      if (data.message === "全件の処理が完了しました") {
        setLoading(false);
        alert("✅ 全件の処理が完了しました！");
        return;
      }

      // 0件
      if (data.message === "条件に該当する回収情報はありませんでした。") {
        setLoading(false);
        alert("⚠️ 条件に該当する回収情報はありませんでした。");
        return;
      }
    };

    socket.onerror = () => {
      setLoading(false);
      alert("⚠️ サーバーとの接続に失敗しました。");
    };
  };

  // 検索
  const handleSearch = () => {
    // 入力チェック
    let errors = [];
    let newInputErrors = {
      email: false,
      category: false,
      keyword: false,
      period: false,
    };
    if (!email) {
      errors.push("メールアドレスを入力してください。");
      newInputErrors.email = true;
    }
    if (!category) {
      errors.push("カテゴリを選択してください。");
      newInputErrors.category = true;
    }
    if (!keyword) {
      errors.push("キーワードを入力してください。");
      newInputErrors.keyword = true;
    }
    if (!period) {
      errors.push("期間を選択してください。");
      newInputErrors.period = true;
    }
    setInputErrors(newInputErrors);

    if (errors.length > 0) {
      alert("⚠️ 入力に不備があります:\n\n" + errors.join("\n"));
      return;
    }

    setLoading(true);
    setResults([]);
    setDownloadUrl('');
    setProgress({ received: 0, total: 0 });

    if (!socketRef.current || socketRef.current.readyState !== 1) {
      connectWebSocket();
      setTimeout(() => sendSearchMessage(), 500); // 接続待ち
    } else {
      sendSearchMessage();
    }
  };

  // メッセージ送信
  const sendSearchMessage = () => {
    if (!socketRef.current || socketRef.current.readyState !== 1) {
      alert("⚠️ WebSocketが未接続です。");
      setLoading(false);
      return;
    }
    const message = {
      action: "sendMessage",
      data: { keyword, period, source: category, email }
    };
    const message2 = {
      action: "PMDA",
      data: { keyword, period, source: category, email }
    };
    socketRef.current.send(JSON.stringify(message2));
    socketRef.current.send(JSON.stringify(message));
  };

  // リセット
  const handleReset = () => {
    setEmail('');
    setCategory('');
    setKeyword('');
    setPeriod('');
    setResults([]);
    setProgress({ received: 0, total: 0 });
    setDownloadUrl('');
    setInputErrors({
      email: false,
      category: false,
      keyword: false,
      period: false,
    });
  };

  // ダミー履歴
  const handleHistory = () => {
    alert("履歴機能は未実装です。");
  };

  // 出力
  const handleExport = () => {
    if (!exportFormat) {
      alert("出力形式を選択してください。");
      return;
    }
    alert(`「${exportFormat.toUpperCase()}」形式での出力は未実装です。`);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100vw', justifyContent: 'center'}}>
      <div className="sidebar">
        <h2>検索条件</h2>
        <label>メールアドレス</label>
        <input
          type="text"
          placeholder="メールアドレスを入力"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={inputErrors.email ? { border: '2px solid #dc3545' } : {}}
        />

        <label htmlFor="sourceSelect">カテゴリ</label>
        <select
          id="sourceSelect"
          value={category}
          onChange={e => setCategory(e.target.value)}
          style={inputErrors.category ? { border: '2px solid #dc3545' } : {}}
        >
          <option value="">選択してください</option>
          <option value="PMDA">PMDA</option>
          <option value="FDA">FDA</option>
        </select>

        <label>全文検索キーワード</label>
        <input
          type="text"
          placeholder="キーワードを入力"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          style={inputErrors.keyword ? { border: '2px solid #dc3545' } : {}}
        />

        <label htmlFor="yearSelect">期間</label>
        <select
          id="yearSelect"
          value={period}
          onChange={e => setPeriod(e.target.value)}
          style={inputErrors.period ? { border: '2px solid #dc3545' } : {}}
        >
          <option value="">選択してください</option>
          <option value="2023">2023</option>
          <option value="2024">2024</option>
          <option value="2025">2025</option>
        </select>

        <button onClick={handleReset} className="reset-button" disabled={loading}>リセット</button>
        <button onClick={handleSearch} className="search-button" disabled={loading}>
          {loading ? "検索中..." : "検索"}
        </button>
        {loading && (
          <div id="loadingMessage" style={{ marginTop: 10, display: 'block' }}>
            🔄 検索中です...
          </div>
        )}
        <button className="history-button" onClick={handleHistory}>履歴</button>
      </div>

      <div className="main">
        <h2>検索結果</h2>
        <div id="progressDisplay" style={{ marginBottom: 10, fontWeight: 'bold', color: '#008D61' }}>
          {progress.received}件 / {progress.total}件
        </div>
        <div className="results">
          {results.map((r, i) => (
            <div key={i} style={{ marginBottom: 20, padding: 15, border: '1px solid #008D61', borderRadius: 8, backgroundColor: '#f9fdfc' }}>
              <strong>製品ID:</strong> {r.timestamp ? r.timestamp.split('#')[1] : '不明'}<br /><br />
              <strong>回収理由:</strong><br />
              <pre style={{ whiteSpace: 'pre-wrap' }}>{r.回収理由}</pre><br />
              <strong>危惧される具体的な健康被害:</strong><br />
              <pre style={{ whiteSpace: 'pre-wrap' }}>{r.危惧される具体的な健康被害}</pre><br />
              <strong>現象・リスク分析:</strong><br />
              <pre style={{ whiteSpace: 'pre-wrap' }}>{r['現象・リスク分析']}</pre>
            </div>
          ))}
          {downloadUrl && (
            <div style={{ marginTop: 20 }}>
              <a href={downloadUrl} download style={{ color: '#008D61', fontWeight: 'bold' }} target="_blank" rel="noopener noreferrer">
                📥 CSVファイルをダウンロード
              </a>
            </div>
          )}
        </div>
        <div className="export-section">
          <select
            id="exportFormat"
            value={exportFormat}
            onChange={e => setExportFormat(e.target.value)}
          >
            <option value="">選択してください</option>
            <option value="pdf">PDF</option>
            <option value="csv">CSV</option>
            <option value="xlsx">XLSX</option>
          </select>
          <button onClick={handleExport}>出力</button>
        </div>
      </div>
    </div>
  );
}

export default App;