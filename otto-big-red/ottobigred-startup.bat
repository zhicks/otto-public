echo "This runs Otto Big Red. It should be located in otto-big-red. Make a shortcut to this file and put it in";
echo "C:\Users\Zack\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup";
echo "Hint: just type 'startup' in an Explorer title bar.
echo "Note that this doesn't run NPM start-prod, but instead just calls node. It's a bug with npm or something."
node otto-big-red.js prod;
pause;