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
    });

    var Module = sequelize.define('Module', {
        dn: DataTypes.STRING,
        code: DataTypes.STRING,
        name: DataTypes.TEXT,
        description: DataTypes.TEXT,
        mc: DataTypes.INTEGER
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