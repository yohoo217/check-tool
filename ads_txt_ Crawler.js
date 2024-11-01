// 設定物件維持不變
const CONFIG = {
  SPREADSHEET_ID: '1InVJQMOs2qqoxp1ovFVp_gQQFnzvFR5EKwRsC1xBiBg',  // 試算表的 ID
  BATCH_SIZE: 100,  // 每批處理的行數
  COOKIE: "AOTTERBD_SESSION=757418f543a95a889184e798ec5ab66d4fad04e5-lats=1724229220332&sso=PIg4zu/Vdnn/A15vMEimFlVAGliNhoWlVd5FTvtEMRAFpk/VvBGvAetanw8DLATSLexy9pee/t52uNojvoFS2Q==;aotter=eyJ1c2VyIjp7ImlkIjoiNjNkYjRkNDBjOTFiNTUyMmViMjk4YjBkIiwiZW1haWwiOiJpYW4uY2hlbkBhb3R0ZXIubmV0IiwiY3JlYXRlZEF0IjoxNjc1MzE2NTQ0LCJlbWFpbFZlcmlmaWVkIjp0cnVlLCJsZWdhY3lJZCI6bnVsbCwibGVnYWN5U2VxSWQiOjE2NzUzMTY1NDQ3ODI5NzQwMDB9LCJhY2Nlc3NUb2tlbiI6IjJkYjQyZTNkOTM5MDUzMjdmODgyZmYwMDRiZmI4YmEzZjBhNTlmMDQwYzhiN2Y4NGY5MmZmZTIzYTU0ZTQ2MDQiLCJ1ZWEiOm51bGx9; *Secure-1PSID=vlPPgXupFroiSjP1/A02minugZVZDgIG4K; *Secure-1PSIDCC=g.a000mwhavReSVd1vN09AVTswXkPAhyuW7Tgj8-JFhj-FZya9I_l1B6W2gqTIWAtQUTQMkTxoAwACgYKAW0SARISFQHGX2MiC--NJ2PzCzDpJ0m3odxHhxoVAUF8yKr8r49abq8oe4UxCA0t_QCW0076; *Secure-3PSID=AKEyXzUuXI1zywmFmkEBEBHfg6GRkRM9cJ9BiJZxmaR46x5im*krhaPtmL4Jhw8gQsz5uFFkfbc; _Secure-3PSIDCC=sidts-CjEBUFGohzUF6oK3ZMACCk2peoDBDp6djBwJhGc4Lxgu2zOlzbVFeVpXF4q1TYZ5ba6cEAA",
  COLUMN_INDICES: {
    APP_NAME: 6,  // 應用名稱所在的欄位
    ADS_TXT_URL: 20,  // ads.txt URL 所在的欄位
    ASEAL: 21,  // aseal 的欄位
    TEADS: 22,  // teads 的欄位
    UCFUNNEL: 23,  // ucfunnel 的欄位
    SMAATO: 24,  // smaato 的欄位
    STATUS: 26  // 設置狀態欄位
  }
};

// 工具函數，保持不變
const Utils = {
  // 取得試算表對象
  getSheet: function() {
    return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getActiveSheet();
  },
  
  // 暫停函數，讓腳本在執行期間休息指定的毫秒數
  sleep: function(ms) {
    Utilities.sleep(ms);
  },

  // 建立定時觸發器，會在指定的分鐘數後執行指定的函數
  createTrigger: function(functionName, minutes) {
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === functionName) {
        ScriptApp.deleteTrigger(trigger);  // 刪除已存在的相同函數觸發器
      }
    });

    // 建立新的時間觸發器
    ScriptApp.newTrigger(functionName)
      .timeBased()
      .after(minutes * 60 * 1000)
      .create();
  }
};

// 數據處理器，包含解析與上色顯示的功能，取得各 app trek ads.txt 功能
const DataProcessor = {
  // 獲取數據的函數，根據行數範圍，調用 API 並將結果寫入試算表
  fetchData: function(startRow, endRow) {
    const sheet = Utils.getSheet();
    
    for (let i = startRow; i <= endRow; i++) {
      const appName = sheet.getRange(i, CONFIG.COLUMN_INDICES.APP_NAME).getValue();  // 取得應用名稱
      
      if (appName) {  // 若應用名稱存在
        try {
          const apiUrl = `https://trek.aotter.net/publisher.action_app/getadstxt/?appName=${appName}`;  // 構造 API URL
          const response = UrlFetchApp.fetch(apiUrl, {
            headers: { "Cookie": CONFIG.COOKIE }  // 發送帶有 Cookie 的請求
          });
          
          const content = response.getContentText();  // 獲取 API 回應內容
          const parsedData = this.parseContent(content);  // 解析內容
          
          // 將解析出的結果寫入對應的欄位
          sheet.getRange(i, CONFIG.COLUMN_INDICES.ASEAL, 1, 4).setValues([[
            parsedData.aseal,
            parsedData.teads,
            parsedData.ucfunnel,
            parsedData.smaato
          ]]);
          
        } catch (error) {
          // 忽略錯誤，不中斷流程
        }
      }
    }
  },
  
  // 解析 API 回應的內容，根據不同的提供者進行分類，ads.txt 設置狀況欄處理公式
  parseContent: function(content) {
    const lines = content.split('\n');
    const result = {
      aseal: '',
      teads: '',
      ucfunnel: '',
      smaato: ''
    };
    
    // 根據提供者的標籤，將內容分類
    lines.forEach(line => {
      if (line.startsWith('aseal')) result.aseal = line;
      else if (line.startsWith('teads')) result.teads = line;
      else if (line.startsWith('ucfunnel')) result.ucfunnel = line;
      else if (line.startsWith('smaato')) result.smaato = line;
    });
    
    return result;  // 返回解析結果
  },

  // 檢查設置狀態，根據行數範圍比對數據，並標示是否正確設置，比對 ads.txt 並顯示 ads.txt 設置狀況用公式
  checkStatus: function(startRow, endRow) {
    const sheet = Utils.getSheet();
    
    for (let i = startRow; i <= endRow; i++) {
      const adsUrl = sheet.getRange(i, CONFIG.COLUMN_INDICES.ADS_TXT_URL).getValue();  // 取得 ads.txt 的 URL
      const values = sheet.getRange(i, CONFIG.COLUMN_INDICES.ASEAL, 1, 4).getValues()[0];  // 取得需要檢查的值
      
      let status = '';
      if (!adsUrl) {
        status = '未設置 - 無 ads.txt_url\n';  // 沒有 URL 的情況
      } else {
        try {
          const response = UrlFetchApp.fetch('https://' + adsUrl, {muteHttpExceptions: true});  // 嘗試訪問 ads.txt URL
          
          if (response.getResponseCode() === 200) {  // 如果請求成功，取得內容
            const content = response.getContentText();
            const providers = ['aseal', 'teads', 'ucfunnel', 'smaato'];
            
            providers.forEach((provider, index) => {
              if (values[index] && content.includes(values[index])) {
                status += `${provider} 正確設置\n`;  // 如果內容匹配，標示為正確
              } else {
                status += `${provider} 未設置\n`;  // 否則標示為未設置
              }
            });
          } else {
            status = '未設置 - 沒有 ads.txt\n';  // 若請求失敗，標示為未設置
          }
        } catch (error) {
          status = '未設置 - 沒有 ads.txt\n';  // 發生錯誤時的情況
        }
      }
      
      sheet.getRange(i, CONFIG.COLUMN_INDICES.STATUS).setValue(status);  // 將狀態寫入試算表
      Utils.sleep(500);  // 每處理一行暫停 500 毫秒
    }
  },

  // 上色顯示狀態欄位的文本，根據不同狀態設置顏色
  highlightText: function(sheet, lastRow) {
    const statusRange = sheet.getRange(2, CONFIG.COLUMN_INDICES.STATUS, lastRow - 1, 1);
    const values = statusRange.getValues();
    
    const richTextValues = values.map(row => {
      const text = row[0];
      if (!text) return [SpreadsheetApp.newRichTextValue().setText('').build()];
      
      const richTextBuilder = SpreadsheetApp.newRichTextValue().setText(text);
      
      // 上色顯示 "未設置" 為紅色
      let startIndex = text.indexOf('未設置');
      while (startIndex !== -1) {
        const endIndex = startIndex + '未設置'.length;
        richTextBuilder.setTextStyle(startIndex, endIndex, 
          SpreadsheetApp.newTextStyle().setForegroundColor('red').build());
        startIndex = text.indexOf('未設置', endIndex);
      }
      
      // 上色顯示 "正確設置" 為綠色
      startIndex = text.indexOf('正確設置');
      while (startIndex !== -1) {
        const endIndex = startIndex + '正確設置'.length;
        richTextBuilder.setTextStyle(startIndex, endIndex,
          SpreadsheetApp.newTextStyle().setForegroundColor('green').build());
        startIndex = text.indexOf('正確設置', endIndex);
      }
      
      return [richTextBuilder.build()];
    });
    
    statusRange.setRichTextValues(richTextValues);  // 設置上色文本值
  }
};

// 全局函數，保持不變
function initializeProcessing() {
  const sheet = Utils.getSheet();
  const lastRow = sheet.getLastRow();  // 取得最後一行的行號
  
  // 初始化處理的屬性
  PropertiesService.getScriptProperties().setProperties({
    'currentBatchStart': '2',
    'lastRow': lastRow.toString(),
    'processingType': 'fetch'
  });
  
  processBatch();  // 開始處理批次
}

//分批處理排程
function processBatch() {
  const props = PropertiesService.getScriptProperties();
  const currentBatchStart = parseInt(props.getProperty('currentBatchStart'));  // 當前批次的開始行
  const lastRow = parseInt(props.getProperty('lastRow'));  // 試算表的最後一行
  const processingType = props.getProperty('processingType');  // 獲取處理類型
  
  const batchEnd = Math.min(currentBatchStart + CONFIG.BATCH_SIZE - 1, lastRow);  // 計算當前批次的結束行
  
  if (processingType === 'fetch') {
    DataProcessor.fetchData(currentBatchStart, batchEnd);  // 執行數據獲取
  } else {
    DataProcessor.checkStatus(currentBatchStart, batchEnd);  // 執行狀態檢查
  }
  
  scheduleNext(currentBatchStart, batchEnd, lastRow, processingType);  // 安排下一批次
}

// 安排下一批次處理的函數
function scheduleNext(currentStart, batchEnd, lastRow, processingType) {
  const props = PropertiesService.getScriptProperties();
  
  if (batchEnd < lastRow) {
    // 還有未處理的數據，繼續處理
    props.setProperty('currentBatchStart', (batchEnd + 1).toString());
    Utils.createTrigger('processBatch', 1);  // 每隔 1 分鐘繼續執行下一批
  } else if (processingType === 'fetch') {
    // 若數據獲取完成，開始檢查狀態
    props.setProperties({
      'currentBatchStart': '2',
      'processingType': 'check'
    });
    Utils.createTrigger('processBatch', 1);  // 每隔 1 分鐘執行狀態檢查
  } else {
    const sheet = Utils.getSheet();
    DataProcessor.highlightText(sheet, lastRow);  // 所有處理完成，進行上色顯示
  }
}


