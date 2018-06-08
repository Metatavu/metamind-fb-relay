/*jshint esversion: 6 */
/* global __dirname */

(() => {
  'use strict';
  
  const config = require("nconf");
  config.file({file: `${__dirname}/../config.json`});
  const argv = require("minimist")(process.argv.slice(2));
  const request = require("request");
  
  const botIndex = argv["bot-index"];
  
  if (!Number.isInteger(botIndex)) {
    console.error("Use --bot-index parameter to select which bot you want to configure.");
    return;
  }
  
  const bot = config.get("bots")[botIndex];
  if (!bot) {
    console.error(`Bot with index ${botIndex} cannot be found`);
    return;
  }
  
  const greetingConfig = bot["greetings"];
  if (!greetingConfig) {
    console.error("Add greeting property to your bots configuration");
    return;
  }
  
  const accessToken = bot["fb-access-token"];
  if (!accessToken) {
    console.error("Add fb-access-token property to your bots configuration");
    return;
  }
  
  const url = `https://graph.facebook.com/v2.6/me/messenger_profile?access_token=${accessToken}`;
  
  request({
    "url": url,
    "method": "POST",
    "json": {
      "greeting": greetingConfig
    }
  }, (error, resp, body) => {
    if (!error && resp.statusCode === 200) {
      console.log("Successfully set greeting");
      console.log(body);
    } else {
      console.error(`Request failed with statusCode: ${resp.statusCode}`);
      if (body) {
        console.error(body);
      }
      if (error) {
        console.error(error);
      }
    }
  });
  
})();