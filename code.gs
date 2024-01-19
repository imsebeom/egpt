const API_KEYEX = 'none'

// 스프레드시트 아이디 확인
const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

const NOWDATE = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MM-dd");


// 시트에서 모델이름 가져오기
function getModel() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("Sheet1");
  const cellValue = sheet.getRange("B1").getValue();  
  return cellValue ? cellValue : "gpt-3.5-turbo-1106";
}

// 시트에서 API키값 가져오기
function getAPIKey() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("Sheet1");
  const cellValue = sheet.getRange("B3").getValue();  
  return cellValue ? cellValue : API_KEYEX;
}

// 시트에서 어시스턴트ID값 가져오기
function gptAssistantId() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("Sheet1");
  const cellValue = sheet.getRange("B2").getValue();  
  return cellValue ? cellValue : createAssistantId();
}

// html에서 사용할 제목, 부제목, 첫인사, 시스템프롬프트값 보내주는 함수
function getSheetValues() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("Sheet1");
  return {
    title: sheet.getRange("B4").getValue(),    
    welcomeMessage: sheet.getRange("B5").getValue(),
    defaultUserRequest: sheet.getRange("B6").getValue(),
    systemValue: sheet.getRange("B7").getValue()
  };
}

// html 실행 함수
function doGet() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("Sheet1");
  const assistant_state = sheet.getRange("B2").getValue();

  // 실행할 때마다 어시스턴트 갱신(없으면 생성)
  if(assistant_state.trim() == "") {
    createAssistantId();
  }
  else {
    modifyAssistantId();
  }

  return HtmlService.createHtmlOutputFromFile("index.html");
}

// 일시적 gpt 요청 함수
function oneGpt(conversations) { 
  const url = 'https://api.openai.com/v1/chat/completions';

  const options = {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + getAPIKey(),
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({
      'model': getModel(),
      'messages': [{ 'role': 'system', 'content': conversations }]
    })
  };

  const response = UrlFetchApp.fetch(url, options);
  const data = JSON.parse(response.getContentText());
  return data.choices[0].message.content; // 생성된 답변 반환
}

// 사용자시트 관리 함수: 시트값과 스레드를 리턴한다. 없으면 새로운 사용자로 시트와 스레드를 생성한다.
function createOrGetSheet(userName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheetName = userName+NOWDATE;
  let sheet = ss.getSheetByName(sheetName);
  let threadId = "";

  if (!sheet) { // 기존 사용자의 대화 시트가 없으면 생성
    // 사용자 이름으로 새 시트 생성
    sheet = ss.insertSheet(sheetName);

    // 새로운 스레드 ID 생성
    threadId = createThreadInOpenAI();

    // 스프레드시트 설정
    sheet.setColumnWidth(1, 152); // A열
    sheet.setColumnWidth(3, 200); // C열
    sheet.setColumnWidth(4, 400); // D열
    sheet.getRange("C:C").setWrap(true);
    sheet.getRange("D:D").setWrap(true);
    sheet.getRange("C:C").setHorizontalAlignment("right");
    sheet.getRange("D:D").setHorizontalAlignment("left");

    sheet.getRange("A1").setValue("Thread ID");
    sheet.getRange("B1").setValue(threadId);

  } else { // 기존 사용자의 대화 시트가 있으면 기존 스프레드시트에서 스레드 ID 불러오기
    threadId = sheet.getRange("B1").getValue();
  }

  return { 'sheet': sheet, 'threadId': threadId };
}

// 새로운 사용자 스레드 생성 함수
function createThreadInOpenAI() { 
  var url = 'https://api.openai.com/v1/threads';
  var options = {
    'method': 'POST',
    'headers': {
      'Authorization': 'Bearer ' + getAPIKey(),
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v1'
    }
  };

  var response = UrlFetchApp.fetch(url, options);
  var responseData = JSON.parse(response.getContentText());

  return responseData.id;
}

// 어시스턴트 생성 함수
function createAssistantId() {  
  var url = 'https://api.openai.com/v1/assistants';
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("Sheet1");  
  const modell= getModel();  
  var namee =sheet.getRange("B4").getValue();
  var instructionss =sheet.getRange("B7").getValue();  
  
  try {        
      var requestData = {
          'model': modell,
          'name': namee,
          'instructions': instructionss,
          'tools': [{'type': 'code_interpreter'}]          
      };
      
      var options = {
          'method': 'POST',
          'headers': {
              'Authorization': 'Bearer ' + getAPIKey(),
              'Content-Type': 'application/json',
              'OpenAI-Beta': 'assistants=v1'
          },
          'payload': JSON.stringify(requestData)
      };

      var response = UrlFetchApp.fetch(url, options);
      var responseData = JSON.parse(response.getContentText());

      var assistantId = responseData.id;
      sheet.getRange("B2").setValue(assistantId);

      return assistantId;
  } catch (error) {
      console.error("Error:", error);
      return null;
  }
}

// 어시스턴트 최신화 함수
function modifyAssistantId() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("Sheet1");

  // OpenAI API 요청 URL
  var url = 'https://api.openai.com/v1/assistants/'+ sheet.getRange("B2").getValue();  

  // API 요청 본문
  var requestData = {
    'model': getModel(),
    'name': sheet.getRange("B4").getValue(), // 어시스턴트 이름 가져오기
    'instructions': sheet.getRange("B7").getValue(), // 시스템 프롬프트 가져오기    
  };
  
  // API 요청 옵션
  var options = {
    'method': 'POST',
    'headers': {
      'Authorization': 'Bearer ' + getAPIKey(),
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v1'  
    },
    'payload': JSON.stringify(requestData)
  };

  // API 요청 실행 및 응답 처리
  var response = UrlFetchApp.fetch(url, options);
  var responseData = JSON.parse(response.getContentText());  
}

//GPT대화를 위한 함수
function processGPT(userName, inputText) { 
  const sheetAndThreadId = createOrGetSheet(userName);
  const sheet = sheetAndThreadId.sheet;
  const thread_id = sheetAndThreadId.threadId;
  const assistantId = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("Sheet1").getRange("B2").getValue();

  const nextRow = sheet.getLastRow() + 1;
  const timestamp = new Date();

  sheet.getRange("A" + nextRow).setValue(Utilities.formatDate(timestamp, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), "yyyy-MM-dd HH:mm:ss"));
  sheet.getRange("B" + nextRow).setValue(userName);
  sheet.getRange("C" + nextRow).setValue(inputText);

  // 메시지 생성
  const messagesUrl = 'https://api.openai.com/v1/threads/' + thread_id + '/messages';
  const options = {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + getAPIKey(),
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v1'
    },
    payload: JSON.stringify({
      'role': 'user',
      'content': inputText
    })
  };

  const message_response = UrlFetchApp.fetch(messagesUrl, options);
  const message_data = JSON.parse(message_response.getContentText());
  const messageId = message_data.id; // messageId 변수에는 생성된 메시지의 ID가 저장됩니다.


  // 실행
  const runUrl = 'https://api.openai.com/v1/threads/' + thread_id + '/runs';
  
  const runOptions = {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + getAPIKey(),
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v1'
    },
    payload: JSON.stringify({
      'assistant_id': assistantId, // 어시스턴트 ID
    })
  };

  const runResponse = UrlFetchApp.fetch(runUrl, runOptions);
  const runData = JSON.parse(runResponse.getContentText());  
  const runId = runData.id; // 런 ID 추출
  const runResultUrl = 'https://api.openai.com/v1/threads/' + thread_id + '/runs/' + runId;
  const runResultOptions = {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + getAPIKey(),
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v1'
    }
  };

  let runResultData;
  let runCompleted = false;

  // 실행 상태가 'completed' 될 때까지 반복
  while (!runCompleted) {
    const runResultResponse = UrlFetchApp.fetch(runResultUrl, runResultOptions);
    runResultData = JSON.parse(runResultResponse.getContentText());
    
    // 상태 확인
    if (runResultData.status === 'completed') {
      runCompleted = true;
    } else {
      Utilities.sleep(1000); // 1초 대기
    }
  }

  // 메세지 결과 받기
  const messagesOptions = {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + getAPIKey(),
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v1'
    }
  };
    // 메세지 결과 받기
  try {
    const messagesResponse = UrlFetchApp.fetch(messagesUrl, messagesOptions);
    const messagesData = JSON.parse(messagesResponse.getContentText());

    // 가장 최근 메시지가 사용자의 질문에 대한 응답인지 확인
    const lastMessage = messagesData.data.find(msg => msg.role === 'assistant' && msg.thread_id === thread_id);
    if (!lastMessage) {
      throw new Error('No assistant response found');
    }

    let result = "";

    console.log(lastMessage.content)

    lastMessage.content.forEach(content => {
      if (content.type === "image_file" && content.image_file.file_id) {
        // 이미지 파일 다운로드 및 Google 드라이브에 저장
        const imageUrl = `https://api.openai.com/v1/files/${content.image_file.file_id}/content`;
        const imageBlob = downloadImage(imageUrl);
        const file = saveImageToDrive(imageBlob, "generated_image.png");
        const publicUrl = createPublicUrl(file);

        // 클라이언트에 전달할 이미지 URL
        result += `<img src="${publicUrl}" alt="Generated Image" >\n`;
        
      } else if (content.type === "text") {
        result += content.text.value; // 텍스트 내용을 추가
      }
    });

    sheet.getRange("D" + nextRow).setValue(result);
    //conversationHistory.push({ 'role': 'assistant', 'content': result });
    return result;
  } catch (error) {
    console.error('Error retrieving messages:', error);
    return 'Error occurred: ' + error.toString();
  }
}

// 이미지 다운로드 함수
function downloadImage(imageUrl) {
  var response = UrlFetchApp.fetch(imageUrl, {'headers': {'Authorization': 'Bearer ' + getAPIKey()}, 'muteHttpExceptions': true});
  if (response.getResponseCode() == 200) {
    return response.getBlob();
  } else {
    return null;
  }
}

// Google 드라이브에 저장 함수
function saveImageToDrive(imageBlob, fileName) {
  var file = DriveApp.createFile(imageBlob.setName(fileName));
  return file;
}

// 공개 URL 생성 함수
function createPublicUrl(file) {
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const fileId = file.getId();
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}


