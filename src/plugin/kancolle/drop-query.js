const logger = global.getLogger("drop-query");

const CSON = require("cson");
const path = require("path");
const _ = require("lodash");
const fs = require("fs-extra");

const ch = require("../../lang/chinese");
const {getJSON, getRaw} = require("./lib/data-update");
const kcdata = require("./lib/kcdata-utils");
const SHIP_EXDATA = require("./lib/poi-stat.constant");

const configFile = path.join(__dirname, "drop-query.config.cson");
const infoFile = path.join(__dirname, "info.cson");
const CONFIG = readCSONFile(configFile);
const INFO = readCSONFile(infoFile);
const LEVEL_ID = {
  "甲": 3,
  "乙": 2,
  "丙": 1
};

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

/**
 * {type: "map", id: <map_id>}                       => res: HTML
 * {type: "ship", id: <ship_id>}                     => res: JSON
 * {type: "point", id: <map_id>-<level>-<point_id>}  => res: JSON
 */
function getCachedData(type, id, cb){
  if(typeof type !== "string"){
    logger.error(`Param 'type' provided is not a string`);
    return;
  }
  else if(_.indexOf(["map", "point", "ship"]) >= 0){
    logger.error(`No such cache type named ${type}`);
    return;
  }

  let cachedFile = path.join(__dirname, "cache", `${type}`, `${id}`);

  //the cache is hit
  if(fs.existsSync(cachedFile)){
    logger.debug(`Local cache is hit. Cache_type=${type}, Cache_id=${id}`);

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

  let id_token = (type == "point")? id.split("-"): undefined;
  let update_url = (type == "ship")? `https://db.kcwiki.org/drop/ship/${id}/SAB.json`:
    (type == "map")? `https://db.kcwiki.org/drop/map/${id}/`:
    `https://db.kcwiki.org/drop/map/${id_token[0]}/${id_token[1]}/${id_token[2]}-SAB.json`;

  logger.debug(`Update the cache from ${update_url}`);

  function onResponse(err, res){
    if(err){
      logger.error("Connection error occurs when trying to connect to Poi DB");
      logger.error(err);
      return;
    }

    if(!res){
      logger.info(`Empty response indicates no such data. Cache_type=${type}, Cache_id=${id}`);
      res = {generateTime: new Date().getTime()};
    }
    else if(typeof res === "string"){
      res = {generateTime: new Date().getTime(), raw: res};
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
      logger.error(`Error occurs when making cache.  Cache_type=${type}, Cache_id=${id}`);
      logger.error(e);
    }

    setImmediate(function(){
      cb(res);
    });
  }

  //connect to poi
  if(type == "ship" || type == "point"){
    getJSON(update_url, onResponse);
  }
  else{
    getRaw(update_url, onResponse);
  }
}

function parsePoiStatMap(res){
  let ret = [];
  let content = (typeof res === "object" && res.raw)? res.raw.split("\n"): [];
  for(let line of content){
    line = line.trim();
    if(line.match(/<b>评价:<\/b>/)){
      break;
    }
    let result = line.match(/<a href='\/drop\/map\/\d{2,3}\/[1-3]\/([A-Z])-SAB\.html'>(\1.*?)<\/a>/);
    if(result){
      ret.push(result[2]);
    }
  }
  return ret;
}

// !!!return undefined will cause infinite loop!!!
function parsePoiStatPoint(res){
  if(!res || !res.data) return {};

  let rare_ships = {};

  for(let ship of _.keys(res.data)){
    let exdata = SHIP_EXDATA.shipData[ship];
    if(!exdata || (exdata && exdata.rare)){
      rare_ships[ship] = res.data[ship];
    }
  }

  return rare_ships;
}

function outputMapQuery(fromGroup, map_name, level, res){
  if(!res){
    logger.error(`Cannot find map statistics for Map '${map_name}, Level ${level}'`);
    output(fromGroup, `電醬沒有在Poi資料庫找到${map_name}${level}的資料[CQ:face,id=9]`);
    return;
  }

  let output_str = `${map_name}${level}:\n`;
  for(let point of _.keys(res)){
    if(_.size(res[point]) > 0){
      output_str += `   - ${point}點有`;

      for(let ship of _.keys(res[point])){
        output_str += `${ship}、`;
      }

      if(_.last(output_str) == "、"){
        output_str = output_str.substr(0, output_str.length - 1);
      }
      output_str += "\n";
    }
  }

  if(_.last(output_str) == "\n"){
    output_str = output_str.substr(0, output_str.length - 1);
  }

  output(fromGroup, output_str);
}

function outputShipQuery(fromGroup, test_name, res){
  if(!(res = parsePoiStatJSON(res))){
    logger.error(`Cannot find drop statistics for Ship '${test_name}'`);
    output(fromGroup, `電醬沒有在Poi資料庫找到${ch.s2t(test_name)}的資料[CQ:face,id=9]`);
    return; //not found
  }

  let query_result = `${ch.s2t(test_name)}的掉落率:\n`;
  if(res.type == "interested"){
    delete res.type;

    let map_stats = {};
    for(let map_name of _.keys(res)){
      let kaiiki_stage = map_name.split("-");
      let point_drop = `${res[map_name].rate}% (S: ${res[map_name].rankCount[0]}件, A: ${res[map_name].rankCount[1]}件, B: ${res[map_name].rankCount[2]}件)`
      _.set(map_stats, `${kaiiki_stage[0]}.${kaiiki_stage[1]}.${kaiiki_stage[2]}.${kaiiki_stage[3]}`, point_drop);
    }

    for(let kaiiki of _.keys(map_stats)){
      for(let map of _.keys(map_stats[kaiiki])){
        for(let point of _.keys(map_stats[kaiiki][map])){
          let map_readable = SHIP_EXDATA.mapWikiData[parseInt(`${kaiiki}${map}`)];
          map_readable = map_readable.replace(/^20([0-9]{2})年(.)季活动\/(E-\d)$/, "$1$2$3");
          query_result += ` - 在${map_readable} ${point}點\n`;
          for(let level of _.keys(map_stats[kaiiki][map][point])){
            query_result += `      · ${level}: ${map_stats[kaiiki][map][point][level]}\n`;
          }
        }
      }
    }
  }
  else if(res.type == "highest" && !_.isEmpty(res.name)){
    let kaiiki_stage = res.name.split("-");
    let map_readable = SHIP_EXDATA.mapWikiData[parseInt(`${kaiiki_stage[0]}${kaiiki_stage[1]}`)] + ` ${kaiiki_stage[2]}點`;
    query_result += ` - 在一般海域中以${map_readable}${res.stat.rate}%最高\n`;
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

function run(){
  global.bot.onInput("message.@me", function(bundle){
    logger.debug(`Drop query input: ${bundle.msg}`);
    let tc_msg = ch.t2s(bundle.msg).replace(/\[.*?\]/, "").trim(); //translate to traditional Chinese
    let query_ships = tc_msg.match(/([1-6Ee])-?(\d)([甲乙丙])(?:级|难度)?(?:可以)?捞什麽/);

    if(query_ships){
      logger.debug("It's a map Query!");

      let kaiiki_id = query_ships[1];
      let map_id = query_ships[2];
      let level = query_ships[3];

      if(kaiiki_id.toLowerCase() == "e"){
        kaiiki_id = `${CONFIG.interested_maps[0]}`;
      }

      logger.debug(`Fetch data for map ${kaiiki_id}${map_id}`);
      getCachedData("map", `${kaiiki_id}${map_id}`, function(map_res){
        let points = parsePoiStatMap(map_res);
        let point_result = {};
        for(let p of points){
          let point_id = p.replace(/\(.*\)/, "").trim();
          logger.debug(`Fetch data for point ${point_id}`);
          getCachedData("point", `${kaiiki_id}${map_id}-${LEVEL_ID[level]}-${point_id}`, function(point_res){
            point_result[p] = parsePoiStatPoint(point_res);
            logger.debug(`Point ${point_id} is ready`);
          });
        }

        function ensureAllFinished(){
          for(let p of points){
            if(!point_result[p]){
              logger.debug(`Point ${p} is not ready, wait for another 500ms`);
              setTimeout(ensureAllFinished, 500);
              return;
            }
          }
          logger.debug(`All points are ready now`);

          //all finished
          outputMapQuery(bundle.fromGroup, `${query_ships[1]}-${query_ships[2]}`, query_ships[3], point_result);
        }

        logger.debug(`Wait processing all points for 500ms`);
        setTimeout(ensureAllFinished, 500);
      });
      return;
    }

    let matches = [
      tc_msg.match(/([\-0-9a-zA-Z\s]+)的?掉落率?.?多少/),
      tc_msg.match(/([\-0-9a-zA-Z\s]+)的?掉落率?[呢吗?]/),
      tc_msg.match(/求([\-0-9a-zA-Z\s]+)的?掉落率.*/),
      tc_msg.match(/([^\-0-9a-zA-Z\s]{1,4})掉落率?.?多少/),
      tc_msg.match(/([^\-0-9a-zA-Z\s]{0,4})掉落率?[呢吗?]/),
      tc_msg.match(/求([^\-0-9a-zA-Z\s]{0,4})掉落率.*/)
    ];
    logger.debug(matches);

    let failed_names = {}; //to avoid redundant search on the same name
    for(let result of matches){
      logger.debug(`Failed:`);
      logger.debug(failed_names);
      if(result && !failed_names[result[1]]){
        let candidate = result[1].replace("的", "");
        logger.debug(`Candidate: "${candidate}"`);
        for(let name_length = candidate.length; name_length > 0; name_length--){
          for(let start_idx = 0; start_idx + name_length <= candidate.length; start_idx++){
            let test_name = candidate.substr(start_idx, name_length), pid = -1;
            if((pid = kcdata.getPoiIDByName(test_name)) >= 0){ //found
              logger.info(`Ship named ${test_name} is found!`);
              getCachedData("ship", pid, function(res){
                outputShipQuery(bundle.fromGroup, test_name, res);
              });
              return;
            }
            else if((pid = kcdata.getPoiIDByNameExdata(test_name)) >= 0){
              logger.info(`Ship named ${test_name} is found!`);
              getCachedData("ship", pid, function(res){
                outputShipQuery(bundle.fromGroup, test_name, res);
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
}

module.exports = {
  run
};
