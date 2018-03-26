/*jshint esversion: 6 */
/* global __dirname */

(() => {
  'use strict';
  
  const bodyParser = require('body-parser');
  const crypto = require('crypto');
  const config = require('nconf');

  class Routes {

    constructor(app, bots) {
      this.app = app;
      this.bots = bots;
      this.app.use(bodyParser.json({ verify: this.verifyRequestSignature.bind(this) }));
      this.registerRoutes();
    }
    
    registerRoutes() {
      this.app.get('/webhook', this.initializeWebhook.bind(this));
      this.app.post('/webhook', this.handleWebhook.bind(this));
    }
    
    verifyRequestSignature(req, res, buf) {
      const signature = req.headers['x-hub-signature'];
      if (!signature) {
        throw new Error('Missing signature header');
      } else {
        const elements = signature.split('=');
        const method = elements[0];
        const signatureHash = elements[1];
        const expectedHash = crypto.createHmac('sha1', config.get('fb:app-secret'))
          .update(buf)
          .digest('hex');

        if (signatureHash !== expectedHash) {
          throw new Error(`Invalid signature header, got: ${signatureHash} expected: ${expectedHash}`);
        }
      }
    }
    
    initializeWebhook(req, res) {
      if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === config.get('fb:verify-token')) {
        res.status(200).send(req.query['hub.challenge']);
      } else {
        console.error('Failed validation. Make sure the validation tokens match.');
        res.status(403).send('Failed validation. Make sure the validation tokens match.');
      }
    }
    
    handleWebhook(req, res) {
      const data = req.body;
      if (data.object !== 'page') {
        return;
      }

      const pageId = data.entry.id;
      for (let j = 0; j < data.entry.length; j++) {
        for(let i = 0; i < this.bots.length; i++) {
          if (this.bots[i].pageId === data.entry[j].id) {
            this.bots[i].handleData({entry: [data.entry[j]]});
            break;
          }
        }
      }

      res.status(200).send();
    }
  }
  
  module.exports = Routes;
  
})();