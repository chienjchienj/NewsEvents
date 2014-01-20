const _ = require('underscore');

_.combine = function(arr, n) {
	return _.combine2D(_.map(arr, function(el){ return [el]; }),n)
}
_.combine2D = function(arr, n) {
		var recursive = arguments.callee;
		var i,j,k,elem,l = arr.length,childperm,ret=[];
		if(n == 1) {
			for (var i = 0; i < arr.length; i++) {
				for (var j = 0; j < arr[i].length; j++) {
					ret.push([arr[i][j]]);
				}
			}
			return ret;
		} else {
			for (i = 0; i < l; i++) {
				elem = arr.shift();
				for (j = 0; j < elem.length; j++) {
					childperm = recursive(arr.slice(), n-1);
					for (k = 0; k < childperm.length; k++) {
						ret.push([elem[j]].concat(childperm[k]));
					}
				}
			}
			return ret;
		}
		i=j=k=elem=l=childperm=ret=[]=null;
}

function Apriori(){
	this.itemsets = [];
	this.collections = [];
	this.items = {};
}

Apriori.prototype.save = function(path){
	var json = JSON.stringify({
		itemsets: this.itemsets,
		collections: this.collections
	}, null, '\t');
	var fs = require('fs');
	fs.writeFileSync(path, json);
}
Apriori.prototype.load = function(path){
	var fs = require('fs');
	var json = fs.readFileSync(path);
	var obj = JSON.parse(json);
	this.itemsets = obj.itemsets;
	this.collections = obj.collections;
}
Apriori.prototype.addCollection = function(arr){
	var self = this;
	var nocase = _.map(arr, function(e){ return e.toLowerCase(); });
	this.collections.push(_.uniq(nocase));
	_.each(_.uniq(nocase), function(item){
		self.items[item] = self.items[item] || 0;
		self.items[item]++;
	})
}	
Apriori.prototype.getFrequentItemsets = function(){
	return this.itemsets;
}
Apriori.prototype.countSet = function(set){
	if(typeof set == 'string') set = [set];
	var found = _.filter(this.collections, function(transaction){
		return _.intersection(set, transaction).length == _.size(set); 
	});
	return _.size(found);
}
Apriori.prototype.frequentItemsets = function(minSup, level){
	var self = this;
	var collections = this.collections;
	var itemset = {};
	minSup = minSup || 0.02;
	level = level || 3;

	var itemsets = [[]];
	var total = _.size(collections);

	for(var ln=1; ln <= level ; ln++){
		itemset = {};
		_.each(collections, function(items){
			var comb = _.combine(items, ln);
			
			_.each(comb, function(item){
				item.sort();
				var key = item.join('='); if(itemset[key]) return;
				var support = self.countSet(item)/total; if(support < minSup) return;
				
				console.log(item, '=>', support);

				//item.support = 0;
				itemset[key] = itemset[key] || {
					list: 		item, 
					support: 	support
				};
				//itemset[key].support++;
			});
		});		


		itemset = _.reject(itemset, function(item){ return item.support<minSup; })

		//console.log('L' + ln, itemset)

		itemsets[ln] = _.sortBy(itemset, function(item){ return item.support; }).reverse();


		//移除支持度小的item
		collections = _.map(this.collections, function(items){
			//console.log('>>', items, _.pluck(itemset, 'list'));
			return _.intersection(items, _.flatten(_.pluck(itemset, 'list')));
		});
		collections = _.reject(collections, function(items){ return _.size(items) < ln; })

	}

	this.itemsets = itemsets;

	return itemsets;
}

Apriori.prototype.strong = function(target, level){
	var self = this;
	var t = new Date();
	var rules = [];

	level = level || 2;

	target = target.toLowerCase();

	function countSet(set){
		if(typeof set == 'string') set = [set];
		var found = _.filter(self.collections, function(transaction){
			return _.intersection(set, transaction).length == _.size(set); 
		});
		return _.size(found);
	}


	_.equal = function(a1, a2){ return _.size(_.difference(a1, a2)) == 0 }
	_.each(_.flatten(this.itemsets.slice(level), true), function(itemset){
		if(itemset.list.length == 1) return;
		if(_.contains(itemset.list, target)){
		//if(_.last(itemset.list) == target){
			//console.log(itemset.list);
			var base = _.without(itemset.list, target);
			var total = _.size(self.collections);
			var pa = countSet(base)/total;
			var pb = countSet(target)/total
			var support = pa+pb;
			var confidence = countSet(itemset.list)/total/pb

			rules.push({ base: base, support: support, confidence: confidence});
		}
	});
	console.log('strong rule found in', (new Date() - t) ,'ms');
	console.log(_.sortBy(rules, function(r){ return r.confidence; }).reverse());
	return _.sortBy(rules, function(r){ return r.confidence; }).reverse();
	
}


/*
var apriori = new Apriori();

apriori.addCollection(['A', 'C', 'D']);
apriori.addCollection(['B', 'C', 'E']);
apriori.addCollection(['A', 'B', 'C', 'E']);
apriori.addCollection(['B', 'E']);
f = apriori.frequentItemsets(2, 3);

*/

module.exports = Apriori;