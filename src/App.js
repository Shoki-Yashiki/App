import React, { useState, useRef } from 'react';
import './App.css';
import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import awsconfig from './aws-exports';

// Amplifyの初期化
Amplify.configure(awsconfig);
function AppContent({ signOut, user }) {
  //const [email, setEmail] = useState('');
  const [sortKey, setSortKey] = useState('');
  const [historyReady, setHistoryReady] = useState(false);
  const [category, setCategory] = useState('');
  const [keyword, setKeyword] = useState('');
  const [period, setPeriod] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [progress, setProgress] = useState({ received: 0, total: 0 });
  const [results, setResults] = useState([]);
  const [csvUrl, setCsvUrl] = useState('');
  const [excelUrl, setExcelUrl] = useState('');
  const [exportFormat, setExportFormat] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [historyData, setHistoryData] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [inputErrors, setInputErrors] = useState({
    //email: false,
    category: false,
    keyword: false,
    period: false,
  });
  const socketRef = useRef(null);

  // WebSocket接続
  const connectWebSocket = (onOpenCallback) => {
    if (socketRef.current) {   
    socketRef.current.onopen = null;
    socketRef.current.onmessage = null;
    socketRef.current.onerror = null;
    socketRef.current.onclose = null;
      socketRef.current.close();
    }
    const socket = new window.WebSocket("wss://b96kdpstti.execute-api.ap-northeast-1.amazonaws.com/dev/");
    socketRef.current = socket;

    socket.onopen = () => {
      // 接続成功
      console.log("✅ WebSocket接続成功");
      
      if (typeof onOpenCallback === 'function') {
          onOpenCallback();
        }
    };

    
    const COST_PER_ITEM = 0.001; // 1件あたりのコスト（ドル）
    let currentSearchId = null;
    let currentTotalCount = 0;

    socket.onmessage = (event) => {
      console.log("📩 メッセージ受信:", event.data);
      const data = JSON.parse(event.data);   

      
// 総検索件数を受信
  if (data.message === "総検索件数" && typeof data.data === 'number') {
    currentTotalCount = data.data;
    currentSearchId = `${keyword}-${Date.now()}`;
    console.log(`🔍 検索開始: ID=${currentSearchId}, 件数=${currentTotalCount}`);
    setProgress({ received: 0, total: data.data });
    setResults([]);
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
      
      // エラーメッセージの処理
      if (data.type === "error" && data.data?.includes("ThrottlingException")) {
        alert("⚠️ 検索件数が多すぎます。\nページを更新してから条件を絞って再度お試しください。");
        return;
      }

      // 総検索件数
      if (data.message === "総検索件数" && typeof data.data === 'number') {
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

      // 全件完了を受信 → コスト計算
  if (data.message === "全件の処理が完了しました") {
    const totalCost = currentTotalCount * COST_PER_ITEM;
    console.log(`✅ 検索完了: ID=${currentSearchId}, 件数=${currentTotalCount}, コスト=$${totalCost.toFixed(4)}`);
    setLoading(false);
    setStatusMessage("全件の処理が完了しました！ファイル形式を選択してダウンロードできます！");
    alert("✅ 全件の処理が完了しました！");
    return;
  }

      // 履歴から戻るボタン
      if (data.type === "status" && data.message === "履歴ファイルの確認が完了しました。") {
        setStatusMessage(data.message);
        setHistoryReady(true);
        return;
      }

      // 0件
      if (data.message === "条件に該当する回収情報はありませんでした。") {
        setLoading(false);
        alert("⚠️ 条件に該当する回収情報はありませんでした。");
        return;
      }

      // 最新の1件だけ保持
      if (data.type === "status" && data.message) {
        setStatusMessage(data.message);
        return;
      }

      if (
  (data.message === "EXCEL形式の履歴ファイルです。" || data.message === "CSV形式の履歴ファイルです。") &&
  data.data &&
  data.url
) {
  const newEntry = {
    keyword: data.data["全文検索キーワード"],
    period: data.data["検索年度"],
    timestamp: data.data["検索日時"]
  };

  setHistoryData(prev => {
    const existingIndex = prev.findIndex(item =>
      item.keyword === newEntry.keyword &&
      item.period === newEntry.period &&
      item.timestamp === newEntry.timestamp
    );

    if (existingIndex !== -1) {
      const updated = [...prev];
      if (data.message.includes("CSV")) {
        updated[existingIndex].csvUrl = data.url;
      } else {
        updated[existingIndex].excelUrl = data.url;
      }
      return updated;
    } else {
      return [
        {
          ...newEntry,
          csvUrl: data.message.includes("CSV") ? data.url : '',
          excelUrl: data.message.includes("Excel") ? data.url : ''
        },
        ...prev
      ];
    }
  });

  setStatusMessage("検索履歴を照会中...");
  setHistoryLoading(false);
  return;
}


      //console.log("📄 履歴メッセージ受信:", data);
    };

    socket.onerror = () => {
      setLoading(false);
      alert("接続が切断されました。ページを更新してください( TДT)");
    };
    
    socket.onclose = () => {
        console.warn("⚠️ WebSocket接続が切断されました。");
        alert("接続が切断されました。ページを更新してください( TДT)");
        connectWebSocket();
    };
  };
  
const ensureWebSocketConnection = (callback) => {
  if (!socketRef.current || socketRef.current.readyState !== 1) {
    connectWebSocket(callback);
  } else {
    callback();
  }
};

  // 検索
  const handleSearch = () => {
    // 入力チェック
    let errors = [];
    let newInputErrors = {
      //email: false,
      category: false,
      keyword: false,
      period: false,
    };
    /*if (!email) {
      errors.push("メールアドレスを入力してください。");
      newInputErrors.email = true;
    }*/
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
    
    // FDA未実装チェック
    if (category === 'FDA') {
      alert("⚠️ FDAカテゴリでの検索は現在未実装です。Coming soon...");
      setLoading(false);
      return;
    }

    setLoading(true);
    setStatusMessage('');
    setResults([]);
    setProgress({ received: 0, total: 0 });
  
  ensureWebSocketConnection(() => {
    sendSearchMessage();
  });
};

  // メッセージ送信
  const sendSearchMessage = () => {
    const userEmail =
    user?.attributes?.email ||
    user?.signInDetails?.loginId ||
    user?.attributes?.preferred_username ||
    user?.username;

    if (!socketRef.current || socketRef.current.readyState !== 1) {
      alert("⚠️ WebSocketが未接続です。");
      setLoading(false);
      return;
    }
    const message = {
      action: "sendMessage",
      data: { userEmail, keyword, period, source: category }
    };
    const message2 = {
      action: "PMDA",
      data: { userEmail, keyword, period, source: category }
    };
    socketRef.current.send(JSON.stringify(message2));
    socketRef.current.send(JSON.stringify(message));
  };

  // リセット
  const handleReset = () => {
    //setEmail('');
    setCategory('');
    setKeyword('');
    setPeriod('');
    setResults([]);
    setProgress({ received: 0, total: 0 });
    setCsvUrl('');
    setExcelUrl('');
    setStatusMessage(''); 
    setInputErrors({
      //email: false,
      category: false,
      keyword: false,
      period: false,
    });
  };

const handleBackToSearchResults = () => {
  setShowHistory(false);
  setStatusMessage(''); // ステータスをクリア
  setHistoryLoading(false); 
  setHistoryData([]);
};

const handleHistory = () => {
  if (showHistory || historyLoading) return; 

  const userEmail =
    user?.attributes?.email ||
    user?.signInDetails?.loginId ||
    user?.attributes?.preferred_username ||
    user?.username;

  if (!userEmail) {
    alert("ユーザーのメールアドレスが取得できませんでした。");
    return;
  }

  setHistoryReady(false);
  setHistoryLoading(true); 
  setShowHistory(true);
  setResults([]);
  setStatusMessage("履歴を取得中...");

  const message3 = {
    action: "history",
    data: userEmail
  };

if (!socketRef.current || socketRef.current.readyState !== 1) {
  connectWebSocket(() => {
    socketRef.current.send(JSON.stringify(message3)); // ← 再接続後に履歴取得メッセージ送信
  });
} else {
  socketRef.current.send(JSON.stringify(message3));
}
};

const sortResults = () => {
  if (!sortKey) {
    alert("⚠️ ソート対象を選択してください。");
    return;
  }

  setResults(prev =>
    [...prev].sort((a, b) => {
      const valA = a[sortKey] || '';
      const valB = b[sortKey] || '';
      return valA.localeCompare(valB, 'ja');
    })
  );
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

        <label htmlFor="sourceSelect">カテゴリ</label>
        <select
          id="sourceSelect"
          value={category}
          onChange={e => setCategory(e.target.value)}
          style={inputErrors.category ? { border: '2px solid #dc3545' } : {}}
          disabled={showHistory || loading} 
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
          disabled={showHistory || loading} 
        />

        <label htmlFor="yearSelect">期間</label>
        <select
          id="yearSelect"
          value={period}
          onChange={e => setPeriod(e.target.value)}
          style={inputErrors.period ? { border: '2px solid #dc3545' } : {}}
          disabled={showHistory || loading} 
        >
          <option value="">選択してください</option>
          <option value="2023">2023</option>
          <option value="2024">2024</option>
          <option value="2025">2025</option>
        </select>

        <button onClick={handleReset} className="reset-button" disabled={showHistory || loading} >リセット</button>
        <button onClick={handleSearch} className="search-button" disabled={showHistory || loading} >
          {loading ? "検索中..." : "検索"}
        </button>
        {loading && (
          <div id="loadingMessage" style={{ marginTop: 10, display: 'block' }}>
            🔄 検索中です...
          </div>
        )}
        <button className="history-button" onClick={handleHistory} disabled={loading || historyLoading} >履歴</button>
      </div>

      <div className="main" style={{ display: 'flex', flexDirection: 'row', gap: '20px', width: '100%' }}>

<div style={{
  position: 'absolute',
  top: 0,
  right: 0,
  padding: '8px 16px',
  background: 'rgba(255,255,255,0.8)',
  borderBottomLeftRadius: 8,
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  fontSize: '14px',
  color: '#008D61',
  fontWeight: 'bold'
}}>
  <span>
    {user?.signInDetails?.loginId ||
    user?.attributes?.email ||
    user?.attributes?.preferred_username ||
    user?.username ||
    'ユーザー'} サインインしています
  </span>
  <button
    onClick={signOut}
    style={{
      backgroundColor: '#f4f7f6',
      color: '#888',
      border: '1px solid #ccc',
      borderRadius: '4px',
      padding: '2px 4px',
      fontSize: '12px',
      fontWeight: 'bold',
      cursor: 'pointer'
    }}
  >
    サインアウト
  </button>
</div>

        <div style={{ flex: 2 }}>
        <h2>検索結果</h2>

{!showHistory && (
<div style={{ marginBottom: '1px', display: 'flex', alignItems: 'center', gap: '4px' }}>
  <label htmlFor="sortSelect"></label>
  <select
    id="sortSelect"
    value={sortKey}
    onChange={e => setSortKey(e.target.value)}
    disabled={showHistory || results.length === 0}
  >
    <option value="">選択してください</option>
    <option value="一般名称">一般名称</option>
    <option value="販売名">販売名</option>
    <option value="製造販売業者の名称">製造販売業者の名称</option>
  </select>
  <button
    onClick={sortResults}
    disabled={showHistory || results.length === 0}
    style={{
      padding: '4px 10px',
      fontSize: '14px',
      cursor: 'pointer',
      backgroundColor: '#008D61',
      color: '#fff',
      border: 'none',
      borderRadius: '4px'
    }}
  >
    並び替え
  </button>
</div>
)}

{!showHistory && (
  <div id="progressDisplay" style={{
    marginBottom: 10,
    fontWeight: 'bold',
    color: '#008D61',
    display: 'flex',
    alignItems: 'center',
    gap: '20px'
  }}>
    <div>{progress.received}件 / {progress.total}件</div>
    <div style={{ color: '#555', fontWeight: 'normal' }}>
      {statusMessage || ''}
    </div>
  </div>
)}

{showHistory ? (
  
<div className="history-results" style={{
    maxHeight: '60vh',
    overflowY: 'auto',
    paddingRight: '10px'
  }}>
    <h2>履歴一覧</h2>
    
<div style={{
  marginBottom: 10,
  fontWeight: 'bold',
  color: '#888',
  display: statusMessage ? 'block' : 'none'
}}>
  {statusMessage}
</div>

    {historyData.length === 0 ? (
      <p>履歴がありません。</p>
    ) : ( 

historyData.map((item, index) => (
  <div key={index} style={{ marginBottom: 20, padding: 15, border: '1px solid #ccc', borderRadius: 8 }}>
    <strong>検索日時:</strong> {new Date(item.timestamp).toLocaleString()}<br />
    <strong>キーワード:</strong> {item.keyword}<br />
    <strong>検索年度:</strong> {item.period}<br />
    <strong>結果ファイル:</strong><br />
    {item.csvUrl && (
      <a href={item.csvUrl} target="_blank" rel="noopener noreferrer" style={{ marginRight: '10px' }}>
        CSVダウンロード
      </a>
    )}
    {item.excelUrl && (
      <a href={item.excelUrl} target="_blank" rel="noopener noreferrer">
        Excelダウンロード
      </a>
    )}
  </div>
))

    )}
  </div>

) : (

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

)}

{showHistory && historyReady && (
  <button
    onClick={handleBackToSearchResults}
    style={{
      backgroundColor: '#008D61',
      color: '#fff',
      fontWeight: 'bold',
      fontSize: '16px',
      padding: '10px 20px',
      borderRadius: '8px',
      border: 'none',
      cursor: 'pointer',
      marginBottom: '20px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
    }}
  >
    検索結果に戻る
  </button>
)}
        </div>

        
{!showHistory && (
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
            ? '#008D61'
            : '#e0e0e0',
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
)}
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
