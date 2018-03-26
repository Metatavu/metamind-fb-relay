/*jshint esversion: 6 */
/* global __dirname */

(() => {
  'use strict';
  
  const MetamindClient = require('metamind-client');
  const BootBot = require('bootbot');
  const config = require('nconf');
  const striptags = require('striptags');

  class Bot {

    constructor(botConfig, database) {
      this.story = botConfig.story;
      this.fbPageId = botConfig['page-id'];
      this.locale = botConfig.locale;
      this.timezone = botConfig.timezone;
      this.database = database;
      this.apiClient = this.buildMetamindApiClient(botConfig['api-url'], botConfig['client-id'], botConfig['client-secret']);
      this.sessionsApi = new MetamindClient.SessionsApi(this.apiClient);
      this.messagesApi = new MetamindClient.MessagesApi(this.apiClient);
      this.bootBot = new BootBot({
        accessToken: botConfig['fb-access-token'],
        verifyToken: config.get('fb:verify-token'),
        appSecret: config.get('fb:app-secret')
      });
      this.bootBot.on('message', this.onFacebookMessage.bind(this));
    }
    
    get pageId() {
      return this.fbPageId;
    }
    
    buildMetamindApiClient(apiUrl, clientId, clientSecret) {
      const apiClient = new MetamindClient.ApiClient();
      apiClient.basePath = apiUrl;
      apiClient.authentications = {
        'basicAuth': {
          type: 'basic',
          username: clientId,
          password: clientSecret
        }
      };
      return apiClient;
    }
    
    handleData(data) {
      this.bootBot.handleFacebookData(data);
    }
    
    processMetamindText(reply) {
      const messages = reply.response.split(/<br\s*\/?>/i);
      const result = [];
      messages.forEach((message) => {
        const cleanedMessage = striptags(message);
        if (cleanedMessage && cleanedMessage.length > 0) {
          result.push({text: cleanedMessage});
        }
      });
      
      if (reply && result.length > 0 && reply.quickResponses.length > 0) {
        result[result.length - 1].quickResponses = reply.quickResponses;
      }
      return result;
    }
    
    getErrorResponse() {
      //TODO: select response based on locale
      return [{text: "Minulla on nyt hiukan teknisiä ongelmia, yritä myöhemmin uudestaan."}];
    }
    
    async onFacebookMessage(payload, chat) {
      const text = payload.message.text;
      const userId = payload.sender.id;
      chat.sendAction('mark_seen');
      chat.sendAction('typing_on');

      let messages = [];
      try {
        const reply = await this.sendMetamindMessage(userId, text);
        messages = this.processMetamindText(reply);
      } catch (err) {
        console.error('Error getting response from Metamind', err);
        messages = this.getErrorResponse();
      }
      chat.sendAction('typing_off');
      messages.forEach(async (message) => {
        await this.sendFbMessage(chat, message);
      });
    }
    
    sendFbMessage(chat, message) {
      if (message.quickResponses) {
        return chat.say({
          text: message.text,
          quickReplies: message.quickResponses
        });
      } else {
        return chat.say(message.text); 
      }
    }
    
    async sendMetamindMessage(userId, text) {
      const botSession = await this.database.findBotSessionByUserId(userId);
      let sessionId = null;
      if (!botSession) {
        sessionId = await this.createMetamindSessionId(userId);
        await this.database.createBotSession(userId, sessionId);
      } else {
        sessionId = botSession.sessionId;
      }
  
      const message = MetamindClient.Message.constructFromObject({
        sessionId: sessionId,
        content: text
      });

      return this.messagesApi.createMessage(message);
    }
    
    createMetamindSessionId(userId) {
      const payload = MetamindClient.Session.constructFromObject({
        story: this.story,
        locale: this.locale,
        timeZone: this.timezone,
        visitor: this.resolveVisitor(userId)
      });

      return this.sessionsApi.createSession(payload)
        .then((session) => {
          return session.id;
        });
    }
    
    async resolveVisitor(userId) {
      try {
        const user = await this.bootBot.getUserProfile(userId);
        return `${user.first_name} ${user.last_name} (${userId})`;
      } catch(err) {
        console.error(`Error getting facebook user profile with userId: ${userId}`, err);
        return `Unidentified facebook user with id ${userId}`;
      }
    }  
  }
  
  module.exports = Bot;
  
})();