trackClick = function(event, script_id) {
    setTimeout(function() {
        try {
            keen.trackExternalLink(event, 'script_click', { 'source': 'scripts_list', 'script_id': script_id });
        } catch (e) {
            var link = event.target.href;
            if (event.shiftKey || event.ctrlKey || event.metaKey) {
                window.open(link, '_blank');
            } else {
                window.location = link;
            }
        }
    }, 0);
    return true;
}
