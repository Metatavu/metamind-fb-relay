/*jshint esversion: 6 */
/* global __dirname */

(() => {
  'use strict';
  
  const config = require('nconf');
  config.file({file: `${__dirname}/config.json`});
  
  const argv = require('minimist')(process.argv.slice(2));
  const app = require('express')();
  const http = require('http').Server(app);
  const Routes = require(`${__dirname}/routes`);
  const Bot = require(`${__dirname}/bot`);
  const bluebird = require('bluebird');
  const redis = require('redis');
  bluebird.promisifyAll(redis);
  const redisClient = redis.createClient();

  const port = argv.port || 3000;
  app.set('port', port);

  const bots = config.get('bots').map((botConfig) => {
    return new Bot(botConfig, redisClient);
  });
  
  new Routes(app, bots);
  http.listen(app.get('port'), () => { console.log(`Listening on port: ${app.get('port')}`); });

})();