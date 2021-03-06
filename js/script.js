// Client ID and API key from the Developer Console
var CLIENT_ID = '401313310525-1hfkof6knp65pc9d63ihvmomb1cn3q8o.apps.googleusercontent.com';

// Array of API discovery doc URLs for APIs used by the quickstart
var DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest"];

// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
var SCOPES = 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send';

var authorizeButton = document.getElementById('authorize_button');
var signoutButton = document.getElementById('signout_button');



/**
 *  On load, called to load the auth2 library and API client library.
 */
function handleClientLoad() {
  gapi.load('client:auth2', initClient);
}

/**
 *  Initializes the API client library and sets up sign-in state
 *  listeners.
 */
function initClient() {
  gapi.client.init({
    discoveryDocs: DISCOVERY_DOCS,
    clientId: CLIENT_ID,
    scope: SCOPES
  }).then(function () {
    // Listen for sign-in state changes.
    gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);

    // Handle the initial sign-in state.
    updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
    authorizeButton.onclick = handleAuthClick;
    signoutButton.onclick = handleSignoutClick;
  });
}

/**
 *  Called when the signed in status changes, to update the UI
 *  appropriately. After a sign-in, the API is called.
 */
function updateSigninStatus(isSignedIn) {
  if (isSignedIn) {
    authorizeButton.style.display = 'none';
    signoutButton.style.display = 'block';
    listLabels();
    //listUserInfo();
    //listMessages();
  } else {
    authorizeButton.style.display = 'block';
    signoutButton.style.display = 'none';
  }
}

/**
 *  Sign in the user upon button click.
 */
function handleAuthClick(event) {
  gapi.auth2.getAuthInstance().signIn();
}

/**
 *  Sign out the user upon button click.
 */
function handleSignoutClick(event) {
  gapi.auth2.getAuthInstance().signOut();
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
  $("#"+labelId).html(response.result.messagesUnread);
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
    $("#messages-div").append("<div class=\"messages-li transparent-background messages-border\" id=\""+divId+"\"></div>");
    gapi.client.gmail.users.messages.get({
      'userId': 'me',
      'id': messages[i].id,
      'format': 'metadata'
    }).then(addMessages.bind(null, divId));
  }
  $("#messages-div").append(
  "<div class=\"col-sm-12 messages-content\" id=\"load-more-emails\" style=\"text-align:center\" onClick=\"fetchMessages('"+labelId+"', '"+response.result.nextPageToken+"')\">"+
    "<b>Load More Emails</b>"+
  "</div>"
  );
}

function addMessages(divId, response){
    $("#"+divId).append(
        "<a class=\"messages-content\" onclick=\"fetchMessage('"+response.result.id+"')\">"+
          "<span class=\"messages-time\" style=\"float:right\">"+formatTime(getHeader(response.result.payload.headers, 'Date'))+"</span>"+
          "<span class=\"messages-from\">"+decodeURIComponent(escape(getHeader(response.result.payload.headers, 'From')))+"</span><br>"+
          "<span class=\"messages-subject\">"+getHeader(response.result.payload.headers, 'Subject')+"</span>"+
        "</a>");
    if($.inArray("UNREAD", response.result.labelIds)==1){
      $("#"+divId).css("background-color", "#80bfff");
    } else {
      $("#"+divId).css("background-color", "#ffffff");
    }
}

function fetchMessage(messageId){
  $("#message-div").html("");
  gapi.client.gmail.users.messages.get({
    'userId': 'me',
    'id': messageId
  }).then(function(response) {
    $("#message-div").append(
      "<b>From</b>: <span id=\"message-from\">"+getHeader(response.result.payload.headers, 'From').replace(/>/g, '&gt;').replace(/</g, '&lt;') + "</span><br>" +
      "<b>Reply-To</b>: <span id=\"message-reply-to\">"+getHeader(response.result.payload.headers, 'Reply-To').replace(/>/g, '&gt;').replace(/</g, '&lt;') + "</span><br>" +
      "<b>To</b>: <span id=\"message-to\">"+getHeader(response.result.payload.headers, 'To').replace(/>/g, '&gt;').replace(/</g, '&lt;') + "</span><br>" +
      "<b>Date</b>: <span id=\"message-date\">"+getHeader(response.result.payload.headers, 'Date') + "</span><br>" +
      "<b>Subject</b>: <span id=\"message-subject\">"+getHeader(response.result.payload.headers, 'Subject') + "</span><br>" +
      ((attachmentNames(response.result.payload).length>0)?("<b>Attachments</b>: <span id=\"message-attachments\">" +attachmentNames(response.result.payload) + "</span><br>"):"")+
      "<br><br>" +
      getBody(response.result.payload)
    );
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
