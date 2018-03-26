/*jshint esversion: 6 */
/* global __dirname */

(() => {
  'use strict';
  
  const Sequelize = require('sequelize');
  const config = require('nconf');
  
  class Database {
    
    constructor () {
      this.sequelize = new Sequelize(config.get('mysql:database'), config.get('mysql:username'), config.get('mysql:password'), {
        host: config.get('mysql:host'),
        dialect: 'mysql',
        logging: false,
        pool: {
          max: 5,
          min: 0,
          acquire: 30000,
          idle: 10000
        }
      });
      this.defineModels();
    }
    
    defineModels() {
      this.defineModel('BotSession', {
        userId: {
          type: Sequelize.STRING(191),
          primaryKey: true
        },
        sessionId:{
          type: Sequelize.STRING(191),
          allowNull: false
        }
      });
    }
    
    defineModel(name, attributes, options) {
      this[name] = this.sequelize.define(name, attributes, Object.assign(options || {}, {
        charset: 'utf8'
      }));
      
      this[name].sync();
    }

    createBotSession(userId, sessionId) {
      return this.BotSession.create({
        userId: userId,
        sessionId: sessionId
      });
    }
    
    findBotSessionByUserId(userId) {
      return this.BotSession.findOne({ where: { userId: userId} });
    }
    
    updateBotSession(userId, sessionId) {
      return this.findBotSessionByUserId(userId).then((botSession) => {
        botSession.sessionId = sessionId;
        return botSession.save();
      });
    }
  }

  module.exports = Database;

})();