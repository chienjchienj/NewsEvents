const _ = require('underscore');
function NTUSD(){
	var self = this;
	var fs = require('fs');
	var positive = fs.readFileSync(__dirname + '/ntusd-positive.txt', {encoding: 'UTF8'}).split(/[\n\r]+/);
	var negative = fs.readFileSync(__dirname + '/ntusd-negative.txt', {encoding: 'UTF8'}).split(/[\n\r]+/);
	this.negative = this.positive = {};
	_.each(positive, function(term){ self.positive[term] = 1; });
	_.each(negative, function(term){ self.negative[term] = -1; });
}
NTUSD.prototype.score = function(term){
	if(! term ) return 0;
	if(term instanceof Array){
		if(term.length == 0) return 0;
		var terms = term.slice(0);
		//console.log(terms.pop(), terms);
		return this.score(terms.pop()) + this.score(terms);
	}
	return this.positive[term] || this.negative[term] || 0;
}

NTUSD.new = function(){
	var instance = new NTUSD();
	return instance;
}

module.exports = NTUSD;