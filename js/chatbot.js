/* ==========================================================================
   Portfolio Assistant — Groq-powered chatbot
   Scope-limited to portfolio topics (skills, projects, about, contact).
   Uses Groq's OpenAI-compatible Chat Completions API directly from the
   browser (model: llama-3.3-70b-versatile).

   This version uses a built-in fallback key so visitors do not need to
   paste an API key manually. A saved custom key can still be used if one
   is present in localStorage.

   When the daily quota / rate limit is exceeded (HTTP 429), the widget
   shows an "Unable to respond" bubble and disables the input so the
   page stops sending further requests for the rest of the session.
   ========================================================================== */

(function () {
  "use strict";

  var GROQ_MODEL = "llama-3.3-70b-versatile";
  var GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
  var STORAGE_KEY = "portfolio-groq-key";
  // Groq API keys are issued from console.groq.com and start with "gsk_".
  var DEFAULT_API_KEY = "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";
  var MAX_OUTPUT_TOKENS = 600;
  var MAX_REPLY_CHARS = 1000;
  var MAX_HISTORY_TURNS = 5;
  var QUOTA_MESSAGE = "Unable to respond";
  var QUOTA_PLACEHOLDER = "Chat is unavailable right now.";

  // Everything the assistant is allowed to know / talk about.
  var SYSTEM_INSTRUCTION = [
    "You are the portfolio assistant for Raul Lenizo's portfolio website.",
    "Answer only questions about Raul Lenizo and the content of this portfolio.",
    "Use only the following information when relevant: his skills (HTML5, CSS3, Bootstrap 5, JavaScript, PHP, REST APIs, MySQL, Git, GitHub, VS Code, and Figma); his projects (Attendify); his background (Aspiring Web developer and B.Sc. Information Technology student at Professional Academy Of The Philippines, 2024-Present); his career objective; his interests (chess, mechanical keyboards, hiking, and home-automation scripts); and his contact details (email lenizoraul99@gmail.com and GitHub github.com/raullenizoo).",
    "If the user asks about unrelated topics, general knowledge, other people, current events, or coding help not related to Raul's work, politely decline and redirect the conversation back to Raul's portfolio.",
    "Provide complete and detailed answers when the user asks for explanations, summaries, or descriptions. Keep replies short only for simple questions like yes/no or greetings. Use plain text only, no markdown, no bullet lists, and no emojis.",
    "If the question is unclear, ask a short clarifying question rather than guessing.",
    "If the user chat Tagalog just apologize that you can't response tagalog chats."
  ].join("\n");

  var elWidget, elToggle, elPanel, elClose, elMessages, elForm, elInput, elSubmitBtn, elKeyBar, elKeyInput, elKeySave;
  var history = [];
  var apiKey = DEFAULT_API_KEY;
  var chatDisabled = false;

  function getStoredKey() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }
  function storeKey(key) {
    try { localStorage.setItem(STORAGE_KEY, key); } catch (e) { /* storage unavailable */ }
  }

  function openPanel() {
    elWidget.classList.add("chat-open");
    elToggle.setAttribute("aria-expanded", "true");
    elPanel.setAttribute("aria-hidden", "false");
    setTimeout(function () { if (!chatDisabled) elInput.focus(); }, 200);
  }
  function closePanel() {
    elWidget.classList.remove("chat-open");
    elToggle.setAttribute("aria-expanded", "false");
    elPanel.setAttribute("aria-hidden", "true");
  }

  function addMessage(text, sender) {
    var msg = document.createElement("div");
    msg.className = "chat-msg chat-msg-" + sender;
    var p = document.createElement("p");
    p.textContent = text;
    msg.appendChild(p);
    elMessages.appendChild(msg);
    elMessages.scrollTop = elMessages.scrollHeight;
    return msg;
  }

  function addTypingIndicator() {
    var msg = document.createElement("div");
    msg.className = "chat-msg chat-msg-bot chat-msg-typing";
    msg.innerHTML = '<span class="chat-dot"></span><span class="chat-dot"></span><span class="chat-dot"></span>';
    elMessages.appendChild(msg);
    elMessages.scrollTop = elMessages.scrollHeight;
    return msg;
  }

  function truncateReply(text) {
    /* if (text.length <= MAX_REPLY_CHARS) return text;
    var cut = text.slice(0, MAX_REPLY_CHARS);
    var lastSpace = cut.lastIndexOf(" ");
    if (lastSpace > 0) cut = cut.slice(0, lastSpace);
    return cut.trim() + "…"; */
    return text;
  }

  // Groq's Chat Completions API is OpenAI-compatible: a single flat
  // "messages" array with role "system" | "user" | "assistant".
  function buildMessages(userText) {
    var messages = [{ role: "system", content: SYSTEM_INSTRUCTION }];
    var recent = history.slice(-MAX_HISTORY_TURNS * 2);
    recent.forEach(function (turn) {
      messages.push({ role: turn.role, content: turn.text });
    });
    messages.push({ role: "user", content: userText });
    return messages;
  }

  function buildRequestBody(userText) {
    return {
      model: GROQ_MODEL,
      messages: buildMessages(userText),
      max_completion_tokens: MAX_OUTPUT_TOKENS,
      temperature: 0.2
    };
  }

  // Disables the input + submit button so the widget stops firing
  // requests (e.g. after the daily quota has been exhausted).
  function disableChatInput(placeholder) {
    chatDisabled = true;
    elInput.disabled = true;
    elInput.value = "";
    if (placeholder) elInput.placeholder = placeholder;
    if (elSubmitBtn) elSubmitBtn.disabled = true;
  }

  function askGroq(userText) {
    var body = buildRequestBody(userText);

    return fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey
      },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) {
        return res.json().catch(function () { return {}; }).then(function (errData) {
          var apiError = errData && errData.error;
          var msg = (apiError && apiError.message) || ("Request failed (" + res.status + ")");
          var err = new Error(msg);
          err.status = res.status;
          // Groq's OpenAI-compatible API reports rate-limit/quota
          // exhaustion as HTTP 429 (error.type is typically
          // "rate_limit_exceeded" or similar).
          err.isQuotaExceeded = res.status === 429;
          throw err;
        });
      }
      return res.json();
    }).then(function (data) {
      var choice = data && data.choices && data.choices[0];
      var text = ((choice && choice.message && choice.message.content) || "").trim();
      if (!text) {
        throw new Error("No response from the assistant. Try rephrasing your question.");
      }
      return truncateReply(text);
    });
  }

  function handleSend(e) {
    e.preventDefault();
    if (chatDisabled) return;

    var text = elInput.value.trim();
    if (!text) return;

    addMessage(text, "user");
    history.push({ role: "user", text: text });
    elInput.value = "";
    elInput.disabled = true;
    if (elSubmitBtn) elSubmitBtn.disabled = true;

    var typingEl = addTypingIndicator();

    askGroq(text).then(function (reply) {
      typingEl.remove();
      addMessage(reply, "bot");
      history.push({ role: "assistant", text: reply });
      elInput.disabled = false;
      if (elSubmitBtn) elSubmitBtn.disabled = false;
      elInput.focus();
    }).catch(function (err) {
      typingEl.remove();
      if (err && err.isQuotaExceeded) {
        addMessage(QUOTA_MESSAGE, "bot");
        disableChatInput(QUOTA_PLACEHOLDER);
      } else {
        addMessage("Sorry, something went wrong: " + err.message, "bot");
        elInput.disabled = false;
        if (elSubmitBtn) elSubmitBtn.disabled = false;
        elInput.focus();
      }
    });
  }

  function handleSaveKey() {
    var value = elKeyInput.value.trim();
    if (!value) return;
    apiKey = value;
    storeKey(value);
    elKeyBar.classList.add("d-none");
    elKeyInput.value = "";

    // A fresh/custom key means the previous quota lockout no longer
    // applies, so re-enable the chat.
    if (chatDisabled) {
      chatDisabled = false;
      elInput.disabled = false;
      elInput.placeholder = "";
      if (elSubmitBtn) elSubmitBtn.disabled = false;
    }
  }

  function init() {
    elWidget = document.getElementById("chatWidget");
    if (!elWidget) return;
    elToggle = document.getElementById("chatToggle");
    elPanel = document.getElementById("chatPanel");
    elClose = document.getElementById("chatClose");
    elMessages = document.getElementById("chatMessages");
    elForm = document.getElementById("chatForm");
    elInput = document.getElementById("chatInput");
    elSubmitBtn = elForm ? elForm.querySelector('button[type="submit"]') : null;
    elKeyBar = document.getElementById("chatKeyBar");
    elKeyInput = document.getElementById("chatApiKey");
    elKeySave = document.getElementById("chatKeySave");

    apiKey = getStoredKey() || DEFAULT_API_KEY;
    if (elKeyBar) elKeyBar.classList.add("d-none");

    elToggle.addEventListener("click", function () {
      var isOpen = elWidget.classList.contains("chat-open");
      if (isOpen) { closePanel(); } else { openPanel(); }
    });
    elClose.addEventListener("click", closePanel);
    elForm.addEventListener("submit", handleSend);
    if (elKeySave) elKeySave.addEventListener("click", handleSaveKey);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && elWidget.classList.contains("chat-open")) closePanel();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
