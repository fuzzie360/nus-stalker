var _ = require('underscore');

function prependPlusToQuery(q) {
    return _.map(q.match(/\w+|"[^"]+"/g), function(x) {
        if (x.length > 0 && x[0] == '-') return;
        return '+'+x;
    }).join(' ');
}

module.exports = function(sequelize, DataTypes) {
    var Student = sequelize.define('Student', {
        dn: DataTypes.STRING,
        matric: DataTypes.STRING,
        displayName: DataTypes.TEXT,
        firstName: DataTypes.TEXT,
        lastName: DataTypes.TEXT,
        email: DataTypes.STRING,
        forwardTo: DataTypes.STRING,
        enrolledOn: DataTypes.INTEGER
    }, {
        classMethods: {
            search: function(query) {
                return sequelize.query('SELECT Students.*, faculties.name AS `faculties.name`, faculties.id AS `faculties.id`, ' +
                ' MATCH (displayName, firstName, lastName) AGAINST (? IN NATURAL LANGUAGE MODE) AS relevance FROM Students' +
                ' LEFT OUTER JOIN StudentFaculties ON Students.id = StudentFaculties.StudentId' +
                ' LEFT OUTER JOIN Faculties AS faculties ON faculties.id = StudentFaculties.FacultyId' +
                ' WHERE MATCH (displayName, firstName, lastName) AGAINST (? IN BOOLEAN MODE) HAVING relevance > 0.3' +
                ' ORDER BY relevance DESC LIMIT 100', null, { raw: true },
                [
                    query,
                    prependPlusToQuery(query)
                ]);
            },

            suggest: function(query) {
                return sequelize.query('SELECT matric, displayName, firstName, lastName,' +
                ' MATCH (displayName, firstName, lastName) AGAINST (? IN NATURAL LANGUAGE MODE) AS relevance FROM Students' +
                ' WHERE MATCH (displayName, firstName, lastName) AGAINST (? IN BOOLEAN MODE)' +
                ' ORDER BY relevance DESC LIMIT 10', null, { raw:true },
                [
                    query+'*',
                    prependPlusToQuery(query)+'*'
                ]);
            },

            similarStudents: function(id, _limit) {
                var limit = _limit || 10;
                return sequelize.query('SELECT s.id, s.matric, s.displayName, intersection.cnt AS common,' +
                ' CASE WHEN not_in.cnt IS NULL' +
                ' THEN intersection.cnt / (SELECT COUNT(ModuleId) FROM StudentModules WHERE StudentId = ?)' +
                ' ELSE intersection.cnt / (not_in.cnt + (SELECT COUNT(ModuleId) FROM StudentModules WHERE StudentId = ?))' +
                ' END AS jaccardIndex' +
                ' FROM Students s' +
                ' INNER JOIN (SELECT StudentId, COUNT(*) AS cnt FROM StudentModules WHERE ModuleId IN (SELECT ModuleId FROM StudentModules WHERE StudentId = ?)' +
                ' AND StudentId != ? GROUP BY StudentId) AS intersection' +
                ' ON s.id = intersection.StudentId' +
                ' LEFT JOIN (SELECT StudentId, COUNT(ModuleId) AS cnt FROM StudentModules WHERE StudentId != ? AND NOT ModuleId IN' +
                ' (SELECT ModuleId FROM StudentModules WHERE StudentId = ?) GROUP BY StudentId) AS not_in' +
                ' ON s.id = not_in.StudentId ORDER BY jaccardIndex DESC LIMIT ?',
                null, { raw: true },
                [
                    id,
                    id,
                    id,
                    id,
                    id,
                    id,
                    limit
                ]);
            }
        },
        instanceMethods: {
            similarStudents: function(_limit) {
                var id = this.id;
                var limit = _limit || 10;
                return sequelize.query('SELECT s.id, s.matric, s.displayName, intersection.cnt AS common,' +
                ' CASE WHEN not_in.cnt IS NULL' +
                ' THEN intersection.cnt / (SELECT COUNT(ModuleId) FROM StudentModules WHERE StudentId = ?)' +
                ' ELSE intersection.cnt / (not_in.cnt + (SELECT COUNT(ModuleId) FROM StudentModules WHERE StudentId = ?))' +
                ' END AS jaccardIndex' +
                ' FROM Students s' +
                ' INNER JOIN (SELECT StudentId, COUNT(*) AS cnt FROM StudentModules WHERE ModuleId IN (SELECT ModuleId FROM StudentModules WHERE StudentId = ?)' +
                ' AND StudentId != ? GROUP BY StudentId) AS intersection' +
                ' ON s.id = intersection.StudentId' +
                ' LEFT JOIN (SELECT StudentId, COUNT(ModuleId) AS cnt FROM StudentModules WHERE StudentId != ? AND NOT ModuleId IN' +
                ' (SELECT ModuleId FROM StudentModules WHERE StudentId = ?) GROUP BY StudentId) AS not_in' +
                ' ON s.id = not_in.StudentId ORDER BY jaccardIndex DESC LIMIT ?',
                null, { raw: true },
                [
                    id,
                    id,
                    id,
                    id,
                    id,
                    id,
                    limit
                ]);
            }
        }
    });

    var Module = sequelize.define('Module', {
        dn: DataTypes.STRING,
        code: DataTypes.STRING,
        name: DataTypes.TEXT,
        description: DataTypes.TEXT,
        mc: DataTypes.INTEGER
    }, {
        classMethods: {
            search: function(query) {
                return sequelize.query('SELECT Modules.*, ModuleDepartments.name AS `department.name`,' +
                ' MATCH (Modules.name) AGAINST (? IN NATURAL LANGUAGE MODE) AS relevance FROM Modules' +
                ' LEFT OUTER JOIN ModuleDepartments ON ModuleDepartments.id = Modules.ModuleDepartmentId' +
                ' WHERE MATCH (Modules.name) AGAINST (? IN BOOLEAN MODE) OR code LIKE ?' +
                ' OR CONCAT_WS(" ", Modules.code, Modules.name) LIKE ?' +
                ' ORDER BY relevance DESC LIMIT 100', null, { raw:true },
                [
                    query,
                    prependPlusToQuery(query),
                    query,
                    '%'+query+'%'
                ]);
            },

            suggest: function(query) {
                return sequelize.query('SELECT code, name,' +
                ' MATCH (name) AGAINST (? IN NATURAL LANGUAGE MODE) AS relevance FROM Modules' +
                ' WHERE MATCH (name) AGAINST (? IN BOOLEAN MODE) OR code LIKE ?' +
                ' OR CONCAT_WS(" ", code, name) LIKE ?' +
                ' ORDER BY relevance DESC LIMIT 10', null, { raw:true },
                [
                    query+'*',
                    prependPlusToQuery(query)+'*',
                    query,
                    query+'%'
                ]);
            },
        },
        instanceMethods: {
            alsoTook: function() {
                var id = this.id;
                return sequelize.query('SELECT code, name, mc, COUNT(*) count FROM StudentModules f' +
                ' INNER JOIN StudentModules s ON s.StudentId = f.StudentId' +
                ' LEFT OUTER JOIN Modules ON s.ModuleId = Modules.id' +
                ' WHERE f.ModuleId = ? AND s.ModuleId != ?' +
                ' GROUP BY s.ModuleId' +
                ' HAVING COUNT(*) > 1' +
                ' ORDER BY COUNT(*) DESC LIMIT 10', null, { raw:true },
                [
                    id,
                    id
                ]);
            }
        }
    });

    var ModuleDepartment = sequelize.define('ModuleDepartment', {
        name: DataTypes.TEXT
    });

    Module.belongsTo(ModuleDepartment);
    ModuleDepartment.hasMany(Module);

    var Career = sequelize.define('Career', {
        dn: DataTypes.STRING,
        name: DataTypes.TEXT,
    });

    var Faculty = sequelize.define('Faculty', {
        name: DataTypes.TEXT,
    });

    var Course = sequelize.define('Course', {
        dn: DataTypes.STRING,
        name: DataTypes.TEXT,
    });

    var StudentModule = sequelize.define('StudentModule', {
        year: DataTypes.INTEGER,
        semester: DataTypes.INTEGER
    });

    Student.hasMany(Module, { joinTableModel: StudentModule });
    Module.hasMany(Student, { joinTableModel: StudentModule });

    var StudentCareer = sequelize.define('StudentCareer', {
        year: DataTypes.INTEGER,
        semester: DataTypes.INTEGER
    });

    Student.hasMany(Career, { joinTableModel: StudentCareer });
    Career.hasMany(Student, { joinTableModel: StudentCareer });

    var StudentFaculty = sequelize.define('StudentFaculty', {
        year: DataTypes.INTEGER,
        semester: DataTypes.INTEGER
    });

    Student.hasMany(Faculty, { joinTableModel: StudentFaculty });
    Faculty.hasMany(Student, { joinTableModel: StudentFaculty });

    var StudentCourse = sequelize.define('StudentCourse', {
        year: DataTypes.INTEGER,
        semester: DataTypes.INTEGER
    });

    Student.hasMany(Course, { joinTableModel: StudentCourse });
    Course.hasMany(Student, { joinTableModel: StudentCourse });

    return {
        Student: Student,
        Module: Module,
        ModuleDepartment: ModuleDepartment,
        Career: Career,
        Faculty: Faculty,
        Course: Course
    };
}
