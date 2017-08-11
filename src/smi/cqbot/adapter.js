const path = require("path");
function _require(js){
  if(js.startsWith("./")){
    js = path.join("..", "..", js.substr(2));
  }
  return require(js);
}

const CSON = require("cson");
const fs = require("fs-extra");
const WebSocketClient = require('websocket').client;

const plugin_for = _require("./smi/lib/plugin-valid");
const logger = _require("./util/logger")("cq-bot");

const INFO = readCSONFile(path.join(__dirname, "info.cson"));
const CONFIG = readCSONFile(path.join(__dirname, "config.cson"));

let connection = null;
let validators = null;

function readCSONFile(configFile){
  let acess_control = {
    set(target, property, value, receiver){
      logger.error(`You cannot change the '${property}' property of a cson constant object to ${value}`);
      return false;
    },
    get(target, property, receiver){
      if(target.code){
        logger.error(`The object read from a cson file has syntax error!`);
        return undefined;
      }

      return target[property];
    }
  };
  try{
    fs.accessSync(configFile, fs.R_OK|fs.W_OK);
    return new Proxy(CSON.parseCSONFile(configFile), acess_control);
    logger.info(`Successfully read ${configFile}`);
  }
  catch(e){
    logger.error(`Fail to read cson from ${configFile}`);
    logger.error(e);
    return undefined;
  }
}

function initValidator(){
  if(CONFIG){
    for(let group of CONFIG.target){
      for(let patt of group.subsc){
        plugin_for(`${INFO.id}.${group.id}`).setPattern(patt);
      }
    }
  }
}

function init(cb){
  initValidator();

  let cq = new WebSocketClient();
  cq.on('connect', function(conn) {
    logger.info('CQ is connected');

    connection = conn;

    conn.on('error', function(error) {
        logger.error("CQ Connection Error: " + error.toString());
    });

    conn.on('close', function() {
        logger.info('CQ Connection is closed');
    });

    conn.on('message', function(message) {
        if (message.type === 'utf8') {
          let data = JSON.parse(message.utf8Data);
          if(data.fromQQ && data.fromQQ != CONFIG.bot_qid){
            // logger.debug(`Message input: `, data);
            global.bot.input("message.input", data);

            // @me
            if(data.msg.indexOf(`[CQ:at,qq=${CONFIG.bot_qid}]`) >= 0){
              // logger.debug(`Message input: `, data);
              global.bot.input("message.@me", data);
            }
          }
          else if(data.fromQQ == CONFIG.bot_qid){
            global.bot.input("message.my", data);
          }
        }
    });

    /**
     * bundle{
     *   src: {
     *     id: plugin_id,
     *     mod: mod_name
     *   },
     *   msg: <string>,
     * }
     */
    global.bot.onOutput("message.broadcast", function(bundle){
      for(let group of CONFIG.target){
        if(plugin_for(`${INFO.id}.${group.id}`).isValid(bundle.src.id, bundle.src.mod)){
          logger.debug(`A message is sent to group with id=${group.id}`);
          sendGroupMsg(group.id, bundle.msg);
        }
      }
    });

    global.bot.onOutput(`message.${INFO.id}.group`, function(bundle){
      if(bundle.gid && bundle.src && bundle.msg){
        if(plugin_for(`${INFO.id}.${bundle.gid}`).isValid(bundle.src.id, bundle.src.mod)){
        logger.debug(`A message is sent to group with id=${bundle.gid}`);
        sendGroupMsg(bundle.gid, bundle.msg);
        }
      }
    });

    cb();
  });

  cq.connect("ws://localhost:25303");

  logger.info("CQ-bot is initialized");
}

function getSubscGroups(plugin_id, mod_name){
  if(!this.isConnected()){
    return [];
  }

  let subsc_list = [];
  for(let group of CONFIG.target){
    if(plugin_for(`${INFO.id}.${group.id}`).isValid(plugin_id, mod_name)){
      subsc_list.push(group.id);
    }
  }

  return subsc_list;
}

function sendGroupMsg(group_id, msg){
  sendRaw({
    act: 101,
    groupid: group_id,
    msg: msg
  });
}

function sendRaw(pkt){
  if(isConnected()){
    connection.sendUTF(JSON.stringify(pkt));
  }
  else{
    logger.error("Error occurs due to no connection available. Do you forget to call init()?");
  }
}

function isConnected(){
  return Boolean(connection);
}

module.exports = {
  init,
  isConnected,
  getSubscGroups
};
