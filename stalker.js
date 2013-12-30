var config = require('./config');
var util = require('util');
var http = require('http')

var _ = require('underscore');
var express = require('express');
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

// set up express
var app = express();
var server = http.createServer(app);
app.engine('html', ejs.renderFile);
app.use(express.static('public'));
app.use(express.cookieParser());
app.use(express.bodyParser());
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
        'Drive a Civic. It\s a car you can trust'
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
    
    if (!req.query.q || req.query.q.length < 4) {
        req.flash('error', 'Query is too short (must be at least 4 characters long)');
        res.redirect('/');
        return;
    }
    
    if (req.query.q.toUpperCase().indexOf('DROP TABLE') != -1) {
        res.redirect('/bobby.txt');
        return;
    }
    
    /*Student.findAll({
        where: ['MATCH (displayName) AGAINST (? IN BOOLEAN MODE)', req.query.q],
        include: [Faculty],
        limit: 200,
    })*/
    sequelize.query('SELECT Students.*, faculties.name AS `faculties.name`, faculties.id AS `faculties.id`, '
    + ' MATCH (displayName, firstName, lastName) AGAINST (? IN NATURAL LANGUAGE MODE) AS relevance FROM Students'
    + ' LEFT OUTER JOIN StudentFaculties ON Students.id = StudentFaculties.StudentId'
    + ' LEFT OUTER JOIN Faculties AS faculties ON faculties.id = StudentFaculties.FacultyId'
    + ' WHERE MATCH (displayName, firstName, lastName) AGAINST (? IN BOOLEAN MODE) HAVING relevance > 0.3'
    + ' ORDER BY relevance DESC LIMIT 100', null, { raw: true }, [req.query.q, prependPlusToQuery(req.query.q)])
    .success(function(students) {
        
        sequelize.query('SELECT Modules.*, ModuleDepartments.name AS `department.name`,'
        +' MATCH (Modules.name) AGAINST (? IN NATURAL LANGUAGE MODE) AS relevance FROM Modules'
        +' LEFT OUTER JOIN ModuleDepartments ON ModuleDepartments.id = Modules.ModuleDepartmentId'
        +' WHERE MATCH (Modules.name) AGAINST (? IN BOOLEAN MODE) OR code LIKE ?'
        +' OR CONCAT_WS(" ", Modules.code, Modules.name) LIKE ?'
        +' ORDER BY relevance DESC LIMIT 100', null, { raw:true },
        [
            req.query.q,
            prependPlusToQuery(req.query.q),
            req.query.q,
            '%'+req.query.q+'%'
        ]).success(function(modules) {
            if (students.length == 1 && modules.length == 0) {
                res.redirect('/student/' + students[0].matric );
                return;
            } else if (modules.length == 1 && students.length == 0) {
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
    
    /*Student.findAll({
        attributes: ['displayName'],
        where: ['displayName like ?', '%' + req.query.q + '%'],
        limit: 10
    })*/
    sequelize.query('SELECT matric, displayName, firstName, lastName,'
    +' MATCH (displayName, firstName, lastName) AGAINST (? IN NATURAL LANGUAGE MODE) AS relevance FROM Students'
    +' WHERE MATCH (displayName, firstName, lastName) AGAINST (? IN BOOLEAN MODE)'
    +' ORDER BY relevance DESC LIMIT 10', null, { raw:true }, [req.query.q+'*', prependPlusToQuery(req.query.q)+'*'])
    .success(function(names) {
        var data = [];
        for (var i=0; i<names.length; i++) {
            var orig = names[i].displayName;
            var matric = names[i].matric;
            var name = names[i].displayName || '';
            var first = names[i].firstName || '';
            var last = names[i].lastName || '';
            
            name = name.replace(/[^\w\s]/gi,'');
            first = first.replace(/[^\w\s]/gi,'');
            last = last.replace(/[^\w\s]/gi,'')
            
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

    Student.find({
        where: { matric: req.params.matric },
        include: [Career, Faculty, Course],
        joinTableAttributes: ['year', 'semester']
    }).success(function(student) {
        if (!student) {
            res.send(404);
            return;
        }
        
        student.getModules().success(function(modules) {
            // shim because sequelize many-to-many eager loading is broken
            function iter(mods) {
                if (_.isEmpty(mods)) {
                    student.modules = modules;
                    
                    sequelize.query('SELECT s.matric, s.displayName, intersection.cnt AS common,'
                    +' CASE WHEN not_in.cnt is null'
                    +' THEN intersection.cnt / (SELECT COUNT(ModuleId) FROM StudentModules WHERE StudentId = ?)'
                    +' ELSE intersection.cnt / (not_in.cnt + (SELECT COUNT(ModuleId) FROM StudentModules WHERE StudentId = ?))'
                    +' END AS jaccardIndex'
                    +' FROM Students s'
                    +' INNER JOIN (SELECT StudentId, COUNT(*) AS cnt FROM StudentModules WHERE ModuleId IN (SELECT ModuleId FROM StudentModules WHERE StudentId = ?)'
                    +' AND StudentId != ? GROUP BY StudentId) AS intersection'
                    +' ON s.id = intersection.StudentId'
                    +' LEFT JOIN (SELECT StudentId, COUNT(ModuleId) AS cnt FROM StudentModules WHERE StudentId != ? AND NOT ModuleId IN'
                    +' (SELECT ModuleId FROM StudentModules WHERE StudentId = ?) GROUP BY StudentId) AS not_in'
                    +' ON s.id = not_in.StudentId ORDER BY jaccardIndex DESC LIMIT 10', 
                    null, { raw: true },
                    [
                        student.id,
                        student.id,
                        student.id,
                        student.id,
                        student.id,
                        student.id
                    ]).success(function(similarModules) {
                        res.render('student.ejs', {
                            student: student,
                            similarModules: similarModules
                        });
                    });
                    
                    return;
                }
                
                var module = _.first(mods);
                module.getModuleDepartment().success(function(d) {
                    if (!d) return iter(_.rest(mods));
                    
                    module.moduleDepartment = d;
                    iter(_.rest(mods));
                });
            }
            iter(modules);
        }); 
    });
});

app.get('/module/suggest', function(req, res) {
    if (config.auth && !req.isAuthenticated()) {
        res.redirect('/login');
        return;
    }
    
    sequelize.query('SELECT code, name,'
    +' MATCH (name) AGAINST (? IN NATURAL LANGUAGE MODE) AS relevance FROM Modules'
    +' WHERE MATCH (name) AGAINST (? IN BOOLEAN MODE) OR code LIKE ?'
    +' OR CONCAT_WS(" ", code, name) LIKE ?'
    +' ORDER BY relevance DESC LIMIT 10', null, { raw:true },
    [
        req.query.q+'*',
        prependPlusToQuery(req.query.q)+'*',
        req.query.q,
        req.query.q+'%'
    ]).success(function(modules) {
        var data = [];
        for (var i=0; i<modules.length; i++) {
            var name = modules[i].name || '';
            var code = modules[i].code;
            var tokens = _.union(name.split(' '), code)
            
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
    
    Module.find({
        where: { code: req.params.code },
        include: [ModuleDepartment]
    }).success(function(module) {
        if (!module) {
            res.send(404);
            return;
        }
        
        module.getStudents().success(function(students) {
            // shim because sequelize many-to-many eager loading is broken
            function iter(stus) {
                if (_.isEmpty(stus)) {
                    sequelize.query('SELECT code, name, mc, COUNT(*) count FROM StudentModules f'
                    +' INNER JOIN StudentModules s ON s.StudentId = f.StudentId'
                    +' LEFT OUTER JOIN Modules ON s.ModuleId = Modules.id'
                    +' WHERE f.ModuleId = ? AND s.ModuleId != ?'
                    +' GROUP BY s.ModuleId'
                    +' HAVING COUNT(*) > 1'
                    +' ORDER BY COUNT(*) DESC LIMIT 10', null, { raw:true },
                    [
                        module.id,
                        module.id
                    ]).success(function(alsoTook) {
                        module.students = students;
                        res.render('module.ejs', {
                            module: module,
                            alsoTook: alsoTook
                        });
                    })
                    
                    return;
                }
                
                var student = _.first(stus);
                student.getFaculties().success(function(f) {
                    if (!f) return iter(_.rest(stus));
                    
                    student.faculties = f;
                    iter(_.rest(stus));
                });
            }
            iter(students);
        });
    })
});

app.get('/login', function(req, res) {
    if (!config.auth || req.isAuthenticated()) {
        res.redirect('/');
        return;
    }
    res.render('login.ejs');
});

app.get('/logout', function(req, res) {
   req.logout(); 
   res.redirect('/');
});

app.post('/auth/openid', passport.authenticate('openid'));

app.get('/auth/openid/return', passport.authenticate('openid'), function(req, res) {
    /*var allowed = [ 'a0096836'];
    
    if (allowed.indexOf(req.user.id) < 0) {
        req.logout();
    }
    
    if (!req.isAuthenticated()) {
        res.redirect('/forbidden');
        return;
    }*/
    
    res.redirect('/');
});

app.get('/forbidden', function (req, res) {
    res.render('forbidden.ejs');
});


function appendChecksum(matric) {
    var sum = 0;
    for (var i=1; i<8; i++) {
        sum += parseInt(matric[i]);
    }
    var table = ['Y', 'X', 'W', 'U', 'R', 'N', 'M', 'L', 'J', 'H', 'E', 'A', 'B'];
    return matric + table[sum%13];
}
