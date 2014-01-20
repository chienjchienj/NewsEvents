// http://www.social-searcher.com/


//extract('#fbbuzzresult');

function extractAll(){
	function extract(target){
		var data = [];
		$(target).find('.postbuzz').each(function(){	
			data.push({
				user: 			$(this).find('.userlink').text(),
				user_link: 		$(this).find('.userlink a').attr('href'), 
				link : 			$(this).find('.linkbuzz a').text(),
				link_url : 		$(this).find('.linkbuzz a').attr('href'), 
				caption : 		$(this).find('.captionbuzz').text(),
				description : 	$(this).find('.descriptionbuzz').text(),
				messagebuzz : 	$(this).find('.messagebuzz').text(),
				image : 		$(this).find('.bigimagebuzz img').attr('src'), 
				time : 			$(this).find('.time').text(),
			});
		});
		return data;
	}	

	var data = {};
	data.facebook = extract('#fbbuzzresult');
	data.twitter = extract('#twbuzzresult');
	data.google = extract('#gpbuzzresult');
	console.log(JSON.stringify(data, null, '\t'));
}
extractAll();