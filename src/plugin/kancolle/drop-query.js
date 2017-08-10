const logger = global.getLogger("drop-query");

const CSON = require("cson");
const path = require("path");
const _ = require("lodash");
const fs = require("fs-extra");

const ch = require("../../lang/chinese");
const {getJSON} = require("./lib/data-update");
const kcdata = require("./lib/kcdata-utils");
const SHIP_EXDATA = require("./lib/poi-stat.constant");

const configFile = path.join(__dirname, "drop-query.config.cson");
const infoFile = path.join(__dirname, "info.cson");
const CONFIG = readCSONFile(configFile);
const INFO = readCSONFile(infoFile);

function readCSONFile(cson){
  try{
    fs.accessSync(cson, fs.R_OK|fs.W_OK);
    return CSON.parseCSONFile(cson);
    logger.info(`Successfully read ${configFile}`);
  }
  catch(e){
    logger.error(`Fail to read cson from ${configFile}`);
    logger.error(e);
    return undefined;
  }
}

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

function isCacheExpired(last_update){
  let lifetime = new Date() - new Date(last_update);
  return lifetime > (CONFIG.update_cycle * 1000 + 60000);
}

function getCachedJSON(pid, cb){
  let cachedFile = path.join(__dirname, "cache", `${pid}.json`);

  //the cache is hit
  if(fs.existsSync(cachedFile)){
    logger.debug(`Local cache is hit by ship id=${pid}`);

    let cachedData = fs.readJsonSync(cachedFile, {throws: false});

    //not expired
    if(!isCacheExpired(cachedData.generateTime)){ // buffer time: 1 min
      logger.debug(`The cache is still effective`);
      if(typeof cb === "function"){
        cb(cachedData);
      }
      return;
    }

    logger.debug(`The cache is out of date`);
  }
  else{
    logger.debug(`The cache miss`);
  }

  logger.debug(`Update the cache from https://db.kcwiki.org/drop/ship/${pid}/SAB.json`);
  //connect to poi
  getJSON(`https://db.kcwiki.org/drop/ship/${pid}/SAB.json`, function(err, res){
    if(err){
      logger.error("Connection error occurs when trying to connect to Poi DB");
      logger.error(err);
      return;
    }

    setImmediate(function(){
      cb(res);
    });

    if(!res){
      logger.info(`Empty response indicates no such data for ship id=${pid}`);
      res = {generateTime: new Date().getTime()};
    }

    if(isCacheExpired(res.generateTime)){
      logger.info("Data from Poi DB is still an out-of-date data");
      logger.info("Refresh generateTime to cache the file for one more lifetime");
      res.generateTime = new Date().getTime();
    }

    // make cache file
    try{
      fs.ensureFileSync(cachedFile);
      fs.writeJsonSync(cachedFile, res);
    }
    catch(e){
      logger.error(`Error occurs when making cache for ship id=${pid}`);
      logger.error(e);
    }
  });

}

function processOutput(fromGroup, test_name, res){
  if(!(res = parsePoiStatJSON(res))){
    logger.error(`Cannot find drop statistics for Ship '${test_name}'`);
    output(fromGroup, `電醬沒有在Poi資料庫找到${ch.s2t(test_name)}的資料[CQ:face,id=9]`);
    return; //not found
  }

  let query_result = `${ch.s2t(test_name)}:\n`;
  if(res.type == "interested"){
    delete res.type;

    for(let map_name of _.keys(res)){
      let kaiiki_stage = map_name.split("-");
      let map_readable = SHIP_EXDATA.mapWikiData[parseInt(`${kaiiki_stage[0]}${kaiiki_stage[1]}`)];
      map_readable = map_readable.replace(/^20([0-9]{2})年(.)季活动\/(E-\d)$/, "$1$2$3");
      query_result += ` - 在${map_readable}的掉落率為${res[map_name].rate}%\n`;
      query_result += `   母數為${res[map_name].totalCount}件, `;
      query_result += `S勝${res[map_name].rankCount[0]}件, A勝${res[map_name].rankCount[1]}件, B勝${res[map_name].rankCount[2]}件\n`;
      query_result += `   提督等級分布在Lv.${res[map_name].hqLv[0]}~Lv.${res[map_name].hqLv[1]}\n`;
    }
  }
  else if(res.type == "highest" && !_.isEmpty(res.name)){
    let kaiiki_stage = res.name.split("-");console.log(res.name)
    let map_readable = SHIP_EXDATA.mapWikiData[parseInt(`${kaiiki_stage[0]}${kaiiki_stage[1]}`)];
    map_readable = map_readable.replace(/^20([0-9]{2})年(.)季活动\/(E-\d)$/, "$1$2$3");
    query_result += ` - 在一般海域中以${map_readable}的掉落率${res.stat.rate}%最高\n`;
    query_result += `   母數為${res.stat.totalCount}件, `;
    query_result += `S勝${res.stat.rankCount[0]}件, A勝${res.stat.rankCount[1]}件, B勝${res.stat.rankCount[2]}件\n`;
    query_result += `   提督等級分布在Lv.${res.stat.hqLv[0]}~Lv.${res.stat.hqLv[1]}\n`;
  }
  else{
    query_result = `電醬沒找到${test_name}在本季活動的資料\n在一般海域也沒有掉落 [CQ:face,id=107]`;
  }

  if(_.last(query_result) == "\n"){
    query_result = query_result.substr(0, query_result.length - 1);
  }

  output(fromGroup, query_result);
}

function parsePoiStatJSON(poi_stat){
  if(!CONFIG || !poi_stat || !poi_stat.data) return undefined;

  let interested = {};
  let highest = {
    name: "",
    type: "highest",
    stat:{rate: 0}
  };

  for(let map_name of _.keys(poi_stat.data)){
    let kaiiki = map_name.split("-")[0];
    // interested
    if(_.indexOf(CONFIG.interested_maps, kaiiki) >= 0){
      interested[map_name] = {};
      _.assign(interested[map_name], poi_stat.data[map_name]);
    }
    // highest
    if((kaiiki <= 6 && kaiiki > 0) && (_.isEmpty(highest.name) || poi_stat.data[map_name].rate > highest.stat.rate)){
      highest.name = map_name;
      _.assign(highest.stat, poi_stat.data[map_name]);
    }
  }

  return (_.isEmpty(interested))? highest: _.assign(interested, {type: "interested"});
}

module.exports = {
  run(){
    global.bot.onInput("message.@me", function(bundle){
      logger.debug(`Drop query input: ${bundle.msg}`);
      let tc_msg = ch.t2s(bundle.msg); //translate to traditional Chinese
      let matches = [
        tc_msg.match(/([\-0-9a-zA-Z\s]+)的{0,1}掉落率{0,1}.{0,1}多少/),
        tc_msg.match(/([\-0-9a-zA-Z\s]+)的{0,1}掉落率{0,1}[呢吗?]/),
        tc_msg.match(/求([\-0-9a-zA-Z\s]+)的{0,1}掉落率.*/),
        tc_msg.match(/([^\-0-9a-zA-Z\s]{1,4})掉落率{0,1}.{0,1}多少/),
        tc_msg.match(/([^\-0-9a-zA-Z\s]{0,4})掉落率{0,1}[呢吗?]/),
        tc_msg.match(/求([^\-0-9a-zA-Z\s]{0,4})掉落率.*/)
      ];
      logger.debug(matches);

      let failed_names = {}; //to avoid redundant search on the same name
      for(let result of matches){
        logger.debug(`Failed: ${failed_names}`);
        if(result && !failed_names[result[1]]){
          let candidate = result[1].replace("的", "");
          logger.debug(`Candidate: "${candidate}"`);
          for(let name_length = candidate.length; name_length > 0; name_length--){
            for(let start_idx = 0; start_idx + name_length <= candidate.length; start_idx++){
              let test_name = candidate.substr(start_idx, name_length), pid = -1;
              if((pid = kcdata.getPoiIDByName(test_name)) >= 0){ //found
                logger.info(`Ship named ${test_name} is found!`);
                getCachedJSON(pid, function(res){
                  processOutput(bundle.fromGroup, test_name, res);
                });
                return;
              }
              else if((pid = kcdata.getPoiIDByNameExdata(test_name)) >= 0){
                logger.info(`Ship named ${test_name} is found!`);
                getCachedJSON(pid, function(res){
                  processOutput(bundle.fromGroup, test_name, res);
                });
                return;
              }
              // not found
              logger.error(`Cannot find a ship named '${test_name}'`);
            }
          }
          failed_names[result[1]] = true;
        }
      }
    });
  } //end run()
};
