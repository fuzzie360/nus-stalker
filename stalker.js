var config = require('./config');
var util = require('util');
var http = require('http')

var express = require('express');
var ejs = require('ejs');
var passport = require('passport');
var OpenIDStrategy = require('passport-openid').Strategy;
var ldap = require('ldapjs');

var client = ldap.createClient({
	url:'ldap://ldapstu.nus.edu.sg:389',
	maxConnections: 5,
	timeout: 10000
});
client.bind(config.ldap.user, config.ldap.pass, function(err) {
    if (err) {
        console.log('Error binding to ldap');
        process.exit(1);
    }
});

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
		done(null, identifier);
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
app.use(passport.initialize());
app.use(passport.session());
app.use(app.router);

// serve frontend
server.listen(config.server.port, config.server.ip);
process.stdout.write('INFO:\tServer listening at port ' + config.server.port + '\n');

app.get('/', function(req, res){
    if (!req.isAuthenticated()) {
        res.redirect('/login');
    }
    res.render('main.ejs');
});

app.get('/search', function(req, eres){
    if (!req.isAuthenticated()) {
        eres.redirect('/login');
    }
    
    var baseDN = 'ou=Students,dc=stu,dc=nus,dc=edu,dc=sg';
    var search = {
        filter: '(displayName=*' + req.query.q + '*)',
        scope: 'sub'
    }
    
    client.search(baseDN, search, function(err, res) {
        var results = [];
        
        if (err) {
            eres.send(500);
            return;
        }
        
        res.on('searchEntry', function(entry) {
            results.push(entry.object);
        });
        
        res.on('error', function(err) {
            console.log(err.message);
        });
        
        res.on('end', function(result) {
            eres.render('results.ejs', {results:results, search:req.query.q});
        });
    });
});

app.get('/person', function(req, eres){
    if (!req.isAuthenticated()) {
        eres.redirect('/login');
    }
    
   var baseDN = 'ou=Students,dc=stu,dc=nus,dc=edu,dc=sg';
   var search = {
       filter: '(name=' + req.query.id + ')',
       scope: 'sub'
   }
   
   client.search(baseDN, search, function(err, res) {
       var person = {};
       var found = false;
       
       if (err) {
           eres.send(500);
           return;
       }
       
       res.on('searchEntry', function(entry) {
           person = entry.object;
           found = true;
       });
       
       res.on('error', function(err) {
           console.log(err.message);
       });
       
       res.on('end', function(result) {
           if (!found) return eres.send(404);

           person.career = '';
           person.course = '';
           
           person.modules = [];
           
           person.groups = [];
           if (!(person.memberOf instanceof Array)) {
               person.memberOf = [person.memberOf];
           }
           for (var i=0; i<person.memberOf.length; i++) {
               var group = person.memberOf[i];

               if (group.indexOf("DC=stf") !== -1) continue;
               switch (getGroupType(group)) {
                   case 'Careers':
                       person.career = group;
                       break;
                   case 'Courses':
                       person.course = group;
                       break;
                   case 'Modules':
                       person.modules.push(getModuleCode(group));
                       break;
                   default:
                       person.groups.push(group);
                       break;
               }
           }
           eres.render('person.ejs', {person:person});
       });
   });
});

app.get('/login', function(req, res){
	if (req.isAuthenticated()) {
		res.redirect('/');
		return;
	}
    res.render('login.ejs');
});

app.get('/logout', function(req, res){
   req.logout(); 
   res.redirect('/');
});

app.post('/auth/openid', passport.authenticate('openid'));

app.get('/auth/openid/return', passport.authenticate('openid'), function(req, res){
	if (!req.isAuthenticated()) {
		res.redirect('/forbidden');
		return;
	}
    
    res.redirect('/');
});

app.get('/forbidden', function (req, res){
    res.render('forbidden.ejs');
});

app.get('/api/getDisplayName', function (req, eres) {
    if(!req.query.dn) return eres.send('Not yet assigned');
    var baseDN = req.query.dn;
    var search = {
        filter: '(objectClass=*)',
        scope: 'base',
        attriutes: 'displayName'
    }
   try { 
    client.search(baseDN, search, function(err, res) {
        var displayName = '';
       
        if (err) {
            eres.send(500);
            return;
        }
       
        res.on('searchEntry', function(entry) {
            displayName = entry.object.displayName;
        });
       
        res.on('error', function(err) {
            console.log(err.message);
        });
       
        res.on('end', function(result) {
            eres.send(displayName);
            return;
        });
    });
    } catch(e) {
         eres.send('Error loading');
    }
});

function getGroupType(group) {
    var typeRegex = new RegExp("OU=(.*?),OU=Student,DC=stu,DC=nus,DC=edu,DC=sg");
    var match = typeRegex.exec(group);
    
    if (match) {
        return match[1];
    }
    return null;
}

function getModuleCode(group) {
    var moduleRegex = new RegExp("CN=MODULE(.*?),OU=Modules,OU=Student,DC=stu,DC=nus,DC=edu,DC=sg");
    var match = moduleRegex.exec(group);

    if (match) {
        return match[1];
    }
    return null;
}

function appendChecksum(matric) {
    var sum = 0;
    for (var i=1; i<8; i++) {
        sum += parseInt(matric[i]);
    }
    var table = ['Y', 'X', 'W', 'U', 'R', 'N', 'M', 'L', 'J', 'H', 'E', 'A', 'B'];
    return matric + table[sum%13];
}
