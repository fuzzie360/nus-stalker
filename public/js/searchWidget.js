var students = new Dataset({
    remote: '/student/suggest?q=%QUERY'
}).initialize();

var modules = new Dataset({
    remote: '/module/suggest?q=%QUERY'
}).initialize();

var easterEggs = new Dataset({
    local: 'Robert\'); DROP TABLE Students;--'
}).initialize();

var search = $('.typeahead');
search.typeahead({
    sections: [{
        highlight: true,
        name: 'modulesSection',
        source: modules,
        limit: 10,
        templates: {
            footer: '<div class="tt-header">Modules</div>'
        }
    }, {
        highlight: true,
        name: 'studentsSection',
        source: students,
        limit: 10,
        templates: {
            footer: '<div class="tt-header">Students</div>'
        }
    }, {
        highlight: true,
        name: 'easterEggSection',
        source: easterEggs,
        limit: 10
    }]
})
.on('typeahead:opened',function() {
    $('.tt-dropdown-menu').css('width',search.outerWidth() + 'px');
})
.on('typeahead:selected', function(obj, datum, section) {
    switch (section) {
    case 'studentsSection':
        window.location.href = '/student/' + datum.id;
        break;
    case 'modulesSection':
        window.location.href = '/module/' + datum.id;
        break;
    case 'easterEggSection':
        window.location.href = '/bobby.txt';
        break;
    }
});
