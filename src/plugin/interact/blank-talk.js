const path = require("path");
const fs = require("fs-extra");
const CSON = require("cson");

const random = require("../../util/random");

const logger = global.getLogger("data-maintain");
const infoFile = path.join(__dirname, "info.cson");
const INFO = readCSONFile(infoFile);

function readCSONFile(cson){
  try{
    fs.accessSync(cson, fs.R_OK|fs.W_OK);
    return CSON.parseCSONFile(cson);
    logger.info(`Successfully read ${cson}`);
  }
  catch(e){
    logger.error(`Fail to read cson from ${cson}`);
    logger.error(e);
    return undefined;
  }
}

function output(group, msg){
  global.bot.output("message.cq-bot.group", {
    src: {
      id: INFO.id,
      mod: path.basename(__filename, ".js")
    },
    gid: group,
    msg: msg
  });
}

module.exports = {
  run(){
    global.bot.onInput("message.@me", function(bundle){
      let ans = [
        "才不要理你! なのです!",
        "変態! なのです!",
        "ロリコン! なのです!",
        "醒醒你沒有女朋友! なのです!"
      ];
      output(bundle.fromGroup, random.choice(ans));
    };
  }
};
