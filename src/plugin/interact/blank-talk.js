const path = require("path");
const fs = require("fs-extra");
const CSON = require("cson");

const random = require("../../util/random");
const ch = require("../../lang/chinese");

const logger = global.getLogger("data-maintain");
const infoFile = path.join(__dirname, "info.cson");
const swordFile = path.join(__dirname, "sensi.cson");
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
      // let ans = [
      //   "才不要理你! なのです!",
      //   "変態! なのです!",
      //   "ロリコン! なのです!",
      //   "醒醒你沒有女朋友! なのです!"
      // ];
      let suggest = "你可以問電醬的問題有3個：\n   - <艦娘名字>的掉落率多少\n" +
        "   - <地圖><難度>可以撈什麼\n   - <地圖>攻 略";
      let message = bundle.msg.replace(/\[.*?\]/, "");
      if(!message.trim()){
        output(bundle.fromGroup, `[CQ:at,qq=${bundle.fromQQ}]` + suggest);
      }
      else{
        msg = ch.s2t(message);
        sensi = readCSONFile(swordFile);
        if(!global.bot.isSirekan("qq", sensi.sirekan)){
          for(let word of sensi.words){
            if(msg.match(new RegExp(word))){
              let ans = [
                "才不要理你! なのです!",
                "変態! なのです!",
                "ロリコン! なのです!",
                "醒醒你沒有女朋友! なのです!"
              ];

              output(bundle.fromGroup, `[CQ:at,qq=${bundle.fromQQ}]` + random.choice(ans));
              return;
            }
          }
        }

        // let ans = [
        //   "はい?",
        //   "怎麼了嗎?",
        //   "找我什麼事?",
        //   "なのです!"
        // ];
        //
        // output(bundle.fromGroup, `[CQ:at,qq=${bundle.fromQQ}]` + random.choice(ans, [1, 1, 1, 5]));
      }
    });
  }
};
