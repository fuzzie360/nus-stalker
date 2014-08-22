var assets = require('./assets');

var _ = require('underscore');
var gulp = require('gulp'); 
var gutil = require('gulp-util'); 
var clean = require('gulp-clean');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var cleancss = require('gulp-minify-css');

gulp.task('clean', function () {  
  return gulp.src('public/build', {read: false})
    .pipe(clean())
});

gulp.task('js', function() {
  return gulp.src(_.map(assets['/build/script.js'], function(p) { return 'public'+p }))
    .pipe(concat('script.js'))
    .pipe(uglify())
    .pipe(gulp.dest('public/build'))
    .on('error', gutil.log)
});

gulp.task('css', function() {
  return gulp.src(_.map(assets['/build/style.css'], function(p) { return 'public'+p }))
    .pipe(concat('style.css'))
    .pipe(cleancss())
    .pipe(gulp.dest('public/build'))
});
