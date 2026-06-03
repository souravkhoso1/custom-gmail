(function() {
'use strict';

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
    $('#compose-btn').show();
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
    $('#compose-btn').show();
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
  $('#compose-btn').hide();
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

function searchMessages(pageToken) {
  var q = $('#search-input').val().trim();
  if (!q) return;
  if (!pageToken) {
    currentLabel = null;
    currentMessageId = null;
    $('[data-label]').removeClass('active');
    $("#messages-div").html('<div class="spinner-wrap"><div class="spinner-border spinner-border-sm text-secondary" role="status"></div></div>');
    $("#message-div").html('');
  } else {
    $("#load-more-emails").remove();
  }
  gapi.client.gmail.users.messages.list({
    userId: 'me',
    q: q,
    maxResults: 10,
    pageToken: pageToken || ''
  }).then(function(response) {
    $("#messages-div").html('');
    var messages = response.result.messages;
    if (!messages || messages.length === 0) {
      $("#messages-div").html('<div class="empty-state"><i class="fas fa-search fa-2x text-muted mb-2"></i><p class="text-muted mb-0">No results</p></div>');
      return;
    }
    for (var i = 0; i < messages.length; i++) {
      var divId = "messages-" + messages[i].id;
      $("#messages-div").append('<div class="msg-row" id="' + divId + '"></div>');
      gapi.client.gmail.users.messages.get({ userId: 'me', id: messages[i].id, format: 'metadata' })
        .then(addMessages.bind(null, divId)).catch(handleApiError);
    }
    if (response.result.nextPageToken) {
      var tok = response.result.nextPageToken;
      $("#messages-div").append('<div id="load-more-emails" class="load-more" onclick="searchMoreMessages(\'' + tok + '\')">Load more results</div>');
    }
  }).catch(handleApiError);
}

window.searchMessages = searchMessages;

function searchMoreMessages(pageToken) {
  searchMessages(pageToken);
}
window.searchMoreMessages = searchMoreMessages;

function fetchMessages(labelId, pageToken=null){
  if (pageToken == null) {
    currentLabel = labelId;
    currentMessageId = null;
    $("#messages-div").html('<div class="spinner-wrap"><div class="spinner-border spinner-border-sm text-secondary" role="status"></div></div>');
    $('[data-label]').removeClass('active');
    $('[data-label="' + labelId + '"]').addClass('active');
  } else {
    $("#load-more-emails").remove();
  }
  gapi.client.gmail.users.threads.list({
    userId: 'me',
    labelIds: labelId,
    maxResults: 10,
    pageToken: pageToken || ''
  }).then(renderThreadList.bind(null, labelId)).catch(handleApiError);
}

function renderThreadList(labelId, response) {
  $("#messages-div").html("");
  var threads = response.result.threads;
  if (!threads || threads.length === 0) {
    $("#messages-div").html('<div class="empty-state"><i class="fas fa-inbox fa-2x text-muted mb-2"></i><p class="text-muted mb-0">No messages</p></div>');
    return;
  }
  for (var i = 0; i < threads.length; i++) {
    var divId = "messages-" + threads[i].id;
    $("#messages-div").append('<div class="msg-row" id="' + divId + '"></div>');
    gapi.client.gmail.users.threads.get({
      userId: 'me', id: threads[i].id, format: 'metadata',
      metadataHeaders: ['From', 'To', 'Subject', 'Date']
    }).then(addThread.bind(null, divId)).catch(handleApiError);
  }
  if (response.result.nextPageToken) {
    var tok = response.result.nextPageToken;
    $("#messages-div").append(
      '<div id="load-more-emails" class="load-more" onclick="fetchMessages(\'' + labelId + '\', \'' + tok + '\')">Load more emails</div>'
    );
  }
}

function addThread(divId, response) {
  var thread = response.result;
  var msgs = thread.messages || [];
  var last = msgs[msgs.length - 1];
  if (!last) return;

  var isUnread = msgs.some(function(m) { return (m.labelIds || []).indexOf('UNREAD') !== -1; });
  if (isUnread) $("#"+divId).addClass("unread");

  var h = last.payload.headers;
  var from    = escapeHtml(getHeader(h, 'From'));
  var subject = escapeHtml(getHeader(h, 'Subject'));
  var time    = escapeHtml(formatTime(getHeader(h, 'Date')));
  var countBadge = msgs.length > 1
    ? '<span class="thread-count">' + msgs.length + '</span>'
    : '';

  $("#"+divId).append(
    '<a class="msg-item" onclick="fetchThread(\'' + thread.id + '\')">' +
      '<div class="msg-header-row">' +
        '<span class="msg-from">' + from + countBadge + '</span>' +
        '<span class="msg-time">' + time + '</span>' +
      '</div>' +
      '<div class="msg-subject">' + subject + '</div>' +
    '</a>'
  );
}

// Keep legacy renderMessageList alias (used by search results)
function renderMessageList(labelId, response) {
  $("#messages-div").html("");
  var messages = response.result.messages;
  if (!messages || messages.length === 0) {
    $("#messages-div").html('<div class="empty-state"><i class="fas fa-inbox fa-2x text-muted mb-2"></i><p class="text-muted mb-0">No messages</p></div>');
    return;
  }
  for(var i=0;i<messages.length;i++){
    var divId = "messages-"+messages[i].id;
    $("#messages-div").append("<div class=\"msg-row\" id=\""+divId+"\"></div>");
    gapi.client.gmail.users.messages.get({
      'userId': 'me', 'id': messages[i].id, 'format': 'metadata'
    }).then(addMessages.bind(null, divId)).catch(handleApiError);
  }
  if (response.result.nextPageToken) {
    var tok = response.result.nextPageToken;
    $("#messages-div").append(
      '<div id="load-more-emails" class="load-more" onclick="searchMoreMessages(\'' + tok + '\')">Load more results</div>'
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

function fetchThread(threadId) {
  currentMessageId = threadId;
  $(".msg-row").removeClass("selected");
  $("#messages-" + threadId).addClass("selected");
  if (window.innerWidth < 768) $("#message-div").addClass("visible");
  $("#message-div").html(
    '<button class="back-btn btn btn-sm btn-outline-secondary mb-3" onclick="$(\'#message-div\').removeClass(\'visible\')"><i class="fas fa-arrow-left me-1"></i>Back</button>' +
    '<div class="d-flex justify-content-center" style="min-height:80px"><div class="spinner-border text-secondary" role="status"></div></div>'
  );
  gapi.client.gmail.users.threads.get({ userId: 'me', id: threadId })
    .then(function(response) {
      var msgs = (response.result.messages || []).slice().reverse();
      var html = '<button class="back-btn btn btn-sm btn-outline-secondary mb-3" onclick="$(\'#message-div\').removeClass(\'visible\')"><i class="fas fa-arrow-left me-1"></i>Back</button>';
      msgs.forEach(function(msg, idx) {
        var h = msg.payload.headers;
        var esc = function(s){ return s ? s.replace(/</g, '&lt;').replace(/>/g, '&gt;') : ''; };
        var from    = esc(getHeader(h, 'From'));
        var to      = esc(getHeader(h, 'To'));
        var date    = getHeader(h, 'Date');
        var subject = getHeader(h, 'Subject');
        var isFirst = idx === 0;
        var frameId = 'email-frame-' + msg.id;
        var atts    = attachmentNames(msg.payload, msg.id);
        var attsHtml = atts ? '<div class="message-attachments mt-2"><b>Attachments:</b> ' + atts + '</div>' : '';
        html +=
          '<div class="thread-message' + (isFirst ? ' thread-message--open' : ' thread-message--collapsed') + '" data-msg-id="' + escapeHtml(msg.id) + '">' +
            '<div class="thread-message-header">' +
              '<span class="fw-semibold">' + from + '</span>' +
              '<span class="text-muted ms-auto small">' + escapeHtml(formatTime(date)) + '</span>' +
            '</div>' +
            (isFirst ?
              '<div class="thread-message-meta">' +
                '<span class="meta-label">To</span><span class="meta-value">' + to + '</span>' +
                '<span class="meta-label">Date</span><span class="meta-value">' + date + '</span>' +
              '</div>' +
              attsHtml +
              '<div class="message-body mt-2"><iframe id="' + frameId + '" class="email-iframe" sandbox="allow-same-origin" frameborder="0"></iframe></div>'
              : ''
            ) +
          '</div>';
      });
      $("#message-div").html(html);

      // Write body into most-recent (first) iframe
      var lastMsg = msgs[0];
      var iframe = document.getElementById('email-frame-' + lastMsg.id);
      if (iframe) {
        var doc = iframe.contentDocument;
        doc.open(); doc.write(getBody(lastMsg.payload)); doc.close();
        iframe.onload = function() { iframe.style.height = (iframe.contentDocument.documentElement.scrollHeight + 20) + 'px'; };
        if (doc.readyState === 'complete') iframe.style.height = (doc.documentElement.scrollHeight + 20) + 'px';
      }

      // Toggle collapsed messages on click
      $(document).off('click.thread').on('click.thread', '.thread-message--collapsed .thread-message-header', function() {
        var msgId = $(this).closest('.thread-message').data('msg-id');
        fetchMessage(msgId);
      });

      // Mark thread messages as read
      msgs.forEach(function(msg) {
        if ((msg.labelIds || []).indexOf('UNREAD') !== -1) {
          gapi.client.gmail.users.messages.modify({ userId: 'me', id: msg.id, resource: { removeLabelIds: ['UNREAD'] } })
            .then(function() { $("#messages-" + threadId).removeClass("unread"); listLabels(); })
            .catch(handleApiError);
        }
      });
    }).catch(handleApiError);
}
window.fetchThread = fetchThread;

function fetchMessage(messageId){
  currentMessageId = messageId;
  $(".msg-row").removeClass("selected");
  $("#messages-" + messageId).addClass("selected");
  if (window.innerWidth < 768) $("#message-div").addClass("visible");
  $("#message-div").html(
    '<button class="back-btn btn btn-sm btn-outline-secondary mb-3" onclick="$(\'#message-div\').removeClass(\'visible\')"><i class="fas fa-arrow-left me-1"></i>Back</button>' +
    '<div class="d-flex justify-content-center align-items-center" style="min-height:100px"><div class="spinner-border text-secondary" role="status"></div></div>'
  );
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
    var attachments = attachmentNames(response.result.payload, messageId);

    var metaRows =
      "<span class=\"meta-label\">From</span><span class=\"meta-value\">"+from+"</span>" +
      (replyTo ? "<span class=\"meta-label\">Reply-To</span><span class=\"meta-value\">"+replyTo+"</span>" : "") +
      "<span class=\"meta-label\">To</span><span class=\"meta-value\">"+to+"</span>" +
      "<span class=\"meta-label\">Date</span><span class=\"meta-value\">"+date+"</span>";

    var attachmentsHtml = attachments
      ? '<div class="message-attachments"><b>Attachments:</b> ' + attachments + '</div>'
      : '';

    var replyAddr = getHeader(h, 'Reply-To') || getHeader(h, 'From');
    var toAddr    = getHeader(h, 'To');
    var replySubject = subject.match(/^Re:/i) ? subject : 'Re: ' + subject;
    var fwdSubject   = subject.match(/^Fwd:/i) ? subject : 'Fwd: ' + subject;

    var frameId = "email-frame-" + messageId;
    $("#message-div").html(
      "<button class=\"back-btn btn btn-sm btn-outline-secondary mb-3\" onclick=\"$('#message-div').removeClass('visible')\"><i class=\"fas fa-arrow-left me-1\"></i>Back</button>" +
      "<div class=\"message-detail\">" +
        "<div class=\"message-detail-header\">" +
          "<div class=\"message-subject-line\">"+subject+"</div>" +
          "<div class=\"message-meta\">"+metaRows+"</div>" +
          attachmentsHtml +
          "<div class=\"mt-3 d-flex flex-wrap gap-2\">" +
            "<button class=\"btn btn-sm btn-outline-primary\" id=\"btn-reply\"><i class=\"fas fa-reply me-1\"></i>Reply</button>" +
            "<button class=\"btn btn-sm btn-outline-secondary\" id=\"btn-reply-all\"><i class=\"fas fa-reply-all me-1\"></i>Reply All</button>" +
            "<button class=\"btn btn-sm btn-outline-secondary\" id=\"btn-forward\"><i class=\"fas fa-forward me-1\"></i>Forward</button>" +
            "<button class=\"btn btn-sm btn-outline-secondary ms-auto\" id=\"btn-archive\" title=\"Archive\"><i class=\"fas fa-archive\"></i></button>" +
            "<button class=\"btn btn-sm btn-outline-warning\" id=\"btn-spam\" title=\"Mark as Spam\"><i class=\"fas fa-exclamation-circle\"></i></button>" +
            "<button class=\"btn btn-sm btn-outline-danger\" id=\"btn-trash\" title=\"Delete\"><i class=\"fas fa-trash\"></i></button>" +
          "</div>" +
        "</div>" +
        "<div class=\"message-body\">" +
          "<iframe id=\""+frameId+"\" class=\"email-iframe\" sandbox=\"allow-same-origin\" frameborder=\"0\"></iframe>" +
        "</div>" +
      "</div>"
    );

    $('#btn-reply').on('click', function() {
      openCompose(replyAddr, '', '', replySubject, '');
    });
    $('#btn-reply-all').on('click', function() {
      openCompose(replyAddr, toAddr, '', replySubject, '');
    });
    $('#btn-forward').on('click', function() {
      openCompose('', '', '', fwdSubject, '');
    });

    $('#btn-trash').on('click', function() {
      gapi.client.gmail.users.messages.trash({ userId: 'me', id: messageId })
        .then(function() {
          $("#messages-" + messageId).remove();
          $("#message-div").html('');
          listLabels();
        }).catch(handleApiError);
    });
    $('#btn-archive').on('click', function() {
      gapi.client.gmail.users.messages.modify({
        userId: 'me', id: messageId,
        resource: { removeLabelIds: ['INBOX'] }
      }).then(function() {
        $("#messages-" + messageId).remove();
        $("#message-div").html('');
        listLabels();
      }).catch(handleApiError);
    });
    $('#btn-spam').on('click', function() {
      gapi.client.gmail.users.messages.modify({
        userId: 'me', id: messageId,
        resource: { addLabelIds: ['SPAM'], removeLabelIds: ['INBOX'] }
      }).then(function() {
        $("#messages-" + messageId).remove();
        $("#message-div").html('');
        listLabels();
      }).catch(handleApiError);
    });

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

function collectAttachments(payloadObj) {
  var result = [];
  var parts = payloadObj.parts || [];
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i];
    if (part.filename && part.filename.length > 0 && part.body && part.body.attachmentId) {
      result.push({ name: part.filename, id: part.body.attachmentId, mimeType: part.mimeType });
    }
    if (part.parts) result = result.concat(collectAttachments(part));
  }
  return result;
}

function attachmentNames(payloadObj, messageId) {
  var attachments = collectAttachments(payloadObj);
  if (!attachments.length) return '';
  return attachments.map(function(att, i) {
    var safeId = escapeHtml(att.id);
    var safeName = escapeHtml(att.name);
    return '<a href="#" class="attachment-link me-2" data-att-id="' + safeId + '" data-att-name="' + safeName + '" data-msg-id="' + escapeHtml(messageId) + '">' +
      '<i class="fas fa-paperclip me-1"></i>' + safeName + '</a>';
  }).join('');
}

function downloadAttachment(messageId, attachmentId, filename) {
  gapi.client.gmail.users.messages.attachments.get({ userId: 'me', messageId: messageId, id: attachmentId })
    .then(function(resp) {
      var data = resp.result.data.replace(/-/g, '+').replace(/_/g, '/');
      var bytes = atob(data);
      var arr = new Uint8Array(bytes.length);
      for (var i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      var blob = new Blob([arr]);
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }).catch(handleApiError);
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

function collectInlineParts(parts, map) {
  (parts || []).forEach(function(part) {
    var cid = getHeader(part.headers || [], 'Content-ID');
    if (cid && part.body && part.body.data) {
      // Strip angle brackets: <ii_abc123> → ii_abc123
      var id = cid.replace(/^<|>$/g, '');
      map[id] = { mimeType: part.mimeType, data: part.body.data };
    }
    if (part.parts) collectInlineParts(part.parts, map);
  });
}

function resolveCidUrls(html, payload) {
  var map = {};
  collectInlineParts(payload.parts, map);
  if (!Object.keys(map).length) return html;
  return html.replace(/cid:([^\s"'>)]+)/gi, function(_, id) {
    var part = map[id];
    if (!part) return 'cid:' + id;
    var b64 = part.data.replace(/-/g, '+').replace(/_/g, '/');
    return 'data:' + part.mimeType + ';base64,' + b64;
  });
}

function getBody(message) {
  var encodedBody = '';
  if (typeof message.parts === 'undefined') {
    encodedBody = message.body.data || '';
  } else {
    encodedBody = getHTMLPart(message.parts) || getPlainPart(message.parts);
  }
  if (!encodedBody) return '<em>(No message body)</em>';
  var html = decodeBase64(encodedBody);
  return resolveCidUrls(html, message);
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

function openCompose(to, cc, bcc, subject, body) {
  $('#compose-to').val(to);
  $('#compose-cc').val(cc);
  $('#compose-bcc').val(bcc);
  $('#compose-subject').val(subject);
  $('#compose-body').val(body);
  $('#compose-send-btn').prop('disabled', false);
  new bootstrap.Modal(document.getElementById('compose-modal')).show();
}

function clearAllFields(){
  bootstrap.Modal.getInstance(document.getElementById('compose-modal')).hide();
  $('#compose-to, #compose-cc, #compose-bcc, #compose-subject, #compose-body').val('');
  $('#compose-send-btn').prop('disabled', false);
}

function sendEmail() {
  var to      = $('#compose-to').val().trim();
  var cc      = $('#compose-cc').val().trim();
  var bcc     = $('#compose-bcc').val().trim();
  var subject = $('#compose-subject').val();
  var body    = $('#compose-body').val();
  if (!to) return;

  $('#compose-send-btn').prop('disabled', true);

  var headers = { 'To': to, 'Subject': subject };
  if (cc)  headers['Cc']  = cc;
  if (bcc) headers['Bcc'] = bcc;

  sendMessage(headers, body, clearAllFields);
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

// Attachment download (delegated)
$(document).on('click', '.attachment-link', function(e) {
  e.preventDefault();
  downloadAttachment($(this).data('msg-id'), $(this).data('att-id'), $(this).data('att-name'));
});

// Mobile sidebar toggle
$('#sidebar-toggle').on('click', function() {
  $('#sidebar').toggleClass('open');
  $('#sidebar-overlay').toggleClass('d-none');
});
$('#sidebar-overlay').on('click', function() {
  $('#sidebar').removeClass('open');
  $('#sidebar-overlay').addClass('d-none');
});
// Close sidebar when a label is clicked on mobile
$('[data-label]').on('click', function() {
  if (window.innerWidth < 768) {
    $('#sidebar').removeClass('open');
    $('#sidebar-overlay').addClass('d-none');
  }
});

// Keyboard navigation
document.addEventListener('keydown', function(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  var rows = $('.msg-row').toArray();
  if (!rows.length) return;
  var idx = rows.findIndex(function(r){ return $(r).hasClass('selected'); });

  if (e.key === 'j' || e.key === 'ArrowDown') {
    var next = rows[Math.min(idx + 1, rows.length - 1)];
    var msgId = next.id.replace('messages-', '');
    fetchMessage(msgId);
  } else if (e.key === 'k' || e.key === 'ArrowUp') {
    var prev = rows[Math.max(idx - 1, 0)];
    var msgId = prev.id.replace('messages-', '');
    fetchMessage(msgId);
  } else if ((e.key === 'Enter') && idx !== -1) {
    fetchMessage(rows[idx].id.replace('messages-', ''));
  }
});

// Expose functions called from inline HTML handlers
window.gapiLoaded       = gapiLoaded;
window.gisLoaded        = gisLoaded;
window.fetchMessages    = fetchMessages;
window.fetchMessage     = fetchMessage;
window.sendEmail        = sendEmail;

})();
