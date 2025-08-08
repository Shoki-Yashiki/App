import React, { useState, useRef } from 'react';
import './App.css';
import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import awsconfig from './aws-exports';

// Amplifyの初期化
Amplify.configure(awsconfig);
function AppContent({ signOut, user }) {
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('');
  const [keyword, setKeyword] = useState('');
  const [period, setPeriod] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ received: 0, total: 0 });
  const [results, setResults] = useState([]);
  const [csvUrl, setCsvUrl] = useState('');
  const [excelUrl, setExcelUrl] = useState('');
  const [exportFormat, setExportFormat] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [inputErrors, setInputErrors] = useState({
    email: false,
    category: false,
    keyword: false,
    period: false,
  });
  const socketRef = useRef(null);

  // WebSocket接続
  const connectWebSocket = (onOpenCallback) => {
    if (socketRef.current) {
      socketRef.current.close();
    }
    const socket = new window.WebSocket("wss://b96kdpstti.execute-api.ap-northeast-1.amazonaws.com/dev/");
    socketRef.current = socket;

    socket.onopen = () => {
      // 接続成功
      if (onOpenCallback) onOpenCallback();
    };

    socket.onmessage = (event) => {
      console.log("📩 メッセージ受信:", event.data);
      const data = JSON.parse(event.data);    
      
      if (data.type === "status" && data.message) {
        setStatusMessage(data.message); // 最新の1件だけ保持
        return;
      }

      // CSVダウンロード
      if (data.message === "CSVファイルが生成されました。以下のリンクからダウンロードできます。" && data.url) {
        setCsvUrl(data.url);
        return;
      }

      // Excelダウンロード
      if (data.message === "Excelファイルが生成されました。以下のリンクからダウンロードできます。" && data.url) {
        setExcelUrl(data.url);
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
    setStatusMessage('');
    setResults([]);
    setProgress({ received: 0, total: 0 });

    if (!socketRef.current || socketRef.current.readyState !== 1) {
      // 接続後にメッセージ送信
      connectWebSocket(() => sendSearchMessage());
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
    setCsvUrl('');
    setExcelUrl('');
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
    if (exportFormat === 'csv') {
      if (!csvUrl) {
        alert("CSVファイルがまだ生成されていません。");
        return;
      }
      window.open(csvUrl, '_blank');
      return;
    }
    if (exportFormat === 'xlsx') {
      if (!excelUrl) {
        alert("Excelファイルがまだ生成されていません。");
        return;
      }
      window.open(excelUrl, '_blank');
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
          disabled={loading}
        />

        <label htmlFor="sourceSelect">カテゴリ</label>
        <select
          id="sourceSelect"
          value={category}
          onChange={e => setCategory(e.target.value)}
          style={inputErrors.category ? { border: '2px solid #dc3545' } : {}}
          disabled={loading}
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
          disabled={loading}
        />

        <label htmlFor="yearSelect">期間</label>
        <select
          id="yearSelect"
          value={period}
          onChange={e => setPeriod(e.target.value)}
          style={inputErrors.period ? { border: '2px solid #dc3545' } : {}}
          disabled={loading}
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
        <button className="history-button" onClick={handleHistory} disabled={loading}>履歴</button>
        <button
          className="signout-btn"
          style={{
            marginTop: 20,
            width: '100%',
            minWidth: 80,
            background: '#f4f7f6',
            color: '#888',
            border: 'none',
            boxShadow: 'none',
            fontWeight: 'bold',
            fontSize: 16,
            cursor: 'pointer'
          }}
          onClick={signOut}
        >
          サインアウト
        </button>
      </div>

      <div className="main" style={{ position: 'relative' }}>
        <div style={{
          position: 'absolute',
          top: 0,
          right: 0,
          padding: '8px 16px',
          color: '#008D61',
          fontWeight: 'bold',
          fontSize: 14,
          background: 'rgba(255,255,255,0.8)',
          borderBottomLeftRadius: 8
        }}>
          {user?.signInDetails?.loginId ||
          user?.attributes?.email ||
          user?.attributes?.preferred_username ||
          user?.username ||
          'ユーザー'} がサインインしています
      
        </div>
        <h2>検索結果</h2>
        

{statusMessage && (
  <div
    className="status-display"
    style={{
      marginBottom: 20,
      padding: 10,
      border: '1px solid #ccc',
      borderRadius: 8,
      backgroundColor: '#f0f0f0',
    }}
  >
    <h4>📡 ステータス</h4>
    <div>✅ {statusMessage}</div>
  </div>
)}


        <div id="progressDisplay" style={{ marginBottom: 10, fontWeight: 'bold', color: '#008D61' }}>
          {progress.received}件 / {progress.total}件
        </div>
        <div className="results">
          {results.map((r, i) => (
            <div key={i} style={{ marginBottom: 20, padding: 15, border: '1px solid #008D61', borderRadius: 8, backgroundColor: '#f9fdfc' }}>
              <strong>製品ID:</strong> {r.timestamp ? r.timestamp.split('#')[1] : '不明'}<br />
              <strong>一般名称:</strong> {r['一般名称'] || '不明'}
              <br />
              <strong>販売名:</strong> {r['販売名'] || '不明'}
              <br />
              <strong>製造販売業者の名称:</strong> {r['製造販売業者の名称'] || '不明'}
              <br />
              <strong>現象・リスク分析:</strong>
              <br />
              <pre style={{ whiteSpace: 'pre-wrap' }}>{r['現象・リスク分析']}</pre>
            </div>
          ))}

        </div>
        <div className="export-section">
  <select
    id="exportFormat"
    value={exportFormat}
    onChange={e => setExportFormat(e.target.value)}
    disabled={loading}
  >
    <option value="">選択してください</option>
    <option value="csv">CSV</option>
    <option value="xlsx">XLSX</option>
  </select>
  <button
    onClick={handleExport}
    disabled={loading}
    className={
      !loading &&
      (
        (exportFormat === 'csv' && csvUrl) ||
        (exportFormat === 'xlsx' && excelUrl)
      )
        ? 'export-ready'
        : ''
    }
    style={{
      background:
        !loading &&
        (
          (exportFormat === 'csv' && csvUrl) ||
          (exportFormat === 'xlsx' && excelUrl)
        )
          ? '#008D61' // ダウンロード可能時の色
          : '#e0e0e0', // 通常時の色
      color:
        !loading &&
        (
          (exportFormat === 'csv' && csvUrl) ||
          (exportFormat === 'xlsx' && excelUrl)
        )
          ? '#fff'
          : '#888',
      fontWeight: 'bold',
      marginLeft: 8,
      cursor:
        !loading &&
        (
          (exportFormat === 'csv' && csvUrl) ||
          (exportFormat === 'xlsx' && excelUrl)
        )
          ? 'pointer'
          : 'not-allowed'
    }}
  >
    出力
  </button>
</div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Authenticator>
      {({ signOut, user }) => (
        <AppContent signOut={signOut} user={user} />
      )}
    </Authenticator>
  );
}