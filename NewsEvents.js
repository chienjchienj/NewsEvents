const _ 		= require('underscore');
const express 	= require('express');
const path 		= require('path');
const fs 		= require('node-fs');
const md5 		= require('MD5');
const csv 		= require('csv');

try {
    const gc 		= require('gc');
} catch(e) {
    console.log('gc not installed');
}

const natural 		= require('natural');
const POSTAG 		= require('node-segment').POSTAG; 
const Segment 		= require('node-segment').Segment;
const TfIdf 		= natural.TfIdf;

const FP 			= require('./lib/fp')
const Apriori 		= require('./lib/Apriori');
const FPTree 		= require('./lib/fptree');


const ntusd			= require('./lib/ntusd').new();


Segment.prototype.destroy = function(){
	for(var i in this) delete this[i];
	if(typeof gc == 'function') gc();
	delete this;
}



// setInterval(function(){
// 	console.log('MemoryUsage: ', _.map(process.memoryUsage(), function(v, k){ return require('filesize')(v) ;}).join(', '));
// }, 10000)


function NewsEvents(callback, basePath){
	var self = this;

	this.basePath 		= basePath || __dirname;

	this.fp 			= new FP();
	this.association 	= new Apriori();
	this.tfidf 			= new TfIdf();

	this.stream = {};

	callback && callback.call(self);
}
NewsEvents.prototype.loadCSV  = function(callback){ 
	var self = this;
	csv().from(this.basePath + '/data/csv/1985公民聯盟.csv', {columns: true})//.on('data', console.log);
	
	.transform(function(row, index){
	    return row;
	})
	.to.array(function(rows){
		
		_.each(rows, function(msg){
			//var hash = md5([msg.object_id, msg.message, msg.description].join('\n'));

			self.stream['csv_' + msg.object_id] = _.extend(msg, {
				source: 'facebook', 
				messagebuzz : msg.message,
				caption : '', 
				hash :  'csv_' + msg.object_id,
				time :  msg.TWTime, 
				link_url : msg.link, 
				link: msg.description,
			});
		})
		console.log(_.size(self.stream), 'loaded from csv');
		callback && callback();
	});

}
NewsEvents.prototype.loadJSON  = function(){ 

	var self = this;
	var path = this.basePath + '/data/social-searcher/';
	var files = fs.readdirSync(path);

	_.each(files, function(fn){
		//var source = fn.match(/fb|tw|gp/ig)//.toString().replace('fb', 'Facebook').replace('gp', 'GooglePlus').replace('tw', 'Twitter');
		try{
			var data = JSON.parse(fs.readFileSync(path + fn));
		}catch(e){
			console.log('failed to load ', fn);
			return;
		}
		_.each(data, function(stream, source){

			_.each(stream, function(msg){
				var hash = md5([msg.user_link, msg.messagebuzz, msg.description].join('\n'));
				msg.hash = hash;
				msg.source = source;
				self.stream[hash] = self.stream[hash] || msg;
				self.stream[hash].count = self.stream[hash].count || 0;
				self.stream[hash].count++;
			});
		});

		console.log(_.size(self.stream), 'loaded');

	});
}
NewsEvents.prototype.removeEmpty  = function(){
	var before = _.size(this.stream);
	for(var i in this.stream){
		if((this.stream.message + this.stream.description + this.stream.messagebuzz ).length < 10){
			delete this.stream[i];
		}
	}
	var after = _.size(this.stream);
	console.log(' - trimmed empty messages', before, '->', after);
}

NewsEvents.prototype.decoupling  = function(attribute, fragments){ 
	var self = this;
	var samples = [];
	var streamClean = {}
	var before = _.size(this.stream);

	fragments = fragments || 4;
	_.each(this.stream, function(message){

		//if(!message[attribute]) return;

		var exist = false;
		if(message[attribute] && message[attribute].length > 20) _.each(samples, function(pattern){
			if(message[attribute].toString().indexOf(pattern) != -1){
				exist = true
				return false;
			}
		});
		if(! exist ) streamClean[message.hash] = message;

		if( (!exist) && message[attribute] && message[attribute].length > fragments * 2){
			var len = message[attribute].length;
			var fragmentSamples = []
			for(var i = 0; i<len; i += len/fragments){
				fragmentSamples.push(message[attribute].substr(i, i+len/fragments));
			}
			samples.push(_.sample(fragmentSamples));
		}

	});

	var after = _.size(streamClean);
	console.log('decoupling:', attribute,  before,'->', after);
	this.stream = streamClean;

	
}
NewsEvents.prototype.build  = function(attribute, fragments){ 

	
}
NewsEvents.prototype.startServer  = function(basePath){ 
	var self = this;
/*	self.loadJSON();
	self.decoupling('description');
	self.decoupling('messagebuzz');
	self.decoupling('caption');
	self.preprocess();
	self.startWebConsole(basePath);*/
	this.loadCSV(function(){
		self.decoupling('message');
		self.loadJSON();
		self.decoupling('description');
		self.decoupling('messagebuzz');
		self.decoupling('caption');
		//self.decoupling('link_url', 1);
		self.removeEmpty();
		self.preprocess();
		self.startWebConsole(basePath);
	});
}

NewsEvents.prototype.loadAndStartServer  = function(basePath){ 
	this.loadJSON();
	this.loadData();
	this.startWebConsole(basePath);
	//console.log(this.association.getFrequentItemsets()[1])
}

NewsEvents.prototype.loadData  = function(){ 
	this.learnedTerms = JSON.parse(fs.readFileSync(this.basePath + '/cache/learnedTerms.json'));
	this.tfidf.documents = JSON.parse(fs.readFileSync(this.basePath + '/cache/tfidf.json'));
	this.hotTerms = JSON.parse(fs.readFileSync(this.basePath + '/cache/hotTerms.json'));
	this.stream = JSON.parse(fs.readFileSync(this.basePath + '/cache/stream.json'));
	this.association.load(this.basePath + '/cache/association.json');
}
NewsEvents.prototype.saveData  = function(){ 

		fs.mkdirSync(this.basePath + '/cache/', 0777, true);

		fs.writeFileSync(this.basePath + '/cache/learnedTerms.json', JSON.stringify(this.learnedTerms, null, '\t'));
		this.association.save(this.basePath + '/cache/association.json');
		fs.writeFileSync(this.basePath + '/cache/stream.json', JSON.stringify(this.stream, null, '\t'));
		fs.writeFileSync(this.basePath + '/cache/tfidf.json', JSON.stringify(this.tfidf.documents, null, '\t'));
		fs.writeFileSync(this.basePath + '/cache/hotTerms.json', JSON.stringify(this.hotTerms, null, '\t'));
}

NewsEvents.prototype.preprocess  = function(basePath){ 
	var self = this;


	var fpTree = new FPTree();
	var segmenter = new Segment();

	// parseTerms test
	//var file = fs.openSync('parse.txt', 'w+');
/*	_.each(self.stream, function(message){
		var text = message.description + ' ' + message.messagebuzz  + ' ' + message.link;
		text = text.replace(/[　\s\n\t（）［］「」\_\,]/g, ' ')
		text = text.replace(/的/g, '的，')

		//fs.writeSync(file, '============ ' + '==============\n');
		fpTree.insert(text);
	});

	self.learnedTerms = fpTree.prediction(0.1);
	fs.writeFileSync('learnedTerms2.txt', self.learnedTerms.join('\n'));
	fs.writeFileSync('tree.txt', JSON.stringify(fpTree.trace(), null, 1));

console.log('term learned');*/


	//segment.useDefault();
	segmenter
		.use('URLTokenizer')            // URL识别
		.use('EmailOptimizer')          // 邮箱地址识别

		.use('WildcardTokenizer')       // 通配符，必须在标点符号识别之前
		.use('PunctuationTokenizer')    // 标点符号识别
		//.use('ForeignTokenizer')        // 外文字符、数字识别，必须在标点符号识别之后

		.use('DictTokenizer')           // 词典识别
		.use('DictOptimizer')           // 词典识别优化
		.use('ChsNameTokenizer')        // 人名识别，建议在词典识别之后
		.use('ChsNameOptimizer')        // 人名识别优化
		.use('DatetimeOptimizer')       // 日期时间识别优化
		.loadDict('names.txt')          // 常见名词、人名
		.loadDict('wildcard.txt', 'WILDCARD', true)   // 通配符
		// .loadDict('dict.txt')
		// .loadDict('dict2.txt')
		.loadDict(__dirname + '/dicts/dict_tw.txt')
		.loadDict(__dirname + '/dicts/tw2.txt');


	self.learnedTerms = fs.readFileSync('./dicts/learnedTerms.txt').toString().split(/[\n\r]+/);
	console.log(' - load learnedTerms')

	/*_.each(self.stream, function(message){
		//self.association.addCollection(emoTerms);
		var text = message.description + ' ' + message.messagebuzz  + ' ' + message.link;
		text = text.replace(/[　\s\n\t（）［］「」]/g, ' ')
		text = text.replace(/的/g, '的，')


		var seg = text.split(/[，。\,\.\:\s]+/);
		var max = _.max(seg, function(i){return i.replace(/[a-zA-Z0-9]+/g).length;}).length;
		if(max > 20) return

		// sret = segmenter.tokenizer.split(text, segmenter.modules.tokenizer);
		// console.log(sret)

		var engStopwords = new RegExp("^(a|about|above|after|again|against|all|am|an|and|any|are|aren't|as|at|be|because|been|before|being|below|between|both|but|by|can't|cannot|could|couldn't|did|didn't|do|does|doesn't|doing|don't|down|during|each|few|for|from|further|had|hadn't|has|hasn't|have|haven't|having|he|he'd|he'll|he's|her|here|here's|hers|herself|him|himself|his|how|how's|i|i'd|i'll|i'm|i've|if|in|into|is|isn't|it|it's|its|itself|let's|me|more|most|mustn't|my|myself|no|nor|not|of|off|on|once|only|or|other|ought|our|ours |ourselves|out|over|own|same|shan't|she|she'd|she'll|she's|should|shouldn't|so|some|such|than|that|that's|the|their|theirs|them|themselves|then|there|there's|these|they|they'd|they'll|they're|they've|this|those|through|to|too|under|until|up|very|was|wasn't|we|we'd|we'll|we're|we've|were|weren't|what|what's|when|when's|where|where's|which|while|who|who's|whom|why|why's|with|won't|would|wouldn't|you|you'd|you'll|you're|you've|your|yours|yourself|yourselves)$", 'ig')
		var parsedTerms = _.reject(segmenter.doSegment(text), function(term){
			return term.w.match(engStopwords) || term.p == POSTAG.D_W || term.p == POSTAG.URL || term.p == POSTAG.D_W || term.p == POSTAG.A_M || term.w == '_' || term.w == ' '|| term.w == '　';
		});

		//console.log( _.pluck(parsedTerms, 'w'))

		fpTree.insert(_.pluck(parsedTerms, 'w'), 'text.txt');
		
	});

	self.learnedTerms = fpTree.prediction(0.3);
	fpTree = null;

	console.log(self.learnedTerms);

	console.log('phase1 complete');*/

	_.each(self.stream, function(message, hash){
		var text = message.description + message.messagebuzz + message.link;	
		text = text.replace(/[　\s\n\t（）［］「」]/g, ' ')
		text = text.replace(/的/g, '的，')

		var seg = text.split(/[，。\,\.\:\s]+/);
		var max = _.max(seg, function(i){return i.replace(/[a-zA-Z0-9]+/g).length;}).length;
		if(max > 20) return

		var terms = [];

		_.each(self.learnedTerms, function(term){
			if(text.match(term)){
				text = text.replace(new RegExp( term , 'g'), '********');
				terms.push(term);
			}
		});


		var engStopwords = new RegExp("^(a|about|above|after|again|against|all|am|an|and|any|are|aren't|as|at|be|because|been|before|being|below|between|both|but|by|can't|cannot|could|couldn't|did|didn't|do|does|doesn't|doing|don't|down|during|each|few|for|from|further|had|hadn't|has|hasn't|have|haven't|having|he|he'd|he'll|he's|her|here|here's|hers|herself|him|himself|his|how|how's|i|i'd|i'll|i'm|i've|if|in|into|is|isn't|it|it's|its|itself|let's|me|more|most|mustn't|my|myself|no|nor|not|of|off|on|once|only|or|other|ought|our|ours |ourselves|out|over|own|same|shan't|she|she'd|she'll|she's|should|shouldn't|so|some|such|than|that|that's|the|their|theirs|them|themselves|then|there|there's|these|they|they'd|they'll|they're|they've|this|those|through|to|too|under|until|up|very|was|wasn't|we|we'd|we'll|we're|we've|were|weren't|what|what's|when|when's|where|where's|which|while|who|who's|whom|why|why's|with|won't|would|wouldn't|you|you'd|you'll|you're|you've|your|yours|yourself|yourselves)$", 'ig')
		var parsedTerms = _.reject(segmenter.doSegment(text), function(term){
			return term.w.match(engStopwords) || term.p == POSTAG.D_W || term.p == POSTAG.URL || term.p == POSTAG.D_W || term.p == POSTAG.A_M || term.w == '_' || term.w == ' '|| term.w == '　';
		});

		parsedTerms = _.reject(parsedTerms, function(t){ return t.w.length < 2;});

		terms = terms.concat(_.pluck(parsedTerms, 'w'));
		terms = _.map(terms, function(t){ return t.toLowerCase(); });


		message.ntusd = ntusd.score(terms)

		if(message.ntusd > 2) message.emotion = 'http://statics.plurk.com/13b15aa49358be8f47b58552401d7725.gif'
		if(message.ntusd == 2) message.emotion = 'http://statics.plurk.com/ff124032f8cc3a9d43b99e661f8fcb4d.gif'
		if(message.ntusd == 1) message.emotion = 'http://statics.plurk.com/6cb1dc388b9259565efedef8f336d27d.gif'
		if(message.ntusd == 0) message.emotion = 'http://emos.plurk.com/a140a58d5f2c9171dec0f3582fe7570f_w20_h20.gif'	
		if(message.ntusd == -1) message.emotion = 'http://statics.plurk.com/8eb05ca7a32301ba16c9496bcad893c4.gif'
		if(message.ntusd == -2) message.emotion = 'http://statics.plurk.com/35b16fc25623670e41c2be6bf8ac38c7.gif'	
		if(message.ntusd < -2) message.emotion = 'http://statics.plurk.com/261c0fe4a88417146ae0292d697a5f52.gif'
		if(message.ntusd < -5) message.emotion = 'http://statics.plurk.com/a5ae31c4185bc60cd006650dc10f8147.gif'


		self.tfidf.addDocument(terms, message.hash)
		//self.association.addCollection(terms);

		self.fp.addCollection(terms)

		message.terms = terms;

	});

	self.fp.build();


	segmenter.destroy();
	segmenter = null;



	console.log('phase2 complete');

	self.association.frequentItemsets();

	//return;

	self.hotTerms = _.map(self.fp.table, function(item){
		//console.log(item)
		return {
			term: item.index, 
			support: item.freq
		}
	});

/*	self.hotTerms = _.map(self.association.getFrequentItemsets()[1], function(l1){
		return {
			term: l1.list[0], 
			support: l1.support
		}
	});*/

	self.saveData();

	console.log('phase3 complete');
}
NewsEvents.prototype.searchMessages = function(search, minMeasure){
	var self = this;
	var result = [];

	minMeasure = minMeasure || 0;


	if(search == '' || search.match && search.match(/^\s+$/)) return [];

	if(typeof search == 'string') search = [search];

	search = _.map(search, function(t){ return t.toLowerCase(); });

	this.tfidf.tfidfs(search, function(i, measure, hash) {
		//console.log(measure, search, i, measure, hash);
		if(measure > minMeasure ){
			result.push({
				message : self.stream[hash], 
				measure: measure
			})
		}
	});	


	result = _.pluck(_.sortBy(result, function(e){ return e.measure; }).reverse(), 'message');
	

	console.log(' + search ', result.length, 'found')

	return result;

}

NewsEvents.prototype.startWebConsole = function(basePath){ 
	var self = this;
	var webConsole = express();
	basePath = basePath || self.basePath;
	webConsole.configure(function(){
		webConsole.locals.pretty = true;
		webConsole.use(express.compress());
		webConsole.use(webConsole.router);
		webConsole.set('views', basePath + '/views');
		webConsole.set('view engine', 'jade');
		webConsole.set('view options', {
			pretty: true
		});
		webConsole.use(express.static(path.join(basePath, '/public')));
	});

	this.webConsole = webConsole;

	webConsole.get('/', function(request, response){


		function weight(str){
			if(str.match(/[a-zA-Z0-9]/)){
				return 1;
			}else{
				return str.length;
			}
		}

		var hotTerms = _.sortBy(self.hotTerms, function(ht){
			return ht.support * weight(ht.term)
		}).reverse();

		var topSize = hotTerms[0] && (hotTerms[0].support * weight(hotTerms[0].term)) || 1;
		hotTerms = _.map(hotTerms, function(e){ return {
			term: e.term.toUpperCase(), 
			support: e.support,
			size: ((e.support * weight(e.term))/topSize)+ 'em'
		}; })

		hotTerms = hotTerms.slice(0, 50);

		//response.json(self.stream);

		response.render('index', {
			hotTerms: hotTerms,
			total: _.size(self.stream)
		})
	});

	webConsole.get('/related/:hash', function(request, response){

		var theHash = request.params.hash
		var terms 	= self.stream[theHash].terms;

		var t = new Date();
		
		response.render('discover', {
			//search: search,
			emoticon: self.stream[theHash],
			related: self.searchMessages(terms, 4), 
			time: (new Date - t)
		});

	});

	webConsole.get('/find/:terms', function(request, response){

		var search = request.params.terms.toLowerCase();
		var result = self.searchMessages(search, 0); 
		var result_hash = _.pluck(result, 'hash');


		var t = new Date();

		//計算top相關詞彙
		var termsCount = {};
		_.each(_.flatten(_.pluck(result, 'terms'), true), function(term){
			if(term == search) return;
			termsCount[term] = termsCount[term] || {term: term, count: 0};
			termsCount[term].count++;
		});

		termsCount = _.sortBy(termsCount, function(e){ return e.count;}).reverse(); //出現次數排序
		termsCount = _.filter(termsCount, function(e){ return e.count > 3 && e.count > termsCount[0].count / 3; }); //必須大於最大的三分之一

		var keywords = _.pluck(termsCount, 'term');

/*		relatedRules = self.association.strong(search); 
		relatedRules = _.union(relatedRules, _.flatten(_.map(_.pluck(termsCount, 'term'), function(term){ console.log('>>', term);return self.association.strong(term); }), true))
		relatedRules = _.reject(relatedRules, function(e){ return e.confidence < 0.18; });
		relatedRules = _.sortBy(relatedRules, function(e){ return e.confidence; }).reverse();



		var relatedTerms = _.uniq(_.flatten(_.pluck(relatedRules, 'base'), true));
		//relatedTerms = relatedTerms.concat();
		relatedTerms = _.uniq(relatedTerms);
		relatedTerms = _.without(relatedTerms, search);*/

		var relatedTerms = self.fp.relatedItems(search).slice(0, 10);
		console.log('relatedTerms', relatedTerms)

		var related = self.searchMessages(relatedTerms, 4);
		related = _.reject(related, function(e){ return (result_hash.indexOf(e.hash) != -1); });


		response.render('find', {
			search: search,
			messages: result.slice(0,300),
			related : related, 
			keywords: keywords,
			relatedTerms: relatedTerms,
			time: (new Date - t)
		});

	});


	webConsole.listen(3334);
	console.log(' - webConsole is ready at 3334');
}
module.exports = NewsEvents;

