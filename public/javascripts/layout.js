$(function(){
	/*$('[keywords]').attr('keywords', function(i, keywords){
		console.log(keywords);
	})*/
	$('#searchTerm').each(function(){ 
		$('.message').highlight($(this).text(), 'search')
	});
	$('#relatedTerms .hotTerm').each(function(){ 
		$('.message').highlight($(this).text(), 'related')
	});
	$('#keywords .hotTerm').each(function(){ 
		$('.message').highlight($(this).text())
	});
	
	
})