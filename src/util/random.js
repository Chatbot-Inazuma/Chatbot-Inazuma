const _ = require("lodash");

function choice(array, weights = []){
  let pool = [];
  for(let w in array){
    let weight = (weights[w])? weights[w]: 1;
    for(let i = 0; i < parseInt(weight); i++){
      pool.push(array[w]);
    }
  }

  let choosen = _.random(_.size(array) - 1);
  return array[choosen];
}

module.exports = {
  choice
}
