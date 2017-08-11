const path = require("path");

const ch = require("../../lang/chinese");
const ifs = require("../../util/fs");

const kouryaku_file = path.join(__dirname, "kouryaku.cson");
const infoFile = path.join(__dirname, "info.cson");

const INFO = ifs.readCSONFile(infoFile);

function output(group, query_result){
  global.bot.output("message.cq-bot.group", {
    src: {
      id: INFO.id,
      mod: path.basename(__filename, ".js")
    },
    gid: group,
    msg: query_result
  });
}

module.exports = {
  run(){
    global.bot.onInput("message.@me", function(bundle){
      let translated = ch.s2t(bundle.msg);
      let matched = translated.match(/([1-6Ee])\-?(\d)\s*攻\s*略/);
      if(matched){
        let map_name = `${matched[1]}${matched[2]}`.toUpperCase();
        let KOURYAKU = ifs.readCSONFile(kouryaku_file);
        if(KOURYAKU[map_name]){
          for(let story of KOURYAKU[map_name]){
            let output_msg = `${map_name} 攻 略 by ${story.provider}\n\n${story.msg}\n\n建立時間: ${new Date(story.time).toLocaleString()}`;
            output(bundle.fromGroup, output_msg);
          }
          return;
        }
        output(bundle.fromGroup, `對噗起, 目前沒有收集到${map_name}的攻略!`);
      }
    });
  }
}
