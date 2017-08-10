const fs = require("fs-extra");
const path = require("path");
const request = require("request");
const _ = require("lodash");

const logger = global.getLogger("data-update");
const MAX_CONN_TRY = 5;
const URL_SHIP_INFO = "http://kcwikizh.github.io/kcdata/ship/all.json";
const PATH_SHIP_INFO = path.join(__dirname, "poi-stat.ship-info.json");

function updateShipInfo(cb){
  let num_tried = 0;

  function scheduleUpdate(){
    num_tried ++;
    getJSON(URL_SHIP_INFO, function(err, res){
      if(err){
        logger.error(`Fail to fetch JSON data from ${URL_SHIP_INFO}, # of try: ${num_tried}`);
        if(num_tried < MAX_CONN_TRY){
          logger.info("Schedule another retry");
          setImmediate(scheduleUpdate);
        }
        return;
      }

      logger.info(`Successfully fetch JSON data, writing to ${PATH_SHIP_INFO}`);
      fs.outputJsonSync(PATH_SHIP_INFO, res);

      if(typeof cb === "function"){
        cb();
      }
    });
  };

  logger.info("Schedule a update for ship info");
  setImmediate(scheduleUpdate);
}

function getJSON (url, cb){
  request({ url: url, json: true }, function (err, res, body) {
    if(err) return cb(err);
    if(res.statusCode != 200) return;
    cb(undefined, body);
  });
}

module.exports = {
  updateShipInfo,
  getJSON
};
