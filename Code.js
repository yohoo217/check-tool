//Code.gs
var cachedData = null;
var lastFetchTime = null;
var manualCookie = "AOTTERBD_SESSION=757418f543a95a889184e798ec5ab66d4fad04e5-lats=1724229220332&sso=PIg4zu/Vdnn/A15vMEimFlVAGliNhoWlVd5FTvtEMRAFpk/VvBGvAetanw8DLATSLexy9pee/t52uNojvoFS2Q==;aotter=eyJ1c2VyIjp7ImlkIjoiNjNkYjRkNDBjOTFiNTUyMmViMjk4YjBkIiwiZW1haWwiOiJpYW4uY2hlbkBhb3R0ZXIubmV0IiwiY3JlYXRlZEF0IjoxNjc1MzE2NTQ0LCJlbWFpbFZlcmlmaWVkIjp0cnVlLCJsZWdhY3lJZCI6bnVsbCwibGVnYWN5U2VxSWQiOjE2NzUzMTY1NDQ3ODI5NzQwMDB9LCJhY2Nlc3NUb2tlbiI6IjJkYjQyZTNkOTM5MDUzMjdmODgyZmYwMDRiZmI4YmEzZjBhNTlmMDQwYzhiN2Y4NGY5MmZmZTIzYTU0ZTQ2MDQiLCJ1ZWEiOm51bGx9; _Secure-1PSID=vlPPgXupFroiSjP1/A02minugZVZDgIG4K; _Secure-1PSIDCC=g.a000mwhavReSVd1vN09AVTswXkPAhyuW7Tgj8-JFhj-FZya9I_l1B6W2gqTIWAtQUTQMkTxoAwACgYKAW0SARISFQHGX2MiC--NJ2PzCzDpJ0m3odxHhxoVAUF8yKr8r49abq8oe4UxCA0t_QCW0076; _Secure-3PSID=AKEyXzUuXI1zywmFmkEBEBHfg6GRkRM9cJ9BiJZxmaR46x5im_krhaPtmL4Jhw8gQsz5uFFkfbc; _Secure-3PSIDCC=sidts-CjEBUFGohzUF6oK3ZMACCk2peoDBDp6djBwJhGc4Lxgu2zOlzbVFeVpXF4q1TYZ5ba6cEAA";
var SPREADSHEET_ID = '1InVJQMOs2qqoxp1ovFVp_gQQFnzvFR5EKwRsC1xBiBg';
var AUTHORIZED_USERS = ['ian.chen@aotter.net', 'cjay@aotter.net', 'coki.lu@aotter.net', 'john.chiu@aotter.net', 'phsu@aotter.net', 'robert.hsueh@aotter.net', 'smallmouth@aotter.net'];


function doGet(e) {
  Logger.log('Authorized Users: ' + JSON.stringify(AUTHORIZED_USERS));
  
  var user = 'Unknown';
  var errorMessage = '';
  
  try {
    user = Session.getActiveUser().getEmail();
    Logger.log('User email retrieved: ' + user);
  } catch (error) {
    errorMessage = 'Error getting user email: ' + error.toString();
    Logger.log(errorMessage);
  }
  
  var isAuthorized = AUTHORIZED_USERS.includes(user);
  Logger.log('Is user authorized: ' + isAuthorized);
  
  if (isAuthorized) {
    Logger.log('Access granted. Returning main page.');
    return HtmlService.createHtmlOutputFromFile('Index')
        .setTitle('DSP 監控系統，看串接狀況')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } else {
    Logger.log('Access denied. Returning error page.');
    var output = HtmlService.createHtmlOutput(`
      <h1>對不起，您沒有權限訪問此頁面。</h1>
      <script>
        function checkManualAuth() {
          var email = document.getElementById('email').value;
          google.script.run.withSuccessHandler(function(result) {
            if (result) {
              window.location.reload();
            } else {
              alert('驗證失敗，您沒有權限訪問此頁面。');
            }
          }).checkManualAuth(email);
        }
      </script>
    `)
    .setTitle('訪問被拒絕')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    
    return output;
  }
}

function checkManualAuth(email) {
  Logger.log('Checking manual auth for email: ' + email);
  var isAuthorized = AUTHORIZED_USERS.includes(email);
  Logger.log('Manual auth result: ' + isAuthorized);
  return isAuthorized;
}

//處理在前端顯示畫面
function getPublishers() {
  if (cachedData && lastFetchTime && (new Date().getTime() - lastFetchTime < 60000)) {
    return cachedData;
  }

  try {
    var spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = spreadsheet.getSheetByName('Sheet1');
    if (!sheet) throw new Error('在指定的 spreadsheet 中找不到 Sheet1');

    var data = sheet.getDataRange().getValues();

    // Normalize headers (trim spaces and convert to lowercase)
    var headers = data[0].map(function(header) {
      return header.trim().toLowerCase();
    });

    var criteoCompareResultIndex = headers.indexOf('criteo 比對結果');
    var foCompareResultIndex = headers.indexOf('fo 比對結果');
    var smaatoCompareResultIndex = headers.indexOf('smaato 比對結果');

    if (criteoCompareResultIndex === -1) {
    throw new Error('找不到 "CRITEO 比對結果" 列');
    }
    if (foCompareResultIndex === -1) {
      throw new Error('找不到 "FO 比對結果" 列');
    }
    if (smaatoCompareResultIndex === -1) {
      throw new Error('找不到 "Smaato 比對結果" 列');
    }

    // Get index for ads.txt status column
    var adsTxtStatusIndex = headers.indexOf('ads.txt 設置狀況');
    if (adsTxtStatusIndex === -1) {
      throw new Error('找不到 "ads.txt 設置狀況" 列');
    }
    
    // DSP columns (例如: CRITEO, FREAKOUTBANNER 等)
    var dspColumns = ['criteo', 'freakoutbanner', 'smaatonative', 'ucfunnelnative', 'ucfunnelbanner', 'freakoutvastxml', 'smaatobanner'];

    var publishers = data.slice(1).reduce(function(acc, row) {
      var item = headers.reduce(function(obj, header, index) {
        obj[header] = row[index];
        return obj;
      }, {});

      var orgId = item['orgid'];
      var clientId = item['clientid'];
      var placeUid = item['placeuid'];

      if (!acc[orgId]) {
        acc[orgId] = {
          orgName: item['orgname'],
          orgId: orgId,
          apps: {}
        };
      }

      if (!acc[orgId].apps[clientId]) {
        acc[orgId].apps[clientId] = {
          appName: item['appname'],
          clientId: clientId,
          platform: item['platform'],
          places: {}
        };
      }

      if (!acc[orgId].apps[clientId].places[placeUid]) {
        // 檢查 ads.txt 狀態
        var adsTxtStatus = item['ads.txt 設置狀況'] || '';
        var adsTxtLines = adsTxtStatus.split('\n');
        var hasAsealSellerJson = adsTxtLines.some(line => line.includes('aseal 正確設置'));
        var hasTeadsSellerJson = adsTxtLines.some(line => line.includes('teads 正確設置'));
        var hasUcfunnelSellerJson = adsTxtLines.some(line => line.includes('ucfunnel 正確設置'));
        var hasSmaatoSellerJson = adsTxtLines.some(line => line.includes('smaato 正確設置'));

        // 列出所有 DSP 項目並檢查串接狀況
        var dspSettingList = dspColumns.map(function(dspName) {
          var status = 'not_connected'; // 預設為未串接

          // 確認該 DSP 的狀態是否是有效的
          if (item[dspName]) {
            var dspStatus = item[dspName].trim().toLowerCase();
            if (dspStatus === '✓' || dspStatus === 'connected') { // 檢查 '✓' 或其他可能的標記
              status = 'normal';
            } 
          }

          return {
            dspName: dspName.toUpperCase(),
            status: status,
            fillRate: item[dspName + ' fill rate'] || 0
          };
        });

        // 根據 compatibilityMap 標註 DSPs 是否兼容，但不過濾
        const compatibleDsps = getCompatibleDsps(item['platform'], item['placetype']);

        dspSettingList = dspSettingList.filter(dsp => compatibleDsps.includes(dsp.dspName)); // 只保留兼容的 DSP

        var criteoCompareResult = row[criteoCompareResultIndex] || '';
        var foCompareResult = row[foCompareResultIndex] || '';
        var smaatoCompareResult = row[smaatoCompareResultIndex] || '';

        acc[orgId].apps[clientId].places[placeUid] = {
          place: item['place'],
          placeType: item['placetype'],
          placeUid: placeUid,
          size: item['size'],
          request: item['received'] || '0',
          dspSettingList: dspSettingList,
          hasAsealSellerJson: hasAsealSellerJson,
          hasTeadsSellerJson: hasTeadsSellerJson,
          hasUcfunnelSellerJson: hasUcfunnelSellerJson,
          hasSmaatoSellerJson: hasSmaatoSellerJson,
          criteoCompareResult: criteoCompareResult,
          foCompareResult: foCompareResult,
          smaatoCompareResult: smaatoCompareResult
        };
      }
      return acc;
    }, {});

    var result = { publishers: Object.values(publishers) };

    cachedData = result;
    lastFetchTime = new Date().getTime();

    return result;
  } catch (error) {
    Logger.log('Error in getPublishers: ' + error.toString());
    throw new Error('獲取發布商數據失敗: ' + error.message);
  }
}

// 定義 getCompatibleDsps 函數，會在前端顯示符合 size 條件的 DSP
function getCompatibleDsps(platform, placeType, size) {
const compatibilityMap = {
  IOS: {
    NATIVE: ["CRITEO", "SMAATONATIVE", "UCFUNNELNATIVE"],
    BANNER: {
      "320x50": ["FREAKOUTBANNER", "UCFUNNELBANNER"],
      "300x250": ["UCFUNNELBANNER"],
    },
    SUPR_AD: {
      "1200x628": ["FREAKOUTBANNER", "SMAATONATIVE", "UCFUNNELBANNER"],
    },
  },
  WEB: {
    NATIVE: ["UCFUNNELNATIVE"],
    BANNER: {
      "320x50": ["CRITEO", "UCFUNNELBANNER"],
      "300x250": ["CRITEO", "UCFUNNELBANNER"],
    },
    SUPR_AD: {
      "336x280": ["FREAKOUTBANNER", "CRITEO"],
      "300x250": ["FREAKOUTBANNER", "CRITEO", "UCFUNNELBANNER"],
    },
  },
  ANDROID: {
    NATIVE: ["CRITEO", "SMAATONATIVE", "UCFUNNELNATIVE"],
    BANNER: {
      "320x50": ["FREAKOUTBANNER", "UCFUNNELBANNER"],
      "300x250": ["UCFUNNELBANNER"],
    },
    SUPR_AD: {
      "1200x628": ["FREAKOUTBANNER", "SMAATONATIVE", "UCFUNNELBANNER"],
    },
  }
};

  // 根據 platform 和 placeType 選擇符合的 DSPs
  if (!platform || !compatibilityMap[platform]) return [];
  const platformMap = compatibilityMap[platform];
  if (!platformMap[placeType]) return [];
  if (size && platformMap[placeType][size]) {
    return platformMap[placeType][size]; // 返回符合 size 的 DSPs
  }
  return Object.values(platformMap[placeType]).flat(); // 返回所有相關 DSPs
}

//分析從 api 拿到的 dspSetting 值，看 Trek 開發者設定部分有哪些 DSP 已經設定了
function updateDspStatus(data) {
  Logger.log('Updating DSP status with data: ' + JSON.stringify(data));

  try {
    var spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = spreadsheet.getSheetByName('Sheet1');
    if (!sheet) throw new Error('在指定的 spreadsheet 中找不到 Sheet1');

    var dataRange = sheet.getDataRange();
    var dataValues = dataRange.getValues();

    // Normalize headers (trim spaces and convert to lowercase)
    var headers = dataValues[0].map(function(header) {
      return header.trim().toLowerCase();
    });

    // Find the row that matches the placeUid
    var placeUidIndex = headers.indexOf('placeuid');
    if (placeUidIndex === -1) {
      throw new Error('找不到 "placeuid" 列');
    }

    var dspNameIndices = {};
    data.dspSettingList.forEach(function(dsp) {
      var index = headers.indexOf(dsp.dspName.toLowerCase());
      if (index !== -1) {
        dspNameIndices[dsp.dspName] = index;
      }
    });

    for (var i = 1; i < dataValues.length; i++) {
      var row = dataValues[i];
      if (row[placeUidIndex] == data.placeUid) {
        data.dspSettingList.forEach(function(dsp) {
          var colIndex = dspNameIndices[dsp.dspName];
          if (colIndex !== undefined) {
            var newValue = '';
            if (dsp.status === 'normal') {
              newValue = '✓';
            } else {
              newValue = '';
            }
            row[colIndex] = newValue;
          }
        });

        // Update the row in the sheet
        var range = sheet.getRange(i + 1, 1, 1, row.length);
        range.setValues([row]);
        break;
      }
    }

    return true;
  } catch (error) {
    Logger.log('Error in updateDspStatus: ' + error.toString());
    throw new Error('更新 DSP 狀態失敗: ' + error.message);
  }
}

//取得 Trek 每日請求數
// 全域變數
var BATCH_SIZE = 100; // 每個批次處理的行數

function updateReceivedValues() {
  // 初始化 lastProcessedRow
  var scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.setProperty('lastProcessedRow', '1'); // 從第 1 行開始

  // 設置批次處理的觸發器
  setupBatchTrigger();
}

// 批次處理函數
function updateReceivedValuesBatch() {
  var scriptProperties = PropertiesService.getScriptProperties();
  var startRow = parseInt(scriptProperties.getProperty('lastProcessedRow')) || 1; // 取得起始行號

  var spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = spreadsheet.getSheetByName('Sheet1');
  if (!sheet) throw new Error('找不到 Sheet1');

  var dataRange = sheet.getDataRange();
  var values = dataRange.getValues();
  var numRows = values.length;

  // 計算結束行號
  var endRow = Math.min(startRow + BATCH_SIZE - 1, numRows - 1);

  // 標準化標題（轉換為小寫）
  var headers = values[0].map(function(header) {
    return header.trim().toLowerCase();
  });

  // 獲取相關欄位的索引
  var placeIndex = headers.indexOf('place');
  var platformIndex = headers.indexOf('platform');
  var appNameIndex = headers.indexOf('appname');
  var placeTypeIndex = headers.indexOf('placetype');
  var receivedIndex = headers.indexOf('received'); // 我們將在此欄位存儲 'received' 值

  // 如果 'received' 欄位不存在，則新增
  if (receivedIndex === -1) {
    sheet.getRange(1, headers.length + 1).setValue('received');
    receivedIndex = headers.length;
  }

  // 從 startRow 到 endRow 迭代每一行
  for (var i = startRow; i <= endRow; i++) {
    var row = values[i];
    var place = row[placeIndex];
    var platform = row[platformIndex];
    var appName = row[appNameIndex];
    var placeType = row[placeTypeIndex];

    // 如果任何必要的欄位缺失，則跳過該行
    if (!place || !platform || !appName || !placeType) {
      Logger.log('由於缺少資料，跳過第 ' + (i + 1) + ' 行');
      continue;
    }

    // 構建 POST 請求的資料載荷
    var payload = {
      "platform": platform,
      "appName": appName,
      "placeType": placeType,
      "place": place,
      "groupBy": null,
      "mode": "ALL",
      "sinceDate": getFormattedDate(-1), // 前一天
      "toDate": getFormattedDate(-1),    // 前一天
      "timeSegment": "day"
    };

    // 準備請求選項
    var options = {
      'method': 'post',
      'contentType': 'application/json',
      'headers': {
        'Cookie': manualCookie,
        'Accept': 'application/json, text/plain, */*',
      },
      'payload': JSON.stringify(payload)
    };

    // 發送 POST 請求
    try {
      var apiUrl = 'https://trek.aotter.net/api/admin/next/bi/request';
      var response = UrlFetchApp.fetch(apiUrl, options);
      var responseCode = response.getResponseCode();
      if (responseCode !== 200) {
        Logger.log('第 ' + (i + 1) + ' 行的 API 請求失敗，回應碼為 ' + responseCode);
        Logger.log('回應內容：' + response.getContentText());
        continue;
      }

      var contentText = response.getContentText();
      Logger.log('第 ' + (i + 1) + ' 行的回應內容：' + contentText);
      var data = JSON.parse(contentText);

      // 檢查回應資料是否包含預期的欄位
      if (data && data.data && Array.isArray(data.data) && data.data.length > 0) {
        var firstItem = data.data[0];
        var received = firstItem.trek && firstItem.trek.received ? firstItem.trek.received : 0;

        // 更新試算表中的 'received' 欄位
        sheet.getRange(i + 1, receivedIndex + 1).setValue(received);
        Logger.log('已更新第 ' + (i + 1) + ' 行的 received 值：' + received);
      } else {
        Logger.log('第 ' + (i + 1) + ' 行沒有返回資料');
        sheet.getRange(i + 1, receivedIndex + 1).setValue(0);
      }
    } catch (error) {
      Logger.log('第 ' + (i + 1) + ' 行的請求錯誤：' + error.toString());
    }
  }

  // 更新已處理的最後一行
  if (endRow >= numRows - 1) {
    // 所有行都已處理，刪除屬性和觸發器
    scriptProperties.deleteProperty('lastProcessedRow');
    deleteBatchTrigger(); // 刪除觸發器的函數
    Logger.log('所有行都已處理完成。');
  } else {
    // 還有未處理的行，更新 lastProcessedRow
    scriptProperties.setProperty('lastProcessedRow', (endRow + 1).toString());
    Logger.log('已處理至第 ' + (endRow + 1) + ' 行。將在下一次觸發器執行時繼續處理。');
  }
}

// 設置批次處理的觸發器
function setupBatchTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var hasTrigger = triggers.some(function(trigger) {
    return trigger.getHandlerFunction() === 'updateReceivedValuesBatch';
  });
  if (!hasTrigger) {
    ScriptApp.newTrigger('updateReceivedValuesBatch')
      .timeBased()
      .everyMinutes(1)
      .create();
    Logger.log('已設置批次處理的觸發器，每分鐘執行一次。');
  } else {
    Logger.log('批次處理的觸發器已存在。');
  }
}

// 刪除批次處理的觸發器
function deleteBatchTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'updateReceivedValuesBatch') {
      ScriptApp.deleteTrigger(trigger);
      Logger.log('已刪除批次處理的觸發器。');
    }
  });
}



// 設置每日觸發器，將在每天早上 6 點執行 updateReceivedValuesDailyBatch
function setupDailyTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    ScriptApp.deleteTrigger(trigger);  // 刪除所有已存在的觸發器
  });
  
  console.log('設置每日觸發器 - 設定為每天早上 6 點執行');
  
  ScriptApp.newTrigger('updateReceivedValuesDailyBatch')
    .timeBased()
    .atHour(6)
    .everyDays(1)
    .create();  // 每日早上 6 點執行 updateReceivedValuesDailyBatch
}

// 輔助函數：獲取 Unix 時間戳記（毫秒）
function getUnixTime(offsetDays) {
  var date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.getTime();
}


// 輔助函數：獲取當前日期偏移指定天數的 'YYYY-MM-DD' 格式日期字串
function getFormattedDate(offsetDays) {
  var date = new Date();
  date.setDate(date.getDate() + offsetDays);
  var yyyy = date.getFullYear();
  var mm = ('0' + (date.getMonth() + 1)).slice(-2);
  var dd = ('0' + date.getDate()).slice(-2);
  return yyyy + '-' + mm + '-' + dd;
}