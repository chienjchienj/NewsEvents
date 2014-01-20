const NewsEvents = require('./NewsEvents');

var server = new NewsEvents(function(){
	this.startServer();
}, __dirname);