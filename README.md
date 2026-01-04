# Browser-Vrm
View VRM models and play VRM animation files in the browser

I made this in like a week so it could be buggy in some areas

# Setup
1. Add models (.vrm files, v0 or v1) to the model folder
2. Add animation files (.vrma files) to the animations folder
3. Change the 'loadVrmToScene(modelPath, idleAnimation)' parameters inside of `src/viewer.js` to the path of your files
4. Inside of `src/index.html` find the div with class 'animation-panel' and then add options inside of the select tag (set the value to the file path and then add a name between the tag)

# Start
To start the project, run `src/index.html` with a live server- dependencies are added through a CDN so this is important. i use the VSCode extension called 'Live Server'
