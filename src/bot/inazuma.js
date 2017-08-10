const const_proxy = require("../util/const-proxy");
const Chatbot = require("./chatbot");
const OWNER = require("./owner_profile");

const CONFIG = {
	name: "電",
	gender: "girl",
	sirekan: OWNER
};

class Inazuma extends Chatbot{
	constructor(){
		super(CONFIG);
	}

	isSirekan(field, value){
		return this.sirekan[field] == value;
	}
}

module.exports = new Proxy(new Inazuma(), const_proxy);
