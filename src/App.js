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
  const [showInquiryForm, setShowInquiryForm] = useState(false);
  const [inquiryText, setInquiryText] = useState('');
  const [sortKey, setSortKey] = useState('');
  const [historyReady, setHistoryReady] = useState(false);
  const [category, setCategory] = useState('');
  const [keyword, setKeyword] = useState('');
  const [period, setPeriod] = useState('');
  const [txtSaleName, setTxtSaleName] = useState('');
  const [cbotype, setCbotype] = useState('');
  const [txtCompName, setTxtCompName] = useState('');
  const [cboClass, setCboClass] = useState('');
  const [loading, setLoading] = useState(false);
  const [sortOrder, setSortOrder] = useState('asc'); 
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
  const totalCost = useRef(0);

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

    
  const handleSocketDisconnected = (message = 'WebSocketが切断されました。') => {
    // ボタン復帰（disabled条件で使っているstateを解除）
    setLoading(false);
    setHistoryLoading(false);
    // 必要なら履歴モードも解除（検索欄を即使えるようにする場合）
    setShowHistory(false);

    // ステータスメッセージ更新
    setStatusMessage(`${message} 再接続したため、操作を継続できます。`);

    // アラート通知
    alert(`${message}\n\n再接続を試行します。操作は継続できます。`);
  };

    socket.onopen = () => {
      // 接続成功
      console.log("✅ WebSocket接続成功");
      
      if (typeof onOpenCallback === 'function') {
          onOpenCallback();
        }
    };

    socket.onmessage = (event) => {
      console.log("📩 メッセージ受信:", event.data);
      const data = JSON.parse(event.data);   
      
    // 履歴0件（＝一致する履歴ファイルなし）
      if (data.type === "status" && data.message === "一致する履歴ファイルが見つかりませんでした。") {
        setStatusMessage(data.message);
        setHistoryData([]);          // 念のため空に
        setHistoryLoading(false);    // ← これがないと戻るボタンが出ない
        return;
      }

      // Bedrock推定費用
      if (data.type === "cost" && data.message === "Bedrock推定費用" && data.data?.USD) {
        totalCost.current += data.data.USD;
        console.log(`💰 現在の累計コスト: $${totalCost.current.toFixed(6)}`);
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
        alert("⚠️ 検索件数が多すぎます。\nページを更新してから再度お試しください。");
        window.location.reload();
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

      // 全件完了
      if (data.message === "全件の処理が完了しました") {
        setLoading(false);
        setStatusMessage("全件の処理が完了しました！ファイル形式を選択してダウンロードできます！");
        alert("✅ 全件の処理が完了しました！");
        return;
      }

      // 履歴から戻るボタン
      if (data.type === "status" && data.message === "履歴ファイルの確認が完了しました。") {
        setStatusMessage(data.message);
        setHistoryReady(true);
        setHistoryLoading(false);
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
      handleSocketDisconnected("接続エラーが発生しました。");
    };   
    
socket.onclose = () => {
      console.warn("⚠️ WebSocket接続が切断されました。");
      handleSocketDisconnected("WebSocketが切断されました。");
      // 少し待ってから再接続
      setTimeout(() => {
        connectWebSocket();
      }, 1500);
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
    /*if (!period) {
      errors.push("期間を選択してください。");
      newInputErrors.period = true;
    }*/
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

    totalCost.current = 0;
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
    
const payload = {
    userEmail,
    keyword,
    source: category,
  };

  if (period) payload.period = period;                 // 任意
  if (txtSaleName) payload.txtSaleName = txtSaleName;  // 任意
  if (cbotype) payload.cbotype = Number(cbotype);      // 任意（数字で送る）
  if (txtCompName) payload.txtCompName = txtCompName;  // 任意
  if (cboClass) payload.cboClass = Number(cboClass);   // 任意（数字で送る）

  const message = { action: "sendMessage", data: payload };
  const message2 = { action: "PMDA", data: payload };

    socketRef.current.send(JSON.stringify(message2));
    socketRef.current.send(JSON.stringify(message));
  };

  // リセット
  const handleReset = () => {
    //setEmail('');
    setCategory('');
    setKeyword('');
    setPeriod('');
    setTxtSaleName('');
    setCbotype('');
    setTxtCompName('');
    setCboClass('');
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
  setShowHistory(false); 
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
  //setResults([]);
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
      let comparison = 0;

      if (sortKey === "製品ID") {
        const idA = a.timestamp ? a.timestamp.split('#')[1] : '';
        const idB = b.timestamp ? b.timestamp.split('#')[1] : '';
        comparison = idA.localeCompare(idB, 'ja', { numeric: true });
      } else if (sortKey === "掲載年月日") {
        const dateA = a['掲載年月日'] ? new Date(a['掲載年月日']) : new Date(0);
        const dateB = b['掲載年月日'] ? new Date(b['掲載年月日']) : new Date(0);
        comparison = dateA - dateB; // 昇順
      } else {
        const valA = a[sortKey] || '';
        const valB = b[sortKey] || '';
        comparison = valA.localeCompare(valB, 'ja', { numeric: true });
      }

      return sortOrder === 'asc' ? comparison : -comparison;
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

const handleInquirySubmit = () => {
  if (!inquiryText.trim()) {
    alert('問い合わせ内容を入力してください。');
    return;
  }

  const supportEmail = "ryunosuke.ishikawa@terumo.co.jp;taiju.kamitani@terumo.co.jp;shoki.yashiki@terumo.co.jp"; // 宛先
  const subject = encodeURIComponent("【お問い合わせ】有害事象検索システム");
  const body = encodeURIComponent(`以下の内容でお問い合わせします。\n\n${inquiryText}`);

  // Outlookを開く
  window.location.href = `mailto:${supportEmail}?subject=${subject}&body=${body}`;

  setInquiryText('');
  setShowInquiryForm(false);
};


  return (
<div className="app-container">
    <div className="sidebar">
        <h2>検索条件</h2>
        
        <label htmlFor="sourceSelect" style={{ fontWeight: 'bold' }}>
          カテゴリ <span style={{ color: 'red', fontSize: '12px' }}>*</span>
        </label>
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
        
        <label style={{ fontWeight: 'bold' }}>
          全文検索キーワード <span style={{ color: 'red', fontSize: '12px' }}>*</span>
        </label>
        <input
          type="text"
          placeholder="キーワードを入力"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          style={inputErrors.keyword ? { border: '2px solid #dc3545' } : {}}
          disabled={showHistory || loading} 
        />

        <label htmlFor="yearSelect">年度</label>
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

        {/* 一般名・製品名 */}
        <label>一般名・製品名</label>
        <input
          type="text"
          placeholder="製品名を入力"
          value={txtSaleName}
          onChange={e => setTxtSaleName(e.target.value)}
          disabled={showHistory || loading}
        />

        {/* 種類 */}
        <label htmlFor="cbotype">種類</label>
        <select
          id="cbotype"
          value={cbotype}
          onChange={e => setCbotype(e.target.value)}
          disabled={showHistory || loading}
        >
          <option value="">選択してください</option>
          <option value="1">医薬品</option>
          <option value="2">化粧品</option>
          <option value="3">医薬部外品</option>
          <option value="4">医療機器</option>
          <option value="6">再生医療等製品</option>
        </select>

        {/* 製造販売業者等名称 */}
        <label>製造販売業者等名称</label>
        <input
          type="text"
          placeholder="会社名を入力"
          value={txtCompName}
          onChange={e => setTxtCompName(e.target.value)}
          disabled={showHistory || loading}
        />

        {/* クラス */}
        <label htmlFor="cboClass">クラス</label>
        <select
          id="cboClass"
          value={cboClass}
          onChange={e => setCboClass(e.target.value)}
          disabled={showHistory || loading}
        >
          <option value="">選択してください</option>
          <option value="1">クラスⅠ</option>
          <option value="2">クラスⅡ</option>
          <option value="3">クラスⅢ</option>
        </select>

        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
          <button onClick={handleReset} className="reset-button" disabled={showHistory || loading}>
            リセット
          </button>
          <button onClick={handleSearch} className="search-button" disabled={showHistory || loading}>
            {loading ? "検索中..." : "検索"}
          </button>
        </div>
        {loading && (
          <div id="loadingMessage" style={{ marginTop: 10, display: 'block' }}>
            🔄 検索中です...
          </div>
        )}
      </div>
      
<div className="main">
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
          onClick={() => setShowInquiryForm(prev => !prev)}
          style={{
            backgroundColor: '#008D61',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '4px 8px',
            fontSize: '12px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          問い合わせ
        </button>

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

{showInquiryForm && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0,
          width: '100vw', height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.4)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#fff',
            padding: '20px',
            borderRadius: '8px',
            width: '400px',
            boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
          }}>
            <h3>お問い合わせ</h3>
            <textarea
              value={inquiryText}
              onChange={(e) => setInquiryText(e.target.value)}
              placeholder="問題の詳細を入力してください"
              style={{ width: '100%', height: '100px', marginBottom: '10px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShowInquiryForm(false)}>キャンセル</button>
              <button
                onClick={handleInquirySubmit}
                style={{ backgroundColor: '#008D61', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px' }}
              >
                送信
              </button>
            </div>
          </div>
        </div>
      )}

        <div style={{ flex: 2 }}>
        <h2>検索結果</h2>

{!showHistory && (
<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
  <select
    id="sortSelect"
    value={sortKey}
    onChange={e => setSortKey(e.target.value)}
    disabled={showHistory || results.length === 0}
  >
    <option value="">選択してください</option>
    <option value="製品ID">製品ID</option>
    <option value="掲載年月日">掲載年月日</option>
    <option value="種類">種類</option>
    <option value="クラス">クラス</option>
    <option value="一般名称">一般名称</option>
    <option value="販売名">販売名</option>
    <option value="製造販売業者の名称">製造販売業者の名称</option>
  </select>

  {/* 昇順・降順トグル */}
  <button
    onClick={() => setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))}
    style={{
      width: '80px',
      padding: '4px 10px',
      fontSize: '14px',
      cursor: 'pointer',
      backgroundColor: '#6c757d',
      color: '#fff',
      border: 'none',
      borderRadius: '4px',
    }}
  >
    {sortOrder === 'asc' ? '昇順 ▲' : '降順 ▼'}
  </button>

  {/* 並び替え実行 */}
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
      <div style={{ marginBottom: '8px' }}>
        <strong>製品ID：</strong> {r.timestamp ? r.timestamp.split('#')[1] : '不明'}　
        <strong>掲載年月日：</strong> {r['掲載年月日'] || '不明'}　
        <strong>種類：</strong> {r['種類'] || '不明'}　
        <strong>クラス：</strong> {r['クラス'] || '不明'}
      </div>
      <strong>一般名称：</strong> {r['一般名称'] || '不明'}<br />
      <strong>販売名：</strong> {r['販売名'] || '不明'}<br />
      <strong>製造販売業者の名称：</strong> {r['製造販売業者の名称'] || '不明'}<br />
      <strong>現象・リスク分析：</strong><br />
      <pre style={{ whiteSpace: 'pre-wrap' }}>{r['現象・リスク分析']}</pre>
    </div>
  ))}
</div>

)}

{showHistory && !historyLoading && (
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
      marginTop: '20px',
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
    
<div className="history-button-container">
  <button onClick={handleHistory} className="history-button" disabled={loading || historyLoading}>
    履歴
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
