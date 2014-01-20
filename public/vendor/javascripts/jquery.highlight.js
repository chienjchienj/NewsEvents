/*

highlight v3

Highlights arbitrary terms.

<http://johannburkard.de/blog/programming/javascript/highlight-javascript-text-higlighting-jquery-plugin.html>

MIT license.

Johann Burkard
<http://johannburkard.de>
<mailto:jb@eaio.com>

*/

jQuery.fn.highlight = function(pat, extendClass) {
	function innerHighlight(node, pat, extendClass) {
		var skip = 0;
		//if($(node).is('.highlight')) return 1;
		if (node.nodeType == 3) {
			var pos = node.data.toUpperCase().indexOf(pat);
			try{
				if (pos >= 0) {
					var spannode = document.createElement('span');
					spannode.className = 'highlight' + (extendClass ? ' ' + extendClass : '');
					
					var middlebit = node.splitText(pos);
					var endbit = middlebit.splitText(pat.length);
					var middleclone = middlebit.cloneNode(true);
					
					//if(extendClass) middleclone = $(middleclone).addClass(extendClass);
					
					spannode.appendChild(middleclone);
					middlebit.parentNode.replaceChild(spannode, middlebit);
					skip = 1;
				}
			}catch(e){
				//Don't know why INDEX_SIZE_ERR: DOM Exception 1
			}
		}
		else if (node.nodeType == 1 && node.childNodes && !/(script|style)/i.test(node.tagName)) {
			for (var i = 0; i < node.childNodes.length; ++i) {
				i += innerHighlight(node.childNodes[i], pat, extendClass);
			}
		}
		return skip;
	}
	return this.each(function() {
	innerHighlight(this, pat.toUpperCase(), extendClass);
	});
};

jQuery.fn.removeHighlight = function(extendClass) {
	
	var nodes = this.find("span.highlight");
	if(extendClass) nodes = nodes.filter('.'+extendClass);
	
	return nodes.each(function() {
		this.parentNode.firstChild.nodeName;
		with (this.parentNode) {
			replaceChild(this.firstChild, this);
			normalize();
		}
	}).end();
};
