'use strict';

/**
 * Compile Handlebars templates to HTML
 * Make content of data/FILENAME.json available to template engine
 */

var gulp = require('gulp'),
	errorHandler = require('gulp-unic-errors'),
	plumber = require('gulp-plumber'),
	size = require('gulp-size'),
	livereload = require('gulp-livereload'),
	util = require('gulp-util'),
	fs = require('fs'),
	path = require('path'),
	glob = require('glob'),
	_ = require('lodash'),
	tap = require('gulp-tap'),
	path = require('path'),
	unicHandlebars = require('gulp-unic-handlebars'),
	prettify = require('gulp-prettify');

gulp.task('html', function() {
	var data = {},
		defaultFileData = JSON.parse(fs.readFileSync('./source/data/default.json')),
		icons = _.map(glob.sync('./source/{assets/media/,modules/**/}icons/*'), function(file) {
			return path.basename(file).replace(path.extname(file), '');
		});

	return gulp.src([
			'./source/{,pages/,modules/**/,styleguide/sections/}!(_)*.hbs'
		])
		.pipe(tap(function(file) {
			var fileName = path.relative('./source/', file.path).replace(path.extname(file.path), '').replace(/\\/g, '/'),
				dataFile = util.replaceExtension(file.path, '.json'),
				fileData = {
					previewUrl: util.replaceExtension(fileName, '.html')
				},
				modulePrepend = new Buffer('{{#extend "styleguide/layouts/module"}}{{#replace "content"}}'),
				moduleAppend = new Buffer('{{/replace}}{{/extend}}'),
				moduleData = {};

			// Find JSON file with the same name as the template
			if (fs.existsSync(dataFile)) {
				try {
					fileData = _.merge(fileData, JSON.parse(fs.readFileSync(dataFile)));
				} catch (err) {
					errorHandler({
						task: 'html',
						message: 'Error loading JSON "'+ path.relative('./source/', dataFile) +'": ' + err
					});
				}
			}

			if (file.path.indexOf('modules') !== -1) {
				fileData.isModule = true;
				fileData.code = file.contents.toString();

				// Wrap modules with custom layout for preview purposes
				file.contents = Buffer.concat([modulePrepend, file.contents, moduleAppend]);
			} else if (file.path.indexOf('styleguide') !== -1) {
				fileData.isStyleguide = true;

				for (var i = 0; i < icons.length; i++) {
					icons[i] = icons[i].replace(/\.[^/.]+$/, "");
				}

				fileData.icons = icons;
			} else {
				// Get module default data for pages
				_.each(glob.sync('./source/modules/**/*.json'), function(file) {
					var moduleName = path.basename(file, path.extname(file));

					if (fs.existsSync(file)) {
						try {
							moduleData[moduleName] = JSON.parse(fs.readFileSync(file));
						} catch (err) {
							errorHandler({
								task: 'html',
								message: 'Error loading JSON "'+ path.relative('./source/', file) +'": ' + err
							});
						}
					}
				});

				fileData.modules = moduleData;
			}

			// Save data for later use
			data[fileName] = _.merge({}, defaultFileData, fileData);
		}))
		.pipe(plumber())
		.pipe(unicHandlebars({
			data: function(filePath) {
				var fileName = path.relative('./source/', filePath).replace(path.extname(filePath), '').replace(/\\/g, '/');

				return data[fileName] || {};
			},
			partials: './source/{,layouts/,pages/,modules/**/,styleguide/**/}*.hbs',
			extension: '.html',
			cachePartials: false
		}).on('error', errorHandler))
		// .pipe(prettify({
		// 	indent_with_tabs: true,
		// 	max_preserve_newlines: 1
		// }))
		.pipe(gulp.dest('./build'))
		.on('end', function() {
			var templateData = _.merge({
					pages: [],
					modules: [],
					styleguide: []
				}, defaultFileData);

			// Sort by filename and split into pages and modules
			data = _.sortBy(data, function(value, key) {
				return key;
			}).map(function(value) {
				if (value.isModule) {
					templateData.modules.push(value);
				} else if (value.isStyleguide) {
					templateData.styleguide.push(value);
				} else {
					templateData.pages.push(value);
				}
			});

			// Create index for preview purposes
			gulp.src('./source/styleguide/index.hbs')
				.pipe(plumber())
				.pipe(unicHandlebars({
					extension: '.html',
					data: templateData,
					cachePartials: false
				}).on('error', errorHandler))
				.pipe(gulp.dest('./build'))
				.pipe(livereload({
					auto: false
				}));
		});
});