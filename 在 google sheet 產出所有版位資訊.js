function fetchDataWithManualCookie() {
  var apiUrl = "https://trek.aotter.net/api/admin/next/publisher/list?page=1&show=1000";
  
  // 將您手動組合的 cookie 字串貼在這裡
  var manualCookie = "AOTTERBD_SESSION=757418f543a95a889184e798ec5ab66d4fad04e5-lats=1724229220332&sso=PIg4zu/Vdnn/A15vMEimFlVAGliNhoWlVd5FTvtEMRAFpk/VvBGvAetanw8DLATSLexy9pee/t52uNojvoFS2Q==;aotter=eyJ1c2VyIjp7ImlkIjoiNjNkYjRkNDBjOTFiNTUyMmViMjk4YjBkIiwiZW1haWwiOiJpYW4uY2hlbkBhb3R0ZXIubmV0IiwiY3JlYXRlZEF0IjoxNjc1MzE2NTQ0LCJlbWFpbFZlcmlmaWVkIjp0cnVlLCJsZWdhY3lJZCI6bnVsbCwibGVnYWN5U2VxSWQiOjE2NzUzMTY1NDQ3ODI5NzQwMDB9LCJhY2Nlc3NUb2tlbiI6IjJkYjQyZTNkOTM5MDUzMjdmODgyZmYwMDRiZmI4YmEzZjBhNTlmMDQwYzhiN2Y4NGY5MmZmZTIzYTU0ZTQ2MDQiLCJ1ZWEiOm51bGx9; _Secure-1PSID=vlPPgXupFroiSjP1/A02minugZVZDgIG4K; _Secure-1PSIDCC=g.a000mwhavReSVd1vN09AVTswXkPAhyuW7Tgj8-JFhj-FZya9I_l1B6W2gqTIWAtQUTQMkTxoAwACgYKAW0SARISFQHGX2MiC--NJ2PzCzDpJ0m3odxHhxoVAUF8yKr8r49abq8oe4UxCA0t_QCW0076; _Secure-3PSID=AKEyXzUuXI1zywmFmkEBEBHfg6GRkRM9cJ9BiJZxmaR46x5im_krhaPtmL4Jhw8gQsz5uFFkfbc; _Secure-3PSIDCC=sidts-CjEBUFGohzUF6oK3ZMACCk2peoDBDp6djBwJhGc4Lxgu2zOlzbVFeVpXF4q1TYZ5ba6cEAA";

  var options = {
    "method": "get",
    "headers": {
      "Cookie": manualCookie,
      "User-Agent": "Mozilla/5.0",
      "Accept": "application/json"
    },
    "muteHttpExceptions": true
  };

  var response = UrlFetchApp.fetch(apiUrl, options);
  var responseCode = response.getResponseCode();
  var responseBody = response.getContentText();

  if (responseCode === 200) {
    try {
      var data = JSON.parse(responseBody);
      populateSheet(data);
    } catch (e) {
      Logger.log("解析 JSON 時出錯: " + e);
      Logger.log("回應內容: " + responseBody);
    }
  } else {
    Logger.log("API 請求失敗。狀態碼: " + responseCode);
    Logger.log("回應內容: " + responseBody);
  }
}

function populateSheet(data) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  sheet.clear();
  
  // 收集所有唯一的 DSP Names
  var allDspNames = new Set();
  if (data.list && Array.isArray(data.list)) {
    data.list.forEach(function(item) {
      if (item.dspSettingList && Array.isArray(item.dspSettingList)) {
        item.dspSettingList.forEach(function(dsp) {
          if (dsp.dspName) allDspNames.add(dsp.dspName);
        });
      }
    });
  }
  
  // 定義所有列
  var baseHeaders = [
    "Client ID", "Place", "Place Type", "Place UID", "App Name", "Platform", 
    "App Display Name", "Org ID", "Org Name", "DSP Settings"
  ];
  var headers = baseHeaders.concat(Array.from(allDspNames));
  
  // 設置背景
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setBackground('#2894FF'); 
  
  var row = 2;
  if (data.list && Array.isArray(data.list)) {
    data.list.forEach(function(item) {
      var rowData = [
        item.clientId || "",
        item.place || "",
        item.placeType || "",
        item.placeUid || "",
        item.appName || "",
        item.platform || "",
        item.appDisplayName || "",
        item.orgId || "",
        item.orgName || "",
        JSON.stringify(item.dspSettingList || [])
      ];
      
      // 為每個 DSP Name 列設值
      var dspColumns = {};
      if (item.dspSettingList && Array.isArray(item.dspSettingList)) {
        item.dspSettingList.forEach(function(dsp) {
          if (dsp.dspName) dspColumns[dsp.dspName] = "✓";
        });
      }
      
      allDspNames.forEach(function(dspName) {
        rowData.push(dspColumns[dspName] || "");
      });
      
      sheet.getRange(row, 1, 1, rowData.length).setValues([rowData]);
      row++;
    });
  } else {
    Logger.log("數據結構不正確或為空");
    Logger.log("接收到的數據：" + JSON.stringify(data));
  }
  
  // 自動調整寬
  sheet.autoResizeColumns(1, headers.length);
}


// 主函數，用於執行整個流程
function main() {
  fetchDataWithManualCookie();
}
