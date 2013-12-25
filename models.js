module.exports = function(sequelize, DataTypes) {    
    var Student = sequelize.define('Student', {
        dn: DataTypes.STRING,
        matric: DataTypes.STRING,
        displayName: DataTypes.STRING,
        firstName: DataTypes.STRING,
        lastName: DataTypes.STRING,
        email: DataTypes.STRING,
        forwardTo: DataTypes.STRING,
        enrolledOn: DataTypes.INTEGER
    });

    var Module = sequelize.define('Module', {
        dn: DataTypes.STRING,
        code: DataTypes.STRING,
        name: DataTypes.STRING,
        description: DataTypes.TEXT,
        mc: DataTypes.INTEGER
    });
    
    var ModuleDepartment = sequelize.define('ModuleDepartment', {
        name: DataTypes.STRING
    });
    
    Module.belongsTo(ModuleDepartment);
    ModuleDepartment.hasMany(Module);

    var Career = sequelize.define('Career', {
        dn: DataTypes.STRING,
        name: DataTypes.STRING,
    });

    var Faculty = sequelize.define('Faculty', {
        name: DataTypes.STRING,
    });

    var Course = sequelize.define('Course', {
        dn: DataTypes.STRING,
        name: DataTypes.STRING,
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
        Career: Career,
        Faculty: Faculty,
        Course: Course,
        StudentModule: StudentModule
    };
}