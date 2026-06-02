var CLIENT_ID = '536550775188-u1qkvebn3ql07pt6r0in94bo1irm336n.apps.googleusercontent.com';
var DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest"];
var SCOPES = 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send';

var authorizeButton = document.getElementById('authorize_button');
var signoutButton = document.getElementById('signout_button');

var tokenClient;
var gapiInited = false;
var gisInited = false;

function gapiLoaded() {
  gapi.load('client', async function () {
    await gapi.client.init({ discoveryDocs: DISCOVERY_DOCS });
    gapiInited = true;
    maybeEnableButtons();
  });
}

function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: '',
  });
  gisInited = true;
  maybeEnableButtons();
}

function maybeEnableButtons() {
  if (gapiInited && gisInited) {
    $(authorizeButton).show();
    authorizeButton.onclick = handleAuthClick;
    signoutButton.onclick = handleSignoutClick;
  }
}

function handleAuthClick() {
  tokenClient.callback = function (resp) {
    if (resp.error) throw resp;
    $(authorizeButton).hide();
    $(signoutButton).show();
    listLabels();
  };
  var prompt = gapi.client.getToken() === null ? 'consent' : '';
  tokenClient.requestAccessToken({ prompt: prompt });
}

function handleSignoutClick() {
  var token = gapi.client.getToken();
  if (token) {
    google.accounts.oauth2.revoke(token.access_token);
    gapi.client.setToken('');
  }
  $(authorizeButton).show();
  $(signoutButton).hide();
  $("#messages-div").html("");
  $("#message-div").html("");
}

/**
 * Append a pre element to the body containing the given message
 * as its text node. Used to display the results of the API call.
 *
 * @param {string} message Text to be placed in pre element.
 */
// function appendPre(message) {
//   var pre = document.getElementById('content');
//   var textContent = document.createTextNode(message + '\n');
//   pre.appendChild(textContent);
// }

/**
 * Print all Labels in the authorized user's inbox. If no labels
 * are found an appropriate message is printed.
 */
function listLabels() {
  var labels = ["INBOX", "SENT", "TRASH", "SPAM"];

  for(var i=0;i<labels.length;i++){
    gapi.client.gmail.users.labels.get({
      'userId': 'me',
      'id': labels[i]
    }).then(func1.bind(null, "badge-"+labels[i].toLowerCase()));
  }
}

function func1(labelId, response){
  var count = response.result.messagesUnread;
  if (count > 0) {
    $("#"+labelId).text(count).show();
  } else {
    $("#"+labelId).hide();
  }
}

function fetchMessages(labelId, pageToken=null){
  if(pageToken==null){
    $("#messages-div").html("");
  } else{
    $("#load-more-emails").remove();
  }
  gapi.client.gmail.users.messages.list({
    'userId': 'me',
    'labelIds': labelId,
    'maxResults': 10,
    'pageToken': (pageToken==null)?'':pageToken
  }).then(func2.bind(null, labelId));
}

function func2(labelId, response) {
  var messages = response.result.messages;
  for(var i=0;i<messages.length;i++){
    var divId = "messages-"+messages[i].id;
    $("#messages-div").append("<div class=\"msg-row\" id=\""+divId+"\"></div>");
    gapi.client.gmail.users.messages.get({
      'userId': 'me',
      'id': messages[i].id,
      'format': 'metadata'
    }).then(addMessages.bind(null, divId));
  }
  $("#messages-div").append(
    "<div id=\"load-more-emails\" class=\"load-more\" onclick=\"fetchMessages('"+labelId+"', '"+response.result.nextPageToken+"')\">Load more emails</div>"
  );
}

function addMessages(divId, response){
  var isUnread = $.inArray("UNREAD", response.result.labelIds) !== -1;
  if (isUnread) $("#"+divId).addClass("unread");

  $("#"+divId).append(
    "<a class=\"msg-item\" onclick=\"fetchMessage('"+response.result.id+"')\">" +
      "<div class=\"msg-header-row\">" +
        "<span class=\"msg-from\">"+decodeURIComponent(escape(getHeader(response.result.payload.headers, 'From')))+"</span>" +
        "<span class=\"msg-time\">"+formatTime(getHeader(response.result.payload.headers, 'Date'))+"</span>" +
      "</div>" +
      "<div class=\"msg-subject\">"+getHeader(response.result.payload.headers, 'Subject')+"</div>" +
    "</a>"
  );
}

function fetchMessage(messageId){
  $("#message-div").html("");
  gapi.client.gmail.users.messages.get({
    'userId': 'me',
    'id': messageId
  }).then(function(response) {
    var h = response.result.payload.headers;
    var esc = function(s){ return s.replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
    var from    = esc(getHeader(h, 'From'));
    var replyTo = esc(getHeader(h, 'Reply-To'));
    var to      = esc(getHeader(h, 'To'));
    var date    = getHeader(h, 'Date');
    var subject = getHeader(h, 'Subject');
    var attachments = attachmentNames(response.result.payload);

    var metaRows =
      "<span class=\"meta-label\">From</span><span class=\"meta-value\">"+from+"</span>" +
      (replyTo ? "<span class=\"meta-label\">Reply-To</span><span class=\"meta-value\">"+replyTo+"</span>" : "") +
      "<span class=\"meta-label\">To</span><span class=\"meta-value\">"+to+"</span>" +
      "<span class=\"meta-label\">Date</span><span class=\"meta-value\">"+date+"</span>";

    var attachmentsHtml = attachments.length > 0
      ? "<div class=\"message-attachments\"><b>Attachments:</b> "+attachments+"</div>"
      : "";

    var frameId = "email-frame-" + messageId;
    $("#message-div").append(
      "<div class=\"message-detail\">" +
        "<div class=\"message-detail-header\">" +
          "<div class=\"message-subject-line\">"+subject+"</div>" +
          "<div class=\"message-meta\">"+metaRows+"</div>" +
          attachmentsHtml +
        "</div>" +
        "<div class=\"message-body\">" +
          "<iframe id=\""+frameId+"\" class=\"email-iframe\" sandbox=\"allow-same-origin\" frameborder=\"0\"></iframe>" +
        "</div>" +
      "</div>"
    );

    // Write email HTML into the sandboxed iframe so its styles/scripts stay isolated
    var iframe = document.getElementById(frameId);
    var doc = iframe.contentDocument;
    doc.open();
    doc.write(getBody(response.result.payload));
    doc.close();
    setTimeout(function() {
      iframe.style.height = (doc.documentElement.scrollHeight + 20) + 'px';
    }, 150);

    // Mark as read if still unread
    if ($.inArray("UNREAD", response.result.labelIds) !== -1) {
      gapi.client.gmail.users.messages.modify({
        'userId': 'me',
        'id': messageId,
        'resource': { 'removeLabelIds': ['UNREAD'] }
      }).then(function() {
        $("#messages-" + messageId).removeClass("unread");
        listLabels();
      });
    }
  });
}

function attachmentNames(payloadObj){
  var parts = payloadObj.parts;
  var ansArr = [];
  if(parts!=null && parts.length>0){
    for(var i=0;i<parts.length;i++){
      if(parts[i].filename.length > 0){
        ansArr.push(parts[i].filename);
      }
    }
  }
  var ans = "";
  for(var i=0;i<ansArr.length;i++){
    if(i==0){
      ans += (i+1) + ". " + ansArr[i];
    } else {
      ans += ", " + (i+1) + ". " + ansArr[i];
    }
  }
  return ans;
}

function decodeEmailId(content){
  var str = "Team Pratilipi \u003ccontact@pratilipi.com\u003e";
  var index1 = str.indexOf("<");
  var name = str.substring(0, index1);
  str = str.substring(index1+1);
  var index2 = str.indexOf(">");
  var email = str.substring(0, index2);
}

function formatTime(dateString){
  var d = new Date(dateString);
  var now = new Date();
  if((now - d)<24*60*60*1000){
  	return formatNumber(d.getHours())+":"+formatNumber(d.getMinutes());
  } else {
  	return formatNumber(d.getDate())+"/"+formatNumber(d.getMonth()+1);
  }
}

function formatNumber(num){
  num = ''+num;
  if(num.length<2){
    num = '0'+num;
  }
  return num;
}

function getHeader(headers, index) {
  var header = '';

  $.each(headers, function(){
    if(this.name === index){
      header = this.value;
    }
  });
  return header;
}

function listUserInfo(){
  gapi.client.gmail.users.getProfile({
    'userId': 'me'
  }).then(function(response) {
    appendPre(JSON.stringify(response.result));

  });
}

function listMessages(){
  gapi.client.gmail.users.messages.list({
    'userId': 'me',
    'labelIds': 'INBOX',
    'maxResults': 10
  }).then(function(response) {
    //appendPre(JSON.stringify(response.result));
    var messages = response.result.messages;
    for(var i=0;i<messages.length;i++){
      getMessageInfo(messages[i].id);
    }
  });
}

function getMessageInfo(messageId){
  gapi.client.gmail.users.messages.get({
    'userId': 'me',
    'id': messageId
  }).then(function(response) {
    //document.getElementById('mailcontent').innerHTML += getBody(response.result.payload) + '<hr>';
    console.log("added");
  });
}

function getBody(message) {
  var encodedBody = '';
  if(typeof message.parts === 'undefined')
  {
    encodedBody = message.body.data;
  }
  else
  {
    encodedBody = getHTMLPart(message.parts);
  }
  encodedBody = encodedBody.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '');
  return decodeURIComponent(escape(window.atob(encodedBody)));
}
function getHTMLPart(arr) {
  for(var x = 0; x <= arr.length; x++)
  {
    if(typeof arr[x].parts === 'undefined')
    {
      if(arr[x].mimeType === 'text/html')
      {
        return arr[x].body.data;
      }
    }
    else
    {
      return getHTMLPart(arr[x].parts);
    }
  }
  return '';
}

function clearAllFields(){
  $('#send-new-email').modal('hide');

  $('#send-new-email-to').val('');
  $('#send-new-email-subject').val('');
  $('#send-new-email-content').val('');

  $('#send-new-email-send').removeClass('disabled');
}

function sendEmail()
{
  $('#send-new-email-send').addClass('disabled');

  sendMessage(
    {
      'To': $('#send-new-email-to').val(),
      'Subject': $('#send-new-email-subject').val()
    },
    $('#send-new-email-content').val(),
    clearAllFields
  );

  return false;
}

function sendMessage(headers_obj, message, callback)
{
  var email = '';

  for(var header in headers_obj)
    email += header += ": "+headers_obj[header]+"\r\n";

  email += "\r\n" + message;

  var sendRequest = gapi.client.gmail.users.messages.send({
    'userId': 'me',
    'resource': {
      'raw': window.btoa(email).replace(/\+/g, '-').replace(/\//g, '_')
    }
  });

  return sendRequest.execute(callback);
}
