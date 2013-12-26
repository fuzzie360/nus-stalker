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

var sequelize = new Sequelize(config.db.database, config.db.user, config.db.pass, config.db.opt);
var Models = sequelize.import(__dirname + '/models.js');

var Student = Models.Student;
var Module = Models.Module;
var ModuleDepartment = Models.ModuleDepartment;
var Career = Models.Career;
var Faculty = Models.Faculty;
var Course = Models.Course;

var auth = true;

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
app.use(express.session({ secret: 'stalker' }));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
app.use(app.router);

// serve frontend
server.listen(config.server.port, config.server.ip);
process.stdout.write('INFO:\tServer listening at port ' + config.server.port + '\n');

app.get('/', function(req, res) {
    if (auth && !req.isAuthenticated()) {
        res.redirect('/login');
        return;
    }
    res.render('main.ejs', { messages:req.flash('error') });
});

function prependPlusToQuery(q) {
    return _.map(q.split(' '), function(x) {
        return '+'+x;
    }).join(' ');
}

app.get('/suggest', function(req, res) {
    if (auth && !req.isAuthenticated()) {
        res.redirect('/login');
        return;
    }
    
    /*Student.findAll({
        attributes: ['displayName'],
        where: ['displayName like ?', '%' + req.query.q + '%'],
        limit: 10
    })*/
    sequelize.query('SELECT displayName,'
    +' MATCH (displayName) AGAINST (? IN NATURAL LANGUAGE MODE) AS relevance FROM Students'
    +' WHERE MATCH (displayName) AGAINST (? IN BOOLEAN MODE)'
    +' ORDER BY relevance DESC LIMIT 10', null, { raw:true }, [req.query.q+'*', prependPlusToQuery(req.query.q+'*')])
    .success(function(results) {
        var names = _.pluck(results, 'displayName');
        var data = [];
        for (var i=0; i<names.length; i++) {
            data.push({
                value: names[i],
                tokens: names[i].split(' ')
            });
        }
        res.json(data);
    });
});

app.get('/search', function(req, res) {
    if (auth && !req.isAuthenticated()) {
        res.redirect('/login');
        return;
    }
    
    if (!req.query.q || req.query.q.length < 4) {
        req.flash('error', 'Query is too short (must be at least 4 characters long)');
        res.redirect('/');
        return;
    }
    
    /*Student.findAll({
        where: ['MATCH (displayName) AGAINST (? IN BOOLEAN MODE)', req.query.q],
        include: [Faculty],
        limit: 200,
    })*/
    sequelize.query('SELECT Students.*, faculties.name AS `faculties.name`,'
    + ' faculties.id AS `faculties.id`, faculties.createdAt AS `faculties.createdAt`,'
    + ' faculties.updatedAt AS `faculties.updatedAt`,'
    + ' MATCH (displayName) AGAINST (? IN NATURAL LANGUAGE MODE) AS relevance FROM Students'
    + ' LEFT OUTER JOIN StudentFaculties ON Students.id = StudentFaculties.StudentId'
    + ' LEFT OUTER JOIN Faculties AS faculties ON faculties.id = StudentFaculties.FacultyId'
    + ' WHERE MATCH (displayName) AGAINST (? IN BOOLEAN MODE) HAVING relevance > 0.3'
    + ' ORDER BY relevance DESC LIMIT 200', null, { raw: true }, [req.query.q, prependPlusToQuery(req.query.q)])
    .success(function(results) {
        if (results.length == 1) {
            res.redirect('/person/' + results[0].matric );
            return;
        }
        
        res.render('results.ejs', {
            search: req.query.q,
            results: results,
            truncated: results.length == 200
        });
    });
});

app.get('/person/:matric', function(req, res) {
    if (auth && !req.isAuthenticated()) {
        res.redirect('/login');
        return;
    }

    Student.find({
        where: { matric: req.params.matric },
        include: [Career, Faculty, Course],
        joinTableAttributes: ['year', 'semester']
    }).success(function(person) {
        person.getModules().success(function(modules) {
            // shim because sequelize many-to-many eager loading is broken
            function iter(mods) {
                if (_.isEmpty(mods)) {
                    person.modules = modules;
                    res.render('person.ejs', { person:person });
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

app.get('/module/:code', function(req, res) {
    if (auth && !req.isAuthenticated()) {
        res.redirect('/login');
        return;
    }
    
    Module.find({
        where: { code: req.params.code },
        include: [ModuleDepartment]
    }).success(function(module) {
        console.dir(module);
        module.getStudents().success(function(students) {
            // shim because sequelize many-to-many eager loading is broken
            function iter(stus) {
                if (_.isEmpty(stus)) {
                    module.students = students;
                    res.render('module.ejs', { module:module });
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
    if (!auth || req.isAuthenticated()) {
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
