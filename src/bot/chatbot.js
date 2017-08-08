const _ = require("lodash");
const logger = require("../util/logger")("chatbot");

const const_proxy = require("../util/const-proxy");

let DEFAULT_CONFIG = {
  name: "Chatbot_A",
  gender: "boy",
  owner: {
      name: "sir"
  }
};

module.exports = class Chatbot{
  constructor(config = {}){
    _.assign(this, DEFAULT_CONFIG);
    _.assign(this, config);

    this.SMI_HANDLER = require("../handler/smi-handler");
    this.PLUGIN_HANDLER = require("../handler/plugin-handler");
  }

  exec(smi_id, mod, func, ...args){
    return this.SMI_HANDLER.call(smi_id, mod, func, ...args);
  }

  run(){
    logger.info(`${this.name} starts running`);

    logger.info(`${this.name} inits all SMIs`);
    this.SMI_HANDLER.initAll();

    let handler = this;
    let init_loop = setInterval(function(){
      if(handler.SMI_HANDLER.isReady()){
        logger.info(`All SMIs are initialized`);
        clearInterval(init_loop);

        handler.PLUGIN_HANDLER.execAll();
      }
    }, 500);
  }

  getSmiApi(smi_id, mod){
    return this.SMI_HANDLER.getModule(smi_id, mod);
  }

  handle(event, ...args){
    logger.debug(`Handle a '${event}' event`);
    this.SMI_HANDLER.emit(event, ...args);
  }

  on(event, cb){
    this.SMI_HANDLER.on(event, cb);
  }
};
