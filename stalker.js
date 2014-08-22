var config = require('./config');
var util = require('util');
var http = require('http');

var _ = require('underscore');
var etagify = require('etagify');
var express = require('express');
var cachify = require('connect-cachify');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var flash = require('connect-flash');
var ejs = require('ejs');
var passport = require('passport');
var OpenIDStrategy = require('passport-openid').Strategy;
var mysql = require('mysql');
var Sequelize = require('sequelize');
var MySQLSessionStore = require('connect-mysql-session')(express);

var sequelize = new Sequelize(config.db.database, config.db.user, config.db.pass, config.db.opt);
var Models = sequelize.import(__dirname + '/models.js');

var Student = Models.Student;
var Module = Models.Module;
var ModuleDepartment = Models.ModuleDepartment;
var Career = Models.Career;
var Faculty = Models.Faculty;
var Course = Models.Course;

passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(user, done) {
    done(null, user);
});

passport.use(new OpenIDStrategy({
        providerURL: 'https://openid.nus.edu.sg/',
        returnURL: 'http://'+config.server.host+'/auth/openid/return',
        realm: 'http://'+config.server.host+'/',
        stateless: true,
        profile: true
    },
    function(identifier, profile, done) {
        profile.id = identifier.split('/').pop();
        done(null, profile);
    }
));

var assets = require('./assets');

// set up express
var app = express();
var server = http.createServer(app);
app.use(cachify.setup(assets, {
    root: __dirname + "/public",
    production: false
}));
app.engine('html', ejs.renderFile);
app.use(express.static(__dirname + '/public'));
app.use(etagify());
app.use(cookieParser());
app.use(bodyParser());
app.use(express.session({
    store: new MySQLSessionStore(config.db.database,
        config.db.user,
        config.db.pass,
        config.session.opt),
    secret: config.session.secret
}));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
app.use(app.router);

// serve frontend
server.listen(config.server.port, config.server.ip);
process.stdout.write('INFO:\tServer listening at port ' + config.server.port + '\n');

app.get('/', function(req, res) {
    if (config.auth && !req.isAuthenticated()) {
        res.redirect('/login');
        return;
    }

    res.etagify();

    var randoms = [
        'ALL YOUR DATABASE ARE BELONG TO US',
        'Nothing is beyond our reach',
        'Protecting NUS from terrorists since 2013',
        'Hide your kids, hide your wife',
        'Wow. So stalk. Much creep.',
        'You come here often, huh',
        'Yep, this will definately make her love you',
        'Now with 50% more stalk, per stalk',
        'The Google of NUS',
        'Has anyone really been far even as decided to use even go want to do look more like?',
        'What does the fox say?',
        'What\'s the meaning of Stongehenge?',
        'Drive a Civic. It\'s a car you can trust'
    ];
    res.render('main.ejs', {
        messages: req.flash('error'),
        random: _.sample(randoms)
    });
});

function prependPlusToQuery(q) {
    return _.map(q.match(/\w+|"[^"]+"/g), function(x) {
        if (x.length > 0 && x[0] == '-') return;
        return '+'+x;
    }).join(' ');
}

app.get('/search', function(req, res) {
    if (config.auth && !req.isAuthenticated()) {
        res.redirect('/login');
        return;
    }

    res.etagify();

    if (!req.query.q) {
        req.flash('error', 'You must give a search term to query');
        res.redirect('/');
        return;
    }

    req.query.q = req.query.q.replace(/^\s+|\s+$/g, '');

    if (req.query.q.length < 4) {
        req.flash('error', 'Query is too short (must be at least 4 characters long)');
        res.redirect('/');
        return;
    }

    if (req.query.q.toUpperCase().indexOf('DROP TABLE') != -1) {
        res.redirect('/bobby.txt');
        return;
    }

    Student.search(req.query.q).success(function(students) {
        Module.search(req.query.q).success(function(modules) {
            if (students.length === 1 && modules.length === 0) {
                res.redirect('/student/' + students[0].matric );
                return;
            } else if (modules.length === 1 && students.length === 0) {
                res.redirect('/module/' + modules[0].code );
                return;
            }

            res.render('search.ejs', {
                search: req.query.q,
                students: students,
                modules: modules,
                truncated: students.length == 100 || modules.length == 100
            });
        });
    });
});

app.get('/student/suggest', function(req, res) {
    if (config.auth && !req.isAuthenticated()) {
        res.redirect('/login');
        return;
    }

    res.etagify();

    Student.suggest(req.query.q).success(function(names) {
        var data = [];
        for (var i=0; i<names.length; i++) {
            var orig = names[i].displayName;
            var matric = names[i].matric;
            var name = names[i].displayName || '';
            var first = names[i].firstName || '';
            var last = names[i].lastName || '';

            name = name.replace(/[^\w\s]/gi,'');
            first = first.replace(/[^\w\s]/gi,'');
            last = last.replace(/[^\w\s]/gi,'');

            var tokens = _.without(_.union(name.split(' '), first.split(' '), last.split(' ')), '');

            data.push({
                value: orig,
                tokens: tokens,
                id: matric
            });
        }
        res.json(data);
    });
});

app.get('/student/:matric', function(req, res) {
    if (config.auth && !req.isAuthenticated()) {
        res.redirect('/login');
        return;
    }

    res.etagify();

    Student.find({
        where: { matric: req.params.matric },
        include: [Career, Faculty, Course, {
            model: Module,
            include: [ModuleDepartment]
        }],
        joinTableAttributes: ['year', 'semester']
    }).success(function(student) {
        if (!student) {
            res.send(404);
            return;
        }

        if (student.courses.length > 0) {
            var coursesGrouped = _.groupBy(student.courses, function(c) {
                return c.studentCourse.year * 100 + c.studentCourse.semester;
            });

            var maxKey = _.max(_.keys(coursesGrouped));
	    student.courses = coursesGrouped[maxKey];
        }

        student.similarStudents().success(function(similarModules) {
            res.render('student.ejs', {
                student: student,
                similarModules: similarModules
            });
        });
    });
});

app.get('/student/:matric/graph.json', function(req, res) {
    if (config.auth && !req.isAuthenticated()) {
        res.redirect('/login');
        return;
    }

    res.etagify();

    Student.find({
        where: { matric: req.params.matric },
        include: [Module]
    }).success(function(student) {
        if (!student) {
            res.send(404);
            return;
        }

        var groupCount = 1;

        var studentIndex = {};
        var graph = {
            nodes: [
                {
                    name: student.displayName,
                    group: 0
                }
            ],
            links: []
        };

        studentIndex[student.matric] = 0;

        student.similarStudents(20).success(function(students) {
            function iter(students) {
                if (_.isEmpty(students)) {
                    res.json(graph);
                    return;
                }

                var student = _.first(students);
                if (studentIndex[student.matric] === undefined) {
                    graph.nodes.push({
                        name: student.displayName,
                        group: groupCount++
                    });

                    studentIndex[student.matric] = graph.nodes.length-1;
                }

                graph.links.push({
                    source: 0,
                    target: studentIndex[student.matric],
                    value: 1+1/student.common
                });


                Student.similarStudents(student.id, 20).success(function(students2) {
                    for (var i=0; i<students2.length; i++) {
                        var student2 = students2[i];

                        if (studentIndex[student.matric] === 0) {
                            continue;
                        }

                        if (studentIndex[student2.matric] === undefined) {
                            graph.nodes.push({
                                name: student2.displayName,
                                group: graph.nodes[studentIndex[student.matric]].group
                            });

                            studentIndex[student2.matric] = graph.nodes.length-1;
                        }

                        graph.links.push({
                            source: studentIndex[student.matric],
                            target: studentIndex[student2.matric],
                            value: 1+1/student2.common
                        });
                    }

                    iter(_.rest(students));
                });
            }

            iter(students);
        });

        /*

        var moduleIndex = {};
        var studentIndex = {};

        var graph = {
            nodes: [
                {
                    name: student.displayName,
                    group: 0,
                }
            ],
            links: []
        };

        studentIndex[student.matric] = 0;

        for (var i=0; i<student.modules.length; i++) {
            var module = student.modules[i];
            graph.nodes.push({
                name: module.code,
                group: module.ModuleDepartmentId
            });

            moduleIndex[module.code] = graph.nodes.length-1;

            graph.links.push({
                source: 0,
                target: moduleIndex[module.code],
                value: 2
            });
        }

        student.similarStudents(25).success(function(students) {
            function iter(students) {
                if (_.isEmpty(students)) {
                    res.json(graph);
                    return;
                }

                var student = _.first(students);

                Student.find({
                    where: { matric: student.matric },
                    include: [Module]
                }).success(function(student) {
                    graph.nodes.push({
                        name: student.displayName,
                        group: 0
                    });

                    studentIndex[student.matric] = graph.nodes.length-1;

                    for (var i=0; i<student.modules.length; i++) {
                        var module = student.modules[i];

                        if (moduleIndex[module.code] !== undefined) {
                            graph.links.push({
                                source: studentIndex[student.matric],
                                target: moduleIndex[module.code]
                            });

                            continue;
                        }

                        graph.nodes.push({
                            name: module.code,
                            group: module.ModuleDepartmentId
                        });

                        moduleIndex[module.code] = graph.nodes.length-1;

                        graph.links.push({
                            source: studentIndex[student.matric],
                            target: moduleIndex[module.code],
                            value: 1
                        });
                    }

                    iter(_.rest(students));
                });
            }

            iter(students);
        });*/
    });
});

app.get('/module/suggest', function(req, res) {
    if (config.auth && !req.isAuthenticated()) {
        res.redirect('/login');
        return;
    }

    res.etagify();

    Module.suggest(req.query.q).success(function(modules) {
        var data = [];
        for (var i=0; i<modules.length; i++) {
            var name = modules[i].name || '';
            var code = modules[i].code;
            var tokens = _.union(name.split(' '), code);

            data.push({
                value: code + ' ' + name,
                tokens: tokens,
                id: code
            });
        }
        res.json(data);
    });
});

app.get('/module/:code', function(req, res) {
    if (config.auth && !req.isAuthenticated()) {
        res.redirect('/login');
        return;
    }

    res.etagify();

    Module.find({
        where: { code: req.params.code },
        include: [ModuleDepartment, {
            model: Student,
            include: [Faculty]
        }]
    }).success(function(module) {
        if (!module) {
            res.send(404);
            return;
        }

        module.alsoTook().success(function(alsoTook) {
            res.render('module.ejs', {
                module: module,
                alsoTook: alsoTook
            });
        });
    });
});

app.get('/login', function(req, res) {
    if (!config.auth || req.isAuthenticated()) {
        res.redirect('/');
        return;
    }
    res.etagify();
    res.render('login.ejs');
});

app.get('/logout', function(req, res) {
   req.logout();
   res.redirect('/');
});

app.post('/auth/openid', passport.authenticate('openid'));

app.get('/auth/openid/return', passport.authenticate('openid', {
    successRedirect: '/',
    failureRedirect: '/login'
}));

app.get('/forbidden', function (req, res) {
    res.render('forbidden.ejs');
});
