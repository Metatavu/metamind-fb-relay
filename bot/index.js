/*jshint esversion: 6 */
/* global __dirname */

(() => {
  'use strict';
  
  const MetamindClient = require('metamind-client');
  const BootBot = require('bootbot');
  const config = require('nconf');
  const sanitizeHtml = require('sanitize-html');

  class Bot {

    constructor(botConfig, redisClient) {
      this.redisClient = redisClient;
      this.story = botConfig.story;
      this.fbPageId = botConfig['page-id'];
      this.locale = botConfig.locale;
      this.timezone = botConfig.timezone;
      this.getStartedPostBackPayload = botConfig['get-started-payload'];
      this.maxSessionIdle = botConfig['max-idle-session'];
      this.apiClient = this.buildMetamindApiClient(botConfig['api-url'], botConfig['client-id'], botConfig['client-secret']);
      this.sessionsApi = new MetamindClient.SessionsApi(this.apiClient);
      this.messagesApi = new MetamindClient.MessagesApi(this.apiClient);
      this.bootBot = new BootBot({
        accessToken: botConfig['fb-access-token'],
        verifyToken: config.get('fb:verify-token'),
        appSecret: config.get('fb:app-secret')
      });

      this.bootBot.on('message', this.onFacebookMessage.bind(this));
      this.bootBot.on('postback', this.onFacebookPostback.bind(this));
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
      const texts = [];

      messages.forEach((message) => {
        const cleanedMessage = sanitizeHtml(message, {
          allowedTags: [],
          allowedAttributes: [],
          transformTags: {
            'a': function(tagName, attribs) {
              return {
                tagName: 'a',
                text: attribs.href || ''
              };
            }
          }
        });
        
        if (cleanedMessage && cleanedMessage.length > 0) {
          texts.push(cleanedMessage);
        }
      });
      
      const result = {text: texts.join('\n')};
      if (reply.quickResponses.length > 0) {
        result.quickResponses = reply.quickResponses;
      }

      return result;
    }
    
    getErrorResponse() {
      //TODO: select response based on locale
      return [{text: "Minulla on nyt hiukan teknisiä ongelmia, yritä myöhemmin uudestaan."}];
    }

    async onFacebookPostback(payload, chat) {
      if (payload.postback && payload.postback.payload) {
        const postbackPayload = payload.postback.payload;
        if (postbackPayload === this.getStartedPostBackPayload) {
          const userId = payload.sender.id;
          await this.processFacebookEvent(userId, 'INIT', chat);
        }
      }
    }
    
    async onFacebookMessage(payload, chat) {
      const text = payload.message.text;
      const userId = payload.sender.id;
      await this.processFacebookEvent(userId, text, chat);
    }
    
    async processFacebookEvent(userId, text, chat) {
      chat.sendAction('mark_seen');

      let messages = [];
      try {
        const reply = await this.sendMetamindMessage(userId, text);
        messages = this.processMetamindText(reply);
      } catch (err) {
        console.error('Error getting response from Metamind', err);
        messages = this.getErrorResponse();
      }
      
      await this.sendFbMessage(chat, messages);
    }
    
    sendFbMessage(chat, message) {
      if (message.quickResponses) {
        return chat.say({
          text: message.text,
          quickReplies: message.quickResponses
        });
      } else {
        return chat.say(message.text, { typing: true }); 
      }
    }
    
    async sendMetamindMessage(userId, text) {
      const botSession = text === 'INIT' ? null : await this.redisClient.getAsync(userId);
      let sessionId = null;
      let createdSession = false;
      if (!botSession) {
        sessionId = await this.createMetamindSessionId(userId);
        createdSession = true;
      } else {
        sessionId = botSession;
      }
      
      this.redisClient.set(userId, sessionId, 'EX', this.maxSessionIdle);
      const message = MetamindClient.Message.constructFromObject({
        sessionId: sessionId,
        content: createdSession ? 'INIT' : text
      });

      return this.messagesApi.createMessage(message);
    }
    
    async createMetamindSessionId(userId) {
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
        return user ? `${user.first_name} ${user.last_name} (${userId})` : "Unidentified facebook user";
      } catch(err) {
        console.error(`Error getting facebook user profile with userId: ${userId}`, err);
        return `Unidentified facebook user with id ${userId}`;
      }
    }  
  }
  
  module.exports = Bot;
  
})();