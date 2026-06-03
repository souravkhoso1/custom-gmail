var CLIENT_ID = '536550775188-u1qkvebn3ql07pt6r0in94bo1irm336n.apps.googleusercontent.com';
var DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest"];
var SCOPES = 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send';

var authorizeButton = document.getElementById('authorize_button');
var signoutButton = document.getElementById('signout_button');

var tokenClient;
var gapiInited = false;
var gisInited = false;
var currentLabel = null;
var currentMessageId = null;

var TOKEN_STORAGE_KEY = 'gmail_token';

function saveToken(resp) {
  var expiresIn = Number(resp.expires_in) || 3600; // default 1 hour if missing
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({
    access_token: resp.access_token,
    expires_at: Date.now() + (expiresIn * 1000) - 60000
  }));
}

function loadToken() {
  try {
    var stored = JSON.parse(localStorage.getItem(TOKEN_STORAGE_KEY));
    if (stored && stored.access_token && stored.expires_at > Date.now()) return stored;
  } catch(e) {}
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  return null;
}

function clearToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

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
  if (!gapiInited || !gisInited) return;
  authorizeButton.onclick = handleAuthClick;
  signoutButton.onclick = handleSignoutClick;

  var saved = loadToken();
  if (saved) {
    gapi.client.setToken({ access_token: saved.access_token });
    $(authorizeButton).hide();
    $(signoutButton).show();
    listLabels();
  } else {
    $(authorizeButton).show();
  }
}

function handleAuthClick() {
  tokenClient.callback = function (resp) {
    if (resp.error) throw resp;
    saveToken(resp);
    $(authorizeButton).hide();
    $(signoutButton).show();
    listLabels();
  };
  tokenClient.requestAccessToken({ prompt: '' });
}

function handleSignoutClick() {
  var token = gapi.client.getToken();
  if (token) {
    google.accounts.oauth2.revoke(token.access_token);
    gapi.client.setToken('');
  }
  clearToken();
  $(authorizeButton).show();
  $(signoutButton).hide();
  $("#messages-div").html("");
  $("#message-div").html("");
}

function handleApiError(err) {
  if (err && (err.status === 401 || err.status === 403)) {
    clearToken();
    gapi.client.setToken('');
    $(signoutButton).hide();
    $(authorizeButton).show();
  } else {
    console.error('Gmail API error', err);
  }
}

function listLabels() {
  gapi.client.gmail.users.labels.get({ userId: 'me', id: 'INBOX' })
    .then(function(resp) {
      var count = resp.result.messagesUnread || 0;
      count > 0 ? $('#badge-inbox').text(count).show() : $('#badge-inbox').hide();
    })
    .catch(handleApiError);
}

function fetchMessages(labelId, pageToken=null){
  if (pageToken == null) {
    currentLabel = labelId;
    currentMessageId = null;
    $("#messages-div").html("");
    $('[data-label]').removeClass('active');
    $('[data-label="' + labelId + '"]').addClass('active');
  } else {
    $("#load-more-emails").remove();
  }
  gapi.client.gmail.users.messages.list({
    'userId': 'me',
    'labelIds': labelId,
    'maxResults': 10,
    'pageToken': (pageToken==null)?'':pageToken
  }).then(renderMessageList.bind(null, labelId)).catch(handleApiError);
}

function renderMessageList(labelId, response) {
  var messages = response.result.messages;
  if (!messages || messages.length === 0) return;
  for(var i=0;i<messages.length;i++){
    var divId = "messages-"+messages[i].id;
    $("#messages-div").append("<div class=\"msg-row\" id=\""+divId+"\"></div>");
    gapi.client.gmail.users.messages.get({
      'userId': 'me',
      'id': messages[i].id,
      'format': 'metadata'
    }).then(addMessages.bind(null, divId)).catch(handleApiError);
  }
  if (response.result.nextPageToken) {
    $("#messages-div").append(
      "<div id=\"load-more-emails\" class=\"load-more\" onclick=\"fetchMessages('"+labelId+"', '"+response.result.nextPageToken+"')\">Load more emails</div>"
    );
  }
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function addMessages(divId, response){
  var isUnread = $.inArray("UNREAD", response.result.labelIds) !== -1;
  if (isUnread) $("#"+divId).addClass("unread");

  var from    = escapeHtml(getHeader(response.result.payload.headers, 'From'));
  var subject = escapeHtml(getHeader(response.result.payload.headers, 'Subject'));
  var time    = escapeHtml(formatTime(getHeader(response.result.payload.headers, 'Date')));

  $("#"+divId).append(
    "<a class=\"msg-item\" onclick=\"fetchMessage('"+response.result.id+"')\">" +
      "<div class=\"msg-header-row\">" +
        "<span class=\"msg-from\">"+from+"</span>" +
        "<span class=\"msg-time\">"+time+"</span>" +
      "</div>" +
      "<div class=\"msg-subject\">"+subject+"</div>" +
    "</a>"
  );
}

function fetchMessage(messageId){
  currentMessageId = messageId;
  $(".msg-row").removeClass("selected");
  $("#messages-" + messageId).addClass("selected");
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
    iframe.onload = function() {
      iframe.style.height = (iframe.contentDocument.documentElement.scrollHeight + 20) + 'px';
    };
    // Fallback for already-loaded iframes (sync writes)
    if (doc.readyState === 'complete') {
      iframe.style.height = (doc.documentElement.scrollHeight + 20) + 'px';
    }

    // Mark as read if still unread
    if ($.inArray("UNREAD", response.result.labelIds) !== -1) {
      gapi.client.gmail.users.messages.modify({
        'userId': 'me',
        'id': messageId,
        'resource': { 'removeLabelIds': ['UNREAD'] }
      }).then(function() {
        $("#messages-" + messageId).removeClass("unread");
        listLabels();
      }).catch(handleApiError);
    }
  }).catch(handleApiError);
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


var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatTime(dateString){
  var d = new Date(dateString);
  var now = new Date();
  if ((now - d) < 24*60*60*1000) {
    return formatNumber(d.getHours()) + ':' + formatNumber(d.getMinutes());
  }
  return MONTHS[d.getMonth()] + ' ' + d.getDate();
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

function decodeBase64(encoded) {
  var b64 = encoded.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '');
  return new TextDecoder().decode(Uint8Array.from(atob(b64), function(c){ return c.charCodeAt(0); }));
}

function getBody(message) {
  var encodedBody = '';
  if (typeof message.parts === 'undefined') {
    encodedBody = message.body.data || '';
  } else {
    encodedBody = getHTMLPart(message.parts) || getPlainPart(message.parts);
  }
  if (!encodedBody) return '<em>(No message body)</em>';
  return decodeBase64(encodedBody);
}

function getHTMLPart(arr) {
  for (var x = 0; x < arr.length; x++) {
    if (typeof arr[x].parts === 'undefined') {
      if (arr[x].mimeType === 'text/html') return arr[x].body.data;
    } else {
      var nested = getHTMLPart(arr[x].parts);
      if (nested) return nested;
    }
  }
  return '';
}

function getPlainPart(arr) {
  for (var x = 0; x < arr.length; x++) {
    if (typeof arr[x].parts === 'undefined') {
      if (arr[x].mimeType === 'text/plain') return arr[x].body.data;
    } else {
      var nested = getPlainPart(arr[x].parts);
      if (nested) return nested;
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

  return sendRequest.then(callback).catch(handleApiError);
}
