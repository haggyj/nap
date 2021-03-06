module.exports = function(grunt) {
  grunt.initConfig({
    uglify: {
      options: {
        beautify: {
          beautify: true
        , indent_level: 2
        }
      , mangle: false  
      }
    , nap: {
        files: {
          "nap.js": ["./src/nap.js", "./components/rhumb/rhumb.js"]
        }
      }
    }
  })

  grunt.loadNpmTasks("grunt-contrib-uglify")

  grunt.registerTask("default", ["uglify:nap"])
}