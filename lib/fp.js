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


function FPNode(index){
	this.index = index;
	this.freq = 1;
	this.next = null;
	this.prev = null;
	this.children = {};
}


function FP(){
	this.root = new FPNode('====root====');
	this.root.freq = -1;
	this.table = {}
	this.collections = [];
}

FP.prototype.addCollection = function(arr){
	var self = this;
	var nocase = _.map(arr, function(e){ return e.toLowerCase(); });
	this.collections.push(_.uniq(nocase));
	_.each(_.uniq(nocase), function(item){
		if(self.table[item]){
			self.table[item].freq++;
		}else{
			self.table[item] = {
				index : item, 
				freq : 1, 
				head : null, 
				tail : null,
				parent : null,
			}		
		}

	})
}
FP.prototype.strong = function(item){
	var currentNode = this.table[item].head;
	var set = [];

	var b_freq = 0;

	do{	
		var path = walkParent(currentNode);
		var sup = _.last(path).freq;

		if(sup > 6)console.log(_.combine(_.pluck(path, 'index'), 2), sup);

		//set.push()
	} while(currentNode = currentNode.next)



	function walkParent(node, arr){
		arr = arr || [];
		if(node.freq == -1) return arr.reverse(); // is root
		arr.push(node)
		if(node.parent){
			return walkParent(node.parent, arr);
		}
		
		
		return arr;
	}
	return set;
}
FP.prototype.addPath = function(items){
	var self = this;
	var currentNode = this.root;
	_.each(items, function(item){
		if(currentNode.children[item]){
			currentNode = currentNode.children[item];
			currentNode.freq++;
		}else{

			var node = new FPNode(item);
			node.parent = currentNode;
			currentNode.children[item] = node;
			currentNode = node;
			

			if(!self.table[item].head){
				self.table[item].head = node
				self.table[item].tail = node
			}else{
				node.prev = self.table[item].tail;
				self.table[item].tail.next = node;
				self.table[item].tail = node;
			}
			

		}
	});
}
FP.prototype.build = function(){
	var self = this;
	var t = new Date();

	console.log(' - build FP')

	
	var table = _.sortBy(this.table, function(e){ return e.freq}).reverse(); //if(!this.table[0]) return;
	var topFreq = table[0].freq;
	table = _.reject(table, function(e){ return e.freq < topFreq / 20});
	this.table = _.object(_.pluck(table, 'index'), table);

	var freqitems = _.pluck(this.table, 'index');

	var collections = _.map(self.collections, function(row){
		var items = _.intersection(freqitems, row);
		//items = _.sortBy(items, function(i){ return _.indexOf(freqitems,i); })
		self.addPath(items)
		return items
	});

	console.log(' - tree built in', (new Date() - t) ,'ms'); t = new Date();

	console.log(' - Growth')

	var association = {};
	var total = _.size(collections);

	function walkParent(node, arr){
		arr = arr || [];
		if(node.freq == -1) return arr.reverse(); // is root
		arr.push(node)
		if(node.parent){
			return walkParent(node.parent, arr);
		}
		return arr;
	}


	for(var i=1; i<freqitems.length; i++){
		var index = freqitems[i];
		var currentNode = this.table[index].head;

		do{	
			var path = walkParent(currentNode);
			var list = _.pluck(path, 'index');
			var sup = _.last(path).freq;

			if(/*list.length < 6 && */sup > 1){
				for(var n=1; n <= Math.min(list.length, 3) ; n++){
					var sets = _.combine(list, n);
					_.each(sets, function(set){
						var key = set.join('=');
						if(!association[key]){
							association[key] = {
								list: set, 
								frequent : sup,
								support: sup / total
							};
						}
					})					
				}
			} 
		} while(currentNode = currentNode.next)
	}	

	console.log(' - generated', _.size(association), 'association rules in', (new Date() - t) ,'ms'); t = new Date();

	var sorted = _.sortBy(association, function(e){ return e.support}).reverse();
	this.frequentPatterns = sorted;

}
FP.prototype.relatedItems = function(item){
	return _.uniq(_.flatten(_.pluck(this.related(item), 'base')));
}
FP.prototype.related = function(item){

	console.log(' - find related: ', item);

	var self = this;
	var t = new Date();
	var related = [];
	var total = _.size(this.collections);
	_.each(self.frequentPatterns, function(pattern){
		var set = pattern.list;
		var last = _.last(set);
		//if( set.length >=2 && last == item){
		if( set.length >=2 && _.contains(set, item)){
			var cur = item;
			var base = _.without(set, cur);
			var base_key = base.join('=');
			var pa = _.find(self.frequentPatterns, function(e){return e.list.join('=') == base_key}).frequent/total;
			var pb = _.find(self.frequentPatterns, function(e){return e.list.join('=') == item}).frequent/total
			var support = pa+pb;
			var confidence = (pattern.support/total)/pb

			var conviction = (1-pb)/(1-confidence)
			var lift = support/(pa*pb);

			related.push({
				base: base,
				confidence : confidence, 
				support : support, 
				conviction: conviction,
				lift: lift
			})
		}
	})
	related = _.sortBy(related, function(e){ return e.support}).reverse();
	console.log(' - related found in', (new Date() - t) ,'ms'); t = new Date();
	return related;
}


module.exports = FP;